const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendConsoleCommand } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nametag')
    .setDescription('Kelola Floating NameTag Darah Simple di atas kepala pemain Minecraft')
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
              ? 'Floating NameTag sekarang menampilkan **Nama Pemain** dan **Indikator Darah (❤ HP)** bergaya simpel di atas kepala pemain.'
              : 'Floating NameTag telah dinonaktifkan dan nama pemain dikembalikan ke tampilan standar.',
            '',
            '**Gaya Tampilan (Simple):**',
            '```',
            aktif ? '<NamaPemain>\n❤ 20/20' : '<NamaPemain>',
            '```'
          ].join('\n'))
          .setFooter({ text: 'SASY199 BDS • Simple Floating NameTag' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🏷️ Info Floating NameTag Darah (Simple Style)')
          .setDescription([
            'Sistem Floating NameTag menampilkan indikator sisa darah (HP) pemain secara live dan bergaya bersih/minimalis.',
            '',
            '**Format:**',
            '```',
            '<NamaPemain>',
            '❤ [Sisa HP]/[Max HP]',
            '```',
            '',
            '**Pengaturan:**',
            '• Jalankan `/nametag aktif: True` untuk mengaktifkan.',
            '• Jalankan `/nametag aktif: False` untuk mematikan.',
            '• Atau di in-game chat: `!nametag on` / `!nametag off` (Khusus Admin/OP).'
          ].join('\n'))
          .setFooter({ text: 'SASY199 BDS • Simple Floating NameTag' })
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
