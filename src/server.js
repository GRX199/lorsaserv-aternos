const http = require('node:http');
const { renderWebMapPage } = require('./webMapHtml');

/**
 * Membuat HTTP Server ringan untuk Web Service (Render healthcheck & link langsung koneksi Minecraft)
 * @param {number} port - Port yang digunakan
 * @param {function} getStatusCallback - Callback untuk mengambil status server Minecraft saat ini
 * @param {object} config - Objek konfigurasi config.json
 * @param {function} getStatusManagerCallback - Callback untuk mengambil instance StatusManager
 */
function startHealthServer(port = 3000, getStatusCallback, config, getStatusManagerCallback) {
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

    // 1.5. Endpoint API Data Peta (Koordinat Pemain & Server Status)
    if (pathname === '/api/map-data') {
      const fs = require('node:fs');
      const path = require('node:path');
      const { getSkinUrls } = require('./skinHelper');

      const sm = typeof getStatusManagerCallback === 'function' ? getStatusManagerCallback() : null;
      const currentStatus = typeof getStatusCallback === 'function' ? getStatusCallback() : null;

      const onlineNames = sm?.playerLogMonitor ? sm.playerLogMonitor.getOnlinePlayers() : [];
      const offlineFile = path.join(__dirname, '..', 'data', 'offline_players.json');

      let savedData = {};
      if (fs.existsSync(offlineFile)) {
        try {
          savedData = JSON.parse(fs.readFileSync(offlineFile, 'utf8'));
        } catch {}
      }

      const players = [];
      const seen = new Set();

      for (const [key, p] of Object.entries(savedData)) {
        if (!p || !p.name) continue;
        const isOnline = onlineNames.some(n => n.toLowerCase() === p.name.toLowerCase());
        const skin = getSkinUrls(p.name);
        players.push({
          name: p.name,
          isOnline,
          x: p.x ?? 0,
          y: p.y ?? 64,
          z: p.z ?? 0,
          dimension: p.dimension || 'overworld',
          health: p.health ?? 20,
          maxHealth: p.maxHealth ?? 20,
          level: p.level ?? 0,
          armor: p.armor || {},
          avatarUrl: skin.headUrl,
          bodyUrl: skin.bodyUrl,
          updatedAt: p.updatedAt || Date.now()
        });
        seen.add(p.name.toLowerCase());
      }

      for (const name of onlineNames) {
        if (!seen.has(name.toLowerCase())) {
          const skin = getSkinUrls(name);
          players.push({
            name,
            isOnline: true,
            x: 0,
            y: 64,
            z: 0,
            dimension: 'overworld',
            health: 20,
            maxHealth: 20,
            level: 0,
            armor: {},
            avatarUrl: skin.headUrl,
            bodyUrl: skin.bodyUrl,
            updatedAt: Date.now()
          });
        }
      }

      const vps = (config?.servers && config.servers.find(s => s.id === 'vps')) || config?.mcserver || {};
      const ip = (vps.ip && vps.ip !== 'auto') ? vps.ip : (config?.publicIp || '129.226.95.58');

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify({
        server: {
          name: vps.name || 'SASY199 Minecraft Bedrock Server',
          online: Boolean(currentStatus?.online),
          ip: ip,
          port: vps.port || 19132,
          version: currentStatus?.version || 'Bedrock 1.26.51',
          playersOnline: onlineNames.length || currentStatus?.players?.online || 0,
          playersMax: currentStatus?.players?.max || 10
        },
        players
      }));
      return;
    }

    // 1.8. Endpoint Halaman Web Map Live Interaktif (/map atau /livemap)
    if (pathname === '/map' || pathname === '/livemap' || pathname === '/webmap') {
      const vps = (config?.servers && config.servers.find(s => s.id === 'vps')) || config?.mcserver || {};
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(renderWebMapPage(vps, config));
      return;
    }

    // 1.85. Endpoint Web Map Visual Blok Dunia Asli (uNmINeD Renderer)
    // A. Otomatis redirect ke /world-map/ jika dibuka tanpa trailing slash agar resolusi relative asset browser benar
    if (pathname === '/world-map' || pathname === '/worldmap') {
      res.writeHead(301, {
        'Location': '/world-map/',
        'Content-Type': 'text/plain'
      });
      res.end('Redirecting to /world-map/');
      return;
    }

    if (pathname.startsWith('/world-map/')) {
      const fs = require('node:fs');
      const path = require('node:path');
      const worldMapDir = path.join(__dirname, '..', 'public', 'world_map');

      let relPath = pathname.replace(/^\/world-map\/?/, '');
      if (!relPath || relPath === '/') {
        relPath = 'index.html';
      }

      // Khusus custom.markers.js: Sajikan koordinat live pemain secara dinamis sesuai struktur uNmINeD!
      if (relPath === 'custom.markers.js') {
        const sm = typeof getStatusManagerCallback === 'function' ? getStatusManagerCallback() : null;
        const onlineNames = sm?.playerLogMonitor ? sm.playerLogMonitor.getOnlinePlayers() : [];
        const offlineFile = path.join(__dirname, '..', 'data', 'offline_players.json');
        const { getSkinUrls } = require('./skinHelper');

        let savedData = {};
        if (fs.existsSync(offlineFile)) {
          try {
            savedData = JSON.parse(fs.readFileSync(offlineFile, 'utf8'));
          } catch {}
        }

        const markers = [];
        const seen = new Set();

        for (const [key, p] of Object.entries(savedData)) {
          if (!p || !p.name) continue;
          const isOnline = onlineNames.some(n => n.toLowerCase() === p.name.toLowerCase());
          const skin = getSkinUrls(p.name);
          markers.push({
            x: Math.round(p.x ?? 0),
            z: Math.round(p.z ?? 0),
            image: skin.headUrl,
            imageAnchor: [0.5, 0.5],
            imageScale: 0.6,
            text: `${isOnline ? '🟢' : '⚪'} ${p.name} (${Math.round(p.x ?? 0)}, ${Math.round(p.y ?? 64)}, ${Math.round(p.z ?? 0)}) [❤️ ${Math.round(p.health ?? 20)}/20]`,
            textColor: isOnline ? '#2ecc71' : '#b5bac1',
            offsetX: 0,
            offsetY: 28,
            font: 'bold 13px system-ui, sans-serif'
          });
          seen.add(p.name.toLowerCase());
        }

        for (const name of onlineNames) {
          if (!seen.has(name.toLowerCase())) {
            const skin = getSkinUrls(name);
            markers.push({
              x: 0,
              z: 0,
              image: skin.headUrl,
              imageAnchor: [0.5, 0.5],
              imageScale: 0.6,
              text: `🟢 ${name} (0, 64, 0)`,
              textColor: '#2ecc71',
              offsetX: 0,
              offsetY: 28,
              font: 'bold 13px system-ui, sans-serif'
            });
          }
        }

        const js = `// Live player markers generated by lorsaserv\nvar UnminedCustomMarkers = {\n  isEnabled: true,\n  markers: ${JSON.stringify(markers, null, 2)}\n};\n`;
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(js);
        return;
      }

      // Safe file path resolution
      const safeRel = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
      let targetFile = path.join(worldMapDir, safeRel);

      // Fallback: jika index.html dicari tapi adanya unmined.index.html
      if (safeRel === 'index.html' && !fs.existsSync(targetFile)) {
        const altFile = path.join(worldMapDir, 'unmined.index.html');
        if (fs.existsSync(altFile)) {
          targetFile = altFile;
        }
      }

      // Jika file index belum ada (belum di-render)
      if ((safeRel === 'index.html' || safeRel === '') && !fs.existsSync(targetFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderWorldMapPendingPage(config));
        return;
      }

      // Sajikan index.html dengan suntikan <base href="/world-map/"> agar semua aset terhubung aman
      if (safeRel === 'index.html' || safeRel === '') {
        let html = fs.readFileSync(targetFile, 'utf8');
        if (!html.includes('<base ')) {
          html = html.replace(/<head>/i, '<head>\n    <base href="/world-map/">');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(html);
        return;
      }

      if (!fs.existsSync(targetFile)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File visual map tidak ditemukan: ' + safeRel);
        return;
      }

      const stat = fs.statSync(targetFile);
      if (stat.isDirectory()) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Access Denied');
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': ext === '.png' || ext === '.jpg' || ext === '.webp' ? 'public, max-age=86400' : 'no-cache'
      });

      fs.createReadStream(targetFile).pipe(res);
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

    // 3. Endpoint Download Bedrock World Archive (.zip)
    if (pathname === '/download-bedrock-world' || pathname === '/bedrock_world.zip') {
      const fs = require('node:fs');
      const path = require('node:path');
      const { execSync } = require('node:child_process');

      const homeDir = process.env.HOME || '/home/ubuntu';
      const worldsDir = path.join(homeDir, 'bedrock-server', 'worlds');
      const publicZip = path.join(__dirname, '..', 'public', 'bedrock_world.zip');

      if (!fs.existsSync(worldsDir)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Direktori world Bedrock tidak ditemukan di server.');
        return;
      }

      try {
        let needsZip = !fs.existsSync(publicZip);
        if (!needsZip) {
          const stat = fs.statSync(publicZip);
          if (Date.now() - stat.mtimeMs > 300000) {
            needsZip = true;
          }
        }

        if (needsZip) {
          const publicDir = path.dirname(publicZip);
          if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
          execSync(`python3 -c "import shutil; shutil.make_archive('${publicZip.replace('.zip', '')}', 'zip', '${worldsDir}')"`, { timeout: 60000 });
        }

        const stat = fs.statSync(publicZip);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="bedrock_world.zip"'
        });

        const readStream = fs.createReadStream(publicZip);
        readStream.pipe(res);
        return;
      } catch (err) {
        console.error('[Web Server] Gagal membuat/mengirim bedrock_world.zip:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Gagal membuat arsip world: ' + err.message);
        return;
      }
    }

    // 4. Endpoint Halaman Bantuan Konverter World (/converter)
    if (pathname === '/converter') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panduan Konversi World Bedrock ke Java</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1012; color: #dbdee1; padding: 20px; line-height: 1.6; max-width: 650px; margin: auto; }
    .card { background: #1e1f22; border: 1px solid #2b2d31; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    h1, h2 { color: #fff; margin-top: 0; }
    .btn { display: inline-block; background: #2ecc71; color: #000; font-weight: bold; text-decoration: none; padding: 12px 20px; border-radius: 8px; margin: 10px 0; }
    .btn-chunker { background: #00b0f4; color: #fff; }
    .code { background: #2b2d31; padding: 10px 14px; border-radius: 6px; font-family: monospace; color: #2ecc71; overflow-x: auto; }
    .warn { background: rgba(241, 196, 15, 0.1); border-left: 4px solid #f1c40f; padding: 12px; margin: 15px 0; color: #f1c40f; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🗺️ Konversi World Bedrock ke Java</h1>
    <div class="warn">
      ⚠️ <b>Penting:</b> Sebelum mengonversi map, pastikan semua pemain telah memasukkan semua item, armor, dan senjata dari badan ke dalam <b>Chest (Peti)</b> di Bedrock!
    </div>
    <h2>Langkah 1: Unduh World Bedrock</h2>
    <p>Klik tombol di bawah untuk mengunduh seluruh file map Bedrock lama Anda dari server:</p>
    <a href="/download-bedrock-world" class="btn">📥 Unduh bedrock_world.zip</a>

    <h2>Langkah 2: Konversi via Chunker</h2>
    <p>Gunakan converter resmi Mojang (Chunker):</p>
    <a href="https://chunker.app" target="_blank" class="btn btn-chunker">🌐 Buka Chunker.app</a>
    <ol>
      <li>Klik <b>Upload Archive</b> lalu pilih file <code>bedrock_world.zip</code> yang baru diunduh.</li>
      <li>Pilih target output: <b>Java 1.21.4</b>.</li>
      <li>Klik <b>Convert & Download</b> untuk mengunduh hasilnya (misal: <code>chunker_java_world.zip</code>).</li>
    </ol>

    <h2>Langkah 3: Terapkan ke Server</h2>
    <p>Jalankan perintah ini di terminal VPS Anda:</p>
    <div class="code">bash import_converted_world.sh &lt;nama_file_hasil_chunker.zip&gt;</div>
  </div>
</body>
</html>`);
      return;
    }

    // 5. Fallback: Sajikan file world-map jika browser me-request aset langsung dari root path (misal: /lib/*, /tiles/*, /unmined*, /custom.markers.js)
    if (pathname === '/custom.markers.js') {
      res.writeHead(302, { 'Location': '/world-map/custom.markers.js' });
      res.end();
      return;
    }

    if (pathname !== '/' && pathname !== '') {
      const fs = require('node:fs');
      const path = require('node:path');
      const worldMapDir = path.join(__dirname, '..', 'public', 'world_map');
      const cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
      const fallbackTarget = path.join(worldMapDir, cleanPath);
      if (fallbackTarget.startsWith(worldMapDir) && fs.existsSync(fallbackTarget) && fs.statSync(fallbackTarget).isFile()) {
        const ext = path.extname(fallbackTarget).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const stat = fs.statSync(fallbackTarget);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': ext === '.png' || ext === '.jpg' || ext === '.webp' ? 'public, max-age=86400' : 'no-cache'
        });
        fs.createReadStream(fallbackTarget).pipe(res);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[HTTP Server] Healthcheck & Connect web server listening on port ${port} (Render / VPS compatible)`);
  });

  return server;
}

function renderWorldMapPendingPage(config) {
  const vps = (config?.servers && config.servers.find(s => s.id === 'vps')) || config?.mcserver || {};
  const serverName = vps.name || 'SASY199 • VPS TENCENT';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🗺️ Visual Map Dunia Sedang Disiapkan - ${serverName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1013;
      color: #f1f2f4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #181a1f;
      border: 1px solid #2b2f38;
      border-radius: 18px;
      padding: 36px 28px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    }
    .icon { font-size: 54px; margin-bottom: 12px; }
    h2 { font-size: 22px; margin: 0 0 10px; color: #fff; }
    p { font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 10px 0; }
    .badge {
      display: inline-block;
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      font-weight: 700;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    .box-info {
      background: #21242b;
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      font-size: 13px;
      margin: 20px 0;
      border-left: 4px solid #38bdf8;
      line-height: 1.6;
    }
    .box-info b { color: #fff; }
    .btn-row { display: flex; gap: 10px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: 0.15s;
    }
    .btn-primary { background: #38bdf8; color: #0b0c0e; }
    .btn-primary:hover { background: #0284c7; }
    .btn-secondary { background: #2b2f38; color: #f1f2f4; }
    .btn-secondary:hover { background: #373c47; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🌍</div>
    <div class="badge">uNmINeD Bedrock Tile Renderer</div>
    <h2>Visual Map Dunia Sedang Disiapkan</h2>
    <p>Peta visual blok dunia asli Minecraft Bedrock (pohon, air, bioma, bangunan, kontur tanah) belum pernah di-render ke web.</p>
    
    <div class="box-info">
      <b>💡 Cara Menjalankan Render Visual Dunia:</b><br>
      1. Buka Discord, ketik perintah <code>/render-map</code> atau klik tombol <b>Render Map</b> di Live Admin Panel.<br>
      2. Atau jalankan di terminal VPS: <code>bash render_world_map.sh</code>.<br>
      3. Setelah selesai, seluruh blok dunia akan otomatis muncul di halaman ini!
    </div>

    <div class="btn-row">
      <a href="/map" class="btn btn-primary">📡 Buka Radar &amp; Koordinat Pemain</a>
      <a href="/connect" class="btn btn-secondary">🎮 Masuk Game</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  startHealthServer
};
