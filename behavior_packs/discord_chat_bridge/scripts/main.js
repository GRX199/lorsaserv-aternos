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

// Helper daftar admin yang tersimpan di Dynamic Properties
function getAdminPlayers() {
  try {
    const raw = world.getDynamicProperty("admin_players");
    if (raw && typeof raw === "string") {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
}

function addAdminPlayer(name) {
  if (!name) return;
  try {
    const list = getAdminPlayers();
    const cleanName = name.trim();
    if (!list.some(n => n.toLowerCase() === cleanName.toLowerCase())) {
      list.push(cleanName);
      world.setDynamicProperty("admin_players", JSON.stringify(list));
    }
    for (const p of world.getPlayers()) {
      if (p.name.toLowerCase() === cleanName.toLowerCase()) {
        try { p.addTag("admin"); p.addTag("op"); } catch {}
      }
    }
    console.warn(`[ADMIN_SYNC] Berhasil menambahkan ${cleanName} ke daftar Admin.`);
  } catch (err) {
    console.warn(`[Scripting Error addAdminPlayer] ${err.message}`);
  }
}

function removeAdminPlayer(name) {
  if (!name) return;
  try {
    let list = getAdminPlayers();
    const cleanName = name.trim().toLowerCase();
    list = list.filter(n => n.toLowerCase() !== cleanName);
    world.setDynamicProperty("admin_players", JSON.stringify(list));
    for (const p of world.getPlayers()) {
      if (p.name.toLowerCase() === cleanName) {
        try { p.removeTag("admin"); p.removeTag("op"); } catch {}
      }
    }
    console.warn(`[ADMIN_SYNC] Berhasil menghapus ${cleanName} dari daftar Admin.`);
  } catch (err) {
    console.warn(`[Scripting Error removeAdminPlayer] ${err.message}`);
  }
}

// Cek hak akses secara sinkron (cek tag atau daftar admin)
function isPlayerAdmin(player) {
  if (!player) return false;
  try {
    if (typeof player.isValid === "function" && !player.isValid()) return false;
  } catch {}

  // 1. Tag entity Minecraft
  try {
    if (player.hasTag("admin") || player.hasTag("op")) return true;
  } catch {}

  // 2. Daftar admin tersimpan
  try {
    const list = getAdminPlayers();
    const pName = (player.name || "").toLowerCase();
    if (list.some(n => n.toLowerCase() === pName)) return true;
  } catch {}

  return false;
}

// Cek hak akses secara asinkron dengan verifikasi query command jika belum bertag
async function isPlayerAdminAsync(player) {
  if (!player) return false;
  if (isPlayerAdmin(player)) return true;

  // 3. Verifikasi hak Operator in-game secara nyata via command query (tanpa efek samping)
  // Perintah 'gamerule showcoordinates' hanya diizinkan untuk Operator di Bedrock Dedicated Server!
  try {
    await player.runCommandAsync("gamerule showcoordinates");
    // Jika sukses tanpa error, pemain 100% adalah Operator di BDS!
    try {
      player.addTag("admin");
      player.addTag("op");
    } catch {}
    return true;
  } catch (permErr) {
    // Member biasa (bukan OP) akan melempar error izin
    return false;
  }
}

// Pelacak posisi pemain berkala & catatan riwayat titik kematian
const lastPlayerPositions = new Map();
const lastDeathPositions = new Map();

// Handler Perintah Chat In-Game (!deathpos, !nametag, !setwarp, !warp, !delwarp, !warplist, !tp, !tpto, !tphere)
async function handleAdminChatCommand(sender, rawMessage) {
  if (!sender) return false;
  const message = (rawMessage || "").trim();
  if (!message.startsWith("!")) return false;

  const parts = message.slice(1).trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg1 = parts[1];
  const arg2 = parts[2];
  const arg3 = parts[3];

  // Perintah Publik: !deathpos / !lastdeath / !titikmati (Bisa digunakan oleh semua member)
  if (cmd === "deathpos" || cmd === "lastdeath" || cmd === "titikmati") {
    let targetName = sender.name;
    const isAdmin = await isPlayerAdminAsync(sender);
    if (arg1 && isAdmin) {
      targetName = arg1;
    }
    const death = lastDeathPositions.get(targetName.toLowerCase());
    if (death) {
      const dimLabel = death.dim === "nether" ? "The Nether" : death.dim === "the_end" ? "The End" : "Overworld";
      sender.sendMessage(`§c§l[TITIK KEMATIAN] §r§ePemain §f${targetName} §egugur di: §aX:${death.x} Y:${death.y} Z:${death.z} §7(${dimLabel})`);
      if (isAdmin) {
        sender.sendMessage(`§7Ketik: §f!tp ${death.x} ${death.y} ${death.z} §7untuk teleportasi ke sana.`);
      }
    } else {
      sender.sendMessage(`§e[TITIK KEMATIAN] Belum ada catatan titik kematian untuk '§f${targetName}§e'.`);
    }
    return true;
  }

  // Info Nametag: !nametag tanpa argumen bisa dicek oleh semua pemain
  if ((cmd === "nametag" || cmd === "nametagdarah") && !arg1) {
    const status = isNametagEnabled() ? "§aAktif" : "§cNonaktif";
    sender.sendMessage(`§e[NAMETAG] Status Floating NameTag Darah: ${status}`);
    const isAdmin = await isPlayerAdminAsync(sender);
    if (isAdmin) {
      sender.sendMessage("§7Gunakan: §f!nametag on §7atau §f!nametag off §7untuk mengubah.");
    }
    return true;
  }

  // Verifikasi Izin Operator / Admin
  const isAdmin = await isPlayerAdminAsync(sender);
  if (!isAdmin) {
    sender.sendMessage("§c§l[DITOLAK] §r§cPerintah ini khusus untuk OP atau Admin server!");
    try { sender.runCommandAsync("playsound note.bass @s"); } catch {}
    return true;
  }

  // === DARI SINI SEMUA PERINTAH KHUSUS OP / ADMIN ===

  // 1. !nametag [on|off]
  if (cmd === "nametag" || cmd === "nametagdarah") {
    if (arg1 === "off" || arg1 === "mati" || arg1 === "disable") {
      disableAllNametags();
      sender.sendMessage("§e[NAMETAG] Floating NameTag darah (Pemain & Mob) dinonaktifkan.");
    } else {
      enableAllNametags();
      sender.sendMessage("§a[NAMETAG] Floating NameTag darah (Pemain & Mob) diaktifkan.");
    }
    return true;
  }

  // 2. !admin / !op
  if (cmd === "admin" || cmd === "op") {
    if (arg1 === "add" && arg2) {
      const target = arg2.trim();
      addAdminPlayer(target);
      sender.sendMessage(`§a[ADMIN] Pemain §e${target} §aberhasil ditambahkan ke daftar Admin.`);
      return true;
    } else if ((arg1 === "del" || arg1 === "remove") && arg2) {
      const target = arg2.trim();
      removeAdminPlayer(target);
      sender.sendMessage(`§e[ADMIN] Pemain §f${target} §edihapus dari daftar Admin.`);
      return true;
    } else if (arg1 === "list") {
      const list = getAdminPlayers();
      sender.sendMessage(`§b[ADMIN LIST] §f${list.join(", ") || "(Hanya Operator Server)"}`);
      return true;
    }
  }

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
    sender.sendMessage("§6§l[BANTUAN COMMAND & WARP SERVER]§r\n" +
      "§e!deathpos §7- Cek koordinat titik kematian terakhir Anda\n" +
      "§e!deathpos <player> §7- Cek titik kematian pemain lain (Admin)\n" +
      "§e!setwarp <nama> §7- Simpan titik warp posisi saat ini\n" +
      "§e!warp <nama> §7- Teleport ke titik warp\n" +
      "§e!warp <nama> <player> §7- Teleport pemain ke warp\n" +
      "§e!delwarp <nama> §7- Hapus titik warp\n" +
      "§e!warplist §7- Lihat daftar semua titik warp\n" +
      "§e!tpto <player> §7- Teleport diri sendiri ke pemain\n" +
      "§e!tphere <player> §7- Tarik pemain ke posisi Anda\n" +
      "§e!tp <p1> <p2> §7- Teleport pemain 1 ke pemain 2\n" +
      "§e!tp <x> <y> <z> §7- Teleportasi ke koordinat");
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
          system.run(() => {
            handleAdminChatCommand(sender, message).catch(err => {
              console.warn(`[Command Error] ${err.message}`);
            });
          });
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
          system.run(() => {
            handleAdminChatCommand(sender, message).catch(err => {
              console.warn(`[Command Error] ${err.message}`);
            });
          });
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
        if (event.player) {
          system.run(async () => {
            try {
              await isPlayerAdminAsync(event.player);
            } catch {}
          });
        }
      } catch (e) {}
    });
    console.warn("[Scripting] Subscribed to playerSpawn (Auto OP Detection Active)");
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

