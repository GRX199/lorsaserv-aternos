const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { warpManager } = require('../warpManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warp')
    .setDescription('Kelola titik warp dan teleportasi instan server (Khusus Admin / OP)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1. Subcommand: TP
    .addSubcommand(sub =>
      sub
        .setName('tp')
        .setDescription('Teleport pemain ke salah satu titik warp yang tersimpan')
        .addStringOption(opt =>
          opt
            .setName('nama')
            .setDescription('Nama titik warp tujuan')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('pemain')
            .setDescription('Gamertag pemain Minecraft yang ingin di-teleport')
            .setRequired(true)
        )
    )
    // 2. Subcommand: Set
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Buat atau perbarui titik warp baru')
        .addStringOption(opt =>
          opt
            .setName('nama')
            .setDescription('Nama titik warp (contoh: ironfarm, gudang, base)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('pemain')
            .setDescription('Ambil koordinat live saat ini dari pemain Minecraft ini')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('x')
            .setDescription('Koordinat X manual (opsional jika memilih pemain)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('y')
            .setDescription('Koordinat Y manual (opsional jika memilih pemain)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('z')
            .setDescription('Koordinat Z manual (opsional jika memilih pemain)')
            .setRequired(false)
        )
    )
    // 3. Subcommand: Hapus
    .addSubcommand(sub =>
      sub
        .setName('hapus')
        .setDescription('Hapus salah satu titik warp')
        .addStringOption(opt =>
          opt
            .setName('nama')
            .setDescription('Nama titik warp yang ingin dihapus')
            .setRequired(true)
        )
    )
    // 4. Subcommand: List
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Tampilkan daftar semua titik warp yang tersedia')
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    // Verifikasi Izin Admin
    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah warp ini khusus untuk **Administrator / OP Server**!'
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur kontrol teleportasi hanya aktif saat bot terhubung di VPS Linux server.'
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const adminName = interaction.user.displayName || interaction.user.username;

    // ==========================================
    // 1. SUBCOMMAND: TP
    // ==========================================
    if (sub === 'tp') {
      const warpName = interaction.options.getString('nama').trim();
      const playerName = interaction.options.getString('pemain').trim();

      const res = warpManager.teleportPlayerToWarp(playerName, warpName);
      if (res.success) {
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('⚡ Teleportasi Titik Warp Berhasil!')
          .setDescription(res.message)
          .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
          .addFields(
            { name: '📍 Titik Warp', value: `\`${res.warp.name}\``, inline: true },
            { name: '🗺️ Koordinat', value: `\`X: ${res.warp.x}, Y: ${res.warp.y}, Z: ${res.warp.z}\``, inline: true },
            { name: '🌍 Dimensi', value: `\`${res.warp.dimension}\``, inline: true }
          )
          .setFooter({ text: `Diinisiasi oleh Admin: ${adminName}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          content: `⚠️ **Gagal Teleport:** ${res.message}`
        });
      }
      return;
    }

    // ==========================================
    // 2. SUBCOMMAND: SET
    // ==========================================
    if (sub === 'set') {
      const warpName = interaction.options.getString('nama').trim();
      const targetPlayer = interaction.options.getString('pemain')?.trim();
      let posX = interaction.options.getInteger('x');
      let posY = interaction.options.getInteger('y');
      let posZ = interaction.options.getInteger('z');
      let dimension = 'overworld';

      // Jika pemain diisi, ambil koordinat live pemain
      if (targetPlayer) {
        const monitor = context?.statusManager?.playerLogMonitor;
        if (!monitor) {
          await interaction.editReply({ content: '⚠️ Server monitor belum siap membaca lokasi pemain.' });
          return;
        }

        const loc = await monitor.queryPlayerLocation(targetPlayer);
        if (loc.error) {
          await interaction.editReply({
            content: `⚠️ Gagal membaca posisi pemain **${targetPlayer}**: ${loc.error}. Silakan masukkan koordinat X, Y, Z secara manual jika pemain sedang offline.`
          });
          return;
        }

        posX = Math.round(loc.x);
        posY = Math.round(loc.y);
        posZ = Math.round(loc.z);
        dimension = loc.dimension || 'overworld';
      }

      if (posX === null || posY === null || posZ === null) {
        await interaction.editReply({
          content: '❌ Harap isi koordinat `x`, `y`, `z` secara manual atau pilih opsi `pemain` yang sedang online!'
        });
        return;
      }

      try {
        const saved = warpManager.setWarp(warpName, {
          x: posX,
          y: posY,
          z: posZ,
          dimension,
          createdBy: adminName
        });

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📍 Titik Warp Berhasil Disimpan!')
          .setDescription(`Titik warp **\`${saved.name}\`** kini telah aktif di server dan siap digunakan oleh Admin/OP!`)
          .addFields(
            { name: '📍 Nama Warp', value: `\`${saved.name}\``, inline: true },
            { name: '🗺️ Koordinat', value: `\`X: ${saved.x}, Y: ${saved.y}, Z: ${saved.z}\``, inline: true },
            { name: '🌍 Dimensi', value: `\`${saved.dimension}\``, inline: true },
            { name: '💬 Perintah In-Game', value: `\`!warp ${saved.name}\``, inline: true },
            { name: '🤖 Perintah Discord', value: `\`/warp tp nama:${saved.name} pemain:NamaAnda\``, inline: true }
          )
          .setFooter({ text: `Disimpan oleh Admin: ${adminName}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ content: `❌ Gagal menyimpan warp: ${err.message}` });
      }
      return;
    }

    // ==========================================
    // 3. SUBCOMMAND: HAPUS
    // ==========================================
    if (sub === 'hapus') {
      const warpName = interaction.options.getString('nama').trim();
      const success = warpManager.deleteWarp(warpName);

      if (success) {
        await interaction.editReply({
          content: `🗑️ **Titik warp \`${warpName}\` berhasil dihapus!**`
        });
      } else {
        await interaction.editReply({
          content: `⚠️ Titik warp \`${warpName}\` tidak ditemukan di dalam database!`
        });
      }
      return;
    }

    // ==========================================
    // 4. SUBCOMMAND: LIST
    // ==========================================
    if (sub === 'list') {
      const warps = warpManager.getAllWarps();

      if (warps.length === 0) {
        await interaction.editReply({
          content: 'ℹ️ Belum ada titik warp yang tersimpan. Gunakan `/warp set` atau in-game `!setwarp <nama>` untuk membuatnya.'
        });
        return;
      }

      const warpLines = warps.map((w, idx) => {
        const dimIcon = w.dimension.includes('nether') ? '🔥' : (w.dimension.includes('end') ? '🌌' : '🌍');
        return `**${idx + 1}. \`${w.name}\`** ${dimIcon}\n┗ 🗺️ Koordinat: \`X: ${w.x}, Y: ${w.y}, Z: ${w.z}\` • Dimensi: \`${w.dimension}\` (Oleh: *${w.createdBy || 'Admin'}*)`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📍 Daftar Titik Warp Server (Khusus Admin / OP)')
        .setDescription([
          `Total ada **${warps.length} titik warp** yang terdaftar di server:`,
          ``,
          warpLines.join('\n\n'),
          ``,
          `*💡 Cara Pakai di Game: Ketik \`!warp <nama>\` di in-game chat (Khusus OP/Admin).*`,
          `*💡 Cara Pakai di Discord: Gunakan \`/warp tp nama:<nama> pemain:<gamertag>\`.*`
        ].join('\n'))
        .setFooter({ text: 'Warp Points • SASY199' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
};
