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
 * Memeriksa apakah host adalah loopback / local IP
 */
function isLocalOrPrivateHost(host) {
  if (!host || host === 'auto') return false;
  const h = host.toLowerCase().trim();
  return (
    h === '127.0.0.1' ||
    h === 'localhost' ||
    h === '::1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.16.')
  );
}

/**
 * Ping langsung server Minecraft Bedrock menggunakan RakNet UDP Unconnected Ping (0x01)
 */
function pingBedrockUDP(host, port = 19132, timeoutMs = 2500) {
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
              max: parseInt(parts[5] || '10', 10) || 10,
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
 * Ping server melalui API publik mcstatus.io (Hanya untuk server publik internet, bukan 127.0.0.1)
 */
async function pingViaApi(host, port, type = 'bedrock', timeoutMs = 4000) {
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

  // Jika mcstatus.io mengembalikan demo server palsu (misal 144.172.67.4), anggap offline!
  if (data.ip_address === '144.172.67.4' || data.motd?.clean?.includes('A Bedrock server\nYou cannot connect!')) {
    return {
      online: false,
      source: 'mcstatus-api-mock',
      host,
      port,
      type,
      motd: 'Offline',
      version: 'N/A',
      players: { online: 0, max: 10, list: [] }
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
 * Ping server melalui API publik mcsrvstat.us sebagai fallback kedua
 */
async function pingViaMcsrvstat(host, port, type = 'bedrock', timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const endpointType = type.toLowerCase() === 'java' ? '3' : 'bedrock/3';
  const url = `https://api.mcsrvstat.us/${endpointType}/${encodeURIComponent(host)}:${port}`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MinecraftDiscordBot/2.0 (Mozilla/5.0)' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.online) return null;

    const motdClean = Array.isArray(data.motd?.clean)
      ? data.motd.clean.join(' ')
      : (data.motd?.clean || '');

    return {
      online: true,
      source: 'mcsrvstat-api',
      latencyMs: null,
      host,
      port,
      type,
      edition: type === 'java' ? 'Java' : 'Bedrock',
      motd: cleanMinecraftFormatting(motdClean) || 'Minecraft Server',
      version: data.version || (type === 'java' ? 'Java' : 'Bedrock'),
      players: {
        online: data.players?.online || 0,
        max: data.players?.max || 20,
        list: (data.players?.list || []).map(p => typeof p === 'string' ? p : p.name)
      },
      gamemode: 'Survival'
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Fungsi utama untuk mengecek status server Minecraft (Bedrock / Java)
 * Mendukung primary host, fallback host (IP Publik), dan fallback API publik
 */
async function checkServerStatus(host, port = 19132, type = 'bedrock', fallbackHost = null) {
  const isBedrock = type.toLowerCase() === 'bedrock';
  const defaultPublicIp = '129.226.95.58';

  // Selesaikan IP jika 'auto' atau falsy
  let primaryHost = host;
  if (!primaryHost || primaryHost === 'auto') {
    primaryHost = fallbackHost && fallbackHost !== 'auto' ? fallbackHost : defaultPublicIp;
  }

  let secondaryHost = fallbackHost;
  if (!secondaryHost || secondaryHost === 'auto' || secondaryHost === primaryHost) {
    if (!isLocalOrPrivateHost(primaryHost) && primaryHost !== defaultPublicIp) {
      secondaryHost = defaultPublicIp;
    } else if (primaryHost !== defaultPublicIp) {
      secondaryHost = defaultPublicIp;
    } else {
      secondaryHost = null;
    }
  }

  // 1. Coba RakNet UDP langsung ke primaryHost
  if (isBedrock && primaryHost) {
    try {
      const udpResult = await pingBedrockUDP(primaryHost, port, 2500);
      if (udpResult && udpResult.online) {
        return udpResult;
      }
    } catch (udpErr) {
      // Primary host UDP gagal / timeout
    }
  }

  // 1b. Coba RakNet UDP langsung ke secondaryHost (misal IP Publik jika primaryHost adalah 127.0.0.1)
  if (isBedrock && secondaryHost && secondaryHost !== primaryHost) {
    try {
      const udpResult2 = await pingBedrockUDP(secondaryHost, port, 2500);
      if (udpResult2 && udpResult2.online) {
        return udpResult2;
      }
    } catch (udpErr2) {
      // Secondary host UDP gagal
    }
  }

  // 2. Fallback ke API publik (mcstatus.io & mcsrvstat.us)
  // Tentukan host publik yang sah untuk di-query dari internet
  const publicApiHost = (!isLocalOrPrivateHost(primaryHost) && primaryHost !== '127.0.0.1')
    ? primaryHost
    : (secondaryHost && !isLocalOrPrivateHost(secondaryHost) ? secondaryHost : defaultPublicIp);

  if (publicApiHost) {
    // 2a. Coba mcstatus.io API
    try {
      const apiResult = await pingViaApi(publicApiHost, port, type, 4000);
      if (apiResult && apiResult.online) {
        return apiResult;
      }
    } catch (apiErr) {}

    // 2b. Fallback ke mcsrvstat.us API
    try {
      const srvStatResult = await pingViaMcsrvstat(publicApiHost, port, type, 4000);
      if (srvStatResult && srvStatResult.online) {
        return srvStatResult;
      }
    } catch (srvErr) {}

    // 2c. Cek Java/Geyser jika type Bedrock tidak merespon
    if (isBedrock) {
      try {
        const javaResult = await pingViaApi(publicApiHost, port, 'java', 3000);
        if (javaResult && javaResult.online) {
          return javaResult;
        }
      } catch {}
      try {
        const javaSrv = await pingViaMcsrvstat(publicApiHost, port, 'java', 3000);
        if (javaSrv && javaSrv.online) {
          return javaSrv;
        }
      } catch {}
    }
  }

  return {
    online: false,
    source: 'none',
    host: primaryHost || host,
    port,
    type,
    motd: 'Server Offline',
    version: 'N/A',
    players: { online: 0, max: 20, list: [] }
  };
}

module.exports = {
  checkServerStatus,
  pingBedrockUDP,
  pingViaApi,
  cleanMinecraftFormatting,
  isLocalOrPrivateHost
};
