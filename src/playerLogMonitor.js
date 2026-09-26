const { spawn } = require('node:child_process');
const readline = require('node:readline');

/**
 * Memantau log Bedrock Dedicated Server secara real-time via journalctl
 * untuk mendeteksi event pemain bergabung/keluar serta streaming log konsol ke Discord.
 */
class PlayerLogMonitor {
  constructor(statusManager, config) {
    this.statusManager = statusManager;
    this.config = config;
    this.process = null;
    this.rl = null;
    this.onlinePlayers = new Set();
    this.retryTimer = null;
    this.isStopping = false;
    this.useSudo = false;
    this.logBuffer = [];
    this.flushTimer = null;
    this.inventoryCallbacks = new Map();
    this.locationCallbacks = new Map();
  }

  /**
   * Mengembalikan array nama-nama pemain yang sedang online
   */
  getOnlinePlayers() {
    return Array.from(this.onlinePlayers);
  }

  /**
   * Memulai pemantauan log
   */
  start() {
    if (process.platform !== 'linux') {
      console.log('[PlayerLogMonitor] Sistem bukan Linux. Pemantauan log journalctl dilewati.');
      return;
    }

    const logChannelId = this.statusManager?.getLogChannelId();
    console.log(`[PlayerLogMonitor] Memulai pemantauan log journalctl. Target channel log: ${logChannelId || 'Belum diatur'}`);

    this.isStopping = false;
    this.spawnWatcher();

    if (logChannelId) {
      setTimeout(() => {
        this.sendStartupLogMessage();
      }, 3000);
    }

    // Kirim perintah 'list' ke konsol server setelah 4 detik untuk sinkronisasi daftar pemain yang sudah online sebelumnya
    setTimeout(() => {
      try {
        const { sendConsoleCommand } = require('./serverController');
        sendConsoleCommand('list');
      } catch {}
    }, 4000);

    // Sinkronkan berkala setiap 3 menit
    if (this.listSyncTimer) clearInterval(this.listSyncTimer);
    this.listSyncTimer = setInterval(() => {
      if (!this.isStopping) {
        try {
          const { sendConsoleCommand } = require('./serverController');
          sendConsoleCommand('list');
        } catch {}
      }
    }, 3 * 60 * 1000);
  }

