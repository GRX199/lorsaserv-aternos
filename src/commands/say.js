const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { execSync } = require('node:child_process');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Kirim pesan siaran pengumuman ke layar semua pemain di dalam game')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('pesan')
        .setDescription('Pesan yang ingin disiarkan ke in-game chat')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const text = interaction.options.getString('pesan').trim();
    const sender = interaction.user.username;

    if (!text) {
      await interaction.editReply({ content: '❌ Pesan tidak boleh kosong!' });
      return;
    }

    try {
      if (process.platform !== 'linux') {
        await interaction.editReply({ content: '❌ Fitur ini hanya bekerja di VPS Linux.' });
        return;
      }

      // Gunakan tellraw dengan warna cyan §b dan putih §f agar terlihat profesional
      const tellrawJson = JSON.stringify({
        rawtext: [
          { text: `§b[Discord] §e${sender}§f: ${text}` }
        ]
      });

      const escapedJson = tellrawJson.replace(/"/g, '\\"');

      try {
        execSync(`screen -S mc-bedrock -X stuff "tellraw @a ${escapedJson}\n"`, { timeout: 4000 });
        await interaction.editReply({
          content: `📢 **Siaran Terkirim ke In-Game Chat:**\n\`\`\`\n[Discord] ${sender}: ${text}\n\`\`\``
        });
      } catch (screenErr) {
        // Fallback coba say biasa
        try {
          execSync(`screen -S mc-bedrock -X stuff "say [Discord] ${sender}: ${text}\n"`, { timeout: 4000 });
          await interaction.editReply({
            content: `📢 **Siaran Terkirim:** \`[Discord] ${sender}: ${text}\``
          });
        } catch {
          await interaction.editReply({
            content: `⚠️ Sesi screen server \`mc-bedrock\` tidak aktif di VPS.`
          });
        }
      }
    } catch (err) {
      console.error('[Command say] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengirim siaran: ${err.message}`
      });
    }
  }
};
