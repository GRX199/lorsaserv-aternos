const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-chat')
    .setDescription('Tentukan channel Discord khusus untuk Chat Bridge 2 arah dengan Minecraft')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel tempat chat game Minecraft akan dihubungkan (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('matikan')
        .setDescription('Pilih True jika ingin menonaktifkan fitur chat bridge')
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
          statusManager.setChatBridgeChannelId(null);
        }
        await interaction.editReply({
          content: '⏹️ **Chat Bridge Dinonaktifkan.** Pesan tidak akan lagi diteruskan antara Discord dan Minecraft.'
        });
        return;
      }

      // Periksa izin bot di channel target
      const botMember = await interaction.guild.members.fetchMe().catch(() => null);
      if (botMember && !targetChannel.permissionsFor(botMember).has(['ViewChannel', 'SendMessages'])) {
        await interaction.editReply({
          content: `⚠️ **Bot Tidak Memiliki Izin di ${targetChannel}:**\nBot memerlukan izin **View Channel** dan **Send Messages** di channel tersebut.`
        });
        return;
      }

      if (statusManager) {
        statusManager.setChatBridgeChannelId(targetChannel.id);
      }

      await targetChannel.send({
        content: [
          `💬 **MINECRAFT $\\longleftrightarrow$ DISCORD CHAT BRIDGE DIAKTIFKAN**`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Channel ini sekarang terhubung langsung ke in-game chat Minecraft Bedrock VPS (2 Arah)!`,
          `• 🎮 **Pemain di Game**: Setiap chat ketikan pemain di Minecraft akan otomatis muncul di sini.`,
          `• 💬 **Member di Discord**: Setiap pesan yang Anda ketik di channel ini akan langsung disiarkan ke layar pemain di dalam game!`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n')
      }).catch(() => {});

      await interaction.editReply({
        content: `✅ **Berhasil!** Channel ${targetChannel} sekarang resmi dijadikan channel khusus **Chat Bridge 2 Arah**.`
      });
    } catch (err) {
      console.error('[setup-chat] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengatur channel chat bridge: ${err.message}`
      });
    }
  }
};