// Helper untuk mengekstrak informasi item beserta Enchantment & Durability
function serializeItemWithDetails(item, slot = null) {
  if (!item) return null;
  const id = item.typeId.replace(/^minecraft:/, "");
  const amount = item.amount || 1;
  const name = item.nameTag || null;
  const enchants = [];
  let durability = null;

  // 1. Ekstrak Enchantment
  try {
    const enchComp = item.getComponent("minecraft:enchantable") || item.getComponent("enchantable");
    if (enchComp && typeof enchComp.getEnchantments === "function") {
      const list = enchComp.getEnchantments();
      if (Array.isArray(list)) {
        for (const e of list) {
          if (!e) continue;
          const typeId = (e.type?.id || e.type || "").replace(/^minecraft:/, "");
          const level = typeof e.level === "number" ? e.level : 1;
          if (typeId) {
            enchants.push({ id: typeId, level });
          }
        }
      }
    }
  } catch (err) {}

  // 2. Ekstrak Durability
  try {
    const durComp = item.getComponent("minecraft:durability") || item.getComponent("durability");
    if (durComp && typeof durComp.maxDurability === "number") {
      durability = {
        damage: durComp.damage || 0,
        max: durComp.maxDurability,
        remaining: Math.max(0, durComp.maxDurability - (durComp.damage || 0))
      };
    }
  } catch (err) {}

  const res = { id, amount, name };
  if (slot !== null) res.slot = slot;
  if (enchants.length > 0) res.enchants = enchants;
  if (durability) res.durability = durability;
  return res;
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
          armor[s.key] = serializeItemWithDetails(item);
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
          const itemData = serializeItemWithDetails(item, i);
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

// Handler perintah konsol/scriptevent langsung (misal: scriptevent bot:cmd !warp base Steve)
function handleAdminConsoleCommand(rawMessage) {
  const message = (rawMessage || "").trim();
  const clean = message.startsWith("!") ? message.slice(1).trim() : message;
  const parts = clean.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg1 = parts[1];
  const arg2 = parts[2];
  const arg3 = parts[3];

  console.warn(`[CONSOLE_CMD] Menjalankan perintah konsol: ${clean}`);

  // 1. Nametag kontrol via konsol
  if (cmd === "nametag" || cmd === "nametagdarah") {
    if (arg1 === "off" || arg1 === "mati" || arg1 === "disable") {
      disableAllNametags();
      console.warn("[NAMETAG] Floating NameTag dinonaktifkan via konsol.");
    } else {
      enableAllNametags();
      console.warn("[NAMETAG] Floating NameTag diaktifkan via konsol.");
    }
    return;
  }

  // 2. Warp via konsol: warp <nama> [target_pemain]
  const warps = getAllWarpsDynamic();

  if (cmd === "warp") {
    if (!arg1) {
      console.warn(`[WARP_LIST] Titik warp tersedia: ${Object.keys(warps).join(", ") || "kosong"}`);
      return;
    }
    const warpName = arg1.toLowerCase();
    const warp = warps[warpName];
    if (!warp) {
      console.warn(`[WARP_ERROR] Titik warp '${warpName}' tidak ditemukan!`);
      return;
    }

    let targetPlayer = null;
    if (arg2) {
      targetPlayer = world.getPlayers().find(p => p.name.toLowerCase() === arg2.toLowerCase());
    } else {
      const players = world.getPlayers();
      if (players.length > 0) targetPlayer = players[0];
    }

    if (targetPlayer) {
      try {
        const dimObj = world.getDimension(warp.dimension || "overworld");
        targetPlayer.teleport({ x: warp.x, y: warp.y, z: warp.z }, { dimension: dimObj });
        targetPlayer.sendMessage(`§b§l[WARP] §r§eTeleportasi ke titik §a'${warp.name}' §r§e(X:${warp.x} Y:${warp.y} Z:${warp.z}) berhasil via Konsol!`);
        try { targetPlayer.runCommandAsync("playsound mob.endermen.portal @s"); } catch {}
        console.warn(`[WARP_SUCCESS] Berhasil teleportasi ${targetPlayer.name} ke warp '${warp.name}' via konsol.`);
      } catch (err) {
        console.warn(`[WARP_ERROR] Gagal teleport: ${err.message}`);
      }
    } else {
      console.warn(`[WARP_ERROR] Target pemain tidak ditemukan atau sedang offline!`);
    }
    return;
  }

  // 3. Setwarp via konsol: setwarp <nama> <x> <y> <z> [dimension]
  if (cmd === "setwarp") {
    if (!arg1 || arg2 === undefined || arg3 === undefined || parts[4] === undefined) {
      console.warn("[WARP_ERROR] Format: setwarp <nama> <x> <y> <z> [dimensi]");
      return;
    }
    const name = arg1.toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    const x = parseInt(arg2, 10) || 0;
    const y = parseInt(arg3, 10) || 64;
    const z = parseInt(parts[4], 10) || 0;
    const dim = parts[5] || "overworld";
    warps[name] = { name, x, y, z, dimension: dim, by: "Console" };
    saveAllWarpsDynamic(warps);
    console.warn(`[WARP_SET] Titik warp '${name}' berhasil disimpan via konsol.`);
    return;
  }

  // 4. Delwarp via konsol: delwarp <nama>
  if (cmd === "delwarp") {
    if (!arg1) return;
    const name = arg1.toLowerCase();
    if (warps[name]) {
      delete warps[name];
      saveAllWarpsDynamic(warps);
      console.warn(`[WARP_DEL] Titik warp '${name}' berhasil dihapus via konsol.`);
    }
    return;
  }
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

      // Kontrol Floating NameTag Simple dari Bot Discord / Konsol
      if (event.id === "bot:nametag" || event.id === "admin:nametag") {
        try {
          const raw = (event.message || "").trim().toLowerCase();
          if (raw === "off" || raw === "false") {
            disableAllNametags();
            console.warn("[NAMETAG] Dinonaktifkan via bot/konsol.");
          } else {
            enableAllNametags();
            console.warn("[NAMETAG] Diaktifkan via bot/konsol.");
          }
        } catch (err) {
          console.warn(`[Scripting Error bot:nametag] ${err.message}`);
        }
      }

      // Eksekusi perintah console/bot admin via scriptevent (misal bot:cmd !nametag on atau bot:cmd !warp base)
      if (event.id === "bot:cmd" || event.id === "admin:cmd") {
        try {
          handleAdminConsoleCommand(event.message);
        } catch (err) {
          console.warn(`[Scripting Error bot:cmd] ${err.message}`);
        }
      }

      // Kelola admin via scriptevent bot:admin add <player>
      if (event.id === "bot:admin" || event.id === "admin:op") {
        try {
          const parts = (event.message || "").trim().split(/\s+/);
          const action = parts[0]?.toLowerCase();
          const target = parts[1];
          if (action === "add" && target) {
            addAdminPlayer(target);
          } else if ((action === "del" || action === "remove") && target) {
            removeAdminPlayer(target);
          }
        } catch (err) {
          console.warn(`[Scripting Error bot:admin] ${err.message}`);
        }
      }
    });
    console.warn("[Scripting] Subscribed to scriptEventReceive (bot:inv, bot:locate, bot:setwarp, bot:delwarp, bot:nametag, bot:cmd, bot:admin)");
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

    // Pelacak posisi berkala setiap 20 ticks (1 detik) sebagai fallback koordinat kematian
    system.runInterval(() => {
      try {
        const players = world.getPlayers();
        for (const p of players) {
          if (p?.name && p.location) {
            lastPlayerPositions.set(p.name.toLowerCase(), {
              name: p.name,
              x: Math.floor(p.location.x),
              y: Math.floor(p.location.y),
              z: Math.floor(p.location.z),
              dim: (p.dimension?.id || "overworld").replace(/^minecraft:/, "")
            });
          }
        }
      } catch {}
    }, 20); // 20 ticks = 1 detik
  }
} catch (e) {}

