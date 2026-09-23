const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getConnectUrl } = require('../embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Tampilkan IP dan Port server Minecraft')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { config, statusManager } = context;
    const servers = statusManager ? statusManager.getServers() : (config.servers || [config.mcserver]);
    const target = servers.find(s => s.id === 'vps' || s.isLocal) || servers[0];
    const connectUrl = getConnectUrl(target, config);

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`🎮 Cara Bergabung ke Server ${target.name}`)
      .setDescription([
        `📱 **Masuk Otomatis (Android / iOS / Windows):**`,
        `👉 **[KLIK DI SINI UNTUK BUKA MINECRAFT OTOMATIS](${connectUrl})**`,
        `*(Atau ketuk tombol hijau **Buka Game Minecraft** di bawah)*`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 **Data Server Manual (Salin di bawah):**`,
        ``,
        `📡 **Server Address / IP:** *(Ketuk teks dalam kotak untuk salin)*`,
        `\`\`\`\n${target.ip}\n\`\`\``,
        `🔌 **Port Bedrock:** *(Ketuk teks dalam kotak untuk salin)*`,
        `\`\`\`\n${target.port}\n\`\`\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `*Buka Minecraft Bedrock → Play → Servers → Add Server lalu paste data di atas.*`
      ].join('\n'))
      .setFooter({ text: target.name || 'Minecraft Bedrock Server' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(connectUrl)
        .setLabel('Buka Game Minecraft')
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId(`btn_copy_ip_${target.id || 'vps'}`)
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
