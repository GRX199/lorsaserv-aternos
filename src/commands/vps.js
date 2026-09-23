const { SlashCommandBuilder } = require('discord.js');
const { SystemMonitor } = require('../systemMonitor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vps')
    .setDescription('Cek spesifikasi dan penggunaan resource VPS Tencent secara real-time'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const { embed, row } = SystemMonitor.createEmbed();

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (err) {
      console.error('[Command vps] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengambil metrik VPS: ${err.message}`
      });
    }
  }
};
