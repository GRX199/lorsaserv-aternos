const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { execSync } = require('node:child_process');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('op')
    .setDescription('Jadikan pemain sebagai Operator (Admin) di server Minecraft Bedrock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Nama / Gamertag pemain yang ingin dijadikan Operator')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const playerName = interaction.options.getString('pemain').trim().replace(/["'\\]/g, '');

    if (!playerName) {
      await interaction.editReply({ content: '❌ Nama pemain tidak boleh kosong!' });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({ content: '❌ Fitur ini hanya bekerja di VPS Linux.' });
      return;
    }

    try {
      execSync(`screen -S mc-bedrock -X stuff "op \\"${playerName}\\"\\n"`, { timeout: 4000 });

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('👑 Operator Berhasil Diberikan!')
        .setDescription(`Pemain **${playerName}** sekarang telah menjadi **Operator (Admin)** server!`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
        .addFields(
          { name: '👤 Pemain', value: `\`${playerName}\``, inline: true },
          { name: '⚡ Status', value: '`Aktif Seketika (Tanpa Restart)`', inline: true }
        )
        .setFooter({ text: 'Izin Operator Minecraft Bedrock' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command op] Error:', err);
      await interaction.editReply({
        content: `⚠️ Gagal memberikan status Operator. Pastikan server Bedrock aktif di sesi screen: ${err.message}`
      });
    }
  }
};
