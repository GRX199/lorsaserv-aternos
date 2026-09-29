const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-security')
    .setDescription('Tentukan channel Discord private untuk notifikasi alarm & chest rahasia')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel private tempat alarm chest rahasia akan dikirim (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('matikan')
        .setDescription('Pilih True jika ingin menonaktifkan notifikasi alarm keamanan')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { statusManager } = context;
      const disable = interaction.options.getBoolean('matikan');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (disable) {
        if (statusManager) {
          statusManager.setSecurityAlertChannelId(null);
        }
        await interaction.editReply({
          content: '⏹️ **Notifikasi Keamanan Dinonaktifkan.** Bot tidak akan lagi mengirim alarm chest rahasia.'
        });
        return;
      }

      const botMember = await interaction.guild.members.fetchMe().catch(() => null);
      if (botMember && !targetChannel.permissionsFor(botMember).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        await interaction.editReply({
          content: `⚠️ **Bot Tidak Memiliki Izin di ${targetChannel}:**\nBot memerlukan izin **View Channel**, **Send Messages**, dan **Embed Links** di channel tersebut.`
        });
        return;
      }

      if (statusManager) {
        statusManager.setSecurityAlertChannelId(targetChannel.id);
      }

      await targetChannel.send({
        content: [
          `🚨 **NOTIFIKASI KEAMANAN & ALARM CHEST RAHASIA AKTIF**`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Channel private ini sekarang resmi digunakan untuk menerima alarm bahaya:`,
          `• 👣 **Penyusup Melintas**: Deteksi saat pemain asing berjalan di atas chest rahasia.`,
          `• ⛏️ **Penggalian Blok**: Deteksi saat blok penutup di atas chest digali/dihancurkan.`,
          `• 🔓 **Peti Dibuka**: Deteksi seketika saat chest dibuka oleh orang lain.`,
          `• 💥 **Peti Dihancurkan**: Deteksi saat chest rahasia dihancurkan.`,
          `• 📟 **Command Block**: Siap menerima perintah \`/scriptevent bot:security <pesan>\`.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n')
      }).catch(() => {});

      await interaction.editReply({
        content: `✅ **Berhasil!** Channel ${targetChannel} sekarang ditetapkan sebagai channel private untuk **Alarm Keamanan & Chest Rahasia**.`
      });
    } catch (err) {
      console.error('[setup-security] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengatur channel keamanan: ${err.message}`
      });
    }
  }
};
