const { restartServer, sendBroadcast } = require('./serverController');
const { EmbedBuilder } = require('discord.js');

class AutoRestart {
  constructor(statusManager, config) {
    this.statusManager = statusManager;
    this.config = config;
    this.timer = null;
    this.warned5m = false;
    this.warned1m = false;
    this.targetHour = this.config.autoRestart?.hour ?? 4; // Jam 04:00 subuh
    this.targetMinute = this.config.autoRestart?.minute ?? 0;
  }

  start() {
    const enabled = this.config.autoRestart?.enabled !== false;
    if (!enabled) {
      console.log('[AutoRestart] Fitur auto-restart harian dinonaktifkan di konfigurasi.');
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    console.log(`[AutoRestart] Auto-restart harian aktif: setiap pukul ${pad(this.targetHour)}:${pad(this.targetMinute)}`);

    // Periksa waktu setiap 30 detik
    this.timer = setInterval(() => {
      this.checkSchedule();
    }, 30000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  checkSchedule() {
    const now = new Date();
    const curHour = now.getHours();
    const curMin = now.getMinutes();

    // Hitung sisa menit ke target jam
    let diffMinutes = (this.targetHour * 60 + this.targetMinute) - (curHour * 60 + curMin);
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Jika sudah lewat, hitung untuk esok hari
    }

    // Peringatan 5 menit sebelum restart
    if (diffMinutes === 5 && !this.warned5m) {
      this.warned5m = true;
      this.sendWarning(5);
      return;
    }

    // Peringatan 1 menit sebelum restart
    if (diffMinutes === 1 && !this.warned1m) {
      this.warned1m = true;
      this.sendWarning(1);
      return;
    }

    // Eksekusi restart saat diffMinutes === 0
    if (diffMinutes === 0) {
      this.warned5m = false;
      this.warned1m = false;
      this.executeRestart();
    }
  }

  /**
   * Mengirim peringatan ke chat in-game Minecraft & channel Discord
   */
  async sendWarning(minutesLeft) {
    console.log(`[AutoRestart] Mengirim peringatan restart otomatis (${minutesLeft} menit lagi)...`);

    // 1. Kirim ke Minecraft in-game
    sendBroadcast('Server', `⚠️ Peringatan: Pembersihan cache harian akan dimulai dalam ${minutesLeft} menit!`);

    // 2. Kirim ke channel Discord
    if (!this.statusManager?.client) return;
    const channelId = this.config.notifications?.onlineAlert?.channelId
      || process.env.STATUS_CHANNEL_ID
      || this.statusManager.state?.statusChannelId;

    if (!channelId) return;

    try {
      const channel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('⚠️ Peringatan Restart Otomatis Harian')
        .setDescription(`Server Minecraft VPS akan di-restart otomatis dalam **${minutesLeft} menit** untuk pembersihan memori cache rutin.`)
        .setFooter({ text: 'Restart hanya memakan waktu beberapa detik' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch {}
  }

  /**
   * Mengeksekusi restart server
   */
  async executeRestart() {
    console.log('[AutoRestart] Menjalankan restart server otomatis...');

    try {
      // Broadcast terakhir sebelum mati
      sendBroadcast('Server', '⚠️ Server sedang restart otomatis untuk pembersihan rutin. Mohon tunggu...');

      const res = await restartServer();

      if (this.statusManager) {
        await this.statusManager.updateStatusEmbed().catch(() => {});
      }

      // Beritahu Discord bahwa server sudah segar kembali
      const channelId = process.env.STATUS_CHANNEL_ID || this.statusManager?.state?.statusChannelId;
      if (channelId) {
        const channel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🟢 Pembersihan Cache Harian Selesai!')
            .setDescription('Server Minecraft Bedrock telah berhasil di-restart secara otomatis. Memori cache telah dibersihkan dan server siap dimainkan kembali!')
            .setFooter({ text: 'Auto-Restart Harian • SASY199' })
            .setTimestamp();

          await channel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[AutoRestart] Gagal restart otomatis:', err.message);
    }
  }
}

module.exports = {
  AutoRestart
};
