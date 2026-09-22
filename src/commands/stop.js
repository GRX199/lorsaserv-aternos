const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { stopServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop-server')
    .setDescription('Matikan server Minecraft Bedrock di VPS secara aman (save world)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await stopServer();
    if (result.success) {
      await interaction.editReply({
        content: `🛑 **${result.message}**`
      });
    } else {
      await interaction.editReply({
        content: `⚠️ ${result.message}`
      });
    }
  }
};
