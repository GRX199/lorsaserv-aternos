const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spawn-storage')
    .setDescription('Munculkan bangunan Gudang Otomatis (Auto Storage Golem) instan (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag pemain yang menjadi titik acuan kemunculan gudang')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rotasi')
        .setDescription('Arah hadap bangunan gudang')
        .setRequired(false)
        .addChoices(
          { name: 'Normal (0°)', value: '0_degrees' },
          { name: 'Putar 90°', value: '90_degrees' },
          { name: 'Putar 180°', value: '180_degrees' },
          { name: 'Putar 270°', value: '270_degrees' }
        )
    )
    .addIntegerOption(option =>
      option.setName('x')
        .setDescription('Koordinat X spesifik (Opsional, jika kosong akan memakai posisi pemain)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('y')
        .setDescription('Koordinat Y spesifik (Opsional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('z')
        .setDescription('Koordinat Z spesifik (Opsional)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator Discord**!'
      });
      return;
    }

    const rawPlayer = interaction.options.getString('pemain') || '';
    const playerName = rawPlayer.trim().replace(/["'\\]/g, '');
    const rotation = interaction.options.getString('rotasi') || '0_degrees';
    const posX = interaction.options.getInteger('x');
    const posY = interaction.options.getInteger('y');
    const posZ = interaction.options.getInteger('z');

    if (!playerName) {
      await interaction.editReply({
        content: '❌ Nama pemain / Gamertag tidak boleh kosong!'
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur ini hanya bekerja saat bot terhubung langsung dengan server di VPS Linux.'
      });
      return;
    }

    try {
      let spawnCmd = '';
      let locationText = '';

      if (posX !== null && posY !== null && posZ !== null) {
        spawnCmd = `structure load easyautostorage ${posX} ${posY} ${posZ} ${rotation}`;
        locationText = `Koordinat: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\` (Rotasi: \`${rotation}\`)`;
      } else {
        spawnCmd = `execute at "${playerName}" run structure load easyautostorage ~ ~ ~ ${rotation}`;
        locationText = `Tepat di posisi pemain: \`${playerName}\` (Rotasi: \`${rotation}\`)`;
      }

      // 1. Eksekusi load structure di server
      const res = sendConsoleCommand(spawnCmd);
      if (!res.success) {
        throw new Error(res.error || 'Gagal mengirim perintah ke konsol BDS');
      }

      // 2. Kirim efek suara & notifikasi in-game ke pemain
      sendConsoleCommand(`playsound random.levelup "${playerName}"`);
      sendConsoleCommand(`tellraw "${playerName}" {"rawtext":[{"text":"§a§l[DISCORD ADMIN] §r§aBangunan Gudang Auto Storage (Golem) [22x10x20] berhasil dimunculkan di lokasi Anda!"}]}`);

      // 3. Kirim konfirmasi Embed ke Discord
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Green Emerald
        .setTitle('🏗️ Gudang Auto Storage (Golem) Berhasil Dimunculkan!')
        .setDescription(`Cetak biru struktur **\`easyautostorage.mcstructure\`** telah berhasil dimuat ke dalam dunia server Minecraft Bedrock!`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
        .addFields(
          { name: '👤 Pemain Acuan', value: `\`${playerName}\``, inline: true },
          { name: '📐 Ukuran Bangunan', value: '`22 x 10 x 20 blok`', inline: true },
          { name: '📍 Titik Kemunculan', value: locationText, inline: false },
          {
            name: '📦 Cara Kerja Auto Storage',
            value: [
              '• Masukkan item sembarang ke dalam **Peti Input** (*Input Chest*).',
              '• Mekanisme **Iron Golem / Redstone Sorter** akan memisahkan item secara otomatis ke dalam deretan peti penyimpanan masing-masing.',
              '• Tidak perlu repot menyusun barang secara manual lagi!'
            ].join('\n'),
            inline: false
          }
        )
        .setFooter({ text: 'SASY199 Auto Storage System • Bedrock Structure Loader' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command spawn-storage] Error:', err);
      await interaction.editReply({
        content: `⚠️ Gagal memunculkan struktur: ${err.message}`
      });
    }
  }
};
