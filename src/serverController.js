const { exec, execSync } = require('node:child_process');

/**
 * Menjalankan perintah shell secara Promise
 */
function runShell(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({
        success: !error,
        code: error ? error.code : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: error ? error.message : null
      });
    });
  });
}

/**
 * Mendeteksi engine server mana yang sedang aktif atau terpasang
 * (minecraft-paper vs minecraft-bedrock)
 */
async function getActiveEngine() {
  if (process.platform !== 'linux') {
    return { service: 'minecraft-bedrock', screen: 'mc-bedrock', type: 'bedrock', running: false };
  }

  // 1. Cek apakah minecraft-paper sedang aktif
  const paperActive = await runShell('systemctl is-active minecraft-paper');
  if (paperActive.stdout.toLowerCase().trim() === 'active') {
    return { service: 'minecraft-paper', screen: 'mc-paper', type: 'paper', running: true };
  }

  // 2. Cek apakah minecraft-bedrock sedang aktif
  const bedrockActive = await runShell('systemctl is-active minecraft-bedrock');
  if (bedrockActive.stdout.toLowerCase().trim() === 'active') {
    return { service: 'minecraft-bedrock', screen: 'mc-bedrock', type: 'bedrock', running: true };
  }

  // 3. Jika keduanya sedang mati (inactive), cek mana yang statusnya enabled
  const paperEnabled = await runShell('systemctl is-enabled minecraft-paper');
  if (paperEnabled.stdout.toLowerCase().trim() === 'enabled') {
    return { service: 'minecraft-paper', screen: 'mc-paper', type: 'paper', running: false };
  }

  // Fallback default ke bedrock
  return { service: 'minecraft-bedrock', screen: 'mc-bedrock', type: 'bedrock', running: false };
}

/**
 * Mendeteksi nama sesi screen yang sedang aktif (mc-paper atau mc-bedrock)
 */
function getActiveScreenSession() {
  if (process.platform !== 'linux') return null;
  try {
    const stdout = execSync('screen -ls', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (stdout.includes('mc-paper')) return 'mc-paper';
    if (stdout.includes('mc-bedrock')) return 'mc-bedrock';
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).toString();
    if (out.includes('mc-paper')) return 'mc-paper';
    if (out.includes('mc-bedrock')) return 'mc-bedrock';
  }
  return null;
}

/**
 * Memeriksa apakah service server Minecraft di VPS sedang aktif
 */
async function isServerRunning() {
  if (process.platform === 'win32') {
    return { available: false, running: false, message: 'Kontrol systemd hanya tersedia di VPS Linux' };
  }

  const engine = await getActiveEngine();
  if (engine.running) {
    return {
      available: true,
      running: true,
      statusText: 'active',
      engine: engine.type,
      service: engine.service
    };
  }

  // Cek proses fallback (pgrep paper.jar atau pidof bedrock_server)
  const procRes = engine.type === 'paper'
    ? await runShell('pgrep -f "paper.jar"')
    : await runShell('pidof bedrock_server');

  const isProcAlive = Boolean(procRes.stdout && procRes.stdout.trim().length > 0);
  const running = isProcAlive;

  return {
    available: true,
    running,
    statusText: running ? 'running-manual' : 'inactive',
    engine: engine.type,
    service: engine.service
  };
}

/**
 * Menyalakan server Minecraft di VPS sesuai engine aktif
 */
async function startServer() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const check = await isServerRunning();
  if (check.running) {
    return { success: false, message: `Server Minecraft (${check.service || 'server'}) sudah dalam keadaan menyala (Online)!` };
  }

  const engine = await getActiveEngine();
  const res = await runShell(`sudo systemctl start ${engine.service}`);
  await new Promise(r => setTimeout(r, 1500));

  const verify = await isServerRunning();
  if (verify.running || res.success) {
    const engineLabel = engine.type === 'paper' ? 'PaperMC Crossplay (Java & Bedrock)' : 'Bedrock Dedicated Server';
    return { success: true, message: `Perintah menyalakan ${engineLabel} berhasil dikirim. Server sedang loading...` };
  } else {
    return { success: false, message: `Gagal menyalakan server: ${res.stderr || res.error}` };
  }
}

