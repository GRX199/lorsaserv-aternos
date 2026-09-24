const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Lihat profil statistik pemain Minecraft dan render tubuh 3D skin')
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag pemain yang ingin dilihat profilnya')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: false });

    const targetName = interaction.options.getString('pemain').trim();
    const tracker = context?.statusManager?.playtimeTracker;

    const data = tracker ? tracker.getPlaytime(targetName) : null;
    const leaderboard = tracker ? tracker.getLeaderboard(100) : [];

    // Hitung posisi ranking
    const rankIndex = leaderboard.findIndex(p => p.name.toLowerCase() === targetName.toLowerCase());
    const rankText = rankIndex !== -1 ? `#${rankIndex + 1} dari ${leaderboard.length} pemain` : 'Belum Terdaftar';

    // Cek status online saat ini
    const monitor = context?.statusManager?.playerLogMonitor;
    const isLiveOnline = monitor
      ? monitor.getOnlinePlayers().some(p => p.toLowerCase() === targetName.toLowerCase())
      : (data?.isOnline || false);

    const statusBadge = isLiveOnline ? '🟢 **Sedang Online di Server**' : '⚪ **Offline**';
    const totalPlaytime = data?.formattedTime || '0 menit';
    const firstSeen = data?.firstSeen ? `<t:${Math.floor(data.firstSeen / 1000)}:D> (<t:${Math.floor(data.firstSeen / 1000)}:R>)` : 'Belum pernah login';
    const lastSeen = data?.lastSeen ? `<t:${Math.floor(data.lastSeen / 1000)}:R>` : 'Belum pernah';
    const sessions = data?.sessions || 0;

    const { getSkinUrls } = require('../skinHelper');
    const skin = await getSkinUrls(targetName);

    const embed = new EmbedBuilder()
      .setColor(isLiveOnline ? 0x2ecc71 : 0x3498db)
      .setTitle(`🏆 Profil Pemain: ${targetName}`)
      .setDescription(`Statistik aktivitas & penampilan karakter di server Minecraft Bedrock:`)
      .setThumbnail(skin.avatar)
      .setImage(skin.body)
      .addFields(
        {
          name: '📡 Status Kehadiran',
          value: statusBadge,
          inline: true
        },
        {
          name: '🏅 Peringkat Keaktifan',
          value: `**${rankText}**`,
          inline: true
        },
        {
          name: '⏳ Total Jam Bermain',
          value: `\`${totalPlaytime}\``,
          inline: false
        },
        {
          name: '🚪 Total Sesi Login',
          value: `${sessions} kali masuk`,
          inline: true
        },
        {
          name: '🕒 Terakhir Terlihat',
          value: lastSeen,
          inline: true
        },
        {
          name: '📅 Pertama Kali Bergabung',
          value: firstSeen,
          inline: false
        }
      )
      .setFooter({
        text: 'Render skin 3D otomatis via Mojang/Bedrock API',
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
  }
};
