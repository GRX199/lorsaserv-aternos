const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playtime')
    .setDescription('Cek total waktu bermain (jam terbang) seorang pemain di server VPS')
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Nama / gamertag pemain di Minecraft (contoh: sasy199)')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    await interaction.deferReply();

    try {
      const { statusManager } = context;
      const tracker = statusManager?.playtimeTracker;

      if (!tracker) {
        await interaction.editReply({
          content: '❌ PlaytimeTracker belum diinisialisasi pada bot.'
        });
        return;
      }

      const queryName = interaction.options.getString('pemain').trim();
      const stats = tracker.getPlaytime(queryName);

      if (!stats || (stats.totalSeconds === 0 && !stats.isOnline)) {
        await interaction.editReply({
          content: `⚠️ Data pemain **${queryName}** belum tercatat di server. Pastikan nama sesuai dan pemain pernah bergabung ke server VPS.`
        });
        return;
      }

      const firstJoinedStr = stats.firstSeen ? `<t:${Math.floor(stats.firstSeen / 1000)}:D>` : 'Tidak tercatat';
      const lastSeenStr = stats.isOnline ? '🟢 **Sedang Online Sekarang**' : (stats.lastSeen ? `<t:${Math.floor(stats.lastSeen / 1000)}:R>` : 'Tidak tercatat');

      const embed = new EmbedBuilder()
        .setColor(stats.isOnline ? '#2ECC71' : '#5865F2')
        .setTitle(`🎮 Profil Jam Terbang: ${stats.name}`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(stats.name)}/128`)
        .addFields(
          { name: '⏱️ Total Waktu Bermain', value: `\`${stats.formattedTime}\``, inline: true },
          { name: '📡 Status Terkini', value: lastSeenStr, inline: true },
          { name: '🔄 Total Sesi Login', value: `\`${stats.sessions} kali\``, inline: true },
          { name: '📅 Pertama Kali Bergabung', value: firstJoinedStr, inline: false }
        )
        .setFooter({ text: 'SASY199 Playtime Tracker' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command playtime] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengambil data playtime: ${err.message}`
      });
    }
  }
};
