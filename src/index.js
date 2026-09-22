require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes
} = require('discord.js');

const { startHealthServer } = require('./server');
const { StatusManager } = require('./statusManager');

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
  intents: [GatewayIntentBits.Guilds]
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

// 5. Jalankan Web Health Server (Sangat penting untuk Render agar tidak crash / sleep)
const port = process.env.PORT || 3000;
startHealthServer(port, () => statusManager?.getLatestStatus(), config);

async function initServerConfig(cfg) {
  // Jika SERVER_IP ditentukan di .env, prioritaskan
  if (process.env.SERVER_IP && process.env.SERVER_IP.trim()) {
    cfg.mcserver.ip = process.env.SERVER_IP.trim();
    console.log(`[Config] Menggunakan SERVER_IP dari .env: ${cfg.mcserver.ip}`);
  } else if (cfg.mcserver.autoPublicIp !== false) {
    // Coba ambil IP publik VPS secara otomatis
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.ipify.org', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const publicIp = (await res.text()).trim();
        if (publicIp && publicIp.length >= 7) {
          cfg.mcserver.ip = publicIp;
          console.log(`[Config] Otomatis mendeteksi IP Publik VPS: ${publicIp}`);
        }
      }
    } catch (err) {
      console.warn(`[Config] Gagal deteksi IP publik otomatis: ${err.message}`);
    }
  }

  // Jika di Linux dan bedrock-server berjalan lokal di VPS, set pingHost ke 127.0.0.1
  if (process.platform === 'linux') {
    cfg.mcserver.pingHost = '127.0.0.1';
    console.log('[Config] Berjalan di VPS Linux: memantau server Minecraft lokal (127.0.0.1:19132)');
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

      // Tombol ▶ Nyalakan Server
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

      // Tombol 📋 Salin IP & Port
      if (interaction.customId === 'btn_copy_ip') {
        const mc = config.mcserver;
        const deepLink = `minecraft://?addExternalServer=${encodeURIComponent(mc.name)}|${mc.ip}:${mc.port}`;
        await interaction.reply({
          content: [
            `📋 **Data Server ${mc.name}:**`,
            ``,
            `📡 **Alamat Server (Ketuk kotak untuk salin):**`,
            `\`\`\`\n${mc.ip}\n\`\`\``,
            `🔌 **Port (Ketuk kotak untuk salin):**`,
            `\`\`\`\n${mc.port}\n\`\`\``,
            `📱 **Mau langsung masuk tanpa ketik?**`,
            `👉 **[KLIK DI SINI UNTUK BUKA MINECRAFT OTOMATIS](${deepLink})**`
          ].join('\n'),
          ephemeral: true
        });
        return;
      }

      // Tombol 🎮 Connect (Android / iOS)
      if (interaction.customId === 'btn_connect_android') {
        const mc = config.mcserver;
        const deepLink = `minecraft://?addExternalServer=${encodeURIComponent(mc.name)}|${mc.ip}:${mc.port}`;
        await interaction.reply({
          content: [
            `🎮 **Buka Minecraft Otomatis (Android / iOS / Windows):**`,
            `Klik tautan di bawah ini untuk langsung membuka Minecraft & menambahkan server ke daftar server Anda:`,
            ``,
            `👉 **[KLIK DI SINI UNTUK BUKA GAME MINECRAFT](${deepLink})**`,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📋 **Atau salin manual:**`,
            `• Alamat IP: \`${mc.ip}\``,
            `• Port: \`${mc.port}\``
          ].join('\n'),
          ephemeral: true
        });
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
    console.error('[Login Error] Gagal login ke Discord:', err.message);
  });
}
