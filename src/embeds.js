const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Membuat Embed status panel yang rapi dan menarik
 * @param {object} status - Data status dari checkServerStatus()
 * @param {object} config - Objek konfigurasi dari config.json
 */
function createStatusEmbed(status, config) {
  const mcConfig = config.mcserver;
  const isOnline = Boolean(status && status.online);
  const serverName = mcConfig.name || 'Minecraft Server';
  const color = isOnline
    ? (config.display?.colorOnline || '#2ECC71')
    : (config.display?.colorOffline || '#E74C3C');

  const nowUnix = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(isOnline ? `🟢  ${serverName.toUpperCase()} • ONLINE` : `🔴  ${serverName.toUpperCase()} • OFFLINE`)
    .setThumbnail(mcConfig.icon || null)
    .setTimestamp();

  if (isOnline) {
    const playersOnline = status.players?.online ?? 0;
    const playersMax = status.players?.max ?? 20;
    const edition = status.edition || (mcConfig.type === 'java' ? 'Java Edition' : 'Bedrock Edition');
    const version = status.version || 'Bedrock';

    let description = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status Server**: \`🟢 ONLINE\` ${status.latencyMs ? `(${status.latencyMs}ms)` : ''}`,
      `👥 **Pemain Online**: \` ${playersOnline} / ${playersMax} \` orang`,
      `🌐 **Versi / Tipe**: \`${edition}\` (${version})`,
      `📡 **Alamat Host**: \`${mcConfig.ip}\``,
      `🔌 **Port Bedrock**: \`${mcConfig.port}\``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    ];

    if (status.motd && status.motd !== 'Minecraft Server') {
      description.push(`💬 *${status.motd}*`);
      description.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }

    if (status.players?.list && status.players.list.length > 0) {
      const listStr = status.players.list.slice(0, 10).join(', ');
      const extra = status.players.list.length > 10 ? ` (+${status.players.list.length - 10} lainnya)` : '';
      description.push(`📋 **Daftar Pemain**: ${listStr}${extra}`);
      description.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }

    description.push(`🔄 Diperbarui: <t:${nowUnix}:R>`);

    embed.setDescription(description.join('\n'));
  } else {
    embed.setDescription([
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status Server**: \`🔴 OFFLINE\``,
      `👥 **Pemain**: \` 0 / ${status.players?.max || 20} \``,
      `📡 **Alamat Host**: \`${mcConfig.ip}\``,
      `🔌 **Port Bedrock**: \`${mcConfig.port}\``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ *Server saat ini sedang offline.*`,
      `Klik tombol **▶ Nyalakan Server** di bawah untuk menyalakan server!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔄 Diperbarui: <t:${nowUnix}:R>`
    ].join('\n'));
  }

  if (mcConfig.footerText) {
    embed.setFooter({ text: mcConfig.footerText, iconURL: mcConfig.icon || undefined });
  }

  return embed;
}

/**
 * Membuat Action Row berisi tombol interaktif (Nyalakan Server, Refresh, Salin IP)
 * @param {object} config - Objek konfigurasi
 * @param {boolean} isOnline - Status apakah server sedang online
 */
function createStatusButtons(config, isOnline = true) {
  const row = new ActionRowBuilder();

  // Jika server offline, sediakan tombol Nyalakan Server
  if (!isOnline) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('btn_start_server')
        .setLabel('Nyalakan Server')
        .setEmoji('▶')
        .setStyle(ButtonStyle.Success)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('btn_refresh_status')
      .setLabel('Perbarui Status')
      .setEmoji('🔄')
      .setStyle(isOnline ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_copy_ip')
      .setLabel('Salin IP & Port')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
  );

  return row;
}

module.exports = {
  createStatusEmbed,
  createStatusButtons
};
