const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-alerts')
    .setDescription('Tentukan channel Discord untuk notifikasi pemain masuk & keluar game')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel tempat notifikasi pemain akan dikirim (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('matikan')
        .setDescription('Pilih True jika ingin menonaktifkan notifikasi pemain')
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
          statusManager.setAlertChannelId(null);
        }
        await interaction.editReply({
          content: '⏹️ **Notifikasi Pemain Dinonaktifkan.** Bot tidak akan lagi mengirim notifikasi saat pemain masuk/keluar.'
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
        statusManager.setAlertChannelId(targetChannel.id);
      }

      await targetChannel.send({
        content: [
          `🔔 **NOTIFIKASI PEMAIN MINECRAFT DIAKTIFKAN**`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Channel ini sekarang resmi digunakan untuk mengirim notifikasi:`,
          `• 🟢 **Pemain Masuk**: Lengkap dengan nama & foto avatar skin pemain.`,
          `• 🔴 **Pemain Keluar**: Menampilkan waktu & sisa jumlah pemain online.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n')
      }).catch(() => {});

      await interaction.editReply({
        content: `✅ **Berhasil!** Channel ${targetChannel} sekarang ditetapkan untuk notifikasi pemain masuk & keluar.`
      });
    } catch (err) {
      console.error('[setup-alerts] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengatur channel notifikasi: ${err.message}`
      });
    }
  }
};
