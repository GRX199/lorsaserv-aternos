const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-name')
    .setDescription('Sinkronkan nama bot dan status jumlah pemain secara paksa di server Discord (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

    const statusManager = context?.statusManager;
    if (!statusManager) {
      await interaction.editReply({ content: '⚠️ StatusManager belum aktif.' });
      return;
    }

    try {
      const guild = interaction.guild;
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);

      if (!me) {
        await interaction.editReply({ content: '❌ Gagal memuat data bot di server ini.' });
        return;
      }

      const hasNickPerm = me.permissions.has(PermissionFlagsBits.ChangeNickname)
        || me.permissions.has(PermissionFlagsBits.Administrator);

      // 1. Sinkronkan via console command /list jika di Linux
      if (process.platform === 'linux') {
        try {
          const { sendConsoleCommand } = require('../serverController');
          sendConsoleCommand('list');
        } catch {}
      }

      // 2. Refresh status server terkini secara live
      await statusManager.updateStatusEmbed().catch(() => {});

      const status = statusManager.getLatestStatus();
      const isOnline = Boolean(status && status.online);
      const online = status?.players?.online ?? 0;
      const max = status?.players?.max ?? 10;

      // Update presence & bot nickname
      statusManager.updatePresence();

      let nickResult = '';
      if (!hasNickPerm) {
        nickResult = '⚠️ **Bot TIDAK memiliki izin "Change Nickname" (Ubah Nama Panggilan)!**\n'
          + '👉 **Solusi:** Buka **Server Settings (Pengaturan Server) → Roles (Peran) → Role Bot Anda → Permissions → Centang "Change Nickname" (Ubah Nama Panggilan)** lalu jalankan `/sync-name` kembali.';
      } else {
        let baseName = context.config?.botName || me.user?.username || 'lorsaserv';
        if (me.nickname) {
          const cleaned = me.nickname.replace(/\s*\[.*?\]\s*$/, '').trim();
          if (cleaned) baseName = cleaned;
        }

        const count = isOnline ? online : 0;
        let targetNick = `${baseName} [${count}/${max}]`;

        // Batasi 32 karakter
        if (targetNick.length > 32) {
          const suffix = ` [${count}/${max}]`;
          const maxBase = Math.max(1, 32 - suffix.length);
          baseName = baseName.substring(0, maxBase).trim();
          targetNick = `${baseName}${suffix}`;
        }

        await me.setNickname(targetNick);
        nickResult = `✅ **Nama bot berhasil diperbarui menjadi:** \`${targetNick}\``;
      }

      const embed = new EmbedBuilder()
        .setColor(hasNickPerm ? 0x2ECC71 : 0xE67E22)
        .setTitle('🔄 Sinkronisasi Nama & Status Bot')
        .setDescription([
          `📊 **Status Server**: ${isOnline ? '`🟢 ONLINE`' : '`🔴 OFFLINE`'}`,
          `👥 **Pemain Terdeteksi**: \`${online} / ${max}\``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏷️ **Hasil Nickname Bot**:`,
          nickResult,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 *Presence activity bot di profil & member list juga telah disinkronkan.*`
        ].join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Gagal sinkronisasi nama: ${err.message}`
      });
    }
  }
};
