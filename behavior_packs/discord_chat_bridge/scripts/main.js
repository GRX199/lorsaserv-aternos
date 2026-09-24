import { world } from "@minecraft/server";

// 1. Berlangganan event pengiriman chat dari pemain di dalam game
world.afterEvents.chatSend.subscribe((event) => {
  const player = event.sender;
  if (!player) return;

  const senderName = player.name;
  const message = event.message;

  // Format: [CHAT] <NamaPemain> Pesan
  console.warn(`[CHAT] <${senderName}> ${message}`);
});

// 2. Berlangganan event pemain masuk / spawn pertama kali ke dunia game
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn && event.player) {
    console.warn(`[PLAYER_JOIN] ${event.player.name}`);
  }
});

// 3. Berlangganan event pemain keluar / disconnect dari game
world.afterEvents.playerLeave.subscribe((event) => {
  if (event.playerName) {
    console.warn(`[PLAYER_LEAVE] ${event.playerName}`);
  }
});
