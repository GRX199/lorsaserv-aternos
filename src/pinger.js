const dgram = require('node:dgram');

const RAKNET_MAGIC = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');

/**
 * Menghapus format kode warna Minecraft (§a, §l, dll)
 */
function cleanMinecraftFormatting(text) {
  if (!text) return '';
  return text.replace(/§[0-9a-fk-or]/gi, '').trim();
}

/**
 * Ping langsung server Minecraft Bedrock menggunakan RakNet UDP Unconnected Ping (0x01)
 */
function pingBedrockUDP(host, port = 19132, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let isSettled = false;
    const startTime = Date.now();

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { socket.close(); } catch {}
        reject(new Error(`UDP ping timeout ke ${host}:${port}`));
      }
    }, timeoutMs);

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        try { socket.close(); } catch {}
        reject(err);
      }
    });

    socket.on('message', (msg) => {
      if (isSettled) return;
      if (msg.length < 35) return;

      const packetId = msg.readUInt8(0);
      if (packetId === 0x1c) {
        // 0x1c = Unconnected Pong
        isSettled = true;
        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;
        try { socket.close(); } catch {}

        try {
          const strLen = msg.readUInt16BE(33);
          const dataStr = msg.subarray(35, 35 + strLen).toString('utf8');
          const parts = dataStr.split(';');

          resolve({
            online: true,
            source: 'raknet-udp',
            latencyMs,
            host,
            port,
            type: 'bedrock',
            edition: parts[0] || 'Bedrock',
            motd: cleanMinecraftFormatting(parts[1]) || 'Minecraft Bedrock Server',
            protocol: parts[2] || '',
            version: parts[3] ? `Bedrock ${parts[3]}` : 'Bedrock',
            players: {
              online: parseInt(parts[4] || '0', 10) || 0,
              max: parseInt(parts[5] || '0', 10) || 20,
              list: []
            },
            serverGuid: parts[6] || '',
            subMotd: cleanMinecraftFormatting(parts[7]) || '',
            gamemode: parts[8] || 'Survival'
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });

    // RakNet Unconnected Ping packet (33 bytes)
    const packet = Buffer.alloc(33);
    packet.writeUInt8(0x01, 0); // Packet ID
    packet.writeBigInt64BE(BigInt(Date.now()), 1); // Timestamp
    RAKNET_MAGIC.copy(packet, 9); // Magic 16 bytes
    packet.writeBigInt64BE(BigInt(Math.floor(Math.random() * 1000000000)), 25); // Client GUID

    socket.send(packet, port, host, (sendErr) => {
      if (sendErr && !isSettled) {
        isSettled = true;
        clearTimeout(timer);
        try { socket.close(); } catch {}
        reject(sendErr);
      }
    });
  });
}

/**
 * Ping server melalui API publik mcstatus.io (Fallback jika UDP diblokir ISP/Host)
 */
async function pingViaApi(host, port, type = 'bedrock', timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const endpointType = type.toLowerCase() === 'java' ? 'java' : 'bedrock';
  const url = `https://api.mcstatus.io/v2/status/${endpointType}/${encodeURIComponent(host)}:${port}`;

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`mcstatus API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.online) {
    return {
      online: false,
      source: 'mcstatus-api',
      host,
      port,
      type,
      motd: 'Offline',
      version: 'N/A',
      players: { online: 0, max: 20, list: [] }
    };
  }

  return {
    online: true,
    source: 'mcstatus-api',
    latencyMs: null,
    host,
    port,
    type,
    edition: data.edition || (type === 'java' ? 'Java' : 'Bedrock'),
    motd: cleanMinecraftFormatting(data.motd?.clean || data.motd?.raw) || 'Minecraft Server',
    version: data.version?.name || (type === 'java' ? 'Java' : 'Bedrock'),
    players: {
      online: data.players?.online || 0,
      max: data.players?.max || 20,
      list: (data.players?.list || []).map(p => p.name_clean || p.name_raw)
    },
    gamemode: data.gamemode || 'Survival'
  };
}

/**
 * Fungsi utama untuk mengecek status server Minecraft (Bedrock / Java)
 * Menggunakan RakNet UDP terlebih dahulu untuk Bedrock, dan otomatis beralih ke API jika gagal.
 */
async function checkServerStatus(host, port = 19132, type = 'bedrock') {
  const isBedrock = type.toLowerCase() === 'bedrock';

  // 1. Coba RakNet UDP langsung jika Bedrock
  if (isBedrock) {
    try {
      const udpResult = await pingBedrockUDP(host, port, 3000);
      return udpResult;
    } catch (udpErr) {
      // Jika UDP gagal atau timed out (misal ISP blok UDP atau di hosting cloud seperti Render), lanjut ke API
    }
  }

  // 2. Fallback ke mcstatus.io REST API (Bekerja sempurna di hosting cloud seperti Render)
  try {
    const apiResult = await pingViaApi(host, port, type, 5000);
    return apiResult;
  } catch (apiErr) {
    // Keduanya gagal atau server benar-benar offline
    return {
      online: false,
      source: 'none',
      host,
      port,
      type,
      motd: 'Server Offline',
      version: 'N/A',
      players: { online: 0, max: 20, list: [] }
    };
  }
}

module.exports = {
  checkServerStatus,
  pingBedrockUDP,
  pingViaApi,
  cleanMinecraftFormatting
};
