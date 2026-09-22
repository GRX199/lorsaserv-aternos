const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { restartServer } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart-server')
    .setDescription('Restart server Minecraft Bedrock di VPS')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await restartServer();
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
