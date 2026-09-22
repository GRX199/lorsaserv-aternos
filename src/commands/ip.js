const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Tampilkan IP dan Port server Minecraft'),

  async execute(interaction, context) {
    const { config } = context;
    const mc = config.mcserver;
    const deepLink = `minecraft://?addExternalServer=${encodeURIComponent(mc.name)}|${mc.ip}:${mc.port}`;

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`🎮 Cara Bergabung ke Server ${mc.name}`)
      .setDescription([
        `📱 **Masuk Otomatis (Android / iOS / Windows):**`,
        `👉 **[KLIK DI SINI UNTUK BUKA MINECRAFT OTOMATIS](${deepLink})**`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 **Data Server Manual (Salin di bawah):**`,
        ``,
        `📡 **Server Address / IP:** (Ketuk/tahan untuk salin)`,
        `\`\`\`\n${mc.ip}\n\`\`\``,
        `🔌 **Port:** (Ketuk/tahan untuk salin)`,
        `\`\`\`\n${mc.port}\n\`\`\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `*Buka Minecraft Bedrock → Play → Servers → Add Server lalu paste data di atas.*`
      ].join('\n'))
      .setFooter({ text: mc.footerText || 'Minecraft Bedrock Server' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_copy_ip')
        .setLabel('Salin IP & Port')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_connect_android')
        .setLabel('Connect (Android)')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
