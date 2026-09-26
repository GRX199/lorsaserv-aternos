const fs = require('node:fs');
const path = require('node:path');
const { sendConsoleCommand, isServerRunning } = require('./serverController');

const WARPS_FILE = path.join(__dirname, '..', 'data', 'warps.json');

/**
 * Default preset warp jika file warps.json belum ada
 */
const DEFAULT_WARPS = {
  ironfarm: {
    name: 'ironfarm',
    x: -351,
    y: 11,
    z: -1111,
    dimension: 'overworld',
    createdBy: 'System',
    createdAt: new Date().toISOString()
  }
};

class WarpManager {
  constructor() {
    this.warps = {};
    this.loadWarps();
  }

  loadWarps() {
    try {
      if (fs.existsSync(WARPS_FILE)) {
        const raw = fs.readFileSync(WARPS_FILE, 'utf8');
        this.warps = JSON.parse(raw);
      } else {
        this.warps = { ...DEFAULT_WARPS };
        this.saveWarps();
      }
    } catch (err) {
      console.warn('[WarpManager] Gagal memuat warps.json, menggunakan default:', err.message);
      this.warps = { ...DEFAULT_WARPS };
    }
  }

  saveWarps() {
    try {
      const dir = path.dirname(WARPS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(WARPS_FILE, JSON.stringify(this.warps, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[WarpManager] Gagal menyimpan warps.json:', err.message);
      return false;
    }
  }

  getAllWarps() {
    this.loadWarps();
    return Object.values(this.warps);
  }

  getWarp(name) {
    if (!name) return null;
    this.loadWarps();
    const key = String(name).trim().toLowerCase();
    return this.warps[key] || null;
  }

  setWarp(rawName, data = {}) {
    if (!rawName) throw new Error('Nama warp tidak boleh kosong');
    const name = String(rawName).trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    if (!name) throw new Error('Nama warp harus berupa huruf, angka, atau tanda minus');

    const x = Math.round(Number(data.x));
    const y = Math.round(Number(data.y));
    const z = Math.round(Number(data.z));

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      throw new Error('Koordinat X, Y, Z harus berupa angka yang valid');
    }

    const dimension = String(data.dimension || 'overworld').toLowerCase().replace(/^minecraft:/, '');
    const createdBy = String(data.createdBy || 'Admin').trim().replace(/["'\\]/g, '');

    const warpObj = {
      name,
      x,
      y,
      z,
      dimension,
      createdBy,
      createdAt: new Date().toISOString()
    };

    this.warps[name] = warpObj;
    this.saveWarps();

    // Sinkronisasi ke Script API BDS in-game jika server aktif
    try {
      const payload = JSON.stringify({ name, x, y, z, dimension, by: createdBy });
      sendConsoleCommand(`scriptevent bot:setwarp ${payload}`);
    } catch {}

    return warpObj;
  }

  deleteWarp(rawName) {
    if (!rawName) return false;
    const name = String(rawName).trim().toLowerCase();
    if (!this.warps[name]) return false;

    delete this.warps[name];
    this.saveWarps();

    // Sinkronisasi hapus ke BDS in-game
    try {
      sendConsoleCommand(`scriptevent bot:delwarp ${name}`);
    } catch {}

    return true;
  }

  teleportPlayerToWarp(playerName, warpName) {
    const warp = this.getWarp(warpName);
    if (!warp) {
      return { success: false, message: `Titik warp '${warpName}' tidak ditemukan!` };
    }

    const cleanPlayer = String(playerName || '').trim().replace(/["'\\]/g, '');
    if (!cleanPlayer) {
      return { success: false, message: 'Nama pemain tidak boleh kosong!' };
    }

    try {
      const tpCmd = `tp "${cleanPlayer}" ${warp.x} ${warp.y} ${warp.z}`;
      const res = sendConsoleCommand(tpCmd);
      if (!res.success) {
        return { success: false, message: res.error || 'Gagal mengirim perintah TP ke konsol server' };
      }

      sendConsoleCommand(`playsound mob.endermen.portal "${cleanPlayer}"`);
      sendConsoleCommand(`tellraw "${cleanPlayer}" {"rawtext":[{"text":"§b§l[WARP] §r§eTeleportasi ke titik §a'${warp.name}' §r§e(X:${warp.x} Y:${warp.y} Z:${warp.z}) berhasil!"}]}`);

      return {
        success: true,
        message: `Pemain **${cleanPlayer}** berhasil di-teleport ke titik warp **${warp.name}** (\`X: ${warp.x}, Y: ${warp.y}, Z: ${warp.z}\`)`,
        warp
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  teleportPlayerToPlayer(sourcePlayer, targetPlayer) {
    const cleanSource = String(sourcePlayer || '').trim().replace(/["'\\]/g, '');
    const cleanTarget = String(targetPlayer || '').trim().replace(/["'\\]/g, '');

    if (!cleanSource || !cleanTarget) {
      return { success: false, message: 'Nama pemain sumber dan target tidak boleh kosong!' };
    }

    try {
      const res = sendConsoleCommand(`tp "${cleanSource}" "${cleanTarget}"`);
      if (!res.success) {
        return { success: false, message: res.error || 'Gagal mengirim perintah TP ke konsol server' };
      }

      sendConsoleCommand(`playsound mob.endermen.portal "${cleanSource}"`);
      sendConsoleCommand(`tellraw "${cleanSource}" {"rawtext":[{"text":"§b§l[TELEPORT] §r§eTeleportasi ke pemain §a${cleanTarget} §eberhasil!"}]}`);

      return {
        success: true,
        message: `Pemain **${cleanSource}** berhasil di-teleport ke posisi **${cleanTarget}**!`
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  teleportPlayerToCoords(playerName, x, y, z) {
    const cleanPlayer = String(playerName || '').trim().replace(/["'\\]/g, '');
    const posX = Math.round(Number(x));
    const posY = Math.round(Number(y));
    const posZ = Math.round(Number(z));

    if (!cleanPlayer || isNaN(posX) || isNaN(posY) || isNaN(posZ)) {
      return { success: false, message: 'Nama pemain atau koordinat tidak valid!' };
    }

    try {
      const res = sendConsoleCommand(`tp "${cleanPlayer}" ${posX} ${posY} ${posZ}`);
      if (!res.success) {
        return { success: false, message: res.error || 'Gagal mengirim perintah TP ke konsol server' };
      }

      sendConsoleCommand(`playsound mob.endermen.portal "${cleanPlayer}"`);
      sendConsoleCommand(`tellraw "${cleanPlayer}" {"rawtext":[{"text":"§b§l[TELEPORT] §r§eTeleportasi ke koordinat §aX:${posX} Y:${posY} Z:${posZ} §eberhasil!"}]}`);

      return {
        success: true,
        message: `Pemain **${cleanPlayer}** berhasil di-teleport ke koordinat \`X: ${posX}, Y: ${posY}, Z: ${posZ}\`!`
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

const warpManager = new WarpManager();

module.exports = {
  WarpManager,
  warpManager
};
