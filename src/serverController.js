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

  // 1. Cek via systemctl (tidak memerlukan sudo)
  const sysRes = await runShell('systemctl is-active minecraft-bedrock');
  const isSysActive = sysRes.stdout.toLowerCase().trim() === 'active';

  // 2. Cek proses binary bedrock_server menggunakan pidof (pidof tidak akan mencocokkan diri sendiri)
  const procRes = await runShell('pidof bedrock_server');
  const isProcAlive = Boolean(procRes.stdout && procRes.stdout.trim().length > 0);

  const running = isSysActive || isProcAlive;

  return {
    available: true,
    running,
    statusText: running ? (isSysActive ? 'active' : 'running-manual') : (sysRes.stdout || 'inactive')
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
  await new Promise(r => setTimeout(r, 1000));

  const verify = await isServerRunning();
  if (verify.running || res.success) {
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

  // 1. Matikan via systemctl
  await runShell('sudo systemctl stop minecraft-bedrock');

  // 2. Beri jeda 1.5 detik agar BDS selesai menulis dan menyimpan world
  await new Promise(r => setTimeout(r, 1500));

  // 3. Pastikan tidak ada sisa proses manual bedrock_server yang menggantung
  await runShell('pkill -x bedrock_server || true');

  // 4. Verifikasi apakah server sudah benar-benar mati
  const check = await isServerRunning();
  if (!check.running) {
    return { success: true, message: 'Server Minecraft berhasil dimatikan secara aman (world tersimpan).' };
  }

  // Jika masih tersisa proses membandel, paksa kill
  await runShell('pkill -9 -x bedrock_server || true');
  return { success: true, message: 'Server Minecraft telah dimatikan.' };
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
