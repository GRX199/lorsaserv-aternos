const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { execSync } = require('node:child_process');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Kirim perintah konsol langsung ke server Minecraft Bedrock (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('perintah')
        .setDescription('Perintah yang ingin dijalankan (contoh: weather clear, time set day, op sasy199)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let cmd = interaction.options.getString('perintah').trim();
    // Hilangkan tanda '/' di awal jika pemain mengetiknya
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

      // Kirim perintah ke sesi screen mc-bedrock
      const escaped = cmd.replace(/"/g, '\\"');
      try {
        execSync(`screen -S mc-bedrock -X stuff "${escaped}\n"`, { timeout: 4000 });
        await interaction.editReply({
          content: `⚡ **Perintah Berhasil Dikirim ke Server:**\n\`\`\`prolog\n/${cmd}\n\`\`\`\n*💡 Cek channel log konsol untuk melihat respon output dari server.*`
        });
      } catch (screenErr) {
        // Jika screen session mc-bedrock belum ada
        await interaction.editReply({
          content: `⚠️ **Gagal mengirim ke konsol screen:** Sesi screen \`mc-bedrock\` tidak ditemukan.\nPastikan service \`minecraft-bedrock\` sudah dijalankan menggunakan screen.`
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
