import { world, system, EquipmentSlot } from "@minecraft/server";

console.warn("[Scripting] Discord Chat Bridge loaded successfully!");
console.info("[Scripting] Discord Chat Bridge loaded successfully!");

let chatSubscribed = false;

function broadcastChat(sender, message) {
  if (!sender || !message) return;
  // Format standar yang dikenali regex bot: [CHAT] <Nama> Pesan
  console.warn(`[CHAT] <${sender}> ${message}`);
  console.info(`[CHAT] <${sender}> ${message}`);
}

// 1. Coba afterEvents.chatSend
try {
  if (world?.afterEvents && typeof world.afterEvents.chatSend?.subscribe === "function") {
    world.afterEvents.chatSend.subscribe((event) => {
      try {
        const sender = event.sender?.name || "Player";
        const message = event.message || "";
        broadcastChat(sender, message);
      } catch (err) {
        console.warn(`[CHAT_ERROR] ${err.message}`);
      }
    });
    chatSubscribed = true;
    console.warn("[Scripting] Subscribed to afterEvents.chatSend");
  }
} catch (e) {
  console.warn(`[Scripting Error chatSend after] ${e.message}`);
}

// 2. Coba beforeEvents.chatSend jika afterEvents tidak tersedia
try {
  if (!chatSubscribed && world?.beforeEvents && typeof world.beforeEvents.chatSend?.subscribe === "function") {
    world.beforeEvents.chatSend.subscribe((event) => {
      try {
        const sender = event.sender?.name || "Player";
        const message = event.message || "";
        broadcastChat(sender, message);
      } catch (err) {
        console.warn(`[CHAT_ERROR] ${err.message}`);
      }
    });
    chatSubscribed = true;
    console.warn("[Scripting] Subscribed to beforeEvents.chatSend");
  }
} catch (e) {
  console.warn(`[Scripting Error chatSend before] ${e.message}`);
}

// 3. Berlangganan event pemain masuk / spawn pertama kali ke dunia game
try {
  if (world?.afterEvents && typeof world.afterEvents.playerSpawn?.subscribe === "function") {
    world.afterEvents.playerSpawn.subscribe((event) => {
      try {
        if (event.initialSpawn && event.player?.name) {
          console.warn(`[PLAYER_JOIN] ${event.player.name}`);
        }
      } catch (e) {}
    });
    console.warn("[Scripting] Subscribed to playerSpawn");
  }
} catch (e) {
  console.warn(`[Scripting Error playerSpawn] ${e.message}`);
}

// 4. Berlangganan event pemain keluar / disconnect dari game
try {
  if (world?.afterEvents && typeof world.afterEvents.playerLeave?.subscribe === "function") {
    world.afterEvents.playerLeave.subscribe((event) => {
      try {
        if (event.playerName) {
          console.warn(`[PLAYER_LEAVE] ${event.playerName}`);
        }
      } catch (e) {}
    });
    console.warn("[Scripting] Subscribed to playerLeave");
  }
} catch (e) {
  console.warn(`[Scripting Error playerLeave] ${e.message}`);
}

// Helper untuk mengambil seluruh data lokasi, vitalitas, dan isi inventory pemain
function getPlayerFullData(player) {
  const loc = player.location;
  const dim = player.dimension?.id ? player.dimension.id.replace(/^minecraft:/, "") : "overworld";

  // Status Darah (Health) & XP
  const healthComp = player.getComponent("health") || player.getComponent("minecraft:health");
  const health = healthComp ? Math.round(healthComp.currentValue) : null;
  const maxHealth = healthComp ? Math.round(healthComp.defaultValue) : null;
  const level = player.level || 0;

  // Armor & Offhand
  const armor = {};
  const equippable = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
  if (equippable) {
    const slots = [
      { key: "head", slot: EquipmentSlot?.Head || "Head" },
      { key: "chest", slot: EquipmentSlot?.Chest || "Chest" },
      { key: "legs", slot: EquipmentSlot?.Legs || "Legs" },
      { key: "feet", slot: EquipmentSlot?.Feet || "Feet" },
      { key: "offhand", slot: EquipmentSlot?.Offhand || "Offhand" }
    ];

    for (const s of slots) {
      try {
        const item = equippable.getEquipment(s.slot);
        if (item) {
          armor[s.key] = {
            id: item.typeId.replace(/^minecraft:/, ""),
            amount: item.amount || 1,
            name: item.nameTag || null
          };
        }
      } catch {}
    }
  }

  // Hotbar (Slot 0-8) & Storage (Slot 9-35)
  const hotbar = [];
  const storage = [];
  const invComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
  const container = invComp?.container;

  if (container) {
    for (let i = 0; i < container.size; i++) {
      try {
        const item = container.getItem(i);
        if (item) {
          const itemData = {
            slot: i,
            id: item.typeId.replace(/^minecraft:/, ""),
            amount: item.amount || 1,
            name: item.nameTag || null
          };
          if (i < 9) {
            hotbar.push(itemData);
          } else {
            storage.push(itemData);
          }
        }
      } catch {}
    }
  }

  return {
    name: player.name,
    x: Math.round(loc.x * 10) / 10,
    y: Math.round(loc.y * 10) / 10,
    z: Math.round(loc.z * 10) / 10,
    dimension: dim,
    health,
    maxHealth,
    level,
    armor,
    hotbar,
    storage,
    updatedAt: Date.now()
  };
}