/**
 * Mematikan server Minecraft di VPS
 */
async function stopServer() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const engine = await getActiveEngine();
  await runShell(`sudo systemctl stop ${engine.service}`);
  await new Promise(r => setTimeout(r, 1500));

  if (engine.type !== 'paper') {
    await runShell('pkill -x bedrock_server || true');
  }

  const check = await isServerRunning();
  if (!check.running) {
    return { success: true, message: `Server Minecraft (${engine.service}) berhasil dimatikan secara aman.` };
  }

  if (engine.type !== 'paper') {
    await runShell('pkill -9 -x bedrock_server || true');
  }
  return { success: true, message: `Server Minecraft (${engine.service}) telah dimatikan.` };
}

const countdownState = {
  active: false,
  timer: null,
  secondsLeft: 0,
  totalSeconds: 60,
  initiatedBy: 'Admin',
  reason: '',
  cancelRequested: false,
  listeners: new Set()
};

function getCountdownState() {
  return {
    active: countdownState.active,
    secondsLeft: countdownState.secondsLeft,
    totalSeconds: countdownState.totalSeconds,
    initiatedBy: countdownState.initiatedBy,
    reason: countdownState.reason
  };
}

function cancelRestart(cancelledBy = 'Admin') {
  if (!countdownState.active) {
    return { success: false, message: 'Tidak ada hitung mundur restart yang sedang berjalan.' };
  }

  countdownState.cancelRequested = true;
  if (countdownState.timer) {
    clearInterval(countdownState.timer);
    countdownState.timer = null;
  }
  countdownState.active = false;

  // Siarkan ke Minecraft in-game
  sendConsoleCommand('title @a times 5 40 10');
  sendConsoleCommand('title @a title §a§lRESTART DIBATALKAN');
  sendConsoleCommand('title @a subtitle §eServer tetap berjalan normal.');
  sendConsoleCommand(`tellraw @a {"rawtext":[{"text":"§a§l[INFO] §eHitung mundur restart dibatalkan oleh §f${cancelledBy}§e. Selamat bermain kembali!"}]}`);
  sendConsoleCommand('playsound random.toast @a');

  for (const listener of countdownState.listeners) {
    try { listener({ event: 'cancelled', by: cancelledBy }); } catch {}
  }
  countdownState.listeners.clear();

  return { success: true, message: `Hitung mundur restart berhasil dibatalkan oleh ${cancelledBy}.` };
}

function broadcastCountdownTick(s, reason = '') {
  const reasonText = reason ? ` (${reason})` : '';

  if (s === 60 || s === 120 || s === 180 || s === 300) {
    const mins = Math.round(s / 60);
    sendConsoleCommand('title @a times 10 70 20');
    sendConsoleCommand('title @a title §c§lRESTART SERVER');
    sendConsoleCommand(`title @a subtitle §eDalam ${mins} menit!${reasonText ? ' §7' + reason : ''}`);
    sendConsoleCommand(`tellraw @a {"rawtext":[{"text":"§c§l[PERINGATAN] §eServer akan di-restart dalam §c${mins} menit§e${reasonText}! Mohon simpan barang & cari tempat aman."}]}`);
    sendConsoleCommand('playsound random.levelup @a');
  } else if (s === 45) {
    sendConsoleCommand('tellraw @a {"rawtext":[{"text":"§6§l[RESTART] §eTersisa §c45 detik§e sebelum server di-restart!"}]}');
    sendConsoleCommand('playsound note.bell @a');
  } else if (s === 30) {
    sendConsoleCommand('title @a times 5 40 10');
    sendConsoleCommand('title @a actionbar §c§l⚠️ RESTART DALAM 30 DETIK!');
    sendConsoleCommand('tellraw @a {"rawtext":[{"text":"§c§l[PERINGATAN] §eServer akan di-restart dalam §c30 detik§e! Mohon segera logout jika berada di tempat rawan."}]}');
    sendConsoleCommand('playsound block.bell.hit @a');
  } else if (s === 15) {
    sendConsoleCommand('title @a actionbar §c§l⚠️ RESTART DALAM 15 DETIK!');
    sendConsoleCommand('tellraw @a {"rawtext":[{"text":"§c§l[PERINGATAN] §eServer akan di-restart dalam §c15 detik§e!"}]}');
    sendConsoleCommand('playsound note.bell @a');
  } else if (s === 10) {
    sendConsoleCommand('title @a times 5 25 5');
    sendConsoleCommand('title @a title §c§l10 DETIK');
    sendConsoleCommand('title @a subtitle §eBersiap log out...');
    sendConsoleCommand('playsound random.orb @a');
  } else if (s >= 1 && s <= 5) {
    sendConsoleCommand('title @a times 0 25 5');
    sendConsoleCommand(`title @a title §c§l${s}`);
    sendConsoleCommand('title @a subtitle §eRestarting...');
    sendConsoleCommand('playsound random.click @a');
  }
}

