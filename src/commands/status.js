const { SlashCommandBuilder } = require('discord.js');
const { checkServerStatus } = require('../pinger');
const { createStatusEmbed, createStatusButtons } = require('../embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Cek status terkini server Minecraft Bedrock'),

  async execute(interaction, context) {
    await interaction.deferReply();

    try {
      const { config } = context;
      const status = await checkServerStatus(
        config.mcserver.pingHost || config.mcserver.ip,
        config.mcserver.port,
        config.mcserver.type
      );

      const embed = createStatusEmbed(status, config);
      const buttons = createStatusButtons(config, Boolean(status?.online));

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Gagal mengambil status server: ${err.message}`
      });
    }
  }
};
