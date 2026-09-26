const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { cancelRestart, getCountdownState } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancel-restart')
    .setDescription('Batalkan hitung mundur restart server Minecraft yang sedang berjalan')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const adminName = interaction.user.displayName || interaction.user.username;
    const result = cancelRestart(adminName);

    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Hitung Mundur Restart Berhasil Dibatalkan')
        .setDescription([
          `Pemberitahuan pembatalan telah disiarkan ke dalam server Minecraft.`,
          `Pemain dapat terus melanjutkan permainan tanpa terputus.`
        ].join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        content: `ℹ️ ${result.message}`
      });
    }
  }
};
