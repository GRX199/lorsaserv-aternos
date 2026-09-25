const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Mendapatkan tautan HTTP redirect koneksi server yang valid dan bisa diklik di Discord
 * @param {object} serverConfig - Konfigurasi server { id, name, ip, port }
 * @param {object} globalConfig - Konfigurasi global bot
 */
function getConnectUrl(serverConfig, globalConfig) {
  const host = globalConfig?.publicUrl
    || process.env.PUBLIC_URL
    || (globalConfig?.publicIp ? `http://${globalConfig.publicIp}:${process.env.PORT || 3000}` : null)
    || (serverConfig?.ip && serverConfig.ip !== 'auto' ? `http://${serverConfig.ip}:${process.env.PORT || 3000}` : null)
    || `http://129.226.95.58:${process.env.PORT || 3000}`;

  const cleanHost = host.replace(/\/+$/, '');
  const sId = serverConfig?.id || 'main';
  return `${cleanHost}/connect?id=${encodeURIComponent(sId)}`;
}

/**
 * Mendapatkan tautan Web Map Live yang bisa diklik langsung dari Discord (Radar Live)
 * @param {object} globalConfig - Konfigurasi global bot
 */
function getMapUrl(globalConfig) {
  const host = globalConfig?.publicUrl
    || process.env.PUBLIC_URL
    || (globalConfig?.publicIp ? `http://${globalConfig.publicIp}:${process.env.PORT || 3000}` : null)
    || `http://129.226.95.58:${process.env.PORT || 3000}`;

  const cleanHost = host.replace(/\/+$/, '');
  return `${cleanHost}/map`;
}

/**
 * Mendapatkan tautan Web Map Visual Blok Dunia Asli (uNmINeD Renderer)
 * @param {object} globalConfig - Konfigurasi global bot
 */
function getWorldMapUrl(globalConfig) {
  const host = globalConfig?.publicUrl
    || process.env.PUBLIC_URL
    || (globalConfig?.publicIp ? `http://${globalConfig.publicIp}:${process.env.PORT || 3000}` : null)
    || `http://129.226.95.58:${process.env.PORT || 3000}`;

  const cleanHost = host.replace(/\/+$/, '');
  return `${cleanHost}/world-map`;
}

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
    const connectUrl = getConnectUrl(serverConfig, globalConfig);

    let description = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status**: \`🟢 ONLINE\` ${status.latencyMs ? `(${status.latencyMs}ms)` : ''}`,
      `👥 **Pemain Online**: \` ${playersOnline} / ${playersMax} \` orang`,
      `🌐 **Versi / Tipe**: \`${edition}\` (${version})`,
      `📡 **Alamat Host**: \`${serverConfig.ip}\``,
      `📱 **Port Bedrock**: \`${serverConfig.port}\``,
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

    description.push(`🎮 **Masuk Otomatis**: [Klik Buka Minecraft Bedrock](${connectUrl})`);
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
      `📱 **Port Bedrock**: \`${serverConfig.port}\``,
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
 * Membuat Action Rows berisi tombol interaktif ramah PC & Mobile
 * @param {object} serverConfig - Konfigurasi server { id, name, ip, port, isLocal }
 * @param {boolean} isOnline - Status apakah server sedang online
 * @param {object} globalConfig - Objek konfigurasi global config.json
 */
