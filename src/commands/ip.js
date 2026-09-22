const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Tampilkan IP dan Port server Minecraft'),

  async execute(interaction, context) {
    const { config } = context;
    const mc = config.mcserver;

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`🎮 Cara Bergabung ke ${mc.name}`)
      .setDescription([
        `Salin informasi berikut ke game Minecraft Bedrock Anda:`,
        ``,
        `📡 **Server Name**: \`${mc.name}\``,
        `🌐 **Server Address**: \`${mc.ip}\``,
        `🔌 **Port**: \`${mc.port}\``,
        ``,
        `*Catatan untuk pemain Bedrock: Pastikan memasukkan Port ${mc.port} dengan benar, karena port default adalah 19132.*`
      ].join('\n'))
      .setFooter({ text: mc.footerText || 'Minecraft Server' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_copy_ip')
        .setLabel('Salin IP & Port')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
