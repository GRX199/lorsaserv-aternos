const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function formatItemName(id) {
  if (!id) return 'Unknown';
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getItemEmoji(id) {
  if (!id) return '📦';
  const lower = id.toLowerCase();
  if (lower.includes('sword')) return '🗡️';
  if (lower.includes('pickaxe')) return '⛏️';
  if (lower.includes('axe')) return '🪓';
  if (lower.includes('shovel')) return '🥄';
  if (lower.includes('hoe')) return '🌾';
  if (lower.includes('bow') || lower.includes('crossbow')) return '🏹';
  if (lower.includes('shield')) return '🛡️';
  if (lower.includes('helmet')) return '🪖';
  if (lower.includes('chestplate')) return '👕';
  if (lower.includes('leggings')) return '👖';
  if (lower.includes('boots')) return '🥾';
  if (lower.includes('apple') || lower.includes('beef') || lower.includes('bread') || lower.includes('pork') || lower.includes('chicken') || lower.includes('mutton') || lower.includes('cooked')) return '🍖';
  if (lower.includes('potion')) return '🧪';
  if (lower.includes('diamond')) return '💎';
  if (lower.includes('gold') || lower.includes('ingot')) return '🪙';
  if (lower.includes('iron')) return '🔩';
  if (lower.includes('totem')) return '🧿';
  if (lower.includes('elytra')) return '🪽';
  if (lower.includes('book')) return '📖';
  return '📦';
}

const ROMAN_NUMERALS = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
};

const ENCHANT_LABELS = {
  protection: 'Protection',
  fire_protection: 'Fire Protection',
  feather_falling: 'Feather Falling',
  blast_protection: 'Blast Protection',
  projectile_protection: 'Projectile Protection',
  thorns: 'Thorns',
  respiration: 'Respiration',
  depth_strider: 'Depth Strider',
  aqua_affinity: 'Aqua Affinity',
  sharpness: 'Sharpness',
  smite: 'Smite',
  bane_of_arthropods: 'Bane of Arthropods',
  knockback: 'Knockback',
  fire_aspect: 'Fire Aspect',
  looting: 'Looting',
  efficiency: 'Efficiency',
  silk_touch: 'Silk Touch',
  unbreaking: 'Unbreaking',
  fortune: 'Fortune',
  power: 'Power',
  punch: 'Punch',
  flame: 'Flame',
  infinity: 'Infinity',
  luck_of_the_sea: 'Luck of the Sea',
  lure: 'Lure',
  frost_walker: 'Frost Walker',
  mending: 'Mending',
  binding: 'Curse of Binding',
  vanishing: 'Curse of Vanishing',
  impaling: 'Impaling',
  riptide: 'Riptide',
  loyalty: 'Loyalty',
  channeling: 'Channeling',
  multishot: 'Multishot',
  piercing: 'Piercing',
  quick_charge: 'Quick Charge',
  soul_speed: 'Soul Speed',
  swift_sneak: 'Swift Sneak',
  wind_burst: 'Wind Burst',
  density: 'Density',
  breach: 'Breach'
};

function formatEnchantment(ench) {
  if (!ench || !ench.id) return '';
  const cleanId = String(ench.id).toLowerCase().replace(/^minecraft:/, '');
  const name = ENCHANT_LABELS[cleanId] || cleanId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const lvl = parseInt(ench.level, 10) || 1;
  const roman = ROMAN_NUMERALS[lvl] || String(lvl);

  const singleLevel = ['mending', 'silk_touch', 'flame', 'infinity', 'channeling', 'multishot', 'binding', 'vanishing', 'aqua_affinity'];
  if (singleLevel.includes(cleanId) && lvl === 1) {
    return name;
  }
  return `${name} ${roman}`;
}

