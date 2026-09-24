const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { getWorldMapUrl } = require('../embeds');

let isRendering = false;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('render-map')
    .setDescription('Render visual blok dunia Minecraft Bedrock asli menjadi Web Map (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator**!' });
      } else {
        await interaction.reply({ content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator**!', ephemeral: true });
      }
      return;
    }

    if (interaction.deferred || interaction.replied) {
      // already deferred
    } else {
      await interaction.deferReply({ ephemeral: false });
    }

    if (isRendering) {
      await interaction.editReply({
        content: '⏳ **Proses render visual dunia sedang berlangsung!** Harap tunggu beberapa saat sampai proses selesai.'
      });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Fitur render visual peta Bedrock LevelDB hanya dapat dijalankan di VPS Linux.'
      });
      return;
    }

    isRendering = true;
    const scriptPath = path.join(__dirname, '..', '..', 'render_world_map.sh');
    const mapUrl = getWorldMapUrl(context?.config);

    await interaction.editReply({
      content: [
        '🔨 **Memulai render visual dunia asli Minecraft Bedrock (uNmINeD)...**',
        '• Bot sedang membaca chunk LevelDB dunia server.',
        '• Proses ini berjalan di background dengan prioritas CPU rendah (`nice -n 19`) sehingga **server Minecraft TIDAK akan lag**.',
        '• Notifikasi akan otomatis dikirimkan di sini setelah selesai!'
      ].join('\n')
    });

    const child = spawn('bash', [scriptPath], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', async (code) => {
      isRendering = false;

      if (code === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('🗺️ Visual Map Dunia Berhasil Di-render!')
          .setDescription([
            'Semua blok bangunan, pohon, air, bioma, dan kontur dunia asli Minecraft Bedrock telah selesai dirender ke Web Map!',
            '',
            `🌐 **Buka Visual Dunia Asli:**\n🔗 [${mapUrl}](${mapUrl})`,
            '',
            '💡 *Peta ini juga secara otomatis menyematkan marker posisi pemain live.*'
          ].join('\n'))
          .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] }).catch(() => {});
      } else {
        const errSnippet = output.slice(-800);
        await interaction.editReply({
          content: `⚠️ **Proses render selesai dengan kode error ${code}:**\n\`\`\`\n${errSnippet}\n\`\`\``
        }).catch(() => {});
      }
    });
  }
};
