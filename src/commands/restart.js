const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { restartServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart-server')
    .setDescription('Restart server Minecraft Bedrock di VPS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply();

    const result = await restartServer();
    if (context?.statusManager) {
      await context.statusManager.updateStatusEmbed();
    }

    if (result.success) {
      await interaction.editReply({
        content: `🔄 **${result.message}**`
      });
    } else {
      await interaction.editReply({
        content: `⚠️ ${result.message}`
      });
    }
  }
};
