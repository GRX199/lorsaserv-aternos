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
      const { config, statusManager } = context;
      const servers = statusManager ? statusManager.getServers() : (config.servers || [config.mcserver]);
      const embeds = [];

      for (const s of servers) {
        const status = statusManager
          ? await statusManager.getStatusForServer(s)
          : await checkServerStatus(s.ip, s.port, s.type);
        embeds.push(createStatusEmbed(status, s, config));
      }

      await interaction.editReply({
        embeds: embeds.slice(0, 10)
      });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Gagal mengambil status server: ${err.message}`
      });
    }
  }
};
