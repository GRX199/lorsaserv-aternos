const { SlashCommandBuilder } = require('discord.js');
const { sendBroadcast } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Kirim pesan siaran pengumuman ke layar semua pemain di dalam game')
    .addStringOption(option =>
      option.setName('pesan')
        .setDescription('Pesan yang ingin disiarkan ke in-game chat')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const text = interaction.options.getString('pesan').trim();
    const sender = interaction.user.username;

    if (!text) {
      await interaction.editReply({ content: '❌ Pesan tidak boleh kosong!' });
      return;
    }

    try {
      if (process.platform !== 'linux') {
        await interaction.editReply({ content: '❌ Fitur ini hanya bekerja di VPS Linux.' });
        return;
      }

      const res = sendBroadcast(sender, text);
      if (res.success) {
        await interaction.editReply({
          content: `📢 **Siaran Terkirim ke In-Game Chat (${res.screen}):**\n\`\`\`\n[Discord] ${sender}: ${text}\n\`\`\``
        });
      } else {
        await interaction.editReply({
          content: `⚠️ Sesi screen server \`${res.screen || 'minecraft'}\` tidak aktif di VPS.`
        });
      }
    } catch (err) {
      console.error('[Command say] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengirim siaran: ${err.message}`
      });
    }
  }
};