function createStatusButtons(serverConfig, isOnline = true, globalConfig = null) {
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  const sId = serverConfig.id || 'main';

  // Baris 1: Koneksi & Kendali Utama (Maksimal 3 tombol agar pas di layar HP)
  if (isOnline) {
    const connectUrl = getConnectUrl(serverConfig, globalConfig);

    row1.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(connectUrl)
        .setLabel('Masuk Game')
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId(`btn_copy_ip_${sId}`)
        .setLabel('Salin IP')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_refresh_status')
        .setLabel('Perbarui')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    if (serverConfig.isLocal) {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId('btn_start_server')
          .setLabel('Nyalakan')
          .setEmoji('▶')
          .setStyle(ButtonStyle.Success)
      );
    } else {
      row1.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL('https://aternos.org/servers/')
          .setLabel('Buka Aternos')
          .setEmoji('🔗')
      );
    }

    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_copy_ip_${sId}`)
        .setLabel('Salin IP')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_refresh_status')
        .setLabel('Perbarui')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
    );
  }

  // Baris 2: Fitur Pemain & Komunitas (Mobile Responsive)
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId('btn_member_daily')
      .setLabel('Hadiah Harian')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_member_profile')
      .setLabel('Profil 3D')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_member_top')
      .setLabel('Peringkat')
      .setEmoji('🏅')
      .setStyle(ButtonStyle.Secondary)
  );

  // Baris 3: Tautan Web Map Dunia Real-Time & Visual Asli
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Visual Dunia Asli')
      .setEmoji('🌍')
      .setStyle(ButtonStyle.Link)
      .setURL(getWorldMapUrl(globalConfig)),
    new ButtonBuilder()
      .setLabel('Radar Pemain Live')
      .setEmoji('📡')
      .setStyle(ButtonStyle.Link)
      .setURL(getMapUrl(globalConfig))
  );

  return [row1, row2, row3];
}

/**
 * Membuat Embed Panel Kontrol Khusus Admin
 */
function createAdminPanelEmbed(serverConfig, status, globalConfig) {
  const isOnline = Boolean(status && status.online);
  const serverName = serverConfig?.name || 'Minecraft Bedrock';
  const playersOnline = status?.players?.online ?? 0;
  const playersMax = status?.players?.max ?? 20;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F) // Gold
    .setTitle(`🛠️ LIVE ADMIN CONTROL PANEL • ${serverName.toUpperCase()}`)
    .setDescription([
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👑 **Panel Pusat Kendali Server Minecraft Bedrock**`,
      `Gunakan tombol interaktif di bawah untuk mengontrol server, memantau pemain, atau menjalankan fungsi darurat langsung tanpa membuka SSH terminal.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 **Status Server**: ${isOnline ? '`🟢 ONLINE`' : '`🔴 OFFLINE`'} • 👥 **Pemain**: \`${playersOnline}/${playersMax}\``,
      `💻 **Engine / VPS**: \`Minecraft Bedrock Dedicated Server\` (Tencent SG)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔒 *Tombol di bawah hanya dapat dieksekusi oleh Administrator.*`
    ].join('\n'))
    .setThumbnail(serverConfig?.icon || globalConfig?.mcserver?.icon || null)
    .addFields(
      {
        name: '⚡ Kontrol Daya',
        value: '🟢 **Start** • 🔴 **Stop** • 🔄 **Restart**',
        inline: true
      },
      {
        name: '🔍 Pemain & Alat',
        value: '🎒 **Inventory** • 📍 **Koordinat** • 👑 **OP** • ✨ **Enchant**',
        inline: true
      },
      {
        name: '💾 Data & Manajemen',
        value: '📥 **Backup ZIP** • ⚡ **CMD Konsol** • 🧹 **Clear Lag** • 🌍 **Render Map**',
        inline: false
      }
    )
    .setFooter({ text: 'SASY199 Live Admin Control Hub • Mobile & Desktop Responsive' })
    .setTimestamp();

  return embed;
}

/**
 * Membuat Action Rows Tombol untuk Admin Control Panel
 */
function createAdminPanelButtons(isOnline = true, globalConfig = null) {
  // Baris 1: Kontrol Daya Server
  const rowPower = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_start')
      .setLabel('Nyalakan')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isOnline),
    new ButtonBuilder()
      .setCustomId('btn_admin_stop')
      .setLabel('Matikan')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isOnline),
    new ButtonBuilder()
      .setCustomId('btn_admin_restart')
      .setLabel('Restart')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
  );

  // Baris 2: Pemantauan & Fitur Pemain
  const rowInspect = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_inv')
      .setLabel('Cek Inventory')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_admin_locate')
      .setLabel('Lacak Lokasi')
      .setEmoji('📍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_admin_op')
      .setLabel('Kelola OP')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_admin_enchant')
      .setLabel('Enchant Instan')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success)
  );

  // Baris 3: Manajemen & Utilitas
  const rowUtil = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_backup')
      .setLabel('Unduh Backup')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_admin_rendermap')
      .setLabel('Render Map')
      .setEmoji('🌍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_admin_cmd')
      .setLabel('Konsol CMD')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_admin_clearlag')
      .setLabel('Bersihkan Lag')
      .setEmoji('🧹')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('Web Map')
      .setEmoji('🗺️')
      .setStyle(ButtonStyle.Link)
      .setURL(getWorldMapUrl(globalConfig))
  );

  return [rowPower, rowInspect, rowUtil];
}

module.exports = {
  createStatusEmbed,
  createStatusButtons,
  createAdminPanelEmbed,
  createAdminPanelButtons,
  getConnectUrl,
  getMapUrl,
  getWorldMapUrl
};

