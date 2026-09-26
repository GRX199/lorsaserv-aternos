const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

const STRUCTURE_PRESETS = {
  easyautostorage: {
    name: 'Gudang Auto Storage (Golem)',
    file: 'easyautostorage',
    size: '22 x 10 x 20 blok',
    color: 0x2ECC71,
    guide: [
      '• Masukkan item sembarang ke dalam **Peti Input** (*Input Chest*).',
      '• Mekanisme **Iron Golem / Redstone Sorter** akan memisahkan item secara otomatis ke deretan peti masing-masing.',
      '• Tidak perlu repot menyusun barang secara manual lagi!'
    ].join('\n')
  },
  sugarcane_farm: {
    name: 'Auto Sugarcane & Bamboo Farm',
    file: 'sugarcane_farm',
    size: '8 x 5 x 5 blok',
    color: 0x27AE60,
    guide: [
      '• Tebu tumbuh otomatis di atas pasir yang dialiri air.',
      '• **Observer** mendeteksi pertumbuhan dan memicu **Piston** untuk memotong tebu.',
      '• Tebu mengalir ke hopper dan terkumpul otomatis di **Peti Ganda** di bagian depan.'
    ].join('\n')
  },
  chicken_farm: {
    name: 'Auto Cooked Chicken & Feather Farm',
    file: 'chicken_farm',
    size: '3 x 5 x 4 blok',
    color: 0xE67E22,
    guide: [
      '• Taruh ayam dewasa di bilik kaca atas (bisa dipancing dengan benih/seed).',
      '• Telur ayam otomatis disalurkan ke **Dispenser** dan ditembakkan ke atas half-slab.',
      '• Begitu anak ayam tumbuh menjadi ayam dewasa, kepalanya menyentuh lava, langsung matang terpanggang menjadi **Cooked Chicken** dan masuk ke peti penyimpanan!'
    ].join('\n')
  },
  easy_ironfarm: {
    name: 'Easy Iron Farm (Farm Besi)',
    file: 'easy_ironfarm',
    size: '23 x 9 x 23 blok',
    color: 0xE74C3C,
    guide: [
      '• Memuat seluruh sistem Iron Farm otomatis lengkap dengan Villager & platform pembunuh Golem.',
      '• Iron Golem spawn di atas platform air, dialirkan ke bilah lava, dan menghasilkan Iron Ingot tanpa batas.',
      '• Besi dan bunga Poppy otomatis terserap masuk ke deretan peti di bagian bawah!'
    ].join('\n')
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spawn-storage')
    .setDescription('Munculkan struktur Gudang atau Auto Farm instan (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag pemain yang menjadi titik acuan kemunculan struktur')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('struktur')
        .setDescription('Pilih jenis bangunan/farm yang ingin dimunculkan')
        .setRequired(false)
        .addChoices(
          { name: '📦 Gudang Auto Storage Golem (22x10x20)', value: 'easyautostorage' },
          { name: '🛡️ Easy Iron Farm - Besi Tak Terbatas (23x9x23)', value: 'easy_ironfarm' },
          { name: '🎋 Auto Sugarcane Farm (8x5x5)', value: 'sugarcane_farm' },
          { name: '🍗 Auto Cooked Chicken Farm (3x5x4)', value: 'chicken_farm' }
        )
    )
    .addStringOption(option =>
      option.setName('rotasi')
        .setDescription('Arah hadap bangunan')
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
        .setDescription('Koordinat X spesifik (Opsional, jika kosong memakai posisi pemain)')
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
    const structKey = interaction.options.getString('struktur') || 'easyautostorage';
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

    const preset = STRUCTURE_PRESETS[structKey] || STRUCTURE_PRESETS.easyautostorage;

    try {
      let spawnCmd = '';
      let locationText = '';

      if (posX !== null && posY !== null && posZ !== null) {
        spawnCmd = `structure load ${preset.file} ${posX} ${posY} ${posZ} ${rotation}`;
        locationText = `Koordinat: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\` (Rotasi: \`${rotation}\`)`;
      } else {
        spawnCmd = `execute at "${playerName}" run structure load ${preset.file} ~ ~ ~ ${rotation}`;
        locationText = `Tepat di posisi pemain: \`${playerName}\` (Rotasi: \`${rotation}\`)`;
      }

      // 1. Eksekusi load structure di server
      const res = sendConsoleCommand(spawnCmd);
      if (!res.success) {
        throw new Error(res.error || 'Gagal mengirim perintah ke konsol BDS');
      }

      // 2. Kirim efek suara & notifikasi in-game ke pemain
      sendConsoleCommand(`playsound random.levelup "${playerName}"`);
      sendConsoleCommand(`tellraw "${playerName}" {"rawtext":[{"text":"§a§l[DISCORD ADMIN] §r§aBangunan ${preset.name} [${preset.size}] berhasil dimunculkan!"}]}`);

      // 3. Kirim konfirmasi Embed ke Discord
      const embed = new EmbedBuilder()
        .setColor(preset.color)
        .setTitle(`🏗️ ${preset.name} Berhasil Dimunculkan!`)
        .setDescription(`Cetak biru struktur **\`${preset.file}.mcstructure\`** telah berhasil dimuat ke dalam dunia server Minecraft Bedrock!`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
        .addFields(
          { name: '👤 Pemain Acuan', value: `\`${playerName}\``, inline: true },
          { name: '📐 Ukuran Bangunan', value: `\`${preset.size}\``, inline: true },
          { name: '📍 Titik Kemunculan', value: locationText, inline: false },
          { name: '📦 Panduan Singkat', value: preset.guide, inline: false }
        )
        .setFooter({ text: 'SASY199 Auto Farm & Storage • Bedrock Structure Loader' })
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
