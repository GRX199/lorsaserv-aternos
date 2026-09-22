const fs = require('node:fs');
const path = require('node:path');
const { ActivityType, EmbedBuilder } = require('discord.js');
const { checkServerStatus } = require('./pinger');
const { createStatusEmbed, createStatusButtons } = require('./embeds');

const STATE_FILE_PATH = path.join(__dirname, '..', 'data', 'state.json');

class StatusManager {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.latestStatus = null;
    this.previousOnlineState = null;
    this.statusTimer = null;
    this.channelNameTimer = null;
    this.lastChannelName = null;
    this.isUpdating = false;
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[StatusManager] Gagal membaca state.json:', err.message);
    }
    return { statusMessageId: null, statusChannelId: null };
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
    return this.latestStatus;
  }

  /**
   * Menyiapkan live status message di channel tertentu (dipanggil oleh /setup-status)
   */
  async setupStatusMessage(channel) {
    const status = await checkServerStatus(
      this.config.mcserver.ip,
      this.config.mcserver.port,
      this.config.mcserver.type
    );
    this.latestStatus = status;
    this.previousOnlineState = status.online;

    const embed = createStatusEmbed(status, this.config);
    const buttons = createStatusButtons(this.config, Boolean(status?.online));

    const message = await channel.send({
      embeds: [embed],
      components: [buttons]
    });

    this.state.statusChannelId = channel.id;
    this.state.statusMessageId = message.id;
    this.saveState();

    return message;
  }

  /**
   * Mengirim notifikasi chat ketika server baru saja Online atau Offline
   */
  async sendNotification(alertType, status) {
    const alertConfig = this.config.notifications?.[alertType];
    if (!alertConfig || !alertConfig.enabled) return;

    const channelId = alertConfig.channelId || process.env.STATUS_CHANNEL_ID || this.state.statusChannelId;
    if (!channelId) return;

    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const mc = this.config.mcserver;
    const isOnline = alertType === 'onlineAlert';

    const embed = new EmbedBuilder()
      .setColor(isOnline ? (this.config.display?.colorOnline || '#2ECC71') : (this.config.display?.colorOffline || '#E74C3C'))
      .setTitle(alertConfig.title || (isOnline ? '🎉 Server Minecraft Online!' : '🔴 Server Minecraft Offline'))
      .setDescription(
        (alertConfig.message || '')
          .replace('{name}', mc.name)
          .replace('{ip}', mc.ip)
          .replace('{port}', mc.port)
      )
      .addFields(
        { name: '📡 Alamat Server', value: `\`${mc.ip}\``, inline: true },
        { name: '🔌 Port Bedrock', value: `\`${mc.port}\``, inline: true },
        { name: '👥 Pemain', value: `\`${status.players?.online || 0} / ${status.players?.max || 20}\``, inline: true }
      )
      .setThumbnail(mc.icon || null)
      .setTimestamp();

    if (mc.footerText) {
      embed.setFooter({ text: mc.footerText, iconURL: mc.icon || undefined });
    }

    const payload = {
      embeds: [embed],
      components: [createStatusButtons(this.config, isOnline)]
    };

    if (alertConfig.mention && alertConfig.mention.trim() !== '') {
      payload.content = alertConfig.mention.trim();
    }

    await channel.send(payload).catch((err) => {
      console.warn(`[StatusManager] Gagal kirim notifikasi ${alertType}:`, err.message);
    });

    console.log(`[StatusManager] Berhasil mengirim notifikasi ${alertType} ke channel ${channel.name}!`);
  }

  /**
   * Memperbarui embed status message
   */
  async updateStatusEmbed() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const status = await checkServerStatus(
        this.config.mcserver.ip,
        this.config.mcserver.port,
        this.config.mcserver.type
      );
      this.latestStatus = status;

      // 1. Deteksi perubahan status Online/Offline untuk notifikasi
      if (this.previousOnlineState !== null) {
        if (this.previousOnlineState === false && status.online === true) {
          console.log('[StatusManager] Terdeteksi server berubah status: OFFLINE -> ONLINE! Mengirim notifikasi...');
          await this.sendNotification('onlineAlert', status);
        } else if (this.previousOnlineState === true && status.online === false) {
          console.log('[StatusManager] Terdeteksi server berubah status: ONLINE -> OFFLINE!');
          await this.sendNotification('offlineAlert', status);
        }
      }
      this.previousOnlineState = status.online;

      // 2. Update Bot Presence
      this.updatePresence(status);

      // 3. Tentukan Channel ID untuk Live Status Panel
      const channelId = process.env.STATUS_CHANNEL_ID || this.state.statusChannelId;
      if (!channelId) {
        return;
      }

      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return;
      }

      const embed = createStatusEmbed(status, this.config);
      const buttons = createStatusButtons(this.config, Boolean(status?.online));

      let message = null;
      if (this.state.statusMessageId) {
        message = await channel.messages.fetch(this.state.statusMessageId).catch(() => null);
      }

      if (message) {
        await message.edit({
          embeds: [embed],
          components: [buttons]
        }).catch((err) => {
          console.warn('[StatusManager] Gagal edit status message:', err.message);
        });
      } else {
        // Jika pesan belum ada atau telah dihapus, buat pesan baru
        const newMessage = await channel.send({
          embeds: [embed],
          components: [buttons]
        }).catch((err) => {
          console.warn('[StatusManager] Gagal kirim status message baru:', err.message);
          return null;
        });

        if (newMessage) {
          this.state.statusChannelId = channel.id;
          this.state.statusMessageId = newMessage.id;
          this.saveState();
        }
      }
    } catch (err) {
      console.error('[StatusManager] Error saat updateStatusEmbed:', err.message);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Mengupdate presence / activity bot di profil Discord
   */
  updatePresence(status) {
    if (!this.client.user) return;

    try {
      if (status && status.online) {
        const text = (this.config.display?.presenceOnline || '👥 {online}/{max} pemain online')
          .replace('{online}', status.players?.online || 0)
          .replace('{max}', status.players?.max || 20);

        this.client.user.setPresence({
          status: 'online',
          activities: [{ name: text, type: ActivityType.Custom }]
        });
      } else {
        const text = this.config.display?.presenceOffline || '🔴 Server Offline';
        this.client.user.setPresence({
          status: 'idle',
          activities: [{ name: text, type: ActivityType.Custom }]
        });
      }
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

      const status = this.latestStatus || await checkServerStatus(
        this.config.mcserver.ip,
        this.config.mcserver.port,
        this.config.mcserver.type
      );

      let targetName = '';
      if (status && status.online) {
        targetName = (this.config.display?.onlineChannelName || '🟢・{online}/{max}-online')
          .replace('{online}', status.players?.online || 0)
          .replace('{max}', status.players?.max || 20);
      } else {
        targetName = this.config.display?.offlineChannelName || '🔴・offline';
      }

      if (this.lastChannelName === targetName || channel.name === targetName) {
        return; // Nama sudah sama, hindari rate-limit Discord
      }

      await channel.setName(targetName).catch((err) => {
        console.warn('[StatusManager] Gagal mengganti nama channel (kemungkinan rate limit Discord):', err.message);
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
    const embedSec = Math.max(30, this.config.intervals?.statusEmbedSeconds || 60);
    const channelMin = Math.max(5, this.config.intervals?.channelNameMinutes || 5);

    console.log(`[StatusManager] Memulai loop update embed setiap ${embedSec} detik.`);
    console.log(`[StatusManager] Memulai loop channel name setiap ${channelMin} menit.`);

    // Jalankan segera saat pertama kali start
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
  }
}

module.exports = {
  StatusManager
};
