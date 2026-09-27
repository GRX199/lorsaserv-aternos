const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nametag')
    .setDescription('Kelola tampilan floating NameTag darah, level, dan badge pemain di game (Khusus Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('aksi')
        .setDescription('Pilih tindakan yang ingin dilakukan')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Aktifkan NameTag Darah', value: 'on' },
          { name: '🔴 Matikan (Kembali ke Nama Biasa)', value: 'off' },
          { name: '🎨 Ubah Gaya: Lengkap (HP + Level + Dimensi)', value: 'style:full' },
          { name: '🎨 Ubah Gaya: Simpel (Hanya HP)', value: 'style:simple' },
          { name: '🎨 Ubah Gaya: Visual Bar Hati (❤❤❤❤❤)', value: 'style:hearts' },
          { name: 'ℹ️ Cek Penjelasan Fitur & Preview', value: 'info' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isOwner = interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = isOwner
      || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.editReply({
        content: '❌ **Akses Ditolak**: Perintah ini khusus untuk **Administrator Server**!'
      });
      return;
    }

    const aksi = interaction.options.getString('aksi');

    if (aksi === 'info') {
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🏷️ Sistem Floating NameTag Darah & Info Pemain')
        .setDescription([
          `Fitur ini menampilkan informasi dinamis tepat di atas kepala setiap pemain di dunia 3D Minecraft Bedrock secara *real-time*!`,
          ``,
          `### 💖 Informasi yang Ditampilkan:`,
          `1. **Baris 1 (Identitas & Badge)**:`,
          `   • Admin/OP: \`👑 [ADMIN] Steve\``,
          `   • Member: \`Steve\``,
          `   • Status AFK: \`Steve [AFK]\``,
          `2. **Baris 2 (Status Vitalitas & Petualangan)**:`,
          `   • **Darah Dinamis**: Warna berubah hijau (sehat), kuning (waspada), merah (sekarat), atau emas (golden apple).`,
          `   • **Level XP**: \`⭐ Lv.15\``,
          `   • **Ikon Dimensi**: \`🌍 Overworld\`, \`🔥 Nether\`, \`🌌 End\``,
          ``,
          `### 🎨 Pilihan Gaya (Style):`,
          `• **Full (Lengkap)**: \`❤ 20/20 | ⭐ Lv.15 | 🌍\``,
          `• **Simple (Simpel)**: \`❤ 20/20 HP\``,
          `• **Hearts (Bar Hati)**: \`❤❤❤❤❤❤❤❤❤❤ (20) ⭐15\``,
          ``,
          `### 💬 Perintah In-Game (Khusus OP/Admin di Chat):`,
          `• \`!nametag on\` / \`!nametag off\``,
          `• \`!nametag style full\` | \`simple\` | \`hearts\``,
          `• \`!nametag help\``
        ].join('\n'))
        .setFooter({ text: 'NameTag System • SASY199' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (process.platform !== 'linux') {
      await interaction.editReply({
        content: '❌ Perintah ke konsol game hanya dapat dieksekusi saat bot berjalan di VPS Linux.'
      });
      return;
    }

    // Kirim event scriptevent ke BDS
    const res = sendConsoleCommand(`scriptevent bot:nametag ${aksi}`);

    if (res.success) {
      let desc = '';
      if (aksi === 'on') desc = '🟢 **Tampilan NameTag Darah & Info telah diaktifkan!** Seluruh pemain kini memiliki indikator darah dan level di atas kepalanya.';
      else if (aksi === 'off') desc = '🔴 **Tampilan NameTag Darah telah dinonaktifkan.** Nama seluruh pemain kembali normal.';
      else if (aksi.startsWith('style:')) desc = `🎨 **Gaya NameTag berhasil diubah ke:** \`${aksi.replace('style:', '')}\`!`;

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Pengaturan NameTag Berhasil Diterapkan!')
        .setDescription(desc)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        content: `⚠️ **Gagal mengirim pengaturan ke server:** ${res.error || res.message}`
      });
    }
  }
};