/**
 * Restart server dengan hitung mundur dan notifikasi in-game (default 60 detik)
 */
async function restartServerWithCountdown(seconds = 60, options = {}) {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const check = await isServerRunning();
  if (!check.running) {
    return { success: false, message: 'Server Minecraft sedang offline, silakan nyalakan server terlebih dahulu.' };
  }

  if (countdownState.active) {
    return {
      success: false,
      message: `Restart sedang dalam proses hitung mundur (${countdownState.secondsLeft} detik tersisa)!`,
      secondsLeft: countdownState.secondsLeft,
      active: true
    };
  }

  const duration = Math.max(0, parseInt(seconds, 10) || 60);
  const initiatedBy = options.initiatedBy || 'Admin';
  const reason = options.reason || '';

  // Jika durasi 0, langsung eksekusi instan
  if (duration === 0) {
    sendConsoleCommand('title @a title §c§lRESTARTING NOW...');
    sendConsoleCommand('tellraw @a {"rawtext":[{"text":"§c§l[SERVER] §eServer sedang di-restart instan oleh Admin..."}]}');
    sendConsoleCommand('save hold');
    await new Promise(r => setTimeout(r, 1200));
    return await executeRestartDirect();
  }

  countdownState.active = true;
  countdownState.secondsLeft = duration;
  countdownState.totalSeconds = duration;
  countdownState.initiatedBy = initiatedBy;
  countdownState.reason = reason;
  countdownState.cancelRequested = false;

  // Siarkan pengumuman awal
  broadcastCountdownTick(duration, reason);

  return new Promise((resolve) => {
    countdownState.timer = setInterval(async () => {
      if (countdownState.cancelRequested) {
        clearInterval(countdownState.timer);
        countdownState.timer = null;
        resolve({ success: false, cancelled: true, message: 'Restart dibatalkan.' });
        return;
      }

      countdownState.secondsLeft -= 1;
      const s = countdownState.secondsLeft;

      if (options.onTick) {
        try { options.onTick(s); } catch {}
      }

      broadcastCountdownTick(s, reason);

      if (s <= 0) {
        clearInterval(countdownState.timer);
        countdownState.timer = null;
        countdownState.active = false;

        // Simpan dunia dan eksekusi restart
        sendConsoleCommand('title @a title §4§lRESTARTING NOW');
        sendConsoleCommand('title @a subtitle §eMenyimpan data dunia...');
        sendConsoleCommand('tellraw @a {"rawtext":[{"text":"§a§l[SERVER] §eMenyimpan data dunia dan me-restart server. Silakan bergabung kembali sesaat lagi!"}]}');
        sendConsoleCommand('save hold');

        await new Promise(r => setTimeout(r, 2000));
        const res = await executeRestartDirect();
        resolve(res);
      }
    }, 1000);
  });
}

/**
 * Eksekusi restart langsung ke systemctl tanpa countdown
 */
async function executeRestartDirect() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }
  const engine = await getActiveEngine();
  const res = await runShell(`sudo systemctl restart ${engine.service}`);
  if (res.success) {
    return { success: true, message: `Server Minecraft (${engine.service}) sedang di-restart. Mohon tunggu beberapa detik...` };
  } else {
    return { success: false, message: `Gagal restart server: ${res.stderr || res.error}` };
  }
}

/**
 * Restart server Minecraft di VPS (default hitung mundur 60 detik)
 */
