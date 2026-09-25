const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

const ENCHANT_PRESETS = {
  sword: {
    label: '⚔️ Pedang Full Max',
    enchants: [
      'sharpness 5',
      'unbreaking 3',
      'mending 1',
      'looting 3',
      'fire_aspect 2',
      'knockback 2'
    ],
    summary: 'Sharpness V, Unbreaking III, Mending I, Looting III, Fire Aspect II, Knockback II'
  },
  pickaxe: {
    label: '⛏️ Pickaxe (Fortune)',
    enchants: [
      'efficiency 5',
      'unbreaking 3',
      'mending 1',
      'fortune 3'
    ],
    summary: 'Efficiency V, Unbreaking III, Mending I, Fortune III'
  },
  silkpick: {
    label: '⛏️ Pickaxe (Silk Touch)',
    enchants: [
      'efficiency 5',
      'unbreaking 3',
      'mending 1',
      'silk_touch 1'
    ],
    summary: 'Efficiency V, Unbreaking III, Mending I, Silk Touch I'
  },
  axe: {
    label: '🪓 Kapak (Axe)',
    enchants: [
      'efficiency 5',
      'sharpness 5',
      'unbreaking 3',
      'mending 1',
      'silk_touch 1'
    ],
    summary: 'Efficiency V, Sharpness V, Unbreaking III, Mending I, Silk Touch I'
  },
  shovel: {
    label: '🥄 Sekop (Shovel)',
    enchants: [
      'efficiency 5',
      'unbreaking 3',
      'mending 1',
      'silk_touch 1'
    ],
    summary: 'Efficiency V, Unbreaking III, Mending I, Silk Touch I'
  },
  armor: {
    label: '🛡️ Armor di Tangan (Universal)',
    enchants: [
      'protection 4',
      'unbreaking 3',
      'mending 1',
      'thorns 3',
      'respiration 3',
      'aqua_affinity 1',
      'swift_sneak 3',
      'feather_falling 4',
      'depth_strider 3',
      'soul_speed 3'
    ],
    summary: 'Protection IV, Unbreaking III, Mending I, Thorns III (+ Respiration/Aqua untuk Helm, Swift Sneak untuk Celana, Feather Falling/Depth untuk Sepatu)'
  },
  bow: {
    label: '🏹 Busur (Bow)',
    enchants: [
      'power 5',
      'unbreaking 3',
      'flame 1',
      'infinity 1',
      'punch 2'
    ],
    summary: 'Power V, Unbreaking III, Flame I, Infinity I, Punch II'
  },
  crossbow: {
    label: '🎯 Crossbow',
    enchants: [
      'quick_charge 3',
      'multishot 1',
      'unbreaking 3',
      'mending 1'
    ],
    summary: 'Quick Charge III, Multishot I, Unbreaking III, Mending I'
  },
  trident: {
    label: '🔱 Trident',
    enchants: [
      'impaling 5',
      'loyalty 3',
      'channeling 1',
      'unbreaking 3',
      'mending 1'
    ],
    summary: 'Impaling V, Loyalty III, Channeling I, Unbreaking III, Mending I'
  },
  mace: {
    label: '🔨 Mace (1.21)',
    enchants: [
      'density 5',
      'wind_burst 3',
      'breach 4',
      'unbreaking 3',
      'mending 1'
    ],
    summary: 'Density V, Wind Burst III, Breach IV, Unbreaking III, Mending I'
  },
  all: {
    label: '✨ Otomatis Deteksi Item di Tangan',
    enchants: [
      'unbreaking 3',
      'mending 1',
      'sharpness 5',
      'looting 3',
      'fire_aspect 2',
      'knockback 2',
      'efficiency 5',
      'fortune 3',
      'power 5',
      'flame 1',
      'infinity 1',
      'punch 2',
      'quick_charge 3',
      'multishot 1',
      'impaling 5',
      'loyalty 3',
      'channeling 1',
      'density 5',
      'wind_burst 3',
      'breach 4',
      'protection 4',
      'thorns 3',
      'respiration 3',
      'aqua_affinity 1',
      'swift_sneak 3',
      'feather_falling 4',
      'depth_strider 3',
      'soul_speed 3'
    ],
    summary: 'Menerapkan seluruh enchant tertinggi yang kompatibel dengan item yang sedang aktif dipegang pemain.'
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enchant-admin')
    .setDescription('Enchant senjata/alat pemain Minecraft menjadi Full Max instan (Khusus Admin Discord)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag / Nama Pemain Minecraft (harus sedang pegang item di tangan)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tipe')
        .setDescription('Jenis preset enchant yang ingin diterapkan')
        .setRequired(false)
        .addChoices(
          { name: '✨ Otomatis Deteksi Item di Tangan (All-in-One)', value: 'all' },
          { name: '⚔️ Pedang Full Max', value: 'sword' },
          { name: '⛏️ Pickaxe (Fortune)', value: 'pickaxe' },
          { name: '⛏️ Pickaxe (Silk Touch)', value: 'silkpick' },
          { name: '🪓 Kapak (Axe)', value: 'axe' },
          { name: '🥄 Sekop (Shovel)', value: 'shovel' },
          { name: '🛡️ Armor di Tangan (Helm/Baju/Celana/Sepatu)', value: 'armor' },
          { name: '🏹 Busur (Bow)', value: 'bow' },
          { name: '🎯 Crossbow', value: 'crossbow' },
          { name: '🔱 Trident', value: 'trident' },
          { name: '🔨 Mace (1.21)', value: 'mace' }
        )
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

    const rawPlayer = interaction.options.getString('pemain') || interaction.fields?.getTextInputValue?.('target_player') || '';
    const playerName = rawPlayer.trim().replace(/["'\\]/g, '');
    const typeKey = (interaction.options.getString('tipe') || 'all').toLowerCase();

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

    const preset = ENCHANT_PRESETS[typeKey] || ENCHANT_PRESETS.all;

    try {
      // 1. Eksekusi seluruh enchantment ke pemain via konsol BDS screen
      for (const ench of preset.enchants) {
        sendConsoleCommand(`enchant "${playerName}" ${ench}`);
      }

      // 2. Mainkan efek suara & notifikasi in-game
      sendConsoleCommand(`playsound random.levelup "${playerName}"`);
      sendConsoleCommand(`tellraw "${playerName}" {"rawtext":[{"text":"§a§l[DISCORD ADMIN] §r§aItem di tangan Anda berhasil di-enchant FULL MAX (${preset.label}) oleh Admin di Discord!"}]}`);

      // 3. Buat Embed Konfirmasi untuk Admin Discord
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6) // Purple / Enchantment Glow
        .setTitle('✨ Instant Max Enchant Berhasil Diterapkan!')
        .setDescription(`Perintah full enchant telah dikirimkan ke konsol server Minecraft untuk pemain **${playerName}**!`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
        .addFields(
          { name: '👤 Pemain Target', value: `\`${playerName}\``, inline: true },
          { name: '🔮 Kategori Preset', value: preset.label, inline: true },
          { name: '📋 Rincian Enchant', value: `\`\`\`prolog\n${preset.summary}\n\`\`\``, inline: false },
          { name: '💡 Catatan Penting', value: 'Pemain harus sedang **memegang item tersebut di tangan utama** agar enchant berhasil menempel.', inline: false }
        )
        .setFooter({ text: 'SASY199 Admin Enchant Panel • Eksekusi Konsol Langsung' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command enchant-admin] Error:', err);
      await interaction.editReply({
        content: `⚠️ Gagal menerapkan enchant: ${err.message}`
      });
    }
  }
};