  getLogFilePath() {
    const fs = require('node:fs');
    const path = require('node:path');
    const homeDir = process.env.HOME || '/home/ubuntu';
    const candidates = [
      path.join(homeDir, 'bedrock-server', 'server.log'),
      path.join(homeDir, 'bedrock-server', 'screenlog.0'),
      path.join(homeDir, 'bedrock-server', 'bedrock_server.log'),
    ];

    // Cari file log yang ada dan memiliki isi (size > 0) dengan mtime terbaru
    let bestFile = null;
    let bestMtime = 0;

    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          if (stats.size > 0 && stats.mtimeMs > bestMtime) {
            bestFile = file;
            bestMtime = stats.mtimeMs;
          }
        }
      } catch {}
    }

    if (bestFile) return bestFile;

    // Fallback jika semua masih 0 byte
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return file;
      }
    }

    const bedrockDir = path.join(homeDir, 'bedrock-server');
    if (fs.existsSync(bedrockDir)) {
      try {
        const defaultLog = path.join(bedrockDir, 'server.log');
        fs.writeFileSync(defaultLog, '', { flag: 'a' });
        return defaultLog;
      } catch {}
    }
    return null;
  }

  spawnWatcher() {
    if (this.isStopping) return;

    this.cleanup();

    const logFile = this.getLogFilePath();
    let cmd, args;

    if (logFile) {
      cmd = 'tail';
      args = ['-F', '-n', '0', logFile];
      console.log(`[PlayerLogMonitor] Memantau file log langsung: ${cmd} ${args.join(' ')}`);
    } else {
      cmd = this.useSudo ? 'sudo' : 'journalctl';
      args = this.useSudo
        ? ['-n', 'journalctl', '-u', 'minecraft-bedrock', '-u', 'minecraft-paper', '-f', '-n', '0']
        : ['-u', 'minecraft-bedrock', '-u', 'minecraft-paper', '-f', '-n', '0'];
      console.log(`[PlayerLogMonitor] Menjalankan pemantau log systemd: ${cmd} ${args.join(' ')}`);
    }

    try {
      this.process = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      this.rl = readline.createInterface({
        input: this.process.stdout,
        terminal: false
      });

      this.rl.on('line', (line) => {
        this.handleLogLine(line);
      });

      this.process.stderr.on('data', (data) => {
        const str = data.toString();
        if ((str.includes('Permission denied') || str.includes('Hint:') || str.includes('systemd-journal')) && !this.useSudo) {
          console.warn('[PlayerLogMonitor] Memerlukan izin sudo untuk journalctl. Berpindah ke mode sudo...');
          this.useSudo = true;
          this.scheduleRestart(1000);
        } else if (!str.includes('No entries') && !str.includes('-- Logs begin') && !str.includes('Hint:')) {
          console.warn('[PlayerLogMonitor] log error:', str.trim());
        }
      });

      this.process.on('error', (err) => {
        console.warn('[PlayerLogMonitor] Error pada proses watcher:', err.message);
        this.scheduleRestart(5000);
      });

      this.process.on('close', (code) => {
        if (!this.isStopping) {
          console.warn(`[PlayerLogMonitor] Watcher terhenti (exit code: ${code}). Memulai ulang dalam 5s...`);
          this.scheduleRestart(5000);
        }
      });
    } catch (err) {
      console.error('[PlayerLogMonitor] Gagal spawn proses:', err.message);
      this.scheduleRestart(5000);
    }
  }

  scheduleRestart(ms = 5000) {
    if (this.isStopping) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.spawnWatcher();
    }, ms);
  }

  cleanup() {
    if (this.rl) {
      try { this.rl.close(); } catch {}
      this.rl = null;
    }
    if (this.process) {
      try { this.process.kill(); } catch {}
      this.process = null;
    }
  }

  stop() {
    this.isStopping = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.listSyncTimer) {
      clearInterval(this.listSyncTimer);
      this.listSyncTimer = null;
    }
    this.logBuffer = [];
    this.cleanup();
  }

  /**
   * Menangani setiap baris log yang keluar dari Minecraft Bedrock Server
   * @param {string} line - Baris log dari journalctl
   */
  handleLogLine(line) {
    if (!line) return;

    // 0. Deteksi Respon Inventory dari Script Engine BDS: [INV_RES] {...}
    if (line.includes('[INV_RES]')) {
      const idx = line.indexOf('[INV_RES]');
      let jsonStr = line.substring(idx + 9).trim();
      const startJson = jsonStr.indexOf('{');
      const endJson = jsonStr.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1) {
        jsonStr = jsonStr.substring(startJson, endJson + 1);
      }
      try {
        const data = JSON.parse(jsonStr);
        this.handleInventoryResponse(data);
      } catch (err) {
        console.warn('[PlayerLogMonitor] Gagal parse [INV_RES]:', err.message);
      }
      return;
    }

    // 0.5. Deteksi Respon Lokasi/Koordinat dari Script Engine BDS: [LOC_RES] {...}
    if (line.includes('[LOC_RES]')) {
      const idx = line.indexOf('[LOC_RES]');
      let jsonStr = line.substring(idx + 9).trim();
      const startJson = jsonStr.indexOf('{');
      const endJson = jsonStr.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1) {
        jsonStr = jsonStr.substring(startJson, endJson + 1);
      }
      try {
        const data = JSON.parse(jsonStr);
        this.handleLocationResponse(data);
      } catch (err) {
        console.warn('[PlayerLogMonitor] Gagal parse [LOC_RES]:', err.message);
      }
      return;
    }

    // 0.8. Deteksi Snapshot Pemain Real-Time: [PLAYER_SNAPSHOT] {...}
    if (line.includes('[PLAYER_SNAPSHOT]')) {
      const idx = line.indexOf('[PLAYER_SNAPSHOT]');
      let jsonStr = line.substring(idx + 17).trim();
      const startJson = jsonStr.indexOf('{');
      const endJson = jsonStr.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1) {
        jsonStr = jsonStr.substring(startJson, endJson + 1);
      }
      try {
        const data = JSON.parse(jsonStr);
        this.saveOfflinePlayerData(data);
      } catch {}
      return;
    }

    // 0.9. Deteksi Event Simpan/Hapus Warp dari Script In-Game: [WARP_SET] & [WARP_DEL]
    if (line.includes('[WARP_SET]')) {
      const idx = line.indexOf('[WARP_SET]');
      let jsonStr = line.substring(idx + 10).trim();
      const startJson = jsonStr.indexOf('{');
      const endJson = jsonStr.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1) {
        jsonStr = jsonStr.substring(startJson, endJson + 1);
      }
      try {
        const data = JSON.parse(jsonStr);
        const { warpManager } = require('./warpManager');
        warpManager.setWarp(data.name, data);
        console.log(`[PlayerLogMonitor] Titik warp '${data.name}' berhasil disinkronkan dari in-game oleh ${data.by || 'Admin'}`);
      } catch (err) {
        console.warn('[PlayerLogMonitor] Gagal parse [WARP_SET]:', err.message);
      }
      return;
    }

    if (line.includes('[WARP_DEL]')) {
      const idx = line.indexOf('[WARP_DEL]');
      let jsonStr = line.substring(idx + 10).trim();
      const startJson = jsonStr.indexOf('{');
      const endJson = jsonStr.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1) {
        jsonStr = jsonStr.substring(startJson, endJson + 1);
      }
      try {
        const data = JSON.parse(jsonStr);
        const { warpManager } = require('./warpManager');
        warpManager.deleteWarp(data.name);
        console.log(`[PlayerLogMonitor] Titik warp '${data.name}' berhasil dihapus via in-game oleh ${data.by || 'Admin'}`);
      } catch (err) {
        console.warn('[PlayerLogMonitor] Gagal parse [WARP_DEL]:', err.message);
      }
      return;
    }

    // 1. Teruskan baris log ke buffer streaming Discord channel
    this.forwardLogToChannel(line);

    // 1.5. Deteksi In-Game Player Chat (Bedrock Behavior Pack atau PaperMC)
    // Format Bedrock BDS: [Scripting] [CHAT] <Steve> Halo semuanya!
    // Format PaperMC: [12:34:56 INFO]: <Steve> Halo semuanya!
    let chatMatch = line.match(/\[CHAT\]\s*<([^>]+)>\s*(.*)/i);
    if (!chatMatch) {
      chatMatch = line.match(/(?:INFO\]:|\/INFO\]:)\s*<([a-zA-Z0-9_.* -]+)>\s+(.+)/);
    }
    if (chatMatch) {
      const sender = chatMatch[1].trim();
      const text = chatMatch[2].trim();
      // Jangan forward jika pesan dari bot / broadcast Discord untuk mencegah loop echo
      if (sender && text && !text.startsWith('[Discord]')) {
        const msgKey = `${sender}:${text}`;
        const now = Date.now();
        if (this.lastChatMessageKey === msgKey && (now - (this.lastChatMessageTime || 0)) < 1500) {
          return;
        }
        this.lastChatMessageKey = msgKey;
        this.lastChatMessageTime = now;

        console.log(`[PlayerLogMonitor] 💬 In-Game Chat Terdeteksi: <${sender}> ${text}`);
        this.forwardInGameChatToDiscord(sender, text);
        return;
      }
    }

    // 1.8. Deteksi Player Death (Bedrock Behavior Pack)
    // Format Bedrock BDS: [Scripting] [DEATH] <Steve> cause:fall killer:Zombie
    const deathMatch = line.match(/\[DEATH\]\s*<([^>]+)>\s*cause:([^\s]+)(?:\s*killer:(.*))?/i);
    if (deathMatch) {
      const victim = deathMatch[1].trim();
      const cause = deathMatch[2].trim();
      const killer = (deathMatch[3] || '').trim();
      console.log(`[PlayerLogMonitor] 💀 Player Death Terdeteksi: ${victim} (Penyebab: ${cause}, Killer: ${killer || 'none'})`);
      this.forwardDeathFeedToDiscord(victim, cause, killer);
      return;
    }

    // 1.9. Deteksi Output Perintah Konsol /list
    // Format BDS: There are 4/10 players online:
    // Player1, Player2, Player3, Player4
    // Atau PaperMC: There are 4 of a max of 20 players online: Player1, Player2
    const listMatch = line.match(/There are (\d+)(?:\/| of a max of )(\d+) players online:?(.*)/i);
    if (listMatch) {
      const count = parseInt(listMatch[1], 10) || 0;
      const inlineNames = (listMatch[3] || '').trim();
      if (count === 0) {
        this.onlinePlayers.clear();
        console.log('[PlayerLogMonitor] 📋 Konsol /list: 0 pemain online.');
        if (this.statusManager) this.statusManager.updatePresence();
      } else if (inlineNames) {
        const names = inlineNames.split(',').map(s => s.trim()).filter(Boolean);
        this.onlinePlayers.clear();
        for (const name of names) {
          this.onlinePlayers.add(name);
        }
        console.log(`[PlayerLogMonitor] 📋 Konsol /list mendeteksi ${names.length} pemain: ${names.join(', ')}`);
        if (this.statusManager) {
          this.statusManager.updatePresence();
        }
      } else {
        this.waitingForListNames = count;
      }
      return;
    }

    if (this.waitingForListNames) {
      const names = line.split(',').map(s => s.trim()).filter(Boolean);
      if (names.length > 0 && !line.includes('INFO') && !line.includes('WARN')) {
        this.onlinePlayers.clear();
        for (const name of names) {
          this.onlinePlayers.add(name);
        }
        console.log(`[PlayerLogMonitor] 📋 Konsol /list sinkronisasi nama pemain (${this.onlinePlayers.size}): ${names.join(', ')}`);
        this.waitingForListNames = 0;
        if (this.statusManager) {
          this.statusManager.updatePresence();
        }
        return;
      }
      this.waitingForListNames = 0;
    }

    // 2. Deteksi Player Connected / Join
    // Contoh BDS: Player connected: Steve, xuid: ...
    // Contoh Behavior Pack: [Scripting] [PLAYER_JOIN] Steve
    // Contoh PaperMC: Steve joined the game
    let joinMatch = line.match(/Player connected:\s*([^,\n\r]+)/i);
    if (!joinMatch) {
      joinMatch = line.match(/\[PLAYER_JOIN\]\s*([^\n\r]+)/i);
    }
    if (!joinMatch) {
      joinMatch = line.match(/(?:INFO\]:|\/INFO\]:)\s*([a-zA-Z0-9_.* -]+?)\s+joined the game/i);
    }
    if (joinMatch) {
      let playerName = joinMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      // Gamertag Xbox / Minecraft Bedrock dapat memiliki spasi dan panjang hingga 24 karakter
      if (playerName && playerName.length > 0 && playerName.length <= 24 && !playerName.includes('INFO') && !playerName.includes('WARN')) {
        const now = Date.now();
        if (this.lastJoinPlayer === playerName && (now - (this.lastJoinTime || 0)) < 3000) {
          return;
        }
        this.lastJoinPlayer = playerName;
        this.lastJoinTime = now;

        if (!this.onlinePlayers.has(playerName)) {
          console.log(`[PlayerLogMonitor] 🟢 Player Join Terdeteksi: ${playerName}`);
          this.onlinePlayers.add(playerName);
          this.notifyPlayerChange('join', playerName);
        }
        return;
      }
    }

    // 3. Deteksi Player Disconnected / Leave
    // Contoh BDS: Player disconnected: Steve, xuid: ...
    // Contoh Behavior Pack: [Scripting] [PLAYER_LEAVE] Steve
    // Contoh PaperMC: Steve left the game ATAU Steve lost connection: Disconnected
    let leaveMatch = line.match(/Player disconnected:\s*([^,\n\r]+)/i);
    if (!leaveMatch) {
      leaveMatch = line.match(/\[PLAYER_LEAVE\]\s*([^\n\r]+)/i);
    }
    if (!leaveMatch) {
      leaveMatch = line.match(/(?:INFO\]:|\/INFO\]:)\s*([a-zA-Z0-9_.* -]+?)\s+(?:left the game|lost connection:)/i);
    }
    if (leaveMatch) {
      let playerName = leaveMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      if (playerName && playerName.length > 0 && playerName.length <= 24 && !playerName.includes('INFO') && !playerName.includes('WARN')) {
        const now = Date.now();
        if (this.lastLeavePlayer === playerName && (now - (this.lastLeaveTime || 0)) < 3000) {
          return;
        }
        this.lastLeavePlayer = playerName;
        this.lastLeaveTime = now;

        console.log(`[PlayerLogMonitor] 🔴 Player Leave Terdeteksi: ${playerName}`);
        this.onlinePlayers.delete(playerName);
        this.notifyPlayerChange('leave', playerName);
        return;
      }
    }

    // 4. Reset jika server berhenti / dimatikan
    if (line.includes('Server stop') || line.includes('Quit command received') || line.includes('Stopping server') || line.includes('Closing Server')) {
      console.log('[PlayerLogMonitor] Server stopped terdeteksi. Mereset daftar pemain.');
      this.onlinePlayers.clear();
      if (this.statusManager) {
        this.statusManager.updateStatusEmbed().catch(() => {});
      }
    }
  }

  async notifyPlayerChange(type, playerName) {
    if (!this.statusManager) return;

    const servers = this.statusManager.getServers();
    // Catat sesi pemain ke PlaytimeTracker
    if (this.statusManager?.playtimeTracker) {
      if (type === 'join') {
        this.statusManager.playtimeTracker.recordJoin(playerName);
      } else if (type === 'leave') {
        this.statusManager.playtimeTracker.recordLeave(playerName);
      }
    }

    const vpsServer = servers.find(s => s.id === 'vps' || s.isLocal) || servers[0];

    // Kirim notifikasi embed ke channel Discord
    await this.statusManager.sendPlayerNotification(
      type,
      playerName,
      vpsServer,
      this.onlinePlayers.size
    ).catch(() => {});

    // Perbarui embed status secara instan agar daftar pemain langsung ter-refresh
    await this.statusManager.updateStatusEmbed().catch(() => {});
  }

  /**
   * Meneruskan pesan chat in-game Minecraft ke channel Discord (#chat-minecraft)
   * Menggunakan Webhook (dengan avatar skin pemain) atau pesan bot
   */
  async forwardInGameChatToDiscord(sender, text) {
    if (!this.statusManager?.client) return;

    const channelId = this.statusManager?.getChatBridgeChannelId()
      || this.config.chatBridgeChannelId
      || this.config.notifications?.chatBridge?.channelId
      || process.env.CHAT_BRIDGE_CHANNEL_ID;

    let targetChannel = null;

    if (channelId) {
      targetChannel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
    } else {
      // Cari channel bernama 'chat-minecraft' atau 'minecraft-chat' di server Discord
      for (const guild of this.statusManager.client.guilds.cache.values()) {
        const found = guild.channels.cache.find(c =>
          c.isTextBased() && (c.name === 'chat-minecraft' || c.name === 'minecraft-chat')
        );
        if (found) {
          targetChannel = found;
          break;
        }
      }
    }

    if (!targetChannel || !targetChannel.isTextBased()) {
      console.warn('[PlayerLogMonitor] ⚠️ Gagal meneruskan chat: Target Discord channel tidak ditemukan. Gunakan /setup-chat di Discord.');
      return;
    }

    console.log(`[PlayerLogMonitor] 📤 Meneruskan chat <${sender}> ke channel Discord: #${targetChannel.name} (${targetChannel.id})`);

    try {
      // Coba gunakan Discord Webhook agar muncul nama & kepala skin pemain langsung
      let webhook = null;
      if (targetChannel.fetchWebhooks) {
        const hooks = await targetChannel.fetchWebhooks().catch(() => null);
        webhook = hooks?.find(h => h.name === 'MinecraftChatBridge');
        if (!webhook && targetChannel.createWebhook) {
          webhook = await targetChannel.createWebhook({
            name: 'MinecraftChatBridge',
            reason: 'Minecraft 2-Way Chat Bridge'
          }).catch(() => null);
        }
      }

      if (webhook) {
        await webhook.send({
          content: text,
          username: `${sender} (Minecraft)`,
          avatarURL: `https://mc-heads.net/avatar/${encodeURIComponent(sender)}/128`
        }).catch(async () => {
          await targetChannel.send(`💬 **[Minecraft] ${sender}**: ${text}`).catch(() => {});
        });
      } else {
        await targetChannel.send(`💬 **[Minecraft] ${sender}**: ${text}`).catch(() => {});
      }
    } catch (err) {
      console.warn('[PlayerLogMonitor] Gagal meneruskan chat in-game ke Discord:', err.message);
    }
  }

  /**
   * Mengirimkan notifikasi kematian pemain (Death Feed) ke Discord
   */
  async forwardDeathFeedToDiscord(victim, cause, killer) {
    if (!this.statusManager?.client) return;

    const channelId = this.statusManager?.getChatBridgeChannelId()
      || this.config.chatBridgeChannelId
      || this.config.notifications?.chatBridge?.channelId
      || process.env.CHAT_BRIDGE_CHANNEL_ID;

    let targetChannel = null;
    if (channelId) {
      targetChannel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
    } else {
      for (const guild of this.statusManager.client.guilds.cache.values()) {
        const found = guild.channels.cache.find(c =>
          c.isTextBased() && (c.name === 'chat-minecraft' || c.name === 'minecraft-chat')
        );
        if (found) {
          targetChannel = found;
          break;
        }
      }
    }

    if (!targetChannel || !targetChannel.isTextBased()) return;

    // Terjemahkan penyebab kematian ke bahasa Indonesia
    let deathMessage = '';
    const cleanCause = (cause || '').toLowerCase();
    const cleanKiller = killer ? killer.replace(/_/g, ' ') : '';

    if (cleanCause === 'fall') {
      deathMessage = 'terpeleset dan jatuh dari tempat tinggi!';
    } else if (cleanCause === 'lava') {
      deathMessage = 'berenang di dalam kolam lahar panas!';
    } else if (cleanCause === 'drowning') {
      deathMessage = 'kehabisan nafas dan tenggelam di air!';
    } else if (cleanCause === 'entityattack' || cleanCause === 'entity_attack') {
      deathMessage = cleanKiller
        ? `gugur setelah diserang oleh **${cleanKiller}**!`
        : 'tewas diserang oleh monster!';
    } else if (cleanCause === 'projectile') {
      deathMessage = cleanKiller
        ? `ditembak jatuh oleh **${cleanKiller}**!`
        : 'tewas tertembak anak panah!';
    } else if (cleanCause === 'explosion') {
      deathMessage = 'hancur lebur terkena ledakan dahsyat!';
    } else if (cleanCause === 'fire' || cleanCause === 'fire_tick') {
      deathMessage = 'hangus terbakar api!';
    } else if (cleanCause === 'magic') {
      deathMessage = 'tewas terkena efek racun / sihir!';
    } else if (cleanCause === 'starve') {
      deathMessage = 'mati kelaparan karena kehabisan perbekalan!';
    } else if (cleanCause === 'suffocation') {
      deathMessage = 'terkubur hidup-hidup di dalam dinding blok!';
    } else if (cleanCause === 'void') {
      deathMessage = 'terperosok jatuh ke dalam jurang kehampaan (*The Void*)!';
    } else {
      deathMessage = `telah tewas (${cause || 'alasan tidak diketahui'})`;
    }

    try {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x992d22)
        .setDescription(`💀 **${victim}** ${deathMessage}`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(victim)}/64`)
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.warn('[PlayerLogMonitor] Gagal kirim death feed ke Discord:', err.message);
    }
  }

  /**
   * Memformat dan memasukkan baris log ke buffer streaming konsol Discord
   * @param {string} rawLine - Baris mentah dari journalctl
   */
  forwardLogToChannel(rawLine) {
    // Jika tidak ada channel log yang aktif, lewatkan agar hemat CPU
    const logChannelId = this.statusManager?.getLogChannelId();
    if (!logChannelId) return;

    let cleanLine = rawLine.trim();
    if (!cleanLine) return;

    // Bersihkan prefix systemd journald (misal: "Sep 24 00:16:39 VM-0-9-ubuntu bedrock_server[1165087]: ")
    const colonIdx = cleanLine.indexOf('bedrock_server[');
    if (colonIdx !== -1) {
      const afterBracket = cleanLine.indexOf(']: ', colonIdx);
      if (afterBracket !== -1) {
        cleanLine = cleanLine.substring(afterBracket + 3).trim();
      }
    }

    // Sederhanakan timestamp panjang: [2026-09-24 00:16:39:485 INFO] -> [00:16:39 INFO]
    cleanLine = cleanLine.replace(/\[\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2}):\d{3}\s+([A-Z]+)\]/, '[$1 $2]');

    // Saring log spam berulang yang tidak berguna
    if (
      cleanLine === '' ||
      cleanLine.startsWith('===') ||
      cleanLine.includes('how_to.html') ||
      cleanLine.includes('Server Telemetry is currently not enabled') ||
      cleanLine.includes('Enabling this telemetry helps us') ||
      cleanLine.includes('emit-server-telemetry=true')
    ) {
      return;
    }

    // Tambahkan styling warna ANSI untuk Discord
    // INFO = Hijau (\u001b[0;32m), WARN = Kuning (\u001b[0;33m), ERROR = Merah (\u001b[0;31m)
    let ansiLine = cleanLine;
    if (cleanLine.includes('INFO]')) {
      ansiLine = cleanLine.replace(/(\[[^\]]*INFO\])/, '\u001b[0;32m$1\u001b[0m');
    } else if (cleanLine.includes('WARN]')) {
      ansiLine = cleanLine.replace(/(\[[^\]]*WARN\])/, '\u001b[0;33m$1\u001b[0m');
    } else if (cleanLine.includes('ERROR]')) {
      ansiLine = cleanLine.replace(/(\[[^\]]*ERROR\])/, '\u001b[0;31m$1\u001b[0m');
    }

    this.logBuffer.push(ansiLine);
    this.scheduleBufferFlush();
  }

  /**
   * Menjadwalkan pengiriman log buffer secara berkala (batching anti rate-limit)
   */
  scheduleBufferFlush() {
    // Jika ukuran buffer sudah mendekati batas pesan Discord (~1200 karakter), flush sekarang
    const currentLen = this.logBuffer.reduce((acc, l) => acc + l.length + 1, 0);
    if (currentLen >= 1200) {
      this.flushLogBuffer();
      return;
    }

    // Jika belum ada timer aktif, tunggu 2 detik untuk mengumpulkan baris log berikutnya
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushLogBuffer();
      }, 2000);
    }
  }

  /**
   * Mengirim kumpulan baris log buffer ke Discord channel
   */
  async flushLogBuffer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.logBuffer.length === 0) return;

    const channelId = this.statusManager?.getLogChannelId();
    if (!channelId) {
      this.logBuffer = [];
      return;
    }

    const linesToSend = this.logBuffer.splice(0, this.logBuffer.length);

    try {
      const channel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      // Kelompokkan dalam potongan aman maksimal ~1700 karakter per pesan
      const chunks = [];
      let currentChunk = '';

      for (const line of linesToSend) {
        if ((currentChunk.length + line.length + 1) > 1700) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk = currentChunk ? (currentChunk + '\n' + line) : line;
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      for (const chunk of chunks) {
        await channel.send({
          content: `\`\`\`ansi\n${chunk}\n\`\`\``
        }).catch((err) => {
          console.warn('[PlayerLogMonitor] Gagal kirim log ke channel Discord:', err.message);
        });
      }
    } catch (err) {
      console.warn('[PlayerLogMonitor] Error saat mengirim log:', err.message);
    }
  }

  /**
   * Mengirimkan status koneksi konsol & 5 baris log server terakhir saat bot baru aktif
   */
  async sendStartupLogMessage() {
    const channelId = this.statusManager?.getLogChannelId();
    if (!channelId) return;

    try {
      const channel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        console.warn(`[PlayerLogMonitor] Channel log (${channelId}) tidak dapat diakses atau bukan text channel.`);
        return;
      }

      // Ambil 5 baris log terakhir agar channel langsung menampilkan aktivitas server
      let recentLogs = '';
      try {
        const fs = require('node:fs');
        const logFile = this.getLogFilePath();
        if (logFile && fs.existsSync(logFile)) {
          const raw = fs.readFileSync(logFile, 'utf8');
          const lines = raw.trim().split('\n').filter(l => l && !l.includes('how_to.html') && !l.includes('Telemetry'));
          recentLogs = lines.slice(-5).map(l => {
            const colonIdx = l.indexOf('bedrock_server[');
            if (colonIdx !== -1) {
              const after = l.indexOf(']: ', colonIdx);
              if (after !== -1) l = l.substring(after + 3);
            }
            return l.replace(/\[\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2}):\d{3}\s+([A-Z]+)\]/, '[$1 $2]');
          }).join('\n');
        } else {
          const { execSync } = require('node:child_process');
          const raw = execSync('journalctl -u minecraft-bedrock -n 5 --no-pager', { encoding: 'utf8', timeout: 4000 });
          const lines = raw.trim().split('\n').filter(l => l && !l.includes('how_to.html') && !l.includes('Telemetry'));
          recentLogs = lines.map(l => {
            const colonIdx = l.indexOf('bedrock_server[');
            if (colonIdx !== -1) {
              const after = l.indexOf(']: ', colonIdx);
              if (after !== -1) l = l.substring(after + 3);
            }
            return l.replace(/\[\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}:\d{2}):\d{3}\s+([A-Z]+)\]/, '[$1 $2]');
          }).join('\n');
        }
      } catch {}

      const msg = [
        `\`\`\`ansi`,
        `\u001b[0;32m[KONSOL AKTIF]\u001b[0m Terhubung ke konsol server Minecraft Bedrock VPS.`,
        recentLogs ? `\u001b[0;34m--- Log Terbaru Saat Ini ---\u001b[0m\n${recentLogs}` : '',
        `\`\`\``
      ].filter(Boolean).join('\n');

      await channel.send(msg).catch((err) => {
        console.warn('[PlayerLogMonitor] Gagal kirim startup log message:', err.message);
      });
      console.log(`[PlayerLogMonitor] Berhasil mengirim konfirmasi ke channel log ${channelId}`);
    } catch (err) {
      console.warn('[PlayerLogMonitor] Error sendStartupLogMessage:', err.message);
    }
  }

  /**
   * Mengirim scriptevent bot:inv <targetName> ke konsol server BDS
   * dan menunggu respon JSON [INV_RES]
   */
  /**
   * Menyimpan data snapshot pemain ke database offline_players.json
   */
  saveOfflinePlayerData(data) {
    if (!data || !data.name) return;
    const fs = require('node:fs');
    const path = require('node:path');
    const filePath = path.join(__dirname, '..', 'data', 'offline_players.json');
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let current = {};
      if (fs.existsSync(filePath)) {
        try { current = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
      }

      const key = data.name.toLowerCase().trim();
      current[key] = {
        ...(current[key] || {}),
        ...data,
        updatedAt: Date.now()
      };

      fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8');
    } catch (err) {
      console.warn('[PlayerLogMonitor] Gagal simpan offline_players.json:', err.message);
    }
  }

  /**
   * Mengambil data terakhir pemain yang tersimpan di offline_players.json
   */
  getOfflinePlayerData(playerName) {
    if (!playerName) return null;
    const fs = require('node:fs');
    const path = require('node:path');
    const filePath = path.join(__dirname, '..', 'data', 'offline_players.json');
    try {
      if (fs.existsSync(filePath)) {
        const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const key = playerName.toLowerCase().trim();
        return current[key] || null;
      }
    } catch {}
    return null;
  }

  /**
   * Mengirim scriptevent bot:inv <targetName> ke konsol server BDS
   * Jika pemain offline atau server mati, otomatis mengambil data terakhir dari database offline
   */
  async queryPlayerInventory(playerName, timeoutMs = 4000) {
    const { sendConsoleCommand } = require('./serverController');
    const target = playerName.trim();
    const key = target.toLowerCase();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.inventoryCallbacks.has(key)) {
          this.inventoryCallbacks.delete(key);
          const cached = this.getOfflinePlayerData(target);
          if (cached && (cached.armor || cached.hotbar || cached.storage)) {
            resolve({ ...cached, isOffline: true });
          } else {
            resolve({
              error: `Pemain **${target}** sedang offline dan belum memiliki riwayat inventory tersimpan di database.`
            });
          }
        }
      }, timeoutMs);

      this.inventoryCallbacks.set(key, (data) => {
        clearTimeout(timer);
        if (data.offline) {
          const cached = this.getOfflinePlayerData(target);
          if (cached && (cached.armor || cached.hotbar || cached.storage)) {
            resolve({ ...cached, isOffline: true });
          } else {
            resolve({
              error: `Pemain **${target}** sedang offline dan belum memiliki riwayat inventory tersimpan di database.`
            });
          }
        } else {
          this.saveOfflinePlayerData(data);
          resolve(data);
        }
      });

      const cmdResult = sendConsoleCommand(`scriptevent bot:inv ${target}`);
      if (!cmdResult.success) {
        clearTimeout(timer);
        this.inventoryCallbacks.delete(key);
        const cached = this.getOfflinePlayerData(target);
        if (cached && (cached.armor || cached.hotbar || cached.storage)) {
          resolve({ ...cached, isOffline: true });
        } else {
          resolve({
            error: `Server offline & pemain **${target}** belum memiliki data tersimpan.`
          });
        }
      }
    });
  }

  /**
   * Memproses respon [INV_RES] dari script engine Bedrock
   */
  handleInventoryResponse(data) {
    if (!data) return;
    if (data.name && !data.offline) this.saveOfflinePlayerData(data);

    // 1. Cocokkan berdasarkan nama pemain
    if (data.name) {
      const key = data.name.toLowerCase();
      const cb = this.inventoryCallbacks.get(key);
      if (cb) {
        this.inventoryCallbacks.delete(key);
        cb(data);
        return;
      }
    }

    // 2. Cocokkan jika respon memuat error dengan nama pemain
    if (data.error) {
      for (const [key, cb] of this.inventoryCallbacks.entries()) {
        if (data.error.toLowerCase().includes(key)) {
          this.inventoryCallbacks.delete(key);
          cb(data);
          return;
        }
      }
    }

    // 3. Fallback jika hanya ada 1 query yang sedang menunggu
    if (this.inventoryCallbacks.size === 1) {
      const [key, cb] = this.inventoryCallbacks.entries().next().value;
      this.inventoryCallbacks.delete(key);
      cb(data);
    }
  }

  /**
   * Mengirim scriptevent bot:locate <targetName> ke konsol server BDS
   * Jika pemain offline atau server mati, otomatis mengambil koordinat terakhir dari database offline
   */
  async queryPlayerLocation(playerName, timeoutMs = 4000) {
    const { sendConsoleCommand } = require('./serverController');
    const target = playerName.trim();
    const key = target.toLowerCase();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.locationCallbacks.has(key)) {
          this.locationCallbacks.delete(key);
          const cached = this.getOfflinePlayerData(target);
          if (cached && cached.x !== undefined) {
            resolve({ ...cached, isOffline: true });
          } else {
            resolve({
              error: `Pemain **${target}** sedang offline dan belum memiliki riwayat koordinat tersimpan di database.`
            });
          }
        }
      }, timeoutMs);

      this.locationCallbacks.set(key, (data) => {
        clearTimeout(timer);
        if (data.offline) {
          const cached = this.getOfflinePlayerData(target);
          if (cached && cached.x !== undefined) {
            resolve({ ...cached, isOffline: true });
          } else {
            resolve({
              error: `Pemain **${target}** sedang offline dan belum memiliki riwayat koordinat tersimpan di database.`
            });
          }
        } else {
          this.saveOfflinePlayerData(data);
          resolve(data);
        }
      });

      const cmdResult = sendConsoleCommand(`scriptevent bot:locate ${target}`);
      if (!cmdResult.success) {
        clearTimeout(timer);
        this.locationCallbacks.delete(key);
        const cached = this.getOfflinePlayerData(target);
        if (cached && cached.x !== undefined) {
          resolve({ ...cached, isOffline: true });
        } else {
          resolve({
            error: `Server offline & pemain **${target}** belum memiliki data koordinat tersimpan.`
          });
        }
      }
    });
  }

  /**
   * Memproses respon [LOC_RES] dari script engine Bedrock
   */
  handleLocationResponse(data) {
    if (!data) return;
    if (data.name && !data.offline) this.saveOfflinePlayerData(data);

    if (data.name) {
      const key = data.name.toLowerCase();
      const cb = this.locationCallbacks.get(key);
      if (cb) {
        this.locationCallbacks.delete(key);
        cb(data);
        return;
      }
    }

    if (data.error) {
      for (const [key, cb] of this.locationCallbacks.entries()) {
        if (data.error.toLowerCase().includes(key)) {
          this.locationCallbacks.delete(key);
          cb(data);
          return;
        }
      }
    }

    if (this.locationCallbacks.size === 1) {
      const [key, cb] = this.locationCallbacks.entries().next().value;
      this.locationCallbacks.delete(key);
      cb(data);
    }
  }
}

module.exports = {
  PlayerLogMonitor
};
