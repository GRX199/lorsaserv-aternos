const { SlashCommandBuilder } = require('discord.js');
const { startServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-server')
    .setDescription('Nyalakan server Minecraft Bedrock di VPS'),

  async execute(interaction, context) {
    await interaction.deferReply();

    const result = await startServer();
    if (context?.statusManager) {
      await context.statusManager.updateStatusEmbed();
    }

    if (result.success) {
      await interaction.editReply({
        content: `🚀 **${result.message}**\nBot akan otomatis mendeteksi dan memperbarui panel status saat server online!`
      });
    } else {
      await interaction.editReply({
        content: `⚠️ ${result.message}`
      });
    }
  }
};
