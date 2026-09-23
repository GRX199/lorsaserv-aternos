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
  }

  spawnWatcher() {
    if (this.isStopping) return;

    this.cleanup();

    const cmd = this.useSudo ? 'sudo' : 'journalctl';
    const args = this.useSudo
      ? ['-n', 'journalctl', '-u', 'minecraft-bedrock', '-f', '-n', '0']
      : ['-u', 'minecraft-bedrock', '-f', '-n', '0'];

    console.log(`[PlayerLogMonitor] Menjalankan pemantau log: ${cmd} ${args.join(' ')}`);

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
        if (str.includes('Permission denied') && !this.useSudo) {
          console.warn('[PlayerLogMonitor] Memerlukan izin sudo untuk journalctl. Berpindah ke mode sudo...');
          this.useSudo = true;
          this.scheduleRestart(1000);
        } else if (!str.includes('No entries') && !str.includes('-- Logs begin')) {
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
    this.logBuffer = [];
    this.cleanup();
  }

  /**
   * Menangani setiap baris log yang keluar dari Minecraft Bedrock Server
   * @param {string} line - Baris log dari journalctl
   */
  handleLogLine(line) {
    if (!line) return;

    // 1. Teruskan baris log ke buffer streaming Discord channel
    this.forwardLogToChannel(line);

    // 1.5. Deteksi In-Game Player Chat (dari Script API Behavior Pack)
    // Contoh format: [Scripting] [CHAT] <Steve> Halo semuanya!
    const chatMatch = line.match(/\[CHAT\]\s*<([^>]+)>\s*(.*)/i);
    if (chatMatch) {
      const sender = chatMatch[1].trim();
      const text = chatMatch[2].trim();
      if (sender && text) {
        console.log(`[PlayerLogMonitor] 💬 In-Game Chat Terdeteksi: <${sender}> ${text}`);
        this.forwardInGameChatToDiscord(sender, text);
        return;
      }
    }

    // 2. Deteksi Player Connected / Join
    // Contoh format log: [2026-09-24 00:20:15:123 INFO] Player connected: Steve, xuid: 2535467890123456
    const joinMatch = line.match(/Player connected:\s*([^,\n\r]+)/i);
    if (joinMatch) {
      let playerName = joinMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      if (playerName) {
        console.log(`[PlayerLogMonitor] 🟢 Player Join Terdeteksi: ${playerName}`);
        this.onlinePlayers.add(playerName);
        this.notifyPlayerChange('join', playerName);
        return;
      }
    }

    // 3. Deteksi Player Disconnected / Leave
    // Contoh format log: [2026-09-24 00:25:10:456 INFO] Player disconnected: Steve, xuid: 2535467890123456
    const leaveMatch = line.match(/Player disconnected:\s*([^,\n\r]+)/i);
    if (leaveMatch) {
      let playerName = leaveMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      if (playerName) {
        console.log(`[PlayerLogMonitor] 🔴 Player Leave Terdeteksi: ${playerName}`);
        this.onlinePlayers.delete(playerName);
        this.notifyPlayerChange('leave', playerName);
        return;
      }
    }

    // 4. Reset jika server berhenti / dimatikan
    if (line.includes('Server stop') || line.includes('Quit command received') || line.includes('Stopping server')) {
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

    const channelId = this.config.chatBridgeChannelId
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

    if (!targetChannel || !targetChannel.isTextBased()) return;

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
}

module.exports = {
  PlayerLogMonitor
};
