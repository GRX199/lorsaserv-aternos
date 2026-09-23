const fs = require('node:fs');
const path = require('node:path');

const PLAYERS_FILE_PATH = path.join(__dirname, '..', 'data', 'players.json');

/**
 * Format detik ke teks waktu bahasa Indonesia yang rapi
 */
function formatDuration(seconds) {
  const s = Math.floor(seconds || 0);
  if (s < 60) return `${s} detik`;

  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} menit`);

  return parts.join(' ');
}

class PlaytimeTracker {
  constructor() {
    this.activeSessions = new Map(); // playerNameLower -> timestamp (Date.now())
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(PLAYERS_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, 'utf8'));
      }
    } catch (err) {
      console.error('[PlaytimeTracker] Gagal membaca players.json:', err.message);
    }
    return {};
  }

  saveData() {
    try {
      const dir = path.dirname(PLAYERS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(PLAYERS_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[PlaytimeTracker] Gagal menyimpan players.json:', err.message);
    }
  }

  /**
   * Dipanggil saat pemain terdeteksi masuk (join)
   */
  recordJoin(playerName) {
    if (!playerName) return;
    const key = playerName.toLowerCase();
    const now = Date.now();

    if (!this.data[key]) {
      this.data[key] = {
        name: playerName,
        totalSeconds: 0,
        firstSeen: now,
        lastSeen: now,
        sessions: 1
      };
    } else {
      this.data[key].name = playerName; // Update casing nama terbaru
      this.data[key].lastSeen = now;
      this.data[key].sessions = (this.data[key].sessions || 0) + 1;
    }

    this.activeSessions.set(key, now);
    this.saveData();
  }

  /**
   * Dipanggil saat pemain terdeteksi keluar (leave)
   */
  recordLeave(playerName) {
    if (!playerName) return;
    const key = playerName.toLowerCase();
    const now = Date.now();

    if (this.activeSessions.has(key)) {
      const startTime = this.activeSessions.get(key);
      const sessionSec = Math.floor((now - startTime) / 1000);
      this.activeSessions.delete(key);

      if (!this.data[key]) {
        this.data[key] = {
          name: playerName,
          totalSeconds: 0,
          firstSeen: startTime,
          lastSeen: now,
          sessions: 1
        };
      }

      if (sessionSec > 0) {
        this.data[key].totalSeconds = (this.data[key].totalSeconds || 0) + sessionSec;
      }
      this.data[key].lastSeen = now;
      this.saveData();
    }
  }

  /**
   * Mengambil data playtime pemain tertentu (termasuk sesi aktif jika sedang online)
   */
  getPlaytime(playerName) {
    if (!playerName) return null;
    const key = playerName.toLowerCase();
    const now = Date.now();

    const record = this.data[key] || {
      name: playerName,
      totalSeconds: 0,
      firstSeen: null,
      lastSeen: null,
      sessions: 0
    };

    let liveExtra = 0;
    const isOnline = this.activeSessions.has(key);
    if (isOnline) {
      liveExtra = Math.floor((now - this.activeSessions.get(key)) / 1000);
    }

    const effectiveTotal = (record.totalSeconds || 0) + liveExtra;

    return {
      name: record.name || playerName,
      totalSeconds: effectiveTotal,
      formattedTime: formatDuration(effectiveTotal),
      firstSeen: record.firstSeen,
      lastSeen: record.lastSeen,
      sessions: record.sessions || (isOnline ? 1 : 0),
      isOnline
    };
  }

  /**
   * Mengambil peringkat Top pemain berdasarkan jam terbang
   */
  getLeaderboard(limit = 10) {
    const now = Date.now();
    const all = [];

    for (const [key, record] of Object.entries(this.data)) {
      let liveExtra = 0;
      const isOnline = this.activeSessions.has(key);
      if (isOnline) {
        liveExtra = Math.floor((now - this.activeSessions.get(key)) / 1000);
      }

      const total = (record.totalSeconds || 0) + liveExtra;
      all.push({
        name: record.name || key,
        totalSeconds: total,
        formattedTime: formatDuration(total),
        isOnline,
        sessions: record.sessions || 0
      });
    }

    // Urutkan dari playtime terlama
    all.sort((a, b) => b.totalSeconds - a.totalSeconds);
    return all.slice(0, limit);
  }
}

module.exports = {
  PlaytimeTracker,
  formatDuration
};
