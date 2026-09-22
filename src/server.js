const http = require('node:http');

/**
 * Membuat HTTP Server ringan untuk Web Service Render (agar tidak sleep & lulus healthcheck)
 * @param {number} port - Port yang digunakan (otomatis mengambil process.env.PORT di Render)
 * @param {function} getStatusCallback - Callback untuk mengambil status server Minecraft saat ini
 */
function startHealthServer(port = 3000, getStatusCallback) {
  const server = http.createServer((req, res) => {
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