// 6. Listener entityDie untuk Death Feed (Notifikasi Kematian Pemain dengan Koordinat)
try {
  if (world?.afterEvents && typeof world.afterEvents.entityDie?.subscribe === "function") {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const deadEntity = event.deadEntity;
        if (!deadEntity) return;

        // Cek jika entitas yang mati adalah player
        if (deadEntity.typeId === "minecraft:player" || deadEntity.name) {
          const playerName = deadEntity.name || deadEntity.nameTag || "Player";
          const damageSource = event.damageSource;
          const cause = damageSource?.cause || "unknown";

          let killerName = "";
          const killer = damageSource?.damagingEntity;
          if (killer) {
            const rawKiller = killer.nameTag || killer.name || (killer.typeId ? killer.typeId.replace(/^minecraft:/, "") : "");
            killerName = rawKiller.split("\n")[0].trim();
          }

          // Ambil koordinat dan dimensi titik kematian
          let x = 0, y = 0, z = 0, dim = "overworld";
          let hasLoc = false;
          try {
            if (deadEntity.location) {
              x = Math.floor(deadEntity.location.x);
              y = Math.floor(deadEntity.location.y);
              z = Math.floor(deadEntity.location.z);
              dim = (deadEntity.dimension?.id || "overworld").replace(/^minecraft:/, "");
              hasLoc = true;
            }
          } catch (locErr) {}

          if (!hasLoc && lastPlayerPositions.has(playerName.toLowerCase())) {
            const fallback = lastPlayerPositions.get(playerName.toLowerCase());
            x = fallback.x;
            y = fallback.y;
            z = fallback.z;
            dim = fallback.dim;
            hasLoc = true;
          }

          if (hasLoc) {
            lastDeathPositions.set(playerName.toLowerCase(), {
              name: playerName,
              x,
              y,
              z,
              dim,
              time: Date.now()
            });
          }

          const locStr = hasLoc ? `loc:${x},${y},${z}:${dim} ` : "";
          console.warn(`[DEATH] <${playerName}> cause:${cause} ${locStr}killer:${killerName}`);

          // Kirim pesan langsung ke pemain yang mati agar tahu posisi barangnya
          if (hasLoc) {
            try {
              const dimLabel = dim === "nether" ? "The Nether" : dim === "the_end" ? "The End" : "Overworld";
              deadEntity.sendMessage(`§c§l[TITIK KEMATIAN] §r§eLokasi: §fX:${x} Y:${y} Z:${z} §7(${dimLabel}) §e• Ketik §f!deathpos §euntuk melihat kembali!`);
            } catch (e) {}
          }
        } else {
          // Jika mob mati, bersihkan nametag agar tidak menggantung sebelum despawn
          try {
            deadEntity.nameTag = "";
          } catch {}
        }
      } catch (err) {
        console.warn(`[Scripting Error entityDie] ${err.message}`);
      }
    });
    console.warn("[Scripting] Subscribed to entityDie (Death Feed with Coordinates)");
  }
} catch (e) {
  console.warn(`[Scripting Error entityDie subscribe] ${e.message}`);
}

