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

function formatItem(item) {
  if (!item || !item.id) return '*(Kosong)*';
  const cleanName = formatItemName(item.id);
  const countStr = item.amount > 1 ? ` **x${item.amount}**` : '';
  const tagStr = item.name ? ` *("${item.name}")*` : '';
  const icon = getItemEmoji(item.id);
  return `${icon} ${cleanName}${countStr}${tagStr}`;
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
      const armorLines = [
        `🪖 **Helm:** ${formatItem(res.armor?.head)}`,
        `👕 **Baju:** ${formatItem(res.armor?.chest)}`,
        `👖 **Celana:** ${formatItem(res.armor?.legs)}`,
        `🥾 **Sepatu:** ${formatItem(res.armor?.feet)}`,
        `🛡️ **Offhand:** ${formatItem(res.armor?.offhand)}`
      ].join('\n');

      // Format Hotbar (Slot 1–9)
      let hotbarText = '*(Semua slot hotbar kosong)*';
      if (res.hotbar && res.hotbar.length > 0) {
        hotbarText = res.hotbar.map(it => `**[Slot ${it.slot + 1}]** ${formatItem(it)}`).join('\n');
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
