const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-logs')
    .setDescription('Aktifkan live stream log konsol server Minecraft di channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel tempat log akan dikirimkan (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('matikan')
        .setDescription('Pilih True jika ingin menonaktifkan live streaming log')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { statusManager } = context;
      const disable = interaction.options.getBoolean('matikan');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (disable) {
        statusManager.setLogChannelId(null);
        await interaction.editReply({
          content: '⏹️ **Live Log Konsol Dinonaktifkan.** Bot tidak akan lagi mengirimkan log Minecraft ke Discord.'
        });
        return;
      }

      // Periksa izin bot di channel target
      const botMember = await interaction.guild.members.fetchMe().catch(() => null);
      if (botMember && !targetChannel.permissionsFor(botMember).has(['ViewChannel', 'SendMessages'])) {
        await interaction.editReply({
          content: `⚠️ **Bot Tidak Memiliki Izin di ${targetChannel}:**\nBot belum memiliki izin **View Channel** atau **Send Messages** di channel tersebut.\nSilakan buka **Settings Channel $\rightarrow$ Permissions**, tambahkan role bot dan beri izin View & Send Messages.`
        });
        return;
      }

      statusManager.setLogChannelId(targetChannel.id);

      await targetChannel.send({
        content: [
          `🖥️ **KONSOL LOG REAL-TIME MINECRAFT DIAKTIFKAN**`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Channel ini sekarang terhubung langsung ke konsol server Minecraft Bedrock VPS.`,
          `Semua aktivitas server (player join/leave, world save, pergerakan, error) akan muncul di sini secara real-time.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n')
      });

      if (statusManager.playerLogMonitor) {
        statusManager.playerLogMonitor.sendStartupLogMessage();
      }

      await interaction.editReply({
        content: `✅ **Berhasil!** Channel ${targetChannel} telah disetel sebagai channel **Live Console Logs**.\nSemua log server sekarang akan dikirim ke sana secara real-time!`
      });
    } catch (err) {
      console.error('[Command setup-logs] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengatur channel log: ${err.message}`
      });
    }
  }
};
