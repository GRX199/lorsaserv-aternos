/**
 * Generator Halaman Web Map & Live Radar Pemain (Interaktif HTML5 Canvas)
 * Mendukung interaksi touch HP & mouse PC, zoom, pan, pergantian dimensi, dan profil skin 3D pemain.
 */
function renderWebMapPage(serverConfig, globalConfig) {
  const serverName = serverConfig?.name || 'SASY199 • VPS TENCENT';
  const ip = (serverConfig?.ip && serverConfig.ip !== 'auto') ? serverConfig.ip : (globalConfig?.publicIp || '129.226.95.58');
  const port = serverConfig?.port || 19132;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🗺️ Web Map Live - ${serverName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100%; height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0d0f12;
      color: #f1f2f4;
      user-select: none;
    }

    /* TOP BAR */
    #topbar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 56px;
      background: rgba(22, 24, 29, 0.94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
    }
    .brand .logo {
      font-size: 20px;
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(46, 204, 113, 0.15);
      color: #2ecc71;
    }
    .badge-status.offline {
      background: rgba(231, 76, 60, 0.15);
      color: #e74c3c;
    }

    .dim-tabs {
      display: flex;
      background: #121316;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 2px;
      gap: 2px;
    }
    .dim-btn {
      background: transparent;
      border: none;
      color: #9ba1ad;
      padding: 6px 12px;
      font-size: 12.5px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .dim-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .dim-btn.active {
      background: #2ecc71;
      color: #0b0c0e;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-action {
      background: #252830;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e1e3e8;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn-action:hover { background: #323642; }

    /* MAP CONTAINER & CANVAS */
    #map-container {
      position: absolute;
      top: 56px; bottom: 0; left: 0; right: 0;
      overflow: hidden;
      background: #0f1217;
      cursor: grab;
    }
    #map-container:active { cursor: grabbing; }
    #map-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* FLOATING CONTROLS */
    .floating-controls {
      position: absolute;
      right: 18px;
      bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 50;
    }
    .circle-btn {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(26, 29, 36, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      backdrop-filter: blur(8px);
      transition: transform 0.1s, background 0.15s;
    }
    .circle-btn:active { transform: scale(0.92); }
    .circle-btn:hover { background: #323642; }

    /* COORDINATES TRACKER */
    #coord-tracker {
      position: absolute;
      left: 18px;
      bottom: 24px;
      background: rgba(22, 24, 29, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, monospace;
      color: #9ba1ad;
      backdrop-filter: blur(6px);
      z-index: 50;
      pointer-events: none;
    }
    #coord-tracker b { color: #00b0f4; }

    /* SIDEBAR PLAYERS */
    #sidebar {
      position: absolute;
      top: 68px; left: 16px;
      width: 260px;
      max-height: calc(100% - 110px);
      background: rgba(22, 24, 29, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      z-index: 60;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.5);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #sidebar.hidden {
      transform: translateX(-300px);
    }
    .sidebar-header {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      font-size: 13px;
    }
    .sidebar-search {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .sidebar-search input {
      width: 100%;
      background: #121316;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      color: #fff;
      padding: 6px 10px;
      font-size: 12px;
      outline: none;
    }
    .player-list {
      padding: 8px 6px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .player-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .player-card:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .player-avatar {
      width: 32px; height: 32px;
      border-radius: 6px;
      background: #2b2d31;
      object-fit: cover;
      position: relative;
    }
    .player-avatar.online {
      box-shadow: 0 0 0 2px #2ecc71;
    }
    .player-avatar.offline {
      box-shadow: 0 0 0 2px #72767d;
      opacity: 0.7;
    }
    .player-meta {
      flex: 1;
      min-width: 0;
    }
    .player-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #fff;
    }
    .player-coords {
      font-size: 11px;
      font-family: monospace;
      color: #8c93a0;
    }

    /* PLAYER POPUP MODAL */
    #popup-modal {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(150%);
      background: rgba(26, 29, 36, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      padding: 16px;
      width: 310px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      z-index: 90;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #popup-modal.show {
      transform: translateX(-50%) translateY(0);
    }
    .popup-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .popup-avatar {
      width: 48px; height: 48px;
      border-radius: 10px;
      background: #2b2d31;
    }
    .popup-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .popup-badge {
      display: inline-block;
      font-size: 10.5px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
      margin-top: 3px;
    }
    .popup-badge.online { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
    .popup-badge.offline { background: rgba(149, 165, 166, 0.2); color: #bdc3c7; }
    .popup-body {
      background: #121316;
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12.5px;
    }
    .popup-row {
      display: flex;
      justify-content: space-between;
      color: #9ba1ad;
    }
    .popup-row span:last-child {
      color: #f1f2f4;
      font-family: monospace;
      font-weight: 600;
    }
    .popup-close {
      position: absolute;
      top: 12px; right: 14px;
      background: none; border: none;
      color: #9ba1ad;
      font-size: 18px;
      cursor: pointer;
    }

    /* RESPONSIVE MOBILE */
    @media (max-width: 720px) {
      .dim-tabs { display: none; }
      #sidebar {
        width: calc(100% - 32px);
        max-height: 220px;
        top: 64px;
      }
      .brand span { display: none; }
    }
  </style>
</head>
<body>

  <!-- TOP BAR -->
  <div id="topbar">
    <div class="brand">
      <span class="logo">🗺️</span>
      <span>${serverName}</span>
      <div id="statusBadge" class="badge-status">
        <span class="dot">●</span> <span id="statusText">Memuat...</span>
      </div>
    </div>

    <!-- DIMENSION SELECTOR -->
    <div class="dim-tabs">
      <button class="dim-btn active" onclick="setDimension('overworld')">🌿 Overworld</button>
      <button class="dim-btn" onclick="setDimension('nether')">🔥 The Nether</button>
      <button class="dim-btn" onclick="setDimension('the_end')">🌌 The End</button>
    </div>

    <!-- QUICK ACTIONS -->
    <div class="top-actions">
      <button class="btn-action" onclick="toggleSidebar()">👥 Pemain</button>
      <a href="/connect" class="btn-action" style="background:#2ecc71; color:#000;">🎮 Main</a>
    </div>
  </div>

  <!-- MAP CONTAINER & CANVAS -->
  <div id="map-container">
    <canvas id="map-canvas"></canvas>
  </div>

  <!-- FLOATING ACTION BUTTONS -->
  <div class="floating-controls">
    <button class="circle-btn" title="Fokus ke Spawn (0,0)" onclick="centerOn(0, 0)">🎯</button>
    <button class="circle-btn" title="Perbesar" onclick="zoom(1.25)">➕</button>
    <button class="circle-btn" title="Perkecil" onclick="zoom(0.8)">➖</button>
  </div>

  <!-- COORDINATE TRACKER -->
  <div id="coord-tracker">
    X: <b id="lblX">0</b> | Z: <b id="lblZ">0</b> (Cursor)
  </div>

  <!-- PLAYERS SIDEBAR -->
  <div id="sidebar">
    <div class="sidebar-header">
      <span>👥 Daftar Pemain</span>
      <span id="playerCountBadge" style="color: #2ecc71; font-size:12px;">0 Online</span>
    </div>
    <div class="sidebar-search">
      <input type="text" id="searchInput" placeholder="Cari nama pemain..." oninput="filterPlayers()">
    </div>
    <div class="player-list" id="playerListEl">
      <div style="color:#72767d; font-size:12px; text-align:center; padding:16px;">Memuat data pemain...</div>
    </div>
  </div>

  <!-- POPUP PLAYER CARD -->
  <div id="popup-modal">
    <button class="popup-close" onclick="closePopup()">✕</button>
    <div class="popup-header">
      <img id="popAvatar" class="popup-avatar" src="https://mc-heads.net/avatar/steve/48" alt="Skin">
      <div>
        <div id="popName" class="popup-title">Player</div>
        <div id="popBadge" class="popup-badge online">🟢 Online</div>
      </div>
    </div>
    <div class="popup-body">
      <div class="popup-row">
        <span>Koordinat</span>
        <span id="popCoords">X: 0 | Y: 64 | Z: 0</span>
      </div>
      <div class="popup-row">
        <span>Dimensi</span>
        <span id="popDim">Overworld</span>
      </div>
      <div class="popup-row">
        <span>Kesehatan</span>
        <span id="popHealth">❤️ 20 / 20</span>
      </div>
    </div>
  </div>

  <script>
    // DATA STATE
    let currentDimension = 'overworld';
    let mapData = { server: {}, players: [] };
    let selectedPlayer = null;
    let imageCache = {};

    // CANVAS & CAMERA STATE
    const container = document.getElementById('map-container');
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');

    let camera = {
      x: 0,
      z: 0,
      zoom: 1.0 // 1 pixel = 1 block pada zoom 1.0
    };

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let cameraStart = { x: 0, z: 0 };
    let lastTouchDistance = 0;

    function resizeCanvas() {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawMap();
    }
    window.addEventListener('resize', resizeCanvas);

    // FETCH DATA REAL-TIME DARI API
    async function fetchData() {
      try {
        const res = await fetch('/api/map-data');
        if (!res.ok) return;
        mapData = await res.json();
        updateUI();
        preloadAvatars();
        drawMap();
      } catch (err) {
        console.warn('Gagal memuat map-data:', err);
      }
    }

    function updateUI() {
      const s = mapData.server || {};
      const statusBadge = document.getElementById('statusBadge');
      const statusText = document.getElementById('statusText');
      if (s.online) {
        statusBadge.className = 'badge-status';
        statusText.innerText = 'ONLINE (' + (s.playersOnline || 0) + '/' + (s.playersMax || 10) + ')';
      } else {
        statusBadge.className = 'badge-status offline';
        statusText.innerText = 'OFFLINE';
      }

      renderSidebar();
    }

    function renderSidebar() {
      const listEl = document.getElementById('playerListEl');
      const countEl = document.getElementById('playerCountBadge');
      const search = (document.getElementById('searchInput').value || '').toLowerCase();

      const players = mapData.players || [];
      const onlineCount = players.filter(p => p.isOnline).length;
      countEl.innerText = onlineCount + ' Online';

      const filtered = players.filter(p => p.name.toLowerCase().includes(search));

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="color:#72767d; font-size:12px; text-align:center; padding:16px;">Tidak ada pemain ditemukan</div>';
        return;
      }

      let html = '';
      // Urutkan online terlebih dahulu
      filtered.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

      for (const p of filtered) {
        const avatar = p.avatarUrl || 'https://mc-heads.net/avatar/' + encodeURIComponent(p.name) + '/32';
        html += \`
          <div class="player-card" onclick="focusPlayer('\${p.name}')">
            <img class="player-avatar \${p.isOnline ? 'online' : 'offline'}" src="\${avatar}" alt="\${p.name}">
            <div class="player-meta">
              <div class="player-name">\${p.name}</div>
              <div class="player-coords">X: \${Math.round(p.x)} | Z: \${Math.round(p.z)}</div>
            </div>
            \${p.isOnline ? '<span style="color:#2ecc71; font-size:10px;">●</span>' : ''}
          </div>
        \`;
      }
      listEl.innerHTML = html;
    }

    function filterPlayers() {
      renderSidebar();
    }

    function preloadAvatars() {
      for (const p of (mapData.players || [])) {
        const url = p.avatarUrl || 'https://mc-heads.net/avatar/' + encodeURIComponent(p.name) + '/32';
        if (!imageCache[url]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          img.onload = () => drawMap();
          imageCache[url] = img;
        }
      }
    }

    // DIMENSION TOGGLE
    function setDimension(dim) {
      currentDimension = dim;
      const btns = document.querySelectorAll('.dim-btn');
      btns.forEach(b => b.classList.remove('active'));
      const activeBtn = Array.from(btns).find(b => b.getAttribute('onclick').includes(dim));
      if (activeBtn) activeBtn.classList.add('active');
      drawMap();
    }

    // CAMERA FOCUS
    function centerOn(x, z) {
      camera.x = x;
      camera.z = z;
      drawMap();
    }

    function zoom(factor) {
      camera.zoom = Math.max(0.1, Math.min(5.0, camera.zoom * factor));
      drawMap();
    }

    function focusPlayer(name) {
      const p = (mapData.players || []).find(pl => pl.name.toLowerCase() === name.toLowerCase());
      if (p) {
        if (p.dimension && p.dimension !== currentDimension) {
          setDimension(p.dimension);
        }
        centerOn(p.x, p.z);
        showPopup(p);
      }
    }

    // DRAW MAP & GRID
    function drawMap() {
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Latar Belakang berdasarkan dimensi
      if (currentDimension === 'nether') {
        ctx.fillStyle = '#220b0b';
      } else if (currentDimension === 'the_end') {
        ctx.fillStyle = '#140c21';
      } else {
        ctx.fillStyle = '#0f1217';
      }
      ctx.fillRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;

      // 2. Garis Grid Koordinat
      let step = 100;
      if (camera.zoom < 0.3) step = 1000;
      else if (camera.zoom < 0.7) step = 500;
      else if (camera.zoom < 1.5) step = 200;
      else step = 100;

      const screenStep = step * camera.zoom;
      const startX = (centerX - (camera.x * camera.zoom)) % screenStep;
      const startZ = (centerY - (camera.z * camera.zoom)) % screenStep;

      ctx.lineWidth = 1;
      ctx.strokeStyle = (currentDimension === 'nether') ? 'rgba(255, 100, 100, 0.08)' : 'rgba(255, 255, 255, 0.06)';

      for (let x = startX; x < w; x += screenStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = startZ; y < h; y += screenStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Sumbu Utama (X = 0 & Z = 0)
      const axisX = centerX - (camera.x * camera.zoom);
      const axisZ = centerY - (camera.z * camera.zoom);

      // Sumbu Z (Garis Vertikal di X=0)
      if (axisX >= 0 && axisX <= w) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 176, 244, 0.4)';
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, h);
        ctx.stroke();
      }
      // Sumbu X (Garis Horizontal di Z=0)
      if (axisZ >= 0 && axisZ <= h) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, axisZ);
        ctx.lineTo(w, axisZ);
        ctx.stroke();
      }

      // 4. World Spawn Marker (0, 0)
      if (currentDimension === 'overworld') {
        const sx = centerX + (0 - camera.x) * camera.zoom;
        const sz = centerY + (0 - camera.z) * camera.zoom;

        if (sx >= -50 && sx <= w + 50 && sz >= -50 && sz <= h + 50) {
          ctx.beginPath();
          ctx.arc(sx, sz, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#f1c40f';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#f1c40f';
          ctx.textAlign = 'center';
          ctx.fillText('🏛️ World Spawn (0, 0)', sx, sz + 20);
        }
      }

      // 5. Render Pemain
      const players = (mapData.players || []).filter(p => {
        const dim = (p.dimension || 'overworld').toLowerCase();
        return dim === currentDimension.toLowerCase();
      });

      for (const p of players) {
        const px = centerX + (p.x - camera.x) * camera.zoom;
        const pz = centerY + (p.z - camera.z) * camera.zoom;

        if (px < -60 || px > w + 60 || pz < -60 || pz > h + 60) continue;

        // Lingkaran Radar Luar jika Online
        if (p.isOnline) {
          ctx.beginPath();
          ctx.arc(px, pz, 18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
          ctx.fill();
        }

        // Gambar Avatar Kepala Skin
        const avatarUrl = p.avatarUrl || 'https://mc-heads.net/avatar/' + encodeURIComponent(p.name) + '/32';
        const img = imageCache[avatarUrl];

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, pz, 12, 0, Math.PI * 2);
        ctx.clip();

        if (img && img.complete) {
          ctx.drawImage(img, px - 12, pz - 12, 24, 24);
        } else {
          ctx.fillStyle = '#2b2d31';
          ctx.fill();
        }
        ctx.restore();

        // Border Avatar
        ctx.beginPath();
        ctx.arc(px, pz, 12, 0, Math.PI * 2);
        ctx.strokeStyle = p.isOnline ? '#2ecc71' : '#95a5a6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Badge Nama Pemain di Bawah Marker
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(p.name).width;
        ctx.fillStyle = 'rgba(18, 20, 24, 0.88)';
        ctx.beginPath();
        ctx.roundRect(px - (textWidth / 2) - 6, pz + 16, textWidth + 12, 18, 5);
        ctx.fill();

        ctx.fillStyle = p.isOnline ? '#fff' : '#bdc3c7';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, px, pz + 29);
      }
    }

    // POPUP MODAL
    function showPopup(p) {
      selectedPlayer = p;
      const modal = document.getElementById('popup-modal');
      const avatar = p.avatarUrl || 'https://mc-heads.net/avatar/' + encodeURIComponent(p.name) + '/48';
      document.getElementById('popAvatar').src = avatar;
      document.getElementById('popName').innerText = p.name;

      const badge = document.getElementById('popBadge');
      if (p.isOnline) {
        badge.className = 'popup-badge online';
        badge.innerText = '🟢 Sedang Bermain';
      } else {
        badge.className = 'popup-badge offline';
        badge.innerText = '⚪ Offline (Data Terakhir)';
      }

      document.getElementById('popCoords').innerText = 'X: ' + Math.round(p.x) + ' | Y: ' + Math.round(p.y) + ' | Z: ' + Math.round(p.z);
      document.getElementById('popDim').innerText = (p.dimension || 'Overworld').toUpperCase();
      document.getElementById('popHealth').innerText = '❤️ ' + (p.health || 20) + ' / ' + (p.maxHealth || 20);

      modal.classList.add('show');
    }

    function closePopup() {
      document.getElementById('popup-modal').classList.remove('show');
      selectedPlayer = null;
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('hidden');
    }

    // EVENT MOUSE & TOUCH (PAN & ZOOM)
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      cameraStart = { x: camera.x, z: camera.z };
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        camera.x = cameraStart.x - (dx / camera.zoom);
        camera.z = cameraStart.z - (dy / camera.zoom);
        drawMap();
      }

      // Update Coordinate Tracker di Bawah
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = Math.round(camera.x + (mouseX - canvas.width / 2) / camera.zoom);
      const worldZ = Math.round(camera.z + (mouseY - canvas.height / 2) / camera.zoom);
      document.getElementById('lblX').innerText = worldX;
      document.getElementById('lblZ').innerText = worldZ;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      zoom(zoomFactor);
    }, { passive: false });

    // TOUCH SUPPORT (MOBILE)
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        cameraStart = { x: camera.x, z: camera.z };
      } else if (e.touches.length === 2) {
        isDragging = false;
        lastTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStart.x;
        const dy = e.touches[0].clientY - dragStart.y;
        camera.x = cameraStart.x - (dx / camera.zoom);
        camera.z = cameraStart.z - (dy / camera.zoom);
        drawMap();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDistance > 0) {
          const factor = dist / lastTouchDistance;
          zoom(factor);
        }
        lastTouchDistance = dist;
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      isDragging = false;
      lastTouchDistance = 0;
    });

    // KLIK PADA CANVAS UNTUK MEMILIH PEMAIN
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      let clicked = null;
      for (const p of (mapData.players || [])) {
        if ((p.dimension || 'overworld').toLowerCase() !== currentDimension.toLowerCase()) continue;
        const px = centerX + (p.x - camera.x) * camera.zoom;
        const pz = centerY + (p.z - camera.z) * camera.zoom;
        const dist = Math.hypot(mouseX - px, mouseY - pz);
        if (dist <= 22) {
          clicked = p;
          break;
        }
      }

      if (clicked) {
        showPopup(clicked);
      } else {
        closePopup();
      }
    });

    // INISIALISASI
    resizeCanvas();
    fetchData();
    setInterval(fetchData, 3500); // Polling otomatis tiap 3.5 detik
  </script>
</body>
</html>`;
}

module.exports = {
  renderWebMapPage
};