// 5. Listener scriptEventReceive untuk inspeksi inventory & lokasi pemain (/inventory & /locate)
try {
  if (system?.afterEvents?.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      // Query Inventory
      if (event.id === "bot:inv") {
        const targetName = (event.message || "").trim();
        if (!targetName) return;

        const players = world.getPlayers();
        const player = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());

        if (!player) {
          console.warn(`[INV_RES] {"offline":true,"name":"${targetName}"}`);
          return;
        }

        try {
          const data = getPlayerFullData(player);
          console.warn(`[INV_RES] ${JSON.stringify(data)}`);
        } catch (err) {
          console.warn(`[INV_RES] {"error":"Gagal membaca inventory: ${err.message}"}`);
        }
      }

      // Query Lokasi / Koordinat
      if (event.id === "bot:locate") {
        const targetName = (event.message || "").trim();
        if (!targetName) return;

        const players = world.getPlayers();
        const player = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());

        if (!player) {
          console.warn(`[LOC_RES] {"offline":true,"name":"${targetName}"}`);
          return;
        }

        try {
          const data = getPlayerFullData(player);
          console.warn(`[LOC_RES] ${JSON.stringify(data)}`);
        } catch (err) {
          console.warn(`[LOC_RES] {"error":"Gagal membaca lokasi: ${err.message}"}`);
        }
      }
    });
    console.warn("[Scripting] Subscribed to scriptEventReceive (bot:inv & bot:locate)");
  }
} catch (e) {
  console.warn(`[Scripting Error scriptEventReceive] ${e.message}`);
}

// 5.5. Snapshot otomatis setiap 20 detik untuk semua pemain yang aktif (untuk cek data saat offline)
try {
  if (system?.runInterval) {
    system.runInterval(() => {
      try {
        const players = world.getPlayers();
        for (const p of players) {
          const data = getPlayerFullData(p);
          console.warn(`[PLAYER_SNAPSHOT] ${JSON.stringify(data)}`);
        }
      } catch {}
    }, 400); // 400 ticks = 20 detik
  }
} catch (e) {}

// 6. Listener entityDie untuk Death Feed (Notifikasi Kematian Pemain)
try {
  if (world?.afterEvents && typeof world.afterEvents.entityDie?.subscribe === "function") {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const deadEntity = event.deadEntity;
        if (!deadEntity) return;

        // Cek jika entitas yang mati adalah player
        if (deadEntity.typeId === "minecraft:player" || deadEntity.name) {
          const playerName = deadEntity.name || "Player";
          const damageSource = event.damageSource;
          const cause = damageSource?.cause || "unknown";

          let killerName = "";
          const killer = damageSource?.damagingEntity;
          if (killer) {
            killerName = killer.nameTag || killer.name || (killer.typeId ? killer.typeId.replace(/^minecraft:/, "") : "");
          }

          console.warn(`[DEATH] <${playerName}> cause:${cause} killer:${killerName}`);
        }
      } catch (err) {
        console.warn(`[Scripting Error entityDie] ${err.message}`);
      }
    });
    console.warn("[Scripting] Subscribed to entityDie (Death Feed)");
  }
} catch (e) {
  console.warn(`[Scripting Error entityDie subscribe] ${e.message}`);
}

