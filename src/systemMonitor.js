const os = require('node:os');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Membuat progress bar teks Unicode
 * @param {number} percent - Persentase 0 - 100
 * @param {number} length - Panjang karakter bar
 */
function createProgressBar(percent, length = 10) {
  const p = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const filled = Math.round((p / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${p.toFixed(1)}%`;
}

/**
 * Mengubah detik menjadi format waktu manusiawi (contoh: 3 hari 5 jam 20 menit)
 */
function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}h`);
  if (hours > 0) parts.push(`${hours}j`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

class SystemMonitor {
  /**
   * Mengumpulkan seluruh metrik sistem VPS Linux
   */
  static getMetrics() {
    let ramTotalMb = Math.round(os.totalmem() / (1024 * 1024));
    let ramFreeMb = Math.round(os.freemem() / (1024 * 1024));
    let ramUsedMb = ramTotalMb - ramFreeMb;
    let ramPercent = (ramUsedMb / ramTotalMb) * 100;

    let swapTotalMb = 0;
    let swapUsedMb = 0;
    let swapPercent = 0;

    // Baca /proc/meminfo untuk data memori Linux yang akurat (memperhitungkan buffers/cache)
    if (process.platform === 'linux' && fs.existsSync('/proc/meminfo')) {
      try {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
        const getVal = (key) => {
          const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
          return match ? parseInt(match[1], 10) / 1024 : 0; // dalam MB
        };

        const total = getVal('MemTotal');
        const available = getVal('MemAvailable') || getVal('MemFree');
        const sTotal = getVal('SwapTotal');
        const sFree = getVal('SwapFree');

        if (total > 0) {
          ramTotalMb = Math.round(total);
          ramUsedMb = Math.round(total - available);
          ramFreeMb = Math.round(available);
          ramPercent = (ramUsedMb / ramTotalMb) * 100;
        }

        if (sTotal > 0) {
          swapTotalMb = Math.round(sTotal);
          swapUsedMb = Math.round(sTotal - sFree);
          swapPercent = (swapUsedMb / swapTotalMb) * 100;
        }
      } catch {}
    }

    // Disk Metrics (df -k /)
    let diskTotalGb = '50.0';
    let diskUsedGb = '10.0';
    let diskFreeGb = '40.0';
    let diskPercent = 20;

    if (process.platform === 'linux') {
      try {
        const dfOut = execSync('df -k /', { encoding: 'utf8', timeout: 3000 });
        const lines = dfOut.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/);
          const totalKb = parseInt(parts[1], 10);
          const usedKb = parseInt(parts[2], 10);
          const availKb = parseInt(parts[3], 10);

          diskTotalGb = (totalKb / (1024 * 1024)).toFixed(1);
          diskUsedGb = (usedKb / (1024 * 1024)).toFixed(1);
          diskFreeGb = (availKb / (1024 * 1024)).toFixed(1);
          diskPercent = Math.round((usedKb / totalKb) * 100);
        }
      } catch {}
    }

    // CPU Metrics
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.replace(/\s+/g, ' ').trim() : 'Virtual CPU';
    const cpuCores = cpus.length;
    const loadAvg = os.loadavg(); // [1m, 5m, 15m]
    const cpuPercent = Math.min(100, Math.round((loadAvg[0] / Math.max(1, cpuCores)) * 100));

    // Minecraft Bedrock Process Metrics
    let mcStatus = 'OFFLINE 🔴';
    let mcPid = null;
    let mcMemMb = 0;

    if (process.platform === 'linux') {
      try {
        const pidRaw = execSync('pidof bedrock_server 2>/dev/null || true', { encoding: 'utf8' }).trim();
        if (pidRaw) {
          mcPid = pidRaw.split(/\s+/)[0];
          mcStatus = `ONLINE 🟢 (PID ${mcPid})`;

          const rssRaw = execSync(`ps -p ${mcPid} -o rss= 2>/dev/null || true`, { encoding: 'utf8' }).trim();
          if (rssRaw) {
            mcMemMb = Math.round(parseInt(rssRaw, 10) / 1024);
          }
        }
      } catch {}
    }

    return {
      ram: {
        total: ramTotalMb,
        used: ramUsedMb,
        free: ramFreeMb,
        percent: ramPercent,
        bar: createProgressBar(ramPercent, 10)
      },
      swap: {
        total: swapTotalMb,
        used: swapUsedMb,
        percent: swapPercent,
        bar: createProgressBar(swapPercent, 10)
      },
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        load1m: loadAvg[0].toFixed(2),
        load5m: loadAvg[1].toFixed(2),
        percent: cpuPercent,
        bar: createProgressBar(cpuPercent, 10)
      },
      disk: {
        total: diskTotalGb,
        used: diskUsedGb,
        free: diskFreeGb,
        percent: diskPercent,
        bar: createProgressBar(diskPercent, 10)
      },
      uptime: {
        systemSeconds: os.uptime(),
        systemFormatted: formatUptime(os.uptime()),
        botSeconds: process.uptime(),
        botFormatted: formatUptime(process.uptime())
      },
      minecraft: {
        status: mcStatus,
        pid: mcPid,
        memMb: mcMemMb
      }
    };
  }

  /**
   * Membuat Embed Discord untuk pemantauan VPS
   */
  static createEmbed() {
    const data = this.getMetrics();
    const nowUnix = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor('#00b0f4')
      .setTitle('📊 Spesifikasi & Kesehatan VPS Tencent (24/7)')
      .setDescription([
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎮 **Minecraft Bedrock**: \`${data.minecraft.status}\` ${data.minecraft.memMb ? `(RAM: ${data.minecraft.memMb} MB)` : ''}`,
        `⏱️ **Uptime VPS**: \`${data.uptime.systemFormatted}\`  |  🤖 **Bot**: \`${data.uptime.botFormatted}\``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n'))
      .addFields(
        {
          name: '🧠 RAM Fisik (Memori)',
          value: `\`${data.ram.bar}\`\n**Terpakai**: \`${data.ram.used} MB / ${data.ram.total} MB\` (Sisa: ${data.ram.free} MB)`,
          inline: false
        },
        {
          name: '💾 Swap File Memory',
          value: `\`${data.swap.bar}\`\n**Terpakai**: \`${data.swap.used} MB / ${data.swap.total} MB\``,
          inline: false
        },
        {
          name: `⚙️ CPU Processor (${data.cpu.cores} Core)`,
          value: `\`${data.cpu.bar}\`\n**Model**: \`${data.cpu.model.substring(0, 30)}\`\n**Load**: \`${data.cpu.load1m} (1m), ${data.cpu.load5m} (5m)\``,
          inline: false
        },
        {
          name: '💽 Hard Disk SSD',
          value: `\`${data.disk.bar}\`\n**Terpakai**: \`${data.disk.used} GB / ${data.disk.total} GB\` (Sisa: ${data.disk.free} GB)`,
          inline: false
        }
      )
      .setFooter({ text: 'Tencent Cloud VPS Monitor • Diperbarui' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_refresh_vps')
        .setLabel('Perbarui Metrik')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
    );

    return { embed, row };
  }
}

module.exports = {
  SystemMonitor
};
