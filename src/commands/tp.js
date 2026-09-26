const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { warpManager } = require('../warpManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tp')
    .setDescription('Teleport pemain ke pemain lain atau koordinat tertentu (Khusus Admin / OP)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('pemain')
        .setDescription('Gamertag pemain yang ingin di-teleport')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('target_pemain')
        .setDescription('Gamertag pemain tujuan (teleport pemain ke pemain ini)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('x')
        .setDescription('Koordinat X target (opsional)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('y')
        .setDescription('Koordinat Y target (opsional)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('z')
        .setDescription('Koordinat Z target (opsional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah teleportasi ini khusus untuk **Administrator / OP Server**!'
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur kontrol teleportasi hanya aktif saat bot terhubung di VPS Linux server.'
      });
      return;
    }

    const player = interaction.options.getString('pemain').trim();
    const targetPlayer = interaction.options.getString('target_pemain')?.trim();
    const posX = interaction.options.getInteger('x');
    const posY = interaction.options.getInteger('y');
    const posZ = interaction.options.getInteger('z');

    // Kasus 1: Teleport ke pemain target
    if (targetPlayer) {
      const res = warpManager.teleportPlayerToPlayer(player, targetPlayer);
      if (res.success) {
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('⚡ Teleportasi Pemain Berhasil!')
          .setDescription(res.message)
          .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(player)}/128`)
          .setFooter({ text: `Admin: ${interaction.user.displayName || interaction.user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: `⚠️ ${res.message}` });
      }
      return;
    }

    // Kasus 2: Teleport ke koordinat X Y Z
    if (posX !== null && posY !== null && posZ !== null) {
      const res = warpManager.teleportPlayerToCoords(player, posX, posY, posZ);
      if (res.success) {
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('⚡ Teleportasi Koordinat Berhasil!')
          .setDescription(res.message)
          .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(player)}/128`)
          .setFooter({ text: `Admin: ${interaction.user.displayName || interaction.user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: `⚠️ ${res.message}` });
      }
      return;
    }

    await interaction.editReply({
      content: '❌ Harap tentukan `target_pemain` (untuk teleport ke pemain lain) ATAU isi lengkap koordinat `x`, `y`, `z`!'
    });
  }
};
