const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { EmbedBuilder } = require('discord.js');

class BackupManager {
  constructor(statusManager, config) {
    this.statusManager = statusManager;
    this.config = config;
    this.timer = null;

    const homeDir = process.env.HOME || '/home/ubuntu';
    this.bedrockDir = process.env.BEDROCK_DIR || path.join(homeDir, 'bedrock-server');
    this.worldsDir = path.join(this.bedrockDir, 'worlds');
    this.backupsDir = process.env.BACKUPS_DIR || path.join(homeDir, 'minecraft-backups');
    this.maxRetention = this.config.backup?.maxRetention || 8; // Simpan 8 backup terakhir (2 hari @ interval 6 jam)
  }

  start() {
    const enabled = this.config.backup?.enabled !== false;
    if (!enabled) {
      console.log('[BackupManager] Fitur auto-backup dinonaktifkan di konfigurasi.');
      return;
    }

    const intervalHours = this.config.backup?.intervalHours || 6;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`[BackupManager] Auto-backup aktif setiap ${intervalHours} jam (Folder: ${this.backupsDir})`);

    // Pastikan folder backups ada
    if (!fs.existsSync(this.backupsDir)) {
      try {
        fs.mkdirSync(this.backupsDir, { recursive: true });
      } catch (err) {
        console.warn('[BackupManager] Gagal membuat direktori backup:', err.message);
      }
    }

    // Jalankan timer berkala
    this.timer = setInterval(() => {
      this.runScheduledBackup();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Menjalankan backup otomatis berkala dan memberi tahu Discord
   */
  async runScheduledBackup() {
    console.log('[BackupManager] Memulai auto-backup terjadwal (interval 6 jam)...');
    try {
      const res = await this.createBackup(false);
      if (res.success) {
        await this.notifyBackupDiscord(res);
      }
    } catch (err) {
      console.error('[BackupManager] Error auto-backup terjadwal:', err.message);
    }
  }

  /**
   * Membuat file backup arsip dari folder worlds
   * @param {boolean} manual - Apakah dipicu manual lewat slash command /backup
   */
  async createBackup(manual = false) {
    if (!fs.existsSync(this.worldsDir)) {
      return {
        success: false,
        message: `Direktori worlds tidak ditemukan di ${this.worldsDir}`
      };
    }

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup-${timestamp}.tar.gz`;
    const targetFile = path.join(this.backupsDir, filename);

    try {
      // Jalankan tar kompresi gzip
      // Di Linux: tar -czf targetFile -C bedrockDir worlds
      const cmd = `tar -czf "${targetFile}" -C "${this.bedrockDir}" worlds`;
      execSync(cmd, { timeout: 60000 });

      const stats = fs.statSync(targetFile);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

      // Bersihkan backup lama (retensi otomatis)
      const cleaned = this.cleanOldBackups();

      console.log(`[BackupManager] Berhasil membuat backup: ${filename} (${sizeMb} MB)`);

      return {
        success: true,
        filename,
        targetFile,
        sizeMb,
        sizeBytes: stats.size,
        timestamp,
        cleanedCount: cleaned,
        manual
      };
    } catch (err) {
      console.error('[BackupManager] Gagal membuat file backup:', err.message);
      return {
        success: false,
        message: `Gagal membuat arsip backup: ${err.message}`
      };
    }
  }

  /**
   * Membersihkan file backup yang melebihi batas retensi (FIFO)
   */
  cleanOldBackups() {
    try {
      if (!fs.existsSync(this.backupsDir)) return 0;

      const files = fs.readdirSync(this.backupsDir)
        .filter(f => f.startsWith('backup-') && (f.endsWith('.tar.gz') || f.endsWith('.zip')))
        .map(f => {
          const fullPath = path.join(this.backupsDir, f);
          return {
            name: f,
            path: fullPath,
            time: fs.statSync(fullPath).mtimeMs
          };
        })
        .sort((a, b) => b.time - a.time); // Urutkan dari terbaru ke terlama

      let deleted = 0;
      if (files.length > this.maxRetention) {
        const toDelete = files.slice(this.maxRetention);
        for (const item of toDelete) {
          try {
            fs.unlinkSync(item.path);
            deleted++;
            console.log(`[BackupManager] Menghapus backup lama: ${item.name}`);
          } catch {}
        }
      }
      return deleted;
    } catch (err) {
      console.warn('[BackupManager] Gagal membersihkan backup lama:', err.message);
      return 0;
    }
  }

  /**
   * Mengirim notifikasi keberhasilan backup ke channel Discord
   */
  async notifyBackupDiscord(result) {
    if (!this.statusManager?.client) return;

    const channelId = this.config.backup?.channelId
      || this.config.notifications?.backup?.channelId
      || process.env.STATUS_CHANNEL_ID
      || this.statusManager.state?.statusChannelId;

    if (!channelId) return;

    try {
      const channel = await this.statusManager.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💾 Auto-Backup Server Selesai!')
        .setDescription(`Dunia Minecraft Bedrock berhasil dicadangkan secara otomatis.`)
        .addFields(
          { name: '📦 Nama File', value: `\`${result.filename}\``, inline: true },
          { name: '📊 Ukuran', value: `\`${result.sizeMb} MB\``, inline: true },
          { name: '⏱️ Jadwal', value: `Setiap ${this.config.backup?.intervalHours || 6} Jam`, inline: true },
          { name: '📂 Lokasi VPS', value: `\`${this.backupsDir}\`` }
        )
        .setFooter({ text: 'SASY199 Backup System • Otomatis' })
        .setTimestamp();

      const payload = { embeds: [embed] };

      // Jika file < 25MB (batas Discord attachment gratis), lampirkan langsung file-nya ke Discord!
      if (result.sizeBytes && result.sizeBytes < 24 * 1024 * 1024 && fs.existsSync(result.targetFile)) {
        payload.files = [{
          attachment: result.targetFile,
          name: result.filename
        }];
      }

      await channel.send(payload).catch((err) => {
        console.warn('[BackupManager] Gagal kirim notifikasi backup ke Discord:', err.message);
      });
    } catch (err) {
      console.warn('[BackupManager] Error notifyBackupDiscord:', err.message);
    }
  }
}

module.exports = {
  BackupManager
};
