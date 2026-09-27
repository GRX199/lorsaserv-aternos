const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nametag')
    .setDescription('Kelola Floating NameTag Darah Simple (Pemain & Semua Mob)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('aktif')
        .setDescription('Aktifkan (True) atau Nonaktifkan (False) Floating NameTag darah')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const aktif = interaction.options.getBoolean('aktif');

    try {
      if (aktif !== null) {
        const payload = aktif ? 'on' : 'off';
        sendConsoleCommand(`scriptevent bot:nametag ${payload}`);

        const embed = new EmbedBuilder()
          .setColor(aktif ? 0x2ECC71 : 0xE74C3C)
          .setTitle(aktif ? '✅ Floating NameTag Darah Diaktifkan' : '🛑 Floating NameTag Darah Dinonaktifkan')
          .setDescription([
            aktif
              ? 'Floating NameTag sekarang menampilkan **Nama & Indikator Darah (❤ HP)** bergaya simpel di atas kepala **seluruh Pemain & semua Mob** (Zombie, Cow, Iron Golem, Villager, Boss, dll).'
              : 'Floating NameTag telah dinonaktifkan untuk pemain dan mob.',
            '',
            '**Gaya Tampilan (Simple):**',
            '```',
            aktif ? '<Nama Pemain / Mob>\n❤ 20/20' : '<Nama Pemain>',
            '```'
          ].join('\n'))
          .setFooter({ text: 'SASY199 BDS • Simple Floating NameTag (Player & Mobs)' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🏷️ Info Floating NameTag Darah (Player & All Mobs)')
          .setDescription([
            'Sistem Floating NameTag menampilkan indikator sisa darah (HP) pemain dan semua mob secara live dengan gaya bersih & minimalis.',
            '',
            '**Format:**',
            '```',
            '<Nama Pemain / Mob>',
            '❤ [Sisa HP]/[Max HP]',
            '```',
            '',
            '**Contoh Tampilan Mob:**',
            '• `Zombie` → `❤ 20/20` (atau `❤ 13/20` saat dipukul)',
            '• `Iron Golem` → `❤ 100/100`',
            '• `Cow` → `❤ 10/10`',
            '• `Ender Dragon` → `❤ 200/200`',
            '',
            '**Pengaturan:**',
            '• Jalankan `/nametag aktif: True` untuk mengaktifkan.',
            '• Jalankan `/nametag aktif: False` untuk mematikan.',
            '• Atau di in-game chat: `!nametag on` / `!nametag off` (Khusus Admin/OP).'
          ].join('\n'))
          .setFooter({ text: 'SASY199 BDS • Simple Floating NameTag (Player & Mobs)' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Command nametag] Error:', err);
      await interaction.editReply({
        content: `❌ Gagal mengatur nametag: ${err.message}`
      });
    }
  }
};
