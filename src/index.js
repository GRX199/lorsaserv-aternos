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
  PermissionFlagsBits
} = require('discord.js');

const { startHealthServer } = require('./server');
const { StatusManager } = require('./statusManager');
const { getConnectUrl } = require('./embeds');

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
startHealthServer(port, () => statusManager?.getLatestStatus(), config);

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

  if (cfg.mcserver && publicIp) {
    cfg.mcserver.ip = publicIp;
  }

  if (cfg.servers && Array.isArray(cfg.servers)) {
    const vps = cfg.servers.find(s => s.id === 'vps' || s.isLocal);
    if (vps && publicIp) {
      vps.ip = publicIp;
      console.log(`[Config] Otomatis mendeteksi IP Publik VPS untuk ${vps.name}: ${publicIp}`);
    }
  }

  if (process.platform === 'linux' && cfg.mcserver) {
    cfg.mcserver.pingHost = '127.0.0.1';
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
      // Perintah berbahaya yang dikunci khusus untuk Admin
      const adminOnlyCommands = ['cmd', 'op', 'deop', 'stop-server', 'restart-server', 'setup-status', 'setup-logs', 'setup-chat'];

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

  let content = (message.cleanContent || message.content || '').trim();
  if (!content && message.attachments.size > 0) {
    content = '[Mengirim Media/Lampiran]';
  }
  if (!content) return;

  const safeContent = content.replace(/[\r\n\t]+/g, ' ').substring(0, 100);
  const sender = (message.member?.displayName || message.author.username).replace(/["'\\]/g, '');

  try {
    const { execSync } = require('node:child_process');
    const rawtext = JSON.stringify({
      rawtext: [
        { text: `§b[Discord] §e${sender}§f: ${safeContent}` }
      ]
    });
    const escaped = rawtext.replace(/"/g, '\\"');
    execSync(`screen -S mc-bedrock -X stuff "tellraw @a ${escaped}\\n"`, { timeout: 3000 });
    await message.react('🎮').catch(() => {});
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
