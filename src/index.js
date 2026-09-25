require('dotenv').config({ override: true });
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

const { startHealthServer } = require('./server');
const { StatusManager } = require('./statusManager');
const { getConnectUrl } = require('./embeds');
const { sendBroadcast } = require('./serverController');

// 1. Baca Konfigurasi config.json
const configPath = path.join(__dirname, '..', 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('[Main] Gagal membaca config.json:', err.message);
  process.exit(1);
}

// 2. Inisialisasi Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
let statusManager = null;

// 3. Muat Slash Commands dari folder src/commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[Main] Command di ${filePath} tidak memiliki properti 'data' atau 'execute'.`);
  }
}

// 4. Daftarkan Slash Commands ke Discord API
async function registerSlashCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.warn('[Slash Commands] DISCORD_TOKEN atau CLIENT_ID belum diisi di .env. Slash commands dilewati.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`[Slash Commands] Mulai mendaftarkan ${commands.length} slash command...`);

    if (guildId) {
      // Daftar ke server tertentu (Instan tanpa delay)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`[Slash Commands] Berhasil didaftarkan ke server (Guild ID: ${guildId})!`);
    } else {
      // Daftar global (bisa butuh beberapa menit sinkronisasi di Discord)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('[Slash Commands] Berhasil didaftarkan secara GLOBAL!');
    }
  } catch (err) {
    console.error('[Slash Commands] Gagal mendaftarkan commands:', err.message);
  }
}

// 5. Jalankan Web Health Server (Sangat penting untuk Render agar tidak crash / sleep & link connect)
const port = process.env.PORT || 3000;
startHealthServer(port, () => statusManager?.getLatestStatus(), config, () => statusManager);

async function initServerConfig(cfg) {
  let publicIp = null;
  if (process.env.SERVER_IP && process.env.SERVER_IP.trim()) {
    publicIp = process.env.SERVER_IP.trim();
    console.log(`[Config] Menggunakan SERVER_IP dari .env: ${publicIp}`);
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.ipify.org', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        publicIp = (await res.text()).trim();
      }
    } catch (err) {
      console.warn(`[Config] Gagal deteksi IP publik otomatis: ${err.message}`);
    }
  }

  cfg.publicIp = publicIp || '129.226.95.58';
  cfg.webPort = port;
  cfg.publicUrl = process.env.PUBLIC_URL || `http://${cfg.publicIp}:${port}`;

  if (cfg.mcserver) {
    if (!cfg.mcserver.ip || cfg.mcserver.ip === 'auto' || publicIp) {
      cfg.mcserver.ip = publicIp || cfg.publicIp;
    }
  }

  if (cfg.servers && Array.isArray(cfg.servers)) {
    for (const s of cfg.servers) {
      if (!s.ip || s.ip === 'auto' || (s.id === 'vps' && publicIp)) {
        s.ip = publicIp || cfg.publicIp;
        console.log(`[Config] Menggunakan IP Publik untuk ${s.name}: ${s.ip}`);
      }
    }
  }
}

// 6. Event Saat Bot Berhasil Login & Online
client.once('ready', async () => {
  // Inisialisasi IP server dan mode VPS lokal
  await initServerConfig(config);

  console.log(`=========================================`);
  console.log(`🤖 Bot Discord Berhasil Login: ${client.user.tag}`);
  console.log(`🎮 Server Target: ${config.mcserver.name} (${config.mcserver.ip}:${config.mcserver.port})`);
  console.log(`=========================================`);

  // Registrasi slash command
  await registerSlashCommands();

  // Inisialisasi & jalankan StatusManager
  statusManager = new StatusManager(client, config);
  statusManager.start();
});

