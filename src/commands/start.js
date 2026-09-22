const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-server')
    .setDescription('Nyalakan server Minecraft Bedrock di VPS')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await startServer();
    if (result.success) {
      await interaction.editReply({
        content: `🚀 **${result.message}**\nBot akan otomatis mengirimkan notifikasi saat server sudah selesai loading dan online!`
      });
    } else {
      await interaction.editReply({
        content: `⚠️ ${result.message}`
      });
    }
  }
};
