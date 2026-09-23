const http = require('node:http');

/**
 * Membuat HTTP Server ringan untuk Web Service (Render healthcheck & link langsung koneksi Minecraft)
 * @param {number} port - Port yang digunakan
 * @param {function} getStatusCallback - Callback untuk mengambil status server Minecraft saat ini
 * @param {object} config - Objek konfigurasi config.json
 */
function startHealthServer(port = 3000, getStatusCallback, config) {
  const server = http.createServer((req, res) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    const pathname = parsedUrl.pathname;

    // 1. Endpoint Healthcheck
    if (pathname === '/health' || pathname === '/') {
      const currentStatus = typeof getStatusCallback === 'function' ? getStatusCallback() : null;

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'ok',
        bot: 'online',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        minecraftServer: currentStatus ? {
          online: currentStatus.online,
          host: currentStatus.host,
          port: currentStatus.port,
          players: currentStatus.players
        } : 'Initializing...'
      }, null, 2));
      return;
    }

    // 2. Endpoint Redirect Otomatis ke Minecraft Bedrock (Android / iOS / Windows)
    if (pathname === '/connect' || pathname === '/join') {
      const serverId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('server');
      const servers = (config?.servers && Array.isArray(config.servers) && config.servers.length > 0)
        ? config.servers
        : (config?.mcserver ? [config.mcserver] : []);

      let target = null;
      if (serverId) {
        target = servers.find(s => s.id === serverId || (s.name && s.name.toLowerCase().includes(serverId.toLowerCase())));
      }
      if (!target && servers.length > 0) {
        // Default ke server VPS jika ada, atau server pertama
        target = servers.find(s => s.id === 'vps' || s.isLocal) || servers[0];
      }
      if (!target && config?.mcserver) {
        target = config.mcserver;
      }

      const serverName = target?.name || 'Minecraft Server';
      const ip = (target?.ip && target.ip !== 'auto')
        ? target.ip
        : (config?.publicIp || '129.226.95.58');
      const mcPort = target?.port || 19132;
      const deepLink = `minecraft://?addExternalServer=${encodeURIComponent(serverName)}|${ip}:${mcPort}`;

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buka Minecraft Bedrock - ${serverName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f1012;
      color: #f2f3f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #1e1f22;
      border: 1px solid #2b2d31;
      border-radius: 18px;
      padding: 28px 24px;
      text-align: center;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
    }
    .badge {
      display: inline-block;
      background: rgba(46, 204, 113, 0.15);
      color: #2ecc71;
      font-weight: 700;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0 0 10px;
      color: #ffffff;
      font-size: 22px;
      letter-spacing: -0.3px;
    }
    p {
      color: #b5bac1;
      font-size: 14px;
      line-height: 1.5;
      margin: 8px 0;
    }
    .info-box {
      background: #2b2d31;
      border-radius: 12px;
      padding: 14px;
      margin: 18px 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }
    .info-label {
      color: #949ba4;
    }
    .info-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #00b0f4;
      font-weight: 600;
      background: #1e1f22;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .btn-main {
      display: block;
      background: #2ecc71;
      color: #0b0c0e;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 16px;
      margin-top: 14px;
      box-shadow: 0 4px 15px rgba(46, 204, 113, 0.35);
      transition: all 0.2s;
    }
    .btn-main:hover {
      background: #27ae60;
      transform: translateY(-1px);
    }
    .btn-group {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .btn-secondary {
      flex: 1;
      background: #313338;
      border: 1px solid #3f4147;
      color: #dbdee1;
      padding: 10px 8px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.2s;
    }
    .btn-secondary:hover {
      background: #383a40;
      color: #fff;
    }
    .steps {
      background: #18191c;
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 20px;
      text-align: left;
      font-size: 12.5px;
      color: #949ba4;
      line-height: 1.5;
    }
    .steps b {
      color: #dbdee1;
    }
    .hint {
      font-size: 12px;
      color: #80848e;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🟢 SERVER READY</div>
    <h2>🎮 Buka Minecraft Bedrock</h2>
    <p>Menghubungkan ke <b>${serverName}</b> di perangkat Anda...</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Alamat Server (IP)</span>
        <span class="info-val">${ip}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Port Bedrock</span>
        <span class="info-val">${mcPort}</span>
      </div>
    </div>

    <a href="${deepLink}" class="btn-main" id="btnLaunch">▶ Buka di Minecraft Sekarang</a>

    <div class="btn-group">
      <button class="btn-secondary" onclick="copyText('${ip}', this, 'IP Tersalin!')">📋 Salin IP</button>
      <button class="btn-secondary" onclick="copyText('${mcPort}', this, 'Port Tersalin!')">🔌 Salin Port</button>
    </div>

    <div class="steps">
      <b>💡 Cara Masuk Manual jika Game Belum Terbuka:</b><br>
      1. Buka Minecraft Bedrock (Android / iOS / Windows)<br>
      2. Klik <b>Play</b> → Tab <b>Servers</b> → Scroll ke bawah & klik <b>Add Server</b><br>
      3. Masukkan Server Address: <b>${ip}</b> dan Port: <b>${mcPort}</b><br>
      4. Klik <b>Save</b> atau <b>Play</b>!
    </div>

    <p class="hint">Jika prompt otomatis tidak muncul dalam 2 detik, klik tombol hijau di atas.</p>
  </div>

  <script>
    function copyText(val, btn, msg) {
      navigator.clipboard.writeText(val).then(function() {
        const orig = btn.innerText;
        btn.innerText = '✅ ' + msg;
        btn.style.color = '#2ecc71';
        setTimeout(function() {
          btn.innerText = orig;
          btn.style.color = '';
        }, 2000);
      }).catch(function() {
        prompt('Salin teks:', val);
      });
    }

    // Auto-launch deep link setelah halaman dimuat
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 300);
  </script>
</body>
</html>`);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[HTTP Server] Healthcheck & Connect web server listening on port ${port} (Render / VPS compatible)`);
  });

  return server;
}

module.exports = {
  startHealthServer
};