// 7. Event Listener Interaksi (Slash Commands & Tombol)
client.on('interactionCreate', async (interaction) => {
  try {
    // A. Interaksi Slash Command
    if (interaction.isChatInputCommand()) {
      // Perintah berbahaya / sensitif yang dikunci khusus untuk Admin
      const adminOnlyCommands = [
        'cmd', 'op', 'deop', 'stop-server', 'restart-server',
        'setup-status', 'setup-logs', 'setup-chat', 'setup-admin',
        'inventory', 'locate', 'download-backup', 'sync-name', 'render-map'
      ];

      if (adminOnlyCommands.includes(interaction.commandName)) {
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const isAdmin = isOwner || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
          || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

        if (!isAdmin) {
          await interaction.reply({
            content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Admin (Administrator)**!',
            ephemeral: true
          });
          return;
        }
      }

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const context = {
        config,
        statusManager,
        client
      };

      await command.execute(interaction, context);
      return;
    }

    // B. Interaksi Tombol (Button)
    if (interaction.isButton()) {
      // Tombol 🔄 Refresh Status
      if (interaction.customId === 'btn_refresh_status') {
        await interaction.deferReply({ ephemeral: true });
        if (statusManager) {
          await statusManager.updateStatusEmbed();
        }
        await interaction.editReply({
          content: '✅ Status server Minecraft berhasil diperbarui secara instan!'
        });
        return;
      }

      // Tombol ▶ Nyalakan Server (Boleh untuk semua member agar bisa main saat offline)
      if (interaction.customId === 'btn_start_server') {
        await interaction.deferReply({ ephemeral: true });
        const { startServer } = require('./serverController');
        const res = await startServer();
        await interaction.editReply({
          content: res.success
            ? `🚀 **${res.message}**\nBot akan otomatis mendeteksi dan mengirimkan notifikasi saat server sudah online!`
            : `⚠️ ${res.message}`
        });
        return;
      }

      // Tombol 📋 Salin IP & Port (Mendukung multi-server)
      if (interaction.customId.startsWith('btn_copy_ip')) {
        const sId = interaction.customId.replace('btn_copy_ip_', '').replace('btn_copy_ip', '');
        const servers = statusManager ? statusManager.getServers() : (config.servers || [config.mcserver]);
        const target = servers.find(s => s.id === sId) || servers[0];
        const connectUrl = getConnectUrl(target, config);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(connectUrl)
            .setLabel('Buka Game Minecraft')
            .setEmoji('🎮')
        );

        await interaction.reply({
          content: [
            `📋 **Data Koneksi Server ${target.name}:**`,
            ``,
            `📡 **Alamat IP Server** *(tekan kotak untuk salin)*:`,
            `\`\`\`\n${target.ip}\n\`\`\``,
            `🔌 **Port Bedrock** *(tekan kotak untuk salin)*:`,
            `\`\`\`\n${target.port}\n\`\`\``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📱 **Mau langsung masuk tanpa ketik?**`,
            `👉 **[KLIK DI SINI UNTUK MASUK MINECRAFT](${connectUrl})**`,
            `*(Atau klik tombol hijau **Buka Game Minecraft** di bawah)*`
          ].join('\n'),
          components: [row],
          ephemeral: true
        });
        return;
      }

      // Tombol 🎮 Connect (Android / iOS - Mendukung multi-server)
      if (interaction.customId.startsWith('btn_connect_android')) {
        const sId = interaction.customId.replace('btn_connect_android_', '').replace('btn_connect_android', '');
        const servers = statusManager ? statusManager.getServers() : (config.servers || [config.mcserver]);
        const target = servers.find(s => s.id === sId) || servers[0];
        const connectUrl = getConnectUrl(target, config);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(connectUrl)
            .setLabel('Buka Game Minecraft')
            .setEmoji('🎮')
        );

        await interaction.reply({
          content: [
            `🎮 **Buka Game Minecraft (${target.name}) Otomatis:**`,
            `Klik tautan atau tombol di bawah untuk langsung membuka Minecraft & menambahkan server ke game:`,
            ``,
            `👉 **[KLIK DI SINI UNTUK BUKA GAME MINECRAFT](${connectUrl})**`,
            `*(Atau klik tombol hijau **Buka Game Minecraft** di bawah)*`,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📋 **Atau Salin Manual:**`,
            `• Alamat IP: \`${target.ip}\``,
            `• Port: \`${target.port}\``,
            ``,
            `*💡 Jika game tidak otomatis terbuka, buka Minecraft → Play → Servers → Add Server dan masukkan data di atas.*`
          ].join('\n'),
          components: [row],
          ephemeral: true
        });
        return;
      }

      // Tombol 🔄 Perbarui Metrik VPS
      if (interaction.customId === 'btn_refresh_vps') {
        const { SystemMonitor } = require('./systemMonitor');
        const { embed, row } = SystemMonitor.createEmbed();
        await interaction.update({
          embeds: [embed],
          components: [row]
        }).catch(() => {});
        return;
      }

      // Tombol 🎁 Hadiah Harian Member
      if (interaction.customId === 'btn_member_daily') {
        const modal = new ModalBuilder()
          .setCustomId('modal_daily')
          .setTitle('🎁 Klaim Hadiah Harian Minecraft');
        const input = new TextInputBuilder()
          .setCustomId('input_daily_player')
          .setLabel('Gamertag Minecraft Anda (Sedang Online)')
          .setPlaceholder('Contoh: Steve')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // Tombol 🏆 Profil 3D Member
      if (interaction.customId === 'btn_member_profile') {
        const modal = new ModalBuilder()
          .setCustomId('modal_profile')
          .setTitle('🏆 Cek Profil Pemain & Skin 3D');
        const input = new TextInputBuilder()
          .setCustomId('input_profile_player')
          .setLabel('Gamertag Pemain yang Dicari')
          .setPlaceholder('Contoh: Steve')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // Tombol 🏅 Leaderboard Jam Main
      if (interaction.customId === 'btn_member_top') {
        await interaction.deferReply({ ephemeral: true });
        const tracker = statusManager?.playtimeTracker;
        const top = tracker ? tracker.getLeaderboard(10) : [];
        const desc = top.length > 0
          ? top.map((p, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
              return `${medal} **${p.name}** — \`${p.formattedTime}\` ${p.isOnline ? '🟢' : ''}`;
            }).join('\n')
          : 'Belum ada data aktivitas pemain tercatat.';

        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('🏅 Peringkat Jam Main Terbanyak (Top 10)')
          .setDescription(desc)
          .setFooter({ text: 'Waktu dihitung otomatis selama berada di server' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // --- TOMBOL-TOMBOL ADMIN LIVE CONTROL PANEL ---
      if (interaction.customId.startsWith('btn_admin_')) {
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const isAdmin = isOwner || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
          || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

        if (!isAdmin) {
          await interaction.reply({
            content: '❌ **Akses Ditolak**: Tombol panel kontrol ini khusus untuk **Administrator**!',
            ephemeral: true
          });
          return;
        }

        // 🟢 Nyalakan Server
        if (interaction.customId === 'btn_admin_start') {
          await interaction.deferReply({ ephemeral: true });
          const { startServer } = require('./serverController');
          const res = await startServer();
          await interaction.editReply({ content: res.success ? `🚀 ${res.message}` : `⚠️ ${res.message}` });
          return;
        }

        // 🔴 Matikan Server
        if (interaction.customId === 'btn_admin_stop') {
          await interaction.deferReply({ ephemeral: true });
          const { stopServer } = require('./serverController');
          const res = await stopServer();
          await interaction.editReply({ content: res.success ? `🛑 ${res.message}` : `⚠️ ${res.message}` });
          return;
        }

        // 🔄 Restart Server
        if (interaction.customId === 'btn_admin_restart') {
          await interaction.deferReply({ ephemeral: true });
          const { restartServer } = require('./serverController');
          const res = await restartServer();
          await interaction.editReply({ content: res.success ? `🔄 ${res.message}` : `⚠️ ${res.message}` });
          return;
        }

        // 🎒 Cek Inventory Pemain (Buka Modal)
        if (interaction.customId === 'btn_admin_inv') {
          const modal = new ModalBuilder()
            .setCustomId('modal_admin_inv')
            .setTitle('🎒 Inspeksi Inventory Pemain');
          const input = new TextInputBuilder()
            .setCustomId('target_player')
            .setLabel('Gamertag Pemain Minecraft')
            .setPlaceholder('Contoh: Steve')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        // 📍 Lacak Koordinat Pemain (Buka Modal)
        if (interaction.customId === 'btn_admin_locate') {
          const modal = new ModalBuilder()
            .setCustomId('modal_admin_locate')
            .setTitle('📍 Lacak Koordinat & Dimensi Pemain');
          const input = new TextInputBuilder()
            .setCustomId('target_player')
            .setLabel('Gamertag Pemain Minecraft')
            .setPlaceholder('Contoh: Steve')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        // 👑 Kelola OP (Buka Modal)
        if (interaction.customId === 'btn_admin_op') {
          const modal = new ModalBuilder()
            .setCustomId('modal_admin_op')
            .setTitle('👑 Beri atau Cabut Operator (OP)');
          const actionInput = new TextInputBuilder()
            .setCustomId('op_action')
            .setLabel('Tindakan (Ketik "op" atau "deop")')
            .setPlaceholder('op / deop')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const playerInput = new TextInputBuilder()
            .setCustomId('target_player')
            .setLabel('Gamertag Pemain')
            .setPlaceholder('Contoh: Steve')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(
            new ActionRowBuilder().addComponents(actionInput),
            new ActionRowBuilder().addComponents(playerInput)
          );
          await interaction.showModal(modal);
          return;
        }

        // 📥 Unduh Backup Dunia
        if (interaction.customId === 'btn_admin_backup') {
          const backupCmd = client.commands.get('download-backup') || client.commands.get('backup');
          if (backupCmd) {
            await backupCmd.execute(interaction, { config, statusManager, client });
          }
          return;
        }

        // ⚡ Konsol CMD (Buka Modal)
        if (interaction.customId === 'btn_admin_cmd') {
          const modal = new ModalBuilder()
            .setCustomId('modal_admin_cmd')
            .setTitle('⚡ Kirim Perintah Konsol BDS');
          const input = new TextInputBuilder()
            .setCustomId('cmd_text')
            .setLabel('Perintah Konsol (tanpa tanda /)')
            .setPlaceholder('Contoh: weather clear atau time set day')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        // 🧹 Clear Lag (Bersihkan Sampah Mengapung)
        if (interaction.customId === 'btn_admin_clearlag') {
          await interaction.deferReply({ ephemeral: true });
          const { sendConsoleCommand } = require('./serverController');
          const res = sendConsoleCommand('kill @e[type=item]');
          await interaction.editReply({
            content: res.success
              ? '🧹 **Clear Lag Berhasil!** Seluruh sampah & item tercecer di tanah telah dibersihkan.'
              : `⚠️ Gagal membersihkan item: ${res.error || res.message}`
          });
          return;
        }

        // 🌍 Render Visual Map Dunia (uNmINeD)
        if (interaction.customId === 'btn_admin_rendermap') {
          const renderCmd = client.commands.get('render-map');
          if (renderCmd) {
            await renderCmd.execute(interaction, { config, statusManager, client });
          }
          return;
        }
      }
    }

    // C. Interaksi Formulir Pop-up (Modals)
    if (interaction.isModalSubmit()) {
      const context = { config, statusManager, client };

      // Modal Hadiah Harian
      if (interaction.customId === 'modal_daily') {
        const gamerTag = interaction.fields.getTextInputValue('input_daily_player').trim();
        interaction.options = { getString: () => gamerTag };
        const cmd = client.commands.get('daily');
        if (cmd) await cmd.execute(interaction, context);
        return;
      }

      // Modal Profil 3D
      if (interaction.customId === 'modal_profile') {
        const gamerTag = interaction.fields.getTextInputValue('input_profile_player').trim();
        interaction.options = { getString: () => gamerTag };
        const cmd = client.commands.get('profile');
        if (cmd) await cmd.execute(interaction, context);
        return;
      }

      // Modal Cek Inventory Admin
      if (interaction.customId === 'modal_admin_inv') {
        const gamerTag = interaction.fields.getTextInputValue('target_player').trim();
        interaction.options = { getString: () => gamerTag };
        const cmd = client.commands.get('inventory');
        if (cmd) await cmd.execute(interaction, context);
        return;
      }

      // Modal Lacak Lokasi Admin
      if (interaction.customId === 'modal_admin_locate') {
        const gamerTag = interaction.fields.getTextInputValue('target_player').trim();
        interaction.options = { getString: () => gamerTag };
        const cmd = client.commands.get('locate');
        if (cmd) await cmd.execute(interaction, context);
        return;
      }

      // Modal Perintah Konsol Admin
      if (interaction.customId === 'modal_admin_cmd') {
        const cmdText = interaction.fields.getTextInputValue('cmd_text').trim();
        interaction.options = { getString: () => cmdText };
        const cmd = client.commands.get('cmd');
        if (cmd) await cmd.execute(interaction, context);
        return;
      }

      // Modal Kelola OP Admin
      if (interaction.customId === 'modal_admin_op') {
        const action = interaction.fields.getTextInputValue('op_action').toLowerCase().trim();
        const gamerTag = interaction.fields.getTextInputValue('target_player').trim();
        interaction.options = { getString: () => gamerTag };
        const cmdName = action === 'deop' ? 'deop' : 'op';
        const cmd = client.commands.get(cmdName);
        if (cmd) await cmd.execute(interaction, context);
        return;
      }
    }
  } catch (err) {
    console.error('[Interaction] Error saat menangani interaksi:', err);
    if (interaction.isRepliable()) {
      const replyFn = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      await interaction[replyFn]({
        content: 'Terjadi kesalahan saat memproses aksi ini.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// 7.5. Event Listener Chat Bridge (Discord -> Minecraft Bedrock In-Game)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const bridgeChannelId = statusManager?.getChatBridgeChannelId()
    || config.chatBridgeChannelId
    || config.notifications?.chatBridge?.channelId
    || process.env.CHAT_BRIDGE_CHANNEL_ID;

  const isBridge = (bridgeChannelId && message.channelId === bridgeChannelId)
    || message.channel?.name === 'chat-minecraft'
    || message.channel?.name === 'minecraft-chat';

  if (!isBridge) return;
  if (process.platform !== 'linux') return;

  if (statusManager && !statusManager.getChatBridgeChannelId()) {
    statusManager.setChatBridgeChannelId(message.channelId);
  }

  let content = (message.cleanContent || message.content || '').trim();
  if (!content && message.attachments.size > 0) {
    content = '[Mengirim Media/Lampiran]';
  }
  if (!content) return;

  const safeContent = content.replace(/[\r\n\t]+/g, ' ').substring(0, 100);
  const sender = (message.member?.displayName || message.author.username).replace(/["'\\]/g, '');

  try {
    const res = sendBroadcast(sender, safeContent);
    if (res.success) {
      await message.react('🎮').catch(() => {});
    }
  } catch (err) {
    // Sesi screen mungkin belum aktif
  }
});

// 8. Error Handling Global agar Bot Tidak Pernah Mati Sendiri
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection pada:', promise, 'alasan:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('[Anti-Crash] Uncaught Exception:', err, 'asal:', origin);
});

// 9. Login ke Discord
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'MASUKKAN_TOKEN_BOT_DISCORD_ANDA_DI_SINI') {
  console.warn('\n⚠️  PERINGATAN: DISCORD_TOKEN belum diatur!');
  console.warn('Silakan salin file .env.example menjadi .env dan masukkan Token bot Anda.\n');
} else {
  client.login(token).catch((err) => {
    if (err.code === 'DisallowedIntents') {
      console.error('\n⚠️ [PERINGATAN INTENTS] DISALLOWED INTENTS TERDETEKSI:');
      console.error('Fitur Chat Bridge membutuhkan "Message Content Intent" diaktifkan di Discord Developer Portal.');
      console.error('Langkah mengaktifkannya (hanya butuh 10 detik):');
      console.error('1. Buka: https://discord.com/developers/applications');
      console.error('2. Pilih aplikasi Bot Anda -> Masuk ke menu "Bot" di bilah kiri.');
      console.error('3. Gulir ke bagian "Privileged Gateway Intents".');
      console.error('4. Centang / Aktifkan toggle "MESSAGE CONTENT INTENT" & klik "Save Changes".');
      console.error('5. Jalankan: pm2 restart minecraft-bot\n');
    } else {
      console.error('[Login Error] Gagal login ke Discord:', err.message);
    }
  });
}
