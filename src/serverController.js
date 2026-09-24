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

/**
 * Restart server Minecraft di VPS
 */
async function restartServer() {
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
  getActiveEngine,
  getActiveScreenSession,
  sendConsoleCommand,
  sendBroadcast
};