async function restartServer(options = {}) {
  const isImmediate = options === true || options?.immediate === true || options?.countdown === 0;
  if (isImmediate) {
    return await executeRestartDirect();
  }
  const seconds = typeof options?.countdown === 'number' ? options.countdown : 60;
  return await restartServerWithCountdown(seconds, options);
}

/**
 * Mengirim perintah konsol ke sesi screen yang sedang aktif (mc-paper atau mc-bedrock)
 */
function sendConsoleCommand(cmd) {
  if (process.platform !== 'linux') {
    return { success: false, message: 'Hanya bekerja di Linux' };
  }

  const fs = require('node:fs');
  const path = require('node:path');
  const homeDir = process.env.HOME || '/home/ubuntu';
  const isBedrock = fs.existsSync(path.join(homeDir, 'bedrock-server'));
  const fallbackScreen = isBedrock ? 'mc-bedrock' : 'mc-paper';
  const screen = getActiveScreenSession() || fallbackScreen;
  let cleanCmd = cmd.trim();
  if (cleanCmd.startsWith('/')) {
    cleanCmd = cleanCmd.substring(1).trim();
  }
  const escaped = cleanCmd.replace(/"/g, '\\"');

  try {
    execSync(`screen -S ${screen} -X stuff "${escaped}\\n"`, { timeout: 4000 });
    return { success: true, screen, command: cleanCmd };
  } catch (err) {
    return { success: false, error: err.message, screen, command: cleanCmd };
  }
}

/**
 * Mengirim pesan broadcast ke in-game chat Minecraft (mendukung PaperMC & Bedrock)
 */
function sendBroadcast(sender, text) {
  if (process.platform !== 'linux') {
    return { success: false, message: 'Hanya bekerja di Linux' };
  }

  const screen = getActiveScreenSession() || 'mc-paper';
  const cleanSender = String(sender || 'Discord').replace(/["'\\]/g, '');
  const cleanText = String(text || '').replace(/[\r\n\t]+/g, ' ').substring(0, 150).replace(/["'\\]/g, '');

  if (screen === 'mc-paper') {
    // Format JSON tellraw untuk Minecraft Java Edition (PaperMC)
    const tellrawJson = JSON.stringify([
      { text: '[Discord] ', color: 'aqua', bold: true },
      { text: `${cleanSender}: `, color: 'yellow' },
      { text: cleanText, color: 'white' }
    ]);
    const escaped = tellrawJson.replace(/"/g, '\\"');

    try {
      execSync(`screen -S mc-paper -X stuff "tellraw @a ${escaped}\\n"`, { timeout: 4000 });
      return { success: true, screen: 'mc-paper' };
    } catch {
      try {
        execSync(`screen -S mc-paper -X stuff "say §b[Discord] §e${cleanSender}§f: ${cleanText}\\n"`, { timeout: 4000 });
        return { success: true, screen: 'mc-paper' };
      } catch (err) {
        return { success: false, error: err.message, screen: 'mc-paper' };
      }
    }
  } else {
    // Format JSON tellraw untuk Minecraft Bedrock Dedicated Server (BDS)
    const tellrawJson = JSON.stringify({
      rawtext: [
        { text: `§b[Discord] §e${cleanSender}§f: ${cleanText}` }
      ]
    });
    const escaped = tellrawJson.replace(/"/g, '\\"');

    try {
      execSync(`screen -S mc-bedrock -X stuff "tellraw @a ${escaped}\\n"`, { timeout: 4000 });
      return { success: true, screen: 'mc-bedrock' };
    } catch {
      try {
        execSync(`screen -S mc-bedrock -X stuff "say [Discord] ${cleanSender}: ${cleanText}\\n"`, { timeout: 4000 });
        return { success: true, screen: 'mc-bedrock' };
      } catch (err) {
        return { success: false, error: err.message, screen: 'mc-bedrock' };
      }
    }
  }
}

module.exports = {
  isServerRunning,
  startServer,
  stopServer,
  restartServer,
  restartServerWithCountdown,
  cancelRestart,
  getCountdownState,
  executeRestartDirect,
  getActiveEngine,
  getActiveScreenSession,
  sendConsoleCommand,
  sendBroadcast
};
