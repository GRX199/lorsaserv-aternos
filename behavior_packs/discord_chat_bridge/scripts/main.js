import * as mc from "@minecraft/server";
const world = mc.world;
const system = mc.system;
const EquipmentSlot = mc.EquipmentSlot || {};

console.warn("[Scripting] Discord Chat Bridge loaded successfully!");
console.info("[Scripting] Discord Chat Bridge loaded successfully!");

let chatSubscribed = false;

function broadcastChat(sender, message) {
  if (!sender || !message) return;
  // Format standar yang dikenali regex bot: [CHAT] <Nama> Pesan
  console.warn(`[CHAT] <${sender}> ${message}`);
  console.info(`[CHAT] <${sender}> ${message}`);
}

// Helper Warp & Dynamic Properties
function getAllWarpsDynamic() {
  try {
    const raw = world.getDynamicProperty("all_warps");
    if (raw && typeof raw === "string") {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    ironfarm: { name: "ironfarm", x: -351, y: 11, z: -1111, dimension: "overworld", by: "System" }
  };
}

function saveAllWarpsDynamic(warps) {
  try {
    world.setDynamicProperty("all_warps", JSON.stringify(warps));
  } catch (err) {
    console.warn(`[Scripting Error saveAllWarps] ${err.message}`);
  }
}

// Cek hak akses: hanya OP atau pemain dengan tag 'admin' / 'op'
function isPlayerAdmin(player) {
  if (!player) return false;
  try {
    if (typeof player.isOp === "function" && player.isOp()) return true;
    if (typeof player.hasTag === "function" && (player.hasTag("admin") || player.hasTag("op"))) return true;
  } catch {}
  return false;
}

// Handler Perintah Admin Chat In-Game (!setwarp, !warp, !delwarp, !warplist, !tp, !tpto, !tphere)
function handleAdminChatCommand(sender, rawMessage) {
  if (!sender) return false;
  const message = (rawMessage || "").trim();
  if (!message.startsWith("!")) return false;

  // Verifikasi Izin: Jika bukan Admin/OP, tolak mentah-mentah
  if (!isPlayerAdmin(sender)) {
    sender.sendMessage("§c§l[DITOLAK] §r§cPerintah warp/teleport ini khusus untuk OP atau Admin server!");
    try { sender.runCommandAsync("playsound note.bass @s"); } catch {}
    return true;
  }

  const parts = message.slice(1).trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg1 = parts[1];
  const arg2 = parts[2];
  const arg3 = parts[3];

  const warps = getAllWarpsDynamic();

  // 1. !setwarp <nama>
  if (cmd === "setwarp") {
    if (!arg1) {
      sender.sendMessage("§e[WARP] Format: §f!setwarp <nama_warp> §e(contoh: §f!setwarp base§e)");
      return true;
    }
    const name = arg1.toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    const loc = sender.location;
    const dim = sender.dimension?.id ? sender.dimension.id.replace(/^minecraft:/, "") : "overworld";
    const x = Math.round(loc.x);
    const y = Math.round(loc.y);
    const z = Math.round(loc.z);

    warps[name] = { name, x, y, z, dimension: dim, by: sender.name };
    saveAllWarpsDynamic(warps);

    sender.sendMessage(`§a§l[WARP] §r§aTitik warp '§e${name}§a' berhasil disimpan di §fX:${x} Y:${y} Z:${z}§a!`);
    try { sender.runCommandAsync("playsound random.levelup @s"); } catch {}
    console.warn(`[WARP_SET] ${JSON.stringify({ name, x, y, z, dimension: dim, by: sender.name })}`);
    return true;
  }

  // 2. !warp <nama> [target_pemain]
  if (cmd === "warp") {
    if (!arg1) {
      const list = Object.values(warps);
      if (list.length === 0) {
        sender.sendMessage("§e[WARP] Belum ada titik warp. Buat dengan: §f!setwarp <nama>");
        return true;
      }
      sender.sendMessage("§d§l[DAFTAR WARP SERVER]§r");
      for (const w of list) {
        sender.sendMessage(`• §e${w.name} §7(X:${w.x} Y:${w.y} Z:${w.z} [${w.dimension}])`);
      }
      sender.sendMessage("§7Ketik: §f!warp <nama> §7untuk teleport.");
      return true;
    }

    const name = arg1.toLowerCase();
    const warp = warps[name];
    if (!warp) {
      sender.sendMessage(`§c§l[WARP] §r§cTitik warp '§e${name}§c' tidak ditemukan! Ketik §f!warplist §cuntuk melihat daftar.`);
      try { sender.runCommandAsync("playsound note.bass @s"); } catch {}
      return true;
    }

    let target = sender;
    if (arg2) {
      const players = world.getPlayers();
      const found = players.find(p => p.name.toLowerCase() === arg2.toLowerCase());
      if (found) {
        target = found;
      } else {
        sender.sendMessage(`§c[WARP] Pemain target '${arg2}' tidak ditemukan / offline.`);
        return true;
      }
    }

    try {
      const dim = world.getDimension(warp.dimension || "overworld");
      target.teleport({ x: warp.x, y: warp.y, z: warp.z }, { dimension: dim });
      target.runCommandAsync("playsound mob.endermen.portal @s");
      target.sendMessage(`§b§l[WARP] §r§eTeleportasi ke titik '§a${warp.name}§e' (X:${warp.x} Y:${warp.y} Z:${warp.z}) berhasil!`);
      if (target !== sender) {
        sender.sendMessage(`§a[WARP] Berhasil teleportasi ${target.name} ke titik '${warp.name}'.`);
      }
    } catch (err) {
      sender.sendMessage(`§c[WARP ERROR] Gagal teleport: ${err.message}`);
    }
    return true;
  }

  // 3. !delwarp <nama>
  if (cmd === "delwarp" || cmd === "deletewarp" || cmd === "rmwarp") {
    if (!arg1) {
      sender.sendMessage("§e[WARP] Format: §f!delwarp <nama_warp>");
      return true;
    }
    const name = arg1.toLowerCase();
    if (warps[name]) {
      delete warps[name];
      saveAllWarpsDynamic(warps);
      sender.sendMessage(`§e§l[WARP] §r§eTitik warp '§c${name}§e' telah dihapus.`);
      try { sender.runCommandAsync("playsound random.toast @s"); } catch {}
      console.warn(`[WARP_DEL] ${JSON.stringify({ name, by: sender.name })}`);
    } else {
      sender.sendMessage(`§c[WARP] Titik warp '${name}' tidak ditemukan.`);
    }
    return true;
  }

  // 4. !warplist / !warps
  if (cmd === "warplist" || cmd === "warps") {
    const list = Object.values(warps);
    if (list.length === 0) {
      sender.sendMessage("§e[WARP] Belum ada titik warp yang tersimpan.");
      return true;
    }
    sender.sendMessage(`§d§l[DAFTAR WARP SERVER (${list.length})]§r`);
    for (const w of list) {
      sender.sendMessage(`• §e${w.name} §7-> §fX:${w.x} Y:${w.y} Z:${w.z} §7(${w.dimension})`);
    }
    return true;
  }

  // 5. !tpto <target>
  if (cmd === "tpto") {
    if (!arg1) {
      sender.sendMessage("§eFormat: §f!tpto <nama_pemain_tujuan>");
      return true;
    }
    const found = world.getPlayers().find(p => p.name.toLowerCase() === arg1.toLowerCase());
    if (found) {
      sender.teleport(found.location, { dimension: found.dimension });
      sender.runCommandAsync("playsound mob.endermen.portal @s");
      sender.sendMessage(`§b§l[TELEPORT] §r§eTeleport ke §a${found.name} §eberhasil!`);
    } else {
      sender.sendMessage(`§c[TP] Pemain '${arg1}' tidak ditemukan.`);
    }
    return true;
  }

  // 6. !tphere <target>
  if (cmd === "tphere") {
    if (!arg1) {
      sender.sendMessage("§eFormat: §f!tphere <nama_pemain>");
      return true;
    }
    const found = world.getPlayers().find(p => p.name.toLowerCase() === arg1.toLowerCase());
    if (found) {
      found.teleport(sender.location, { dimension: sender.dimension });
      found.runCommandAsync("playsound mob.endermen.portal @s");
      found.sendMessage(`§b§l[TELEPORT] §r§eAnda ditarik oleh Admin §f${sender.name}§e!`);
      sender.sendMessage(`§a[TP] Berhasil menarik §f${found.name} §eke posisi Anda.`);
    } else {
      sender.sendMessage(`§c[TP] Pemain '${arg1}' tidak ditemukan.`);
    }
    return true;
  }

  // 7. !tp <pemain> <target_atau_coords>
  if (cmd === "tp") {
    if (arg1 && arg2 && !arg3) {
      const p1 = world.getPlayers().find(p => p.name.toLowerCase() === arg1.toLowerCase());
      const p2 = world.getPlayers().find(p => p.name.toLowerCase() === arg2.toLowerCase());
      if (p1 && p2) {
        p1.teleport(p2.location, { dimension: p2.dimension });
        p1.runCommandAsync("playsound mob.endermen.portal @s");
        sender.sendMessage(`§a[TP] Berhasil teleportasi §f${p1.name} §eke §f${p2.name}§a.`);
      } else {
        sender.sendMessage(`§c[TP] Salah satu pemain tidak ditemukan.`);
      }
      return true;
    } else if (arg1 && arg2 && arg3) {
      const posX = parseInt(arg1, 10);
      const posY = parseInt(arg2, 10);
      const posZ = parseInt(arg3, 10);
      if (!isNaN(posX) && !isNaN(posY) && !isNaN(posZ)) {
        sender.teleport({ x: posX, y: posY, z: posZ });
        sender.runCommandAsync("playsound mob.endermen.portal @s");
        sender.sendMessage(`§b§l[TELEPORT] §r§eTeleport ke §fX:${posX} Y:${posY} Z:${posZ} §eberhasil!`);
        return true;
      }
    }
    sender.sendMessage("§eFormat: §f!tp <player1> <player2> §eatau §f!tp <x> <y> <z>");
    return true;
  }

  // 8. !warphelp
  if (cmd === "warphelp") {
    sender.sendMessage("§6§l[BANTUAN WARP & TP ADMIN]§r\n" +
      "§e!setwarp <nama> §7- Simpan titik warp posisi saat ini\n" +
      "§e!warp <nama> §7- Teleport ke titik warp\n" +
      "§e!warp <nama> <player> §7- Teleport pemain ke warp\n" +
      "§e!delwarp <nama> §7- Hapus titik warp\n" +
      "§e!warplist §7- Lihat daftar semua titik warp\n" +
      "§e!tpto <player> §7- Teleport diri sendiri ke pemain\n" +
      "§e!tphere <player> §7- Tarik pemain ke posisi Anda\n" +
      "§e!tp <p1> <p2> §7- Teleport pemain 1 ke pemain 2");
    return true;
  }

  return false;
}

// 1. Coba beforeEvents.chatSend (bisa membatalkan pesan command agar tidak bocor ke chat)
try {
  if (world?.beforeEvents && typeof world.beforeEvents.chatSend?.subscribe === "function") {
    world.beforeEvents.chatSend.subscribe((event) => {
      try {
        const sender = event.sender;
        const message = (event.message || "").trim();

        if (message.startsWith("!")) {
          event.cancel = true; // Sembunyikan command admin dari publik
          handleAdminChatCommand(sender, message);
          return;
        }

        broadcastChat(sender?.name || "Player", message);
      } catch (err) {
        console.warn(`[CHAT_ERROR] ${err.message}`);
      }
    });
    chatSubscribed = true;
    console.warn("[Scripting] Subscribed to beforeEvents.chatSend (Admin Commands Active)");
  }
} catch (e) {
  console.warn(`[Scripting Error chatSend before] ${e.message}`);
}

// 2. Fallback afterEvents.chatSend jika beforeEvents tidak tersedia
try {
  if (!chatSubscribed && world?.afterEvents && typeof world.afterEvents.chatSend?.subscribe === "function") {
    world.afterEvents.chatSend.subscribe((event) => {
      try {
        const sender = event.sender;
        const message = (event.message || "").trim();

        if (message.startsWith("!")) {
          handleAdminChatCommand(sender, message);
          return;
        }

        broadcastChat(sender?.name || "Player", message);
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

      // Sinkronisasi Set Warp dari Bot Discord
      if (event.id === "bot:setwarp") {
        try {
          const data = JSON.parse(event.message || "{}");
          if (data.name) {
            const warps = getAllWarpsDynamic();
            warps[data.name] = data;
            saveAllWarpsDynamic(warps);
            console.warn(`[WARP_SYNC] Berhasil sinkronisasi warp '${data.name}' dari bot Discord.`);
          }
        } catch (err) {
          console.warn(`[Scripting Error bot:setwarp] ${err.message}`);
        }
      }

      // Sinkronisasi Hapus Warp dari Bot Discord
      if (event.id === "bot:delwarp") {
        try {
          const name = (event.message || "").trim().toLowerCase();
          if (name) {
            const warps = getAllWarpsDynamic();
            if (warps[name]) {
              delete warps[name];
              saveAllWarpsDynamic(warps);
              console.warn(`[WARP_SYNC] Berhasil hapus warp '${name}' via sinkronisasi bot Discord.`);
            }
          }
        } catch (err) {
          console.warn(`[Scripting Error bot:delwarp] ${err.message}`);
        }
      }
    });
    console.warn("[Scripting] Subscribed to scriptEventReceive (bot:inv, bot:locate, bot:setwarp, bot:delwarp)");
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

