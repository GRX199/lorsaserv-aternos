const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { stopServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop-server')
    .setDescription('Matikan server Minecraft Bedrock di VPS secara aman (save world)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply();

    const result = await stopServer();
    if (context?.statusManager) {
      await context.statusManager.updateStatusEmbed();
    }

    if (result.success) {
      await interaction.editReply({
        content: `🛑 **${result.message}**\nPanel status di atas telah otomatis diperbarui menjadi Offline.`
      });
    } else {
      await interaction.editReply({
        content: `⚠️ ${result.message}`
      });
    }
  }
};
