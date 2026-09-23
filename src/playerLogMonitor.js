const { spawn } = require('node:child_process');
const readline = require('node:readline');

/**
 * Memantau log Bedrock Dedicated Server secara real-time via journalctl
 * untuk mendeteksi event pemain bergabung (Join) dan keluar (Leave).
 */
class PlayerLogMonitor {
  constructor(statusManager, config) {
    this.statusManager = statusManager;
    this.config = config;
    this.process = null;
    this.rl = null;
    this.onlinePlayers = new Set();
    this.retryTimer = null;
    this.isStopping = false;
    this.useSudo = false;
  }

  /**
   * Mengembalikan array nama-nama pemain yang sedang online
   */
  getOnlinePlayers() {
    return Array.from(this.onlinePlayers);
  }

  /**
   * Memulai pemantauan log
   */
  start() {
    if (process.platform !== 'linux') {
      console.log('[PlayerLogMonitor] Sistem bukan Linux. Pemantauan log journalctl dilewati.');
      return;
    }

    this.isStopping = false;
    this.spawnWatcher();
  }

  spawnWatcher() {
    if (this.isStopping) return;

    this.cleanup();

    const cmd = this.useSudo ? 'sudo' : 'journalctl';
    const args = this.useSudo
      ? ['-n', 'journalctl', '-u', 'minecraft-bedrock', '-f', '-n', '0']
      : ['-u', 'minecraft-bedrock', '-f', '-n', '0'];

    console.log(`[PlayerLogMonitor] Menjalankan pemantau log: ${cmd} ${args.join(' ')}`);

    try {
      this.process = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      this.rl = readline.createInterface({
        input: this.process.stdout,
        terminal: false
      });

      this.rl.on('line', (line) => {
        this.handleLogLine(line);
      });

      this.process.stderr.on('data', (data) => {
        const str = data.toString();
        if (str.includes('Permission denied') && !this.useSudo) {
          console.warn('[PlayerLogMonitor] Memerlukan izin sudo untuk journalctl. Berpindah ke mode sudo...');
          this.useSudo = true;
          this.scheduleRestart(1000);
        } else if (!str.includes('No entries') && !str.includes('-- Logs begin')) {
          console.warn('[PlayerLogMonitor] log error:', str.trim());
        }
      });

      this.process.on('error', (err) => {
        console.warn('[PlayerLogMonitor] Error pada proses watcher:', err.message);
        this.scheduleRestart(5000);
      });

      this.process.on('close', (code) => {
        if (!this.isStopping) {
          console.warn(`[PlayerLogMonitor] Watcher terhenti (exit code: ${code}). Memulai ulang dalam 5s...`);
          this.scheduleRestart(5000);
        }
      });
    } catch (err) {
      console.error('[PlayerLogMonitor] Gagal spawn proses:', err.message);
      this.scheduleRestart(5000);
    }
  }

  scheduleRestart(ms = 5000) {
    if (this.isStopping) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.spawnWatcher();
    }, ms);
  }

  cleanup() {
    if (this.rl) {
      try { this.rl.close(); } catch {}
      this.rl = null;
    }
    if (this.process) {
      try { this.process.kill(); } catch {}
      this.process = null;
    }
  }

  stop() {
    this.isStopping = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.cleanup();
  }

  /**
   * Menangani setiap baris log yang keluar dari Minecraft Bedrock Server
   * @param {string} line - Baris log dari journalctl
   */
  handleLogLine(line) {
    if (!line) return;

    // 1. Deteksi Player Connected / Join
    // Contoh format log resmi Mojang BDS:
    // [2026-09-24 00:20:15:123 INFO] Player connected: Steve, xuid: 2535467890123456
    // Sep 24 00:20:15 VM-0-9-ubuntu bedrock_server[1165087]: Player connected: sasy199, xuid: 
    const joinMatch = line.match(/Player connected:\s*([^,\n\r]+)/i);
    if (joinMatch) {
      let playerName = joinMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      if (playerName) {
        console.log(`[PlayerLogMonitor] 🟢 Player Join Terdeteksi: ${playerName}`);
        this.onlinePlayers.add(playerName);
        this.notifyPlayerChange('join', playerName);
        return;
      }
    }

    // 2. Deteksi Player Disconnected / Leave
    // Contoh format log:
    // [2026-09-24 00:25:10:456 INFO] Player disconnected: Steve, xuid: 2535467890123456
    const leaveMatch = line.match(/Player disconnected:\s*([^,\n\r]+)/i);
    if (leaveMatch) {
      let playerName = leaveMatch[1].trim();
      playerName = playerName.replace(/^["']|["']$/g, '').trim();

      if (playerName) {
        console.log(`[PlayerLogMonitor] 🔴 Player Leave Terdeteksi: ${playerName}`);
        this.onlinePlayers.delete(playerName);
        this.notifyPlayerChange('leave', playerName);
        return;
      }
    }

    // 3. Reset jika server berhenti / dimatikan
    if (line.includes('Server stop') || line.includes('Quit command received') || line.includes('Stopping server')) {
      console.log('[PlayerLogMonitor] Server stopped terdeteksi. Mereset daftar pemain.');
      this.onlinePlayers.clear();
      if (this.statusManager) {
        this.statusManager.updateStatusEmbed().catch(() => {});
      }
    }
  }

  async notifyPlayerChange(type, playerName) {
    if (!this.statusManager) return;

    const servers = this.statusManager.getServers();
    const vpsServer = servers.find(s => s.id === 'vps' || s.isLocal) || servers[0];

    // Kirim notifikasi embed ke channel Discord
    await this.statusManager.sendPlayerNotification(
      type,
      playerName,
      vpsServer,
      this.onlinePlayers.size
    ).catch(() => {});

    // Perbarui embed status secara instan agar daftar pemain langsung ter-refresh
    await this.statusManager.updateStatusEmbed().catch(() => {});
  }
}

module.exports = {
  PlayerLogMonitor
};
