const fs = require('node:fs');
const path = require('node:path');
const { ActivityType, EmbedBuilder } = require('discord.js');
const { checkServerStatus } = require('./pinger');
const { createStatusEmbed, createStatusButtons } = require('./embeds');
const { isServerRunning } = require('./serverController');
const { PlaytimeTracker } = require('./playtimeTracker');
const { BackupManager } = require('./backupManager');
const { AutoRestart } = require('./autoRestart');

const STATE_FILE_PATH = path.join(__dirname, '..', 'data', 'state.json');

class StatusManager {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.serverStatuses = {};
    this.previousOnlineStates = {};
    this.statusTimer = null;
    this.channelNameTimer = null;
    this.lastChannelName = null;
    this.isUpdating = false;
    this.state = this.loadState();
    this.playtimeTracker = new PlaytimeTracker();
    this.backupManager = new BackupManager(this, this.config);
    this.autoRestart = new AutoRestart(this, this.config);
  }

  getServers() {
    if (this.config.servers && Array.isArray(this.config.servers) && this.config.servers.length > 0) {
      return this.config.servers;
    }
    return [{
      id: 'main',
      name: this.config.mcserver?.name || 'Minecraft Server',
      ip: this.config.mcserver?.ip || '127.0.0.1',
      port: this.config.mcserver?.port || 19132,
      type: this.config.mcserver?.type || 'bedrock',
      isLocal: process.platform === 'linux',
      icon: this.config.mcserver?.icon || null
    }];
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        const data = JSON.parse(raw);
        if (!data.serverMessages) {
          data.serverMessages = {};
          if (data.statusMessageId) {
            data.serverMessages['main'] = data.statusMessageId;
            data.serverMessages['vps'] = data.statusMessageId;
          }
        }
        return data;
      }
    } catch (err) {
      console.error('[StatusManager] Gagal membaca state.json:', err.message);
    }
    return { serverMessages: {}, statusChannelId: null };
  }

  saveState() {
    try {
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[StatusManager] Gagal menyimpan state.json:', err.message);
    }
  }

  getLatestStatus() {
    const servers = this.getServers();
    const vpsServer = servers.find(s => s.id === 'vps') || servers[0];
    return this.serverStatuses[vpsServer.id] || null;
  }

  /**
   * Mengambil ID channel untuk live log konsol
   */
  getLogChannelId() {
    return process.env.LOG_CHANNEL_ID
      || this.state.logChannelId
      || this.config.logChannelId
      || this.config.notifications?.consoleLog?.channelId
      || null;
  }

  /**
   * Menyimpan ID channel untuk live log konsol
   */
  setLogChannelId(channelId) {
    this.state.logChannelId = channelId;
    this.saveState();
  }

  /**
   * Mengambil status server dengan pengecekan ganda (UDP Ping + systemd fallback untuk VPS lokal)
   */
  async getStatusForServer(s) {
    const pingHost = (s.isLocal && process.platform === 'linux') ? '127.0.0.1' : s.ip;
    let status = await checkServerStatus(pingHost, s.port, s.type);

    // Jika server lokal VPS dan UDP belum merespon, periksa langsung ke systemd service
    if (s.isLocal && process.platform === 'linux' && !status.online) {
      try {
        const sysStatus = await isServerRunning();
        if (sysStatus.running) {
          status = {
            online: true,
            source: 'systemd-service',
            latencyMs: 1,
            host: s.ip,
            port: s.port,
            type: s.type,
            edition: 'Bedrock',
            motd: 'SASY199 • Minecraft Bedrock Server (Aktif)',
            version: '1.26.51',
            players: { online: 0, max: 10, list: [] },
            gamemode: 'Survival'
          };
        }
      } catch (err) {
        console.warn('[StatusManager] Gagal cek systemd service:', err.message);
      }
    }

    // Jika server lokal VPS dan ada pemain yang terdeteksi via PlayerLogMonitor
    if (s.isLocal && this.playerLogMonitor) {
      const livePlayers = this.playerLogMonitor.getOnlinePlayers();
      if (livePlayers.length > 0) {
        status.players = status.players || { max: 10 };
        status.players.list = livePlayers;
        if (status.online) {
          status.players.online = Math.max(status.players.online || 0, livePlayers.length);
        }
      }
    }

    return status;
  }

  /**
   * Menyiapkan live status messages di channel tertentu (dipanggil oleh /setup-status)
   */
  async setupStatusMessage(channel) {
    const servers = this.getServers();
    this.state.statusChannelId = channel.id;
    this.state.serverMessages = this.state.serverMessages || {};

    for (const s of servers) {
      const status = await this.getStatusForServer(s);
      this.serverStatuses[s.id] = status;
      this.previousOnlineStates[s.id] = status.online;

      const embed = createStatusEmbed(status, s, this.config);
      const buttons = createStatusButtons(s, Boolean(status?.online), this.config);

      const message = await channel.send({
        embeds: [embed],
        components: [buttons]
      });

      this.state.serverMessages[s.id] = message.id;
    }

    this.saveState();
    return true;
  }

  /**
   * Mengirim notifikasi chat ketika server baru saja Online atau Offline
   */
  async sendNotification(alertType, serverConfig, status) {
    const alertConfig = this.config.notifications?.[alertType];
    if (!alertConfig || !alertConfig.enabled) return;

    const channelId = alertConfig.channelId || process.env.STATUS_CHANNEL_ID || this.state.statusChannelId;
    if (!channelId) return;

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const isOnline = alertType === 'onlineAlert';
    const serverName = serverConfig.name;

    const embed = new EmbedBuilder()
      .setColor(isOnline ? (this.config.display?.colorOnline || '#2ECC71') : (this.config.display?.colorOffline || '#E74C3C'))
      .setTitle((alertConfig.title || '🎉 Server {name} Sudah Online!').replace('{name}', serverName))
      .setDescription(
        (alertConfig.message || 'Server **{name}** sudah aktif!')
          .replace(/{name}/g, serverName)
          .replace(/{ip}/g, serverConfig.ip)
          .replace(/{port}/g, serverConfig.port)
      )
      .addFields(
        { name: '📡 Alamat Server', value: `\`${serverConfig.ip}\``, inline: true },
        { name: '🔌 Port Bedrock', value: `\`${serverConfig.port}\``, inline: true },
        { name: '👥 Pemain', value: `\`${status.players?.online || 0} / ${status.players?.max || 20}\``, inline: true }
      )
      .setThumbnail(serverConfig.icon || null)
      .setTimestamp();

    const payload = {
      embeds: [embed],
      components: [createStatusButtons(serverConfig, isOnline, this.config)]
    };

    if (alertConfig.mention && alertConfig.mention.trim() !== '') {
      payload.content = alertConfig.mention.trim();
    }

    await channel.send(payload).catch((err) => {
      console.warn(`[StatusManager] Gagal kirim notifikasi ${alertType} untuk ${serverName}:`, err.message);
    });

    console.log(`[StatusManager] Berhasil mengirim notifikasi ${alertType} untuk ${serverName}!`);
  }

  /**
   * Mengirim notifikasi chat ketika ada pemain Masuk (Join) atau Keluar (Leave) server VPS
   * @param {'join' | 'leave'} type - Tipe notifikasi ('join' atau 'leave')
   * @param {string} playerName - Nama pemain
   * @param {object} serverConfig - Objek konfigurasi server
   * @param {number} currentCount - Jumlah pemain online saat ini
   */
  async sendPlayerNotification(type, playerName, serverConfig, currentCount = null) {
    const notifyConfig = this.config.notifications || {};
    const alertKey = type === 'join' ? 'playerJoin' : 'playerLeave';
    const alertConfig = notifyConfig[alertKey];

    // Jika notifikasi pemain dinonaktifkan secara eksplisit, abaikan
    if (alertConfig && alertConfig.enabled === false) return;

    const channelId = alertConfig?.channelId
      || notifyConfig.playerAlertChannelId
      || process.env.PLAYER_ALERT_CHANNEL_ID
      || process.env.STATUS_CHANNEL_ID
      || this.state.statusChannelId;

    if (!channelId) return;

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const isJoin = type === 'join';
    const serverName = serverConfig?.name || 'Minecraft Server';
    const maxPlayers = serverConfig?.isLocal ? 10 : 20;
    const countStr = currentCount !== null ? `${currentCount} / ${maxPlayers}` : null;
    const nowUnix = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor(isJoin ? '#2ECC71' : '#E74C3C')
      .setAuthor({
        name: isJoin ? '🟢 Player Bergabung' : '🔴 Player Keluar',
        iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/64`
      })
      .setTitle(isJoin ? `👋 ${playerName} masuk ke server!` : `🚪 ${playerName} keluar dari server.`)
      .setDescription(
        isJoin
          ? `Selamat datang **${playerName}** di **${serverName}**!`
          : `Sampai jumpa lagi **${playerName}**!`
      )
      .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/64`)
      .setTimestamp();

    if (countStr) {
      embed.addFields(
        { name: '👥 Pemain Online', value: `\`${countStr}\``, inline: true },
        { name: '⏰ Waktu', value: `<t:${nowUnix}:T>`, inline: true }
      );
    }

    embed.setFooter({
      text: `${serverName} • Notifikasi Pemain`,
      iconURL: serverConfig?.icon || undefined
    });

    const payload = { embeds: [embed] };
    if (alertConfig?.mention && alertConfig.mention.trim() !== '') {
      payload.content = alertConfig.mention.trim();
    }

    await channel.send(payload).catch((err) => {
      console.warn(`[StatusManager] Gagal kirim notifikasi player ${type} (${playerName}):`, err.message);
    });

    console.log(`[StatusManager] Berhasil kirim notifikasi player ${type}: ${playerName}`);
  }

  /**
   * Memperbarui embed status messages untuk semua server
   */
  async updateStatusEmbed() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const servers = this.getServers();
      const channelId = process.env.STATUS_CHANNEL_ID || this.state.statusChannelId;
      const channel = channelId ? await this.client.channels.fetch(channelId).catch(() => null) : null;

      this.state.serverMessages = this.state.serverMessages || {};

      for (const s of servers) {
        const status = await this.getStatusForServer(s);
        this.serverStatuses[s.id] = status;

        // 1. Deteksi perubahan status Online/Offline untuk notifikasi
        const prev = this.previousOnlineStates[s.id];
        if (prev !== undefined && prev !== null) {
          if (prev === false && status.online === true) {
            console.log(`[StatusManager] Server ${s.name} berubah: OFFLINE -> ONLINE!`);
            await this.sendNotification('onlineAlert', s, status);
          } else if (prev === true && status.online === false) {
            console.log(`[StatusManager] Server ${s.name} berubah: ONLINE -> OFFLINE!`);
            await this.sendNotification('offlineAlert', s, status);
          }
        }
        this.previousOnlineStates[s.id] = status.online;

        // 2. Update atau kirim Embed Message di Discord channel
        if (channel && channel.isTextBased()) {
          const embed = createStatusEmbed(status, s, this.config);
          const buttons = createStatusButtons(s, Boolean(status?.online), this.config);

          let message = null;
          const msgId = this.state.serverMessages[s.id];
          if (msgId) {
            message = await channel.messages.fetch(msgId).catch(() => null);
          }

          if (message) {
            await message.edit({
              embeds: [embed],
              components: [buttons]
            }).catch((err) => {
              console.warn(`[StatusManager] Gagal edit message untuk ${s.name}:`, err.message);
            });
          } else {
            const newMsg = await channel.send({
              embeds: [embed],
              components: [buttons]
            }).catch((err) => {
              console.warn(`[StatusManager] Gagal kirim message baru untuk ${s.name}:`, err.message);
              return null;
            });

            if (newMsg) {
              this.state.statusChannelId = channel.id;
              this.state.serverMessages[s.id] = newMsg.id;
              this.saveState();
            }
          }
        }
      }

      // 3. Update Bot Presence
      this.updatePresence();

    } catch (err) {
      console.error('[StatusManager] Error saat updateStatusEmbed:', err.message);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Mengupdate presence / activity bot di profil Discord
   */
  updatePresence() {
    if (!this.client.user) return;

    try {
      const servers = this.getServers();
      const vps = servers.find(s => s.id === 'vps');
      const aternos = servers.find(s => s.id === 'aternos');

      const vpsStatus = vps ? this.serverStatuses[vps.id] : null;
      const aternosStatus = aternos ? this.serverStatuses[aternos.id] : null;

      let presenceText = '';
      if (vpsStatus && vpsStatus.online) {
        presenceText = `VPS: 🟢 ${vpsStatus.players?.online || 0} pemain`;
        if (aternosStatus && aternosStatus.online) {
          presenceText += ` | Aternos: 🟢 ${aternosStatus.players?.online || 0}`;
        }
      } else if (aternosStatus && aternosStatus.online) {
        presenceText = `Aternos: 🟢 ${aternosStatus.players?.online || 0} pemain`;
      } else {
        presenceText = '🔴 Server Offline';
      }

      this.client.user.setPresence({
        status: (vpsStatus?.online || aternosStatus?.online) ? 'online' : 'idle',
        activities: [{ name: presenceText, type: ActivityType.Custom }]
      });
    } catch (err) {
      console.warn('[StatusManager] Gagal update presence:', err.message);
    }
  }

  /**
   * Mengupdate nama channel counter pemain (Voice/Text Channel)
   */
  async updatePlayerCountChannel() {
    const channelId = process.env.PLAYER_COUNT_CHANNEL_ID;
    if (!channelId) return;

    try {
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel) return;

      const servers = this.getServers();
      const vps = servers.find(s => s.id === 'vps') || servers[0];
      const status = this.serverStatuses[vps.id];

      let targetName = '';
      if (status && status.online) {
        targetName = (this.config.display?.onlineChannelName || '🟢・{online}/{max}-online')
          .replace('{online}', status.players?.online || 0)
          .replace('{max}', status.players?.max || 10);
      } else {
        targetName = this.config.display?.offlineChannelName || '🔴・offline';
      }

      if (this.lastChannelName === targetName || channel.name === targetName) {
        return;
      }

      await channel.setName(targetName).catch((err) => {
        console.warn('[StatusManager] Gagal mengganti nama channel:', err.message);
      });

      this.lastChannelName = targetName;
    } catch (err) {
      console.error('[StatusManager] Error updatePlayerCountChannel:', err.message);
    }
  }

  /**
   * Memulai interval update otomatis
   */
  start() {
    const embedSec = Math.max(30, this.config.intervals?.statusEmbedSeconds || 45);
    const channelMin = Math.max(5, this.config.intervals?.channelNameMinutes || 5);

    console.log(`[StatusManager] Memulai loop update embed multi-server setiap ${embedSec} detik.`);
    console.log(`[StatusManager] Memulai loop channel name setiap ${channelMin} menit.`);

    // Inisialisasi pemantau log pemain (PlayerLogMonitor) untuk VPS Linux
    if (process.platform === 'linux') {
      try {
        const { PlayerLogMonitor } = require('./playerLogMonitor');
        this.playerLogMonitor = new PlayerLogMonitor(this, this.config);
        this.playerLogMonitor.start();
      } catch (err) {
        console.warn('[StatusManager] Gagal memulai PlayerLogMonitor:', err.message);
      }

      // Auto-Backup setiap 6 jam
      try {
        this.backupManager.start();
      } catch (err) {
        console.warn('[StatusManager] Gagal memulai BackupManager:', err.message);
      }

      // Auto-Restart harian jam 04:00 subuh
      try {
        this.autoRestart.start();
      } catch (err) {
        console.warn('[StatusManager] Gagal memulai AutoRestart:', err.message);
      }
    }

    this.updateStatusEmbed();
    this.updatePlayerCountChannel();

    this.statusTimer = setInterval(() => {
      this.updateStatusEmbed();
    }, embedSec * 1000);

    this.channelNameTimer = setInterval(() => {
      this.updatePlayerCountChannel();
    }, channelMin * 60 * 1000);
  }

  stop() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    if (this.channelNameTimer) clearInterval(this.channelNameTimer);
    if (this.playerLogMonitor) {
      this.playerLogMonitor.stop();
      this.playerLogMonitor = null;
    }
    if (this.backupManager) {
      this.backupManager.stop();
    }
    if (this.autoRestart) {
      this.autoRestart.stop();
    }
  }
}

module.exports = {
  StatusManager
};
