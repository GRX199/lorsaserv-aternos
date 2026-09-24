const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('download-backup')
    .setDescription('Unduh file backup dunia Minecraft Bedrock langsung dari Discord (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator**!'
      });
      return;
    }

    const { statusManager, config } = context;
    if (!statusManager?.backupManager) {
      await interaction.editReply({
        content: '❌ BackupManager belum aktif pada bot ini.'
      });
      return;
    }

    try {
      await interaction.editReply({
        content: '⏳ **Sedang mengompresi dan menyiapkan arsip backup dunia...**\nProses ini membutuhkan waktu beberapa detik tergantung ukuran map server.'
      });

      const res = await statusManager.backupManager.createBackup(true);

      if (!res.success) {
        await interaction.editReply({
          content: `❌ Gagal membuat arsip backup: ${res.message}`
        });
        return;
      }

      const host = config?.publicUrl
        || (config?.publicIp ? `http://${config.publicIp}:${process.env.PORT || 3000}` : null)
        || `http://129.226.95.58:${process.env.PORT || 3000}`;
      const webDownloadUrl = `${host.replace(/\/+$/, '')}/download-bedrock-world`;

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('📥 Arsip Backup Dunia Siap Diunduh!')
        .setDescription(`Dunia Minecraft Bedrock berhasil diarsipkan ke dalam file zip/tar.gz dengan aman.`)
        .addFields(
          { name: '📦 Nama File', value: `\`${res.filename}\``, inline: true },
          { name: '📊 Ukuran File', value: `\`${res.sizeMb} MB\``, inline: true },
          { name: '🌐 Tautan Unduh Web', value: `[Klik di Sini untuk Unduh Langsung (${res.sizeMb} MB)](${webDownloadUrl})`, inline: false }
        )
        .setFooter({ text: '🔒 Khusus Admin • File dapat langsung diekstrak ke folder worlds/' })
        .setTimestamp();

      const payload = {
        content: null,
        embeds: [embed]
      };

      // Jika ukuran file < 24MB, lampirkan langsung file-nya ke Discord
      if (res.sizeBytes && res.sizeBytes < 24 * 1024 * 1024 && fs.existsSync(res.targetFile)) {
        payload.files = [{
          attachment: res.targetFile,
          name: res.filename
        }];
      }

      await interaction.editReply(payload);
    } catch (err) {
      console.error('[Command download-backup] Error:', err);
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat menyiapkan unduhan: ${err.message}`
      });
    }
  }
};
