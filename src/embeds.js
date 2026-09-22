const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Membuat Embed status panel yang rapi dan menarik untuk server tertentu
 * @param {object} status - Data status dari checkServerStatus()
 * @param {object} serverConfig - Konfigurasi spesifik server { id, name, ip, port, type, isLocal, icon }
 * @param {object} globalConfig - Objek konfigurasi global dari config.json
 */
function createStatusEmbed(status, serverConfig, globalConfig) {
  const isOnline = Boolean(status && status.online);
  const serverName = serverConfig.name || 'Minecraft Server';
  const color = isOnline
    ? (globalConfig?.display?.colorOnline || '#2ECC71')
    : (globalConfig?.display?.colorOffline || '#E74C3C');

  const nowUnix = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(isOnline ? `🟢  ${serverName.toUpperCase()} • ONLINE` : `🔴  ${serverName.toUpperCase()} • OFFLINE`)
    .setThumbnail(serverConfig.icon || globalConfig?.mcserver?.icon || null)
    .setTimestamp();

  if (isOnline) {
    const playersOnline = status.players?.online ?? 0;
    const playersMax = status.players?.max ?? (serverConfig.isLocal ? 10 : 20);
    const edition = status.edition || (serverConfig.type === 'java' ? 'Java Edition' : 'Bedrock Edition');
    const version = status.version || 'Bedrock';

    let description = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status**: \`🟢 ONLINE\` ${status.latencyMs ? `(${status.latencyMs}ms)` : ''}`,
      `👥 **Pemain Online**: \` ${playersOnline} / ${playersMax} \` orang`,
      `🌐 **Versi / Tipe**: \`${edition}\` (${version})`,
      `📡 **Alamat Host**: \`${serverConfig.ip}\``,
      `🔌 **Port Bedrock**: \`${serverConfig.port}\``,
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

    description.push(`📱 Klik tombol di bawah untuk menyalin IP atau masuk langsung!`);
    description.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    description.push(`🔄 Diperbarui: <t:${nowUnix}:R>`);

    embed.setDescription(description.join('\n'));
  } else {
    embed.setDescription([
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status**: \`🔴 OFFLINE\``,
      `👥 **Pemain**: \` 0 / ${status.players?.max || (serverConfig.isLocal ? 10 : 20)} \``,
      `📡 **Alamat Host**: \`${serverConfig.ip}\``,
      `🔌 **Port Bedrock**: \`${serverConfig.port}\``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      serverConfig.isLocal
        ? `⚠️ *Server VPS saat ini sedang offline. Klik tombol **▶ Nyalakan Server** di bawah!*`
        : `⚠️ *Server Aternos saat ini sedang offline. Buka web Aternos untuk menyalakan!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔄 Diperbarui: <t:${nowUnix}:R>`
    ].join('\n'));
  }

  const footerText = serverConfig.isLocal
    ? 'Minecraft Dedicated Server • VPS Tencent 24/7'
    : 'Minecraft Server • Aternos Hosting';

  embed.setFooter({ text: footerText, iconURL: serverConfig.icon || undefined });

  return embed;
}

/**
 * Membuat Action Row berisi tombol interaktif (Connect Android, Nyalakan Server, Refresh, Salin IP)
 * @param {object} serverConfig - Konfigurasi server { id, name, ip, port, isLocal }
 * @param {boolean} isOnline - Status apakah server sedang online
 */
function createStatusButtons(serverConfig, isOnline = true) {
  const row = new ActionRowBuilder();
  const sId = serverConfig.id || 'main';

  // Jika server online: berikan tombol Connect Android & Salin IP
  if (isOnline) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_connect_android_${sId}`)
        .setLabel('Connect (Android)')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`btn_copy_ip_${sId}`)
        .setLabel('Salin IP & Port')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_refresh_status')
        .setLabel('Perbarui')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    // Jika server offline:
    if (serverConfig.isLocal) {
      // Jika server VPS lokal: tombol Nyalakan Server
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('btn_start_server')
          .setLabel('Nyalakan Server')
          .setEmoji('▶')
          .setStyle(ButtonStyle.Success)
      );
    } else {
      // Jika Aternos: tombol link langsung buka dashboard Aternos di browser
      row.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL('https://aternos.org/servers/')
          .setLabel('Buka Aternos Web')
          .setEmoji('🔗')
      );
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_copy_ip_${sId}`)
        .setLabel('Salin IP & Port')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_refresh_status')
        .setLabel('Perbarui Status')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
    );
  }

  return row;
}

module.exports = {
  createStatusEmbed,
  createStatusButtons
};
