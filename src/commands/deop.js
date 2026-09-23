const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { execSync } = require('node:child_process');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deop')
    .setDescription('Cabut status Operator (Admin) seorang pemain di server Minecraft Bedrock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Nama / Gamertag pemain yang ingin dicabut status Operatornya')
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
      execSync(`screen -S mc-bedrock -X stuff "deop \\"${playerName}\\"\\n"`, { timeout: 4000 });

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚫 Status Operator Dicabut')
        .setDescription(`Status Operator pemain **${playerName}** telah berhasil dicabut.`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/128`)
        .addFields(
          { name: '👤 Pemain', value: `\`${playerName}\``, inline: true },
          { name: '⚡ Status', value: '`Non-Operator (Pemain Biasa)`', inline: true }
        )
        .setFooter({ text: 'Izin Operator Minecraft Bedrock' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Command deop] Error:', err);
      await interaction.editReply({
        content: `⚠️ Gagal mencabut status Operator: ${err.message}`
      });
    }
  }
};
