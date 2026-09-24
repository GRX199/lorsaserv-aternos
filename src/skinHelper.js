const fs = require('node:fs');
const path = require('node:path');

const SKINS_CACHE_FILE = path.join(__dirname, '..', 'data', 'skins.json');
let skinsCache = {};

function loadSkinsCache() {
  try {
    if (fs.existsSync(SKINS_CACHE_FILE)) {
      skinsCache = JSON.parse(fs.readFileSync(SKINS_CACHE_FILE, 'utf8'));
    }
  } catch {}
}

function saveSkinsCache() {
  try {
    const dir = path.dirname(SKINS_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SKINS_CACHE_FILE, JSON.stringify(skinsCache, null, 2), 'utf8');
  } catch {}
}

loadSkinsCache();

/**
 * Mengambil URL Avatar dan Body 3D pemain (Mendukung Bedrock via GeyserMC & Java)
 * @param {string} playerName - Gamertag / nama pemain
 * @returns {Promise<{ avatar: string, body: string }>}
 */
async function getSkinUrls(playerName) {
  if (!playerName) {
    return {
      avatar: 'https://mc-heads.net/avatar/steve/100',
      body: 'https://mc-heads.net/body/steve/right'
    };
  }

  const key = playerName.toLowerCase().trim();

  // 1. Cek cache lokal jika sudah pernah diambil
  if (skinsCache[key] && skinsCache[key].textureId) {
    const tid = skinsCache[key].textureId;
    return {
      avatar: `https://mc-heads.net/avatar/${tid}/100`,
      body: `https://mc-heads.net/body/${tid}/right`
    };
  }

  // 2. Coba ambil XUID Bedrock via GeyserMC Global API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const xuidRes = await fetch(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(playerName)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (xuidRes.ok) {
      const { xuid } = await xuidRes.json();
      if (xuid) {
        // Ambil data skin berdasarkan XUID
        const ctrl2 = new AbortController();
        const timeout2 = setTimeout(() => ctrl2.abort(), 3500);

        const skinRes = await fetch(`https://api.geysermc.org/v2/skin/${xuid}`, {
          signal: ctrl2.signal
        });
        clearTimeout(timeout2);

        if (skinRes.ok) {
          const skinData = await skinRes.json();
          if (skinData && skinData.texture_id) {
            skinsCache[key] = {
              textureId: skinData.texture_id,
              xuid,
              updatedAt: Date.now()
            };
            saveSkinsCache();

            return {
              avatar: `https://mc-heads.net/avatar/${skinData.texture_id}/100`,
              body: `https://mc-heads.net/body/${skinData.texture_id}/right`
            };
          }
        }
      }
    }
  } catch (err) {
    // Abaikan error jaringan/timeout dan gunakan fallback
  }

  // 3. Fallback standar ke nama (Mojang Java / Steve)
  return {
    avatar: `https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/100`,
    body: `https://mc-heads.net/body/${encodeURIComponent(playerName)}/right`
  };
}

module.exports = {
  getSkinUrls
};
