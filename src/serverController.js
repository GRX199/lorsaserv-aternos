const { exec } = require('node:child_process');

/**
 * Menjalankan perintah shell secara Promise
 */
function runShell(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({
        success: !error,
        code: error ? error.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        error: error ? error.message : null
      });
    });
  });
}

/**
 * Memeriksa apakah service server Minecraft di VPS sedang aktif
 */
async function isServerRunning() {
  if (process.platform === 'win32') {
    return { available: false, running: false, message: 'Kontrol systemd hanya tersedia di VPS Linux' };
  }

  // 1. Cek via systemctl tanpa sudo (tidak memerlukan password)
  const sysRes = await runShell('systemctl is-active minecraft-bedrock');
  let running = sysRes.stdout.toLowerCase().trim() === 'active';

  // 2. Fallback cek apakah proses binary bedrock_server sedang jalan di background
  if (!running) {
    const procRes = await runShell('pgrep -f bedrock_server');
    if (procRes.stdout && procRes.stdout.trim().length > 0) {
      running = true;
    }
  }

  return {
    available: true,
    running,
    statusText: running ? 'active' : sysRes.stdout
  };
}

/**
 * Menyalakan server Minecraft Bedrock di VPS
 */
async function startServer() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const check = await isServerRunning();
  if (check.running) {
    return { success: false, message: 'Server Minecraft sudah dalam keadaan menyala (Online)!' };
  }

  const res = await runShell('sudo systemctl start minecraft-bedrock');
  if (res.success) {
    return { success: true, message: 'Perintah menyalakan server berhasil dikirim. Server sedang loading...' };
  } else {
    return { success: false, message: `Gagal menyalakan server: ${res.stderr || res.error}` };
  }
}

/**
 * Mematikan server Minecraft Bedrock di VPS (save world otomatis)
 */
async function stopServer() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const check = await isServerRunning();
  if (!check.running) {
    return { success: false, message: 'Server Minecraft saat ini memang sudah dalam keadaan mati.' };
  }

  const res = await runShell('sudo systemctl stop minecraft-bedrock');
  if (res.success) {
    return { success: true, message: 'Server Minecraft berhasil dimatikan secara aman (world tersimpan).' };
  } else {
    return { success: false, message: `Gagal mematikan server: ${res.stderr || res.error}` };
  }
}

/**
 * Restart server Minecraft Bedrock di VPS
 */
async function restartServer() {
  if (process.platform === 'win32') {
    return { success: false, message: 'Kontrol server hanya tersedia di VPS Linux.' };
  }

  const res = await runShell('sudo systemctl restart minecraft-bedrock');
  if (res.success) {
    return { success: true, message: 'Server Minecraft sedang di-restart. Mohon tunggu beberapa detik...' };
  } else {
    return { success: false, message: `Gagal restart server: ${res.stderr || res.error}` };
  }
}

module.exports = {
  isServerRunning,
  startServer,
  stopServer,
  restartServer
};
