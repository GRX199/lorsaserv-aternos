const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Tampilkan papan peringkat Top 10 pemain dengan jam bermain terlama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply();

    try {
      const { statusManager } = context;
      const tracker = statusManager?.playtimeTracker;

      if (!tracker) {
        await interaction.editReply({
          content: '❌ PlaytimeTracker belum aktif pada bot.'
        });
        return;
      }

      const topList = tracker.getLeaderboard(10);

      if (topList.length === 0) {
        await interaction.editReply({
          content: '📋 Belum ada data waktu bermain yang tercatat di server VPS.'
        });
        return;
      }

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const lines = topList.map((p, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const onlineDot = p.isOnline ? '🟢' : '⚪';
        return `${medal} **${p.name}** ${onlineDot}\n└ ⏱️ \`${p.formattedTime}\` (${p.sessions} sesi)`;
      });

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🏆 Top 10 Pemain Teraktif (Jam Terbang)')
        .setDescription([
          `Papan peringkat pemain dengan waktu bermain terlama di server Bedrock VPS:`,
          ``,
          lines.join('\n\n'),
          ``,
          `*💡 Ketuk \`/playtime <nama>\` untuk melihat detail profil spesifik pemain.*`
        ].join('\n'))
        .setFooter({ text: 'SASY199 Playtime Leaderboard' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command leaderboard] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengambil data leaderboard: ${err.message}`
      });
    }
  }
};
