import { world } from "@minecraft/server";

console.warn("[Scripting] Discord Chat Bridge loaded successfully!");

let chatSubscribed = false;

// 1. Coba afterEvents.chatSend
try {
  if (world?.afterEvents && typeof world.afterEvents.chatSend?.subscribe === "function") {
    world.afterEvents.chatSend.subscribe((event) => {
      try {
        const sender = event.sender?.name || "Player";
        const message = event.message || "";
        if (sender && message) {
          console.warn(`[CHAT] <${sender}> ${message}`);
        }
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
        if (sender && message) {
          console.warn(`[CHAT] <${sender}> ${message}`);
        }
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
