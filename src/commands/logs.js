const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { execSync } = require('node:child_process');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Tampilkan baris log terbaru server Minecraft Bedrock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('jumlah')
        .setDescription('Jumlah baris log yang ingin dilihat (default: 20, max: 40)')
        .setMinValue(5)
        .setMaxValue(40)
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (process.platform !== 'linux') {
        await interaction.editReply({ content: 'Fitur cek log konsol hanya tersedia di VPS Linux.' });
        return;
      }

      const count = interaction.options.getInteger('jumlah') || 20;
      let output = '';

      try {
        output = execSync(`journalctl -u minecraft-bedrock -n ${count} --no-pager`, {
          encoding: 'utf8',
          timeout: 5000
        });
      } catch {
        output = execSync(`sudo -n journalctl -u minecraft-bedrock -n ${count} --no-pager`, {
          encoding: 'utf8',
          timeout: 5000
        });
      }

      // Rapikan baris log
      const lines = output.trim().split('\n').slice(-count);
      const cleanLines = lines.map(line => {
        const colonIdx = line.indexOf('bedrock_server[');
        if (colonIdx !== -1) {
          const after = line.indexOf(']: ', colonIdx);
          if (after !== -1) return line.substring(after + 3);
        }
        return line;
      }).filter(l => l && !l.includes('how_to.html'));

      const result = cleanLines.join('\n');
      const safeText = result.length > 1850 ? result.substring(result.length - 1850) : result;

      await interaction.editReply({
        content: `📋 **${cleanLines.length} Baris Log Server Terkini:**\n\`\`\`prolog\n${safeText || 'Belum ada log tercatat.'}\n\`\`\``
      });
    } catch (err) {
      console.error('[Command logs] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengambil log server: ${err.message}`
      });
    }
  }
};
