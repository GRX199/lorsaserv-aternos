const http = require('node:http');

/**
 * Membuat HTTP Server ringan untuk Web Service (Render healthcheck & link langsung koneksi Minecraft)
 * @param {number} port - Port yang digunakan
 * @param {function} getStatusCallback - Callback untuk mengambil status server Minecraft saat ini
 * @param {object} config - Objek konfigurasi config.json
 */
function startHealthServer(port = 3000, getStatusCallback, config) {
  const server = http.createServer((req, res) => {
    // 1. Endpoint Healthcheck
    if (req.url === '/health' || req.url === '/') {
      const currentStatus = typeof getStatusCallback === 'function' ? getStatusCallback() : null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
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
    if (req.url === '/connect' || req.url === '/join') {
      const mc = config?.mcserver || {};
      const serverName = mc.name || 'Minecraft Server';
      const ip = mc.ip || '127.0.0.1';
      const mcPort = mc.port || 19132;
      const deepLink = `minecraft://?addExternalServer=${encodeURIComponent(serverName)}|${ip}:${mcPort}`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buka Minecraft Bedrock - ${serverName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121214; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e1f22; border: 1px solid #2b2d31; border-radius: 16px; padding: 30px; text-align: center; max-width: 420px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { margin: 0 0 10px; color: #2ecc71; font-size: 24px; }
    p { color: #dbdee1; font-size: 15px; line-height: 1.5; margin: 8px 0; }
    .info { background: #2b2d31; border-radius: 8px; padding: 12px; margin: 20px 0; font-family: monospace; font-size: 15px; color: #00b0f4; }
    .btn { display: block; background: #5865f2; color: #fff; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: bold; font-size: 16px; margin-top: 15px; transition: 0.2s; }
    .btn:hover { background: #4752c4; }
    .hint { font-size: 12px; color: #949ba4; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🎮 Menghubungkan ke Server...</h2>
    <p>Membuka game Minecraft Bedrock di perangkat Anda untuk server <b>${serverName}</b>.</p>
    <div class="info">${ip}:${mcPort}</div>
    <a href="${deepLink}" class="btn">▶ Buka Minecraft Sekarang</a>
    <p class="hint">Jika game tidak terbuka secara otomatis dalam beberapa detik, silakan klik tombol biru di atas.</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${deepLink}";
    }, 500);
  </script>
</body>
</html>`);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[HTTP Server] Healthcheck web server listening on port ${port} (Render compatible)`);
  });

  return server;
}

module.exports = {
  startHealthServer
};
