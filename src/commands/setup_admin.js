const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createAdminPanelEmbed, createAdminPanelButtons } = require('../embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-admin')
    .setDescription('Pasang Live Control Panel khusus Administrator di channel tertentu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel khusus admin tempat panel kontrol akan dipasang (Default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

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

    const { statusManager, config } = context;
    if (!statusManager) {
      await interaction.editReply({
        content: '⚠️ StatusManager belum aktif pada bot ini.'
      });
      return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.editReply({
        content: '❌ Channel target tidak valid atau bukan channel teks.'
      });
      return;
    }

    try {
      const servers = statusManager.getServers();
      const vpsServer = servers.find(s => s.id === 'vps') || servers[0];
      const status = await statusManager.getStatusForServer(vpsServer);

      const embed = createAdminPanelEmbed(vpsServer, status, config);
      const buttons = createAdminPanelButtons(Boolean(status?.online));

      // Hapus pesan panel admin lama jika ada di channel yang sama
      if (statusManager.state?.adminMessageId && statusManager.state?.adminChannelId === targetChannel.id) {
        try {
          const oldMsg = await targetChannel.messages.fetch(statusManager.state.adminMessageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        } catch {}
      }

      const panelMsg = await targetChannel.send({
        embeds: [embed],
        components: buttons
      });

      // Simpan ID pesan panel admin ke state
      statusManager.state = statusManager.state || {};
      statusManager.state.adminChannelId = targetChannel.id;
      statusManager.state.adminMessageId = panelMsg.id;
      statusManager.saveState();

      await interaction.editReply({
        content: `✅ **Live Admin Control Panel Berhasil Dipasang!**\nPanel kontrol telah dikirimkan ke <#${targetChannel.id}>. Panel ini akan diperbarui secara otomatis setiap ada perubahan status di server Minecraft Bedrock.`
      });
    } catch (err) {
      console.error('[Command setup-admin] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal memasang panel admin: ${err.message}`
      });
    }
  }
};
