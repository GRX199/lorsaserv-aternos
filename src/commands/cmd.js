const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Kirim perintah konsol langsung ke server Minecraft (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('perintah')
        .setDescription('Perintah yang ingin dijalankan (contoh: weather clear, time set day, op sasy199)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let cmd = interaction.options.getString('perintah').trim();
    if (cmd.startsWith('/')) {
      cmd = cmd.substring(1).trim();
    }

    if (!cmd) {
      await interaction.editReply({ content: '❌ Perintah tidak boleh kosong!' });
      return;
    }

    try {
      if (process.platform !== 'linux') {
        await interaction.editReply({ content: '❌ Fitur ini hanya bekerja di VPS Linux.' });
        return;
      }

      const result = sendConsoleCommand(cmd);
      if (result.success) {
        await interaction.editReply({
          content: `⚡ **Perintah Berhasil Dikirim ke Server (${result.screen}):**\n\`\`\`prolog\n/${cmd}\n\`\`\`\n*💡 Cek channel log konsol untuk melihat respon output dari server.*`
        });
      } else {
        await interaction.editReply({
          content: `⚠️ **Gagal mengirim ke konsol screen (${result.screen}):** ${result.error || 'Sesi screen tidak ditemukan'}.\nPastikan server Minecraft sudah aktif.`
        });
      }
    } catch (err) {
      console.error('[Command cmd] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengeksekusi perintah: ${err.message}`
      });
    }
  }
};