// ==============================================================================
// 7. SISTEM FLOATING NAMETAG DARAH SIMPLE (PEMAIN & SEMUA MOB)
// ==============================================================================

// Daftar entitas non-living atau proyektil/dekorasi yang tidak perlu nametag darah
const EXCLUDED_NAMETAG_ENTITIES = new Set([
  "minecraft:item",
  "minecraft:xp_orb",
  "minecraft:xp_bottle",
  "minecraft:arrow",
  "minecraft:thrown_trident",
  "minecraft:splash_potion",
  "minecraft:lingering_potion",
  "minecraft:snowball",
  "minecraft:egg",
  "minecraft:ender_pearl",
  "minecraft:fishing_hook",
  "minecraft:lightning_bolt",
  "minecraft:tnt",
  "minecraft:falling_block",
  "minecraft:armor_stand",
  "minecraft:boat",
  "minecraft:chest_boat",
  "minecraft:minecart",
  "minecraft:chest_minecart",
  "minecraft:hopper_minecart",
  "minecraft:tnt_minecart",
  "minecraft:furnace_minecart",
  "minecraft:command_block_minecart",
  "minecraft:eye_of_ender_signal",
  "minecraft:shulker_bullet",
  "minecraft:dragon_fireball",
  "minecraft:small_fireball",
  "minecraft:fireball",
  "minecraft:wither_skull",
  "minecraft:wither_skull_dangerous",
  "minecraft:evocation_fangs",
  "minecraft:area_effect_cloud",
  "minecraft:fireworks_rocket"
]);

