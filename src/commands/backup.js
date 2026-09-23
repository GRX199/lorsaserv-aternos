const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Cadangkan (backup) seluruh dunia Minecraft Bedrock ke arsip .tar.gz')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply();

    try {
      const { statusManager } = context;
      if (!statusManager?.backupManager) {
        await interaction.editReply({
          content: '❌ BackupManager belum aktif pada bot ini.'
        });
        return;
      }

      await interaction.editReply({
        content: '⏳ Sedang mengompresi dan membuat backup dunia Minecraft Bedrock, mohon tunggu sebentar...'
      });

      const res = await statusManager.backupManager.createBackup(true);

      if (!res.success) {
        await interaction.editReply({
          content: `❌ Gagal membuat backup: ${res.message}`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Backup Dunia Minecraft Berhasil Dibuat!')
        .setDescription('Seluruh file dunia dan data pemain berhasil dicadangkan dengan aman.')
        .addFields(
          { name: '📦 Nama File', value: `\`${res.filename}\``, inline: true },
          { name: '📊 Ukuran Arsip', value: `\`${res.sizeMb} MB\``, inline: true },
          { name: '📂 Lokasi di VPS', value: `\`${res.targetFile}\`` }
        )
        .setFooter({ text: 'Gunakan file ini kapan saja jika ingin me-restore peta server!' })
        .setTimestamp();

      const replyPayload = {
        content: null,
        embeds: [embed]
      };

      // Jika ukuran file backup < 24MB, lampirkan langsung ke Discord agar bisa didownload ke HP / PC pengguna!
      if (res.sizeBytes && res.sizeBytes < 24 * 1024 * 1024 && fs.existsSync(res.targetFile)) {
        replyPayload.files = [{
          attachment: res.targetFile,
          name: res.filename
        }];
      }

      await interaction.editReply(replyPayload);
    } catch (err) {
      console.error('[Command backup] Error:', err);
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat memproses backup: ${err.message}`
      });
    }
  }
};
