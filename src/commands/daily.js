const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

const DAILY_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'daily_claims.json');
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 Jam

function loadDailyClaims() {
  try {
    if (fs.existsSync(DAILY_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DAILY_FILE_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveDailyClaims(data) {
  try {
    const dir = path.dirname(DAILY_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DAILY_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Daily] Gagal simpan daily_claims.json:', err.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Klaim paket hadiah item harian langsung ke inventory Minecraft Anda!')
    .addStringOption(option =>
      option.setName('pemain')
        .setDescription('Gamertag Minecraft Anda yang sedang online di dalam server')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: false });

    const gamerTag = interaction.options.getString('pemain').trim();
    const userId = interaction.user.id;
    const now = Date.now();

    const claims = loadDailyClaims();
    const lastClaim = claims[userId] || claims[gamerTag.toLowerCase()];

    if (lastClaim && (now - lastClaim) < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (now - lastClaim);
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

      const nextClaimTimestamp = Math.floor((lastClaim + COOLDOWN_MS) / 1000);

      await interaction.editReply({
        content: `⏳ **Hadiah Harian Belum Tersedia!**\nAnda sudah mengklaim hadiah harian hari ini. Silakan tunggu **${hours} jam ${minutes} menit** lagi (<t:${nextClaimTimestamp}:R>).`
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur pengiriman hadiah langsung hanya bekerja di VPS Linux.'
      });
      return;
    }

    // Cek apakah pemain sedang online di server
    const monitor = context?.statusManager?.playerLogMonitor;
    if (monitor) {
      const onlinePlayers = monitor.getOnlinePlayers();
      const isOnline = onlinePlayers.some(p => p.toLowerCase() === gamerTag.toLowerCase());
      if (!isOnline) {
        await interaction.editReply({
          content: `⚠️ **Pemain Tidak Ditemukan di Dalam Game!**\nKarakter **${gamerTag}** harus sedang **online/login** di dalam server Minecraft Bedrock agar item hadiah bisa dikirimkan langsung ke tas Anda.\n\n*Masuklah ke server terlebih dahulu, lalu klik klaim lagi!*`
        });
        return;
      }
    }

    // Paket Hadiah Harian:
    // 16x Cooked Beef, 5x Iron Ingot, 1x Golden Apple
    const rewardItems = [
      { id: 'cooked_beef', amount: 16, name: '🥩 16x Daging Panggang (Cooked Beef)' },
      { id: 'iron_ingot', amount: 5, name: '🔩 5x Batangan Besi (Iron Ingot)' },
      { id: 'golden_apple', amount: 1, name: '🍏 1x Apel Emas (Golden Apple)' }
    ];

    try {
      for (const item of rewardItems) {
        sendConsoleCommand(`give "${gamerTag}" ${item.id} ${item.amount}`);
      }

      // Kirim pesan title / chat ke pemain di dalam game
      sendConsoleCommand(`title "${gamerTag}" actionbar "§a🎁 Paket Hadiah Harian Berhasil Diklaim!"`);

      // Simpan riwayat klaim
      claims[userId] = now;
      claims[gamerTag.toLowerCase()] = now;
      saveDailyClaims(claims);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎁 Hadiah Harian Berhasil Diklaim!')
        .setDescription(`Selamat <@${userId}>! Paket perlengkapan telah dikirimkan langsung ke inventory **${gamerTag}** di dalam server!`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(gamerTag)}/100`)
        .addFields(
          {
            name: '📦 Daftar Item yang Diterima:',
            value: rewardItems.map(it => `• ${it.name}`).join('\n'),
            inline: false
          }
        )
        .setFooter({ text: 'Datang kembali besok untuk mengklaim hadiah harian berikutnya!' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });
    } catch (err) {
      console.error('[Command daily] Error:', err);
      await interaction.editReply({
        content: `❌ Terjadi kesalahan saat membagikan hadiah: ${err.message}`
      });
    }
  },

  loadDailyClaims,
  saveDailyClaims,
  COOLDOWN_MS
};
