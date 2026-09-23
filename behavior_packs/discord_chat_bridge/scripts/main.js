import { world } from "@minecraft/server";

// Berlangganan event pengiriman chat dari pemain di dalam game
world.afterEvents.chatSend.subscribe((event) => {
  const player = event.sender;
  if (!player) return;

  const senderName = player.name;
  const message = event.message;

  // Cetak format terstandarisasi ke stdout server BDS
  // Format: [CHAT] <NamaPemain> Pesan
  console.warn(`[CHAT] <${senderName}> ${message}`);
});
