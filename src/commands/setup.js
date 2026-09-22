const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-status')
    .setDescription('Pasang Live Status Panel otomatis di channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { statusManager } = context;
      const channel = interaction.channel;

      const message = await statusManager.setupStatusMessage(channel);

      await interaction.editReply({
        content: `✅ **Berhasil!** Live Status Panel telah dipasang di ${channel}. Bot akan memperbarui pesan tersebut secara otomatis setiap beberapa detik!`
      });
    } catch (err) {
      console.error('[Command setup-status] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal memasang live status panel: ${err.message}`
      });
    }
  }
};
