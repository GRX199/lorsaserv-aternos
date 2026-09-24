const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('locate')
    .setDescription('Lacak koordinat X, Y, Z dan dimensi pemain saat ini (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag / nama pemain yang ingin dilacak posisinya')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator**!'
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur pelacak lokasi hanya tersedia di VPS Linux.'
      });
      return;
    }

    const monitor = context?.statusManager?.playerLogMonitor;
    if (!monitor) {
      await interaction.editReply({
        content: '⚠️ Monitor server belum aktif atau server sedang offline.'
      });
      return;
    }

    const targetPlayer = interaction.options.getString('pemain').trim();

    try {
      const res = await monitor.queryPlayerLocation(targetPlayer);

      if (res.error) {
        await interaction.editReply({
          content: `⚠️ **Gagal Melacak Lokasi:**\n${res.error}`
        });
        return;
      }

      // Format Dimensi
      let dimName = '🌍 Overworld';
      let dimColor = 0x2ecc71;
      let portalCalc = '';

      const dim = (res.dimension || '').toLowerCase();
      if (dim.includes('nether')) {
        dimName = '🔥 Nether';
        dimColor = 0xe74c3c;
        const owX = Math.round(res.x * 8);
        const owZ = Math.round(res.z * 8);
        portalCalc = `🚪 **Estimasi Portal di Overworld:** \`X: ${owX}, Z: ${owZ}\``;
      } else if (dim.includes('end')) {
        dimName = '🌌 The End';
        dimColor = 0x9b59b6;
        portalCalc = `🌀 Berada di dimensi End.`;
      } else {
        dimName = '🌍 Overworld';
        dimColor = 0x2ecc71;
        const netherX = Math.round(res.x / 8);
        const netherZ = Math.round(res.z / 8);
        portalCalc = `🚪 **Estimasi Portal di Nether (X/8, Z/8):** \`X: ${netherX}, Z: ${netherZ}\``;
      }

      const embed = new EmbedBuilder()
        .setColor(dimColor)
        .setTitle(`📍 Lokasi Pemain: ${res.name}`)
        .setDescription(`Koordinat posisi dan dimensi pemain di Minecraft Bedrock:`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(res.name)}/100`)
        .addFields(
          {
            name: '🗺️ Dimensi',
            value: `**${dimName}**`,
            inline: true
          },
          {
            name: '🧭 Posisi Koordinat',
            value: `\`\`\`prolog\nX: ${res.x}\nY: ${res.y}\nZ: ${res.z}\n\`\`\``,
            inline: false
          },
          {
            name: '🔄 Konversi Portal Nether',
            value: portalCalc,
            inline: false
          }
        )
        .setFooter({
          text: '🔒 Rahasia Admin (Pesan ini hanya terlihat oleh Anda)',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });
    } catch (err) {
      console.error('[Command locate] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengambil lokasi pemain: ${err.message}`
      });
    }
  }
};
