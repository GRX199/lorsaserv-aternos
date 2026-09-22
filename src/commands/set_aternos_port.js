const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-aternos-port')
    .setDescription('Ubah port server Aternos Bedrock secara instan')
    .addIntegerOption(option =>
      option.setName('port')
        .setDescription('Nomor port aktif dari menu Connect di Aternos (misal: 34125)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('address')
        .setDescription('Alamat / DynIP server Aternos (opsional jika berubah)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, context) {
    await interaction.deferReply();

    const newPort = interaction.options.getInteger('port');
    const newAddress = interaction.options.getString('address');
    const { config, statusManager } = context;

    try {
      // Cari server Aternos di config
      let aternosServer = null;
      if (config.servers && Array.isArray(config.servers)) {
        aternosServer = config.servers.find(s => s.id === 'aternos');
      }

      if (!aternosServer) {
        aternosServer = config.mcserver;
      }

      if (!aternosServer) {
        return interaction.editReply({ content: '❌ Konfigurasi server Aternos tidak ditemukan di bot.' });
      }

      const oldPort = aternosServer.port;
      aternosServer.port = newPort;

      if (newAddress && newAddress.trim()) {
        aternosServer.ip = newAddress.trim();
      }

      // Simpan perubahan ke config.json agar permanen
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

      // Segera perbarui status panel di Discord
      if (statusManager) {
        await statusManager.updateStatusEmbed();
      }

      await interaction.editReply({
        content: `✅ **Berhasil mengubah Port Aternos!**\n• Port lama: \`${oldPort}\`\n• Port baru: \` ${newPort} \`${newAddress ? `\n• Alamat baru: \`${newAddress}\`` : ''}\n\nBot sedang mengecek status server Aternos sekarang...`
      });
    } catch (err) {
      console.error('[set-aternos-port] Error:', err);
      await interaction.editReply({ content: `❌ Gagal mengubah port: ${err.message}` });
    }
  }
};