function formatItem(item) {
  if (!item || !item.id) return '*(Kosong)*';
  const cleanName = formatItemName(item.id);
  const countStr = item.amount > 1 ? ` **x${item.amount}**` : '';
  const tagStr = item.name ? ` *("${item.name}")*` : '';
  const icon = getItemEmoji(item.id);

  let result = `${icon} **${cleanName}**${countStr}${tagStr}`;

  if (item.durability && item.durability.max) {
    const pct = Math.round((item.durability.remaining / item.durability.max) * 100);
    if (pct < 100) {
      result += ` \`[${pct}%]\``;
    }
  }

  if (item.enchants && Array.isArray(item.enchants) && item.enchants.length > 0) {
    const enchList = item.enchants.map(formatEnchantment).filter(Boolean);
    if (enchList.length > 0) {
      result += `\n   ┗ ✨ *${enchList.join(', ')}*`;
    }
  }

  return result;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Lihat isi tas, armor, dan status pemain (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag / nama pemain yang ingin diperiksa')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    // Balasan WAJIB ephemeral (hanya admin yang dapat melihat)
    await interaction.deferReply({ ephemeral: true });

    // Verifikasi ekstra hak akses Administrator
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
        content: '❌ Fitur inspeksi inventory real-time hanya tersedia di VPS Linux.'
      });
      return;
    }

    const monitor = context?.statusManager?.playerLogMonitor;
    if (!monitor) {
      await interaction.editReply({
        content: '⚠️ Sistem monitoring server belum aktif atau server sedang offline. Pastikan server Minecraft aktif.'
      });
      return;
    }

    const targetPlayer = interaction.options.getString('pemain').trim();

    try {
      const res = await monitor.queryPlayerInventory(targetPlayer);

      if (res.error) {
        await interaction.editReply({
          content: `⚠️ **Gagal Memeriksa Inventory:**\n${res.error}`
        });
        return;
      }

      // Format Armor & Offhand
      let armorLines = [
        `🪖 **Helm:** ${formatItem(res.armor?.head)}`,
        `👕 **Baju:** ${formatItem(res.armor?.chest)}`,
        `👖 **Celana:** ${formatItem(res.armor?.legs)}`,
        `🥾 **Sepatu:** ${formatItem(res.armor?.feet)}`,
        `🛡️ **Offhand:** ${formatItem(res.armor?.offhand)}`
      ].join('\n');
      if (armorLines.length > 1000) {
        armorLines = armorLines.substring(0, 990) + '...';
      }

      // Format Hotbar (Slot 1–9)
      let hotbarText = '*(Semua slot hotbar kosong)*';
      if (res.hotbar && res.hotbar.length > 0) {
        const lines = res.hotbar.map(it => `**[Slot ${it.slot + 1}]** ${formatItem(it)}`);
        hotbarText = lines.join('\n');
        if (hotbarText.length > 1000) {
          hotbarText = '';
          let count = 0;
          for (const line of lines) {
            if ((hotbarText + line + '\n').length > 940) break;
            hotbarText += line + '\n';
            count++;
          }
          const remaining = lines.length - count;
          if (remaining > 0) {
            hotbarText += `*...dan ${remaining} item lainnya.*`;
          }
        }
      }

      // Format Bag Storage (Slot 10–36)
      let storageText = '*(Tas penyimpanan kosong)*';
      if (res.storage && res.storage.length > 0) {
        const lines = res.storage.map(it => `**[Slot ${it.slot + 1}]** ${formatItem(it)}`);
        storageText = lines.join('\n');
        if (storageText.length > 1000) {
          storageText = '';
          let count = 0;
          for (const line of lines) {
            if ((storageText + line + '\n').length > 940) break;
            storageText += line + '\n';
            count++;
          }
          const remaining = lines.length - count;
          if (remaining > 0) {
            storageText += `*...dan ${remaining} item lainnya.*`;
          }
        }
      }

      // Format Status Vitalitas
      const healthStr = res.health !== null ? `❤️ **${res.health}/${res.maxHealth || 20} HP**` : '❤️ *N/A*';
      const levelStr = `⭐ **Level ${res.level || 0}**`;
      const isOffline = Boolean(res.isOffline);

      const { getSkinUrls } = require('../skinHelper');
      const skin = await getSkinUrls(res.name);

      const embed = new EmbedBuilder()
        .setColor(isOffline ? 0x95a5a6 : 0x00b0f4)
        .setTitle(`🎒 Inventory Pemain: ${res.name} ${isOffline ? '(⚪ Offline)' : '(🟢 Online)'}`)
        .setDescription(isOffline
          ? `⚠️ *Pemain sedang offline. Menampilkan data inventaris terakhir saat logout:*`
          : `Status & perlengkapan pemain saat ini di server Minecraft Bedrock:`)
        .setThumbnail(skin.avatar)
        .addFields(
          {
            name: '📊 Status Pemain',
            value: `${healthStr}  •  ${levelStr}`,
            inline: false
          },
          {
            name: '🛡️ Perlengkapan & Armor',
            value: armorLines,
            inline: false
          },
          {
            name: '⚔️ Hotbar Utama (Slot 1–9)',
            value: hotbarText,
            inline: false
          },
          {
            name: `📦 Isi Tas Penyimpanan (${res.storage ? res.storage.length : 0} Item)`,
            value: storageText,
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
      console.error('[Command inventory] Error:', err);
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat memeriksa inventory: ${err.message}`
      });
    }
  }
};