function isNametagEnabled() {
  try {
    const val = world.getDynamicProperty("nametag_simple_enabled");
    if (typeof val === "boolean") return val;
  } catch {}
  return true; // Default aktif
}

function setNametagEnabled(val) {
  try {
    world.setDynamicProperty("nametag_simple_enabled", !!val);
  } catch (err) {
    console.warn(`[Scripting Error setNametagEnabled] ${err.message}`);
  }
}

// Helper nama bersih entitas (Pemain atau Mob)
function formatEntityDisplayName(entity) {
  if (!entity) return "Mob";
  if (entity.typeId === "minecraft:player") {
    return entity.name || "Player";
  }

  // Jika mob sudah dinamai secara kustom oleh player (misal pakai Name Tag)
  const currentTag = entity.nameTag;
  if (currentTag && typeof currentTag === "string" && currentTag.trim()) {
    const firstLine = currentTag.split("\n")[0].trim();
    if (firstLine && !firstLine.startsWith("§c❤") && !firstLine.startsWith("§6❤") && !firstLine.startsWith("§4❤")) {
      return firstLine;
    }
  }

  const rawId = (entity.typeId || "Mob").replace(/^minecraft:/, "");
  return rawId
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Cek apakah entitas valid dan merupakan makhluk hidup / mob dengan HP
function isLivingEntity(entity) {
  if (!entity) return false;
  try {
    if (typeof entity.isValid === "function" && !entity.isValid()) return false;
  } catch {}

  const typeId = entity.typeId;
  if (!typeId || EXCLUDED_NAMETAG_ENTITIES.has(typeId)) return false;
  if (typeId.includes("projectile") || typeId.includes("bullet") || typeId.includes("cart")) return false;

  const healthComp = entity.getComponent("health") || entity.getComponent("minecraft:health");
  return !!healthComp;
}

// Update tampilan NameTag untuk Player dan Mob: Hanya Nama dan Darah bergaya simpel
function updateEntityNameTagSimple(entity, enabled = true) {
  if (!entity) return;
  try {
    if (typeof entity.isValid === "function" && !entity.isValid()) return;
  } catch {}

  if (!isLivingEntity(entity)) return;

  const isPlayer = entity.typeId === "minecraft:player";
  const displayName = formatEntityDisplayName(entity);

  if (!enabled) {
    if (isPlayer) {
      if (entity.nameTag !== displayName) {
        entity.nameTag = displayName;
      }
    } else {
      if (entity.nameTag) {
        entity.nameTag = "";
      }
    }
    return;
  }

  // Ambil data health
  let currentHp = 20;
  let maxHp = 20;
  try {
    const healthComp = entity.getComponent("health") || entity.getComponent("minecraft:health");
    if (healthComp) {
      currentHp = Math.max(0, Math.round(healthComp.currentValue));
      maxHp = Math.round(healthComp.defaultValue) || 20;
    }
  } catch {}

  // Pewarnaan indikator darah yang bersih dan elegan
  let hpColor = "§a"; // Hijau saat sehat
  let heartIcon = "§c❤";

  if (currentHp > maxHp) {
    hpColor = "§6"; // Emas saat ada efek absorption (Golden Apple)
    heartIcon = "§6❤";
  } else {
    const ratio = maxHp > 0 ? (currentHp / maxHp) : 1;
    if (ratio <= 0.25) {
      hpColor = "§c"; // Merah saat kritis
      heartIcon = "§4❤";
    } else if (ratio <= 0.5) {
      hpColor = "§6"; // Oranye saat sekarat
      heartIcon = "§c❤";
    } else if (ratio <= 0.75) {
      hpColor = "§e"; // Kuning saat terluka
      heartIcon = "§c❤";
    }
  }

  // Gaya Simpel:
  // Baris 1: Nama Entitas (Player / Mob)
  // Baris 2: ❤ [HP]/[MaxHP]
  const newTag = `${displayName}\n${heartIcon} ${hpColor}${currentHp}§7/§a${maxHp}`;

  if (entity.nameTag !== newTag) {
    entity.nameTag = newTag;
  }

  // Untuk mob, pastikan nametag mengambang terlihat
  if (!isPlayer) {
    try {
      if (typeof entity.isNameTagVisible === "boolean" || "isNameTagVisible" in entity) {
        entity.isNameTagVisible = true;
      }
    } catch {}
  }
}

// Matikan nametag untuk semua pemain dan mob di sekitar
function disableAllNametags() {
  setNametagEnabled(false);
  const players = world.getPlayers();
  for (const p of players) {
    try { p.nameTag = p.name || "Player"; } catch {}
    try {
      if (p.dimension && p.location) {
        const nearby = p.dimension.getEntities({ location: p.location, maxDistance: 48 });
        for (const ent of nearby) {
          if (ent.typeId !== "minecraft:player") {
            try { ent.nameTag = ""; } catch {}
          }
        }
      }
    } catch {}
  }
}

// Aktifkan nametag untuk semua pemain dan mob di sekitar
function enableAllNametags() {
  setNametagEnabled(true);
  const players = world.getPlayers();
  for (const p of players) {
    try { updateEntityNameTagSimple(p, true); } catch {}
    try {
      if (p.dimension && p.location) {
        const nearby = p.dimension.getEntities({ location: p.location, maxDistance: 48 });
        for (const ent of nearby) {
          try { updateEntityNameTagSimple(ent, true); } catch {}
        }
      }
    } catch {}
  }
}

// Interval loop setiap 10 ticks (0.5 detik) untuk sinkronisasi darah pemain & mob di sekitar
try {
  if (system?.runInterval) {
    system.runInterval(() => {
      try {
        const enabled = isNametagEnabled();
        const players = world.getPlayers();
        if (players.length === 0) return; // Hemat CPU total saat server kosong

        const processedEntities = new Set();

        // 1. Update seluruh pemain yang online
        for (const p of players) {
          updateEntityNameTagSimple(p, enabled);
          if (p.id) processedEntities.add(p.id);
        }

        if (!enabled) return;

        // 2. Update seluruh mob di sekitar pemain (radius 36 blok)
        for (const p of players) {
          try {
            if (!p.dimension || !p.location) continue;
            const nearbyEntities = p.dimension.getEntities({
              location: p.location,
              maxDistance: 36
            });
            for (const ent of nearbyEntities) {
              const entId = ent.id;
              if (entId && processedEntities.has(entId)) continue;
              if (entId) processedEntities.add(entId);

              updateEntityNameTagSimple(ent, true);
            }
          } catch {}
        }
      } catch {}
    }, 10);
    console.warn("[Scripting] Floating NameTag darah simple (Player & Mob) aktif (10 ticks interval)");
  }
} catch (e) {
  console.warn(`[Scripting Error NameTag interval] ${e.message}`);
}

// Update instan saat pemain atau mob terkena serangan/damage (entityHurt)
try {
  if (world?.afterEvents?.entityHurt?.subscribe) {
    world.afterEvents.entityHurt.subscribe((event) => {
      try {
        const hurt = event.hurtEntity;
        if (hurt && isLivingEntity(hurt)) {
          if (isNametagEnabled()) {
            updateEntityNameTagSimple(hurt, true);
          }
        }
      } catch {}
    });
  }
} catch (e) {}

// Update instan saat mob spawn (entitySpawn)
try {
  if (world?.afterEvents?.entitySpawn?.subscribe) {
    world.afterEvents.entitySpawn.subscribe((event) => {
      try {
        const ent = event.entity;
        if (ent && isLivingEntity(ent) && isNametagEnabled()) {
          updateEntityNameTagSimple(ent, true);
        }
      } catch {}
    });
  }
} catch (e) {}

// Update instan saat pemain spawn / respawn (playerSpawn)
try {
  if (world?.afterEvents?.playerSpawn?.subscribe) {
    world.afterEvents.playerSpawn.subscribe((event) => {
      try {
        const p = event.player;
        if (p && isNametagEnabled()) {
          updateEntityNameTagSimple(p, true);
        }
      } catch {}
    });
  }
} catch (e) {}


