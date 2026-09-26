const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { restartServerWithCountdown, restartServer, cancelRestart, getCountdownState } = require('../serverController');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart-server')
    .setDescription('Restart server Minecraft Bedrock di VPS dengan countdown notifikasi in-game')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('countdown')
        .setDescription('Waktu hitung mundur dalam detik (default: 60, isi 0 untuk restart instan)')
        .setMinValue(0)
        .setMaxValue(300)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('alasan')
        .setDescription('Alasan restart (akan disiarkan ke in-game chat)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply();

    const currentState = getCountdownState();
    if (currentState.active) {
      await interaction.editReply({
        content: `⚠️ **Hitung mundur restart sudah berjalan!** Tersisa **${currentState.secondsLeft} detik**. Anda dapat menggunakan tombol di bawah untuk membatalkan jika diperlukan.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_cancel_restart')
              .setLabel('Batalkan Restart')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⛔')
          )
        ]
      });
      return;
    }

    const countdown = interaction.options.getInteger('countdown') ?? 60;
    const reason = interaction.options.getString('alasan') || '';
    const adminName = interaction.user.displayName || interaction.user.username;

    if (countdown === 0) {
      await interaction.editReply({
        content: '⚡ **Menjalankan restart instan tanpa countdown...**'
      });
      const result = await restartServer({ immediate: true });
      if (context?.statusManager) {
        await context.statusManager.updateStatusEmbed();
      }
      await interaction.editReply({
        content: result.success ? `🔄 **${result.message}**` : `⚠️ ${result.message}`
      });
      return;
    }

    const createRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_cancel_restart')
        .setLabel('Batalkan Restart')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⛔'),
      new ButtonBuilder()
        .setCustomId('btn_force_restart')
        .setLabel('Restart Sekarang')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚡')
    );

    const makeEmbed = (secLeft) => {
      const percent = Math.max(0, Math.min(100, Math.round(((countdown - secLeft) / countdown) * 100)));
      const filled = Math.round(percent / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      const embed = new EmbedBuilder()
        .setColor(secLeft <= 10 ? 0xE74C3C : 0xF39C12)
        .setTitle('⏱️ Hitung Mundur Restart Server Sedang Berjalan!')
        .setDescription([
          `Peringatan in-game telah disiarkan ke semua pemain di server Minecraft.`,
          ``,
          `⏳ **Sisa Waktu:** \`${secLeft} detik\` (${percent}%)`,
          `\`[${bar}]\``,
          reason ? `📝 **Alasan:** ${reason}` : '',
          `👑 **Diinisiasi oleh:** ${adminName}`,
          ``,
          `*💡 Pemain di dalam game mendapatkan notifikasi Title layar, Countdown Actionbar, suara alarm, dan pesan chat agar sempat menyimpan barang & mencari tempat aman.*`
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Tekan tombol di bawah untuk membatalkan atau lewati hitung mundur' })
        .setTimestamp();
      return embed;
    };

    await interaction.editReply({
      embeds: [makeEmbed(countdown)],
      components: [createRow()]
    });

    let lastEditSec = countdown;
    const result = await restartServerWithCountdown(countdown, {
      initiatedBy: adminName,
      reason,
      onTick: async (s) => {
        // Edit reply di Discord setiap 15 detik atau saat s <= 5 agar tidak terkena rate-limit
        if ((s % 15 === 0 || s === 10 || s <= 5) && s !== lastEditSec) {
          lastEditSec = s;
          try {
            await interaction.editReply({
              embeds: [makeEmbed(s)],
              components: [createRow()]
            });
          } catch {}
        }
      }
    });

    if (context?.statusManager) {
      await context.statusManager.updateStatusEmbed().catch(() => {});
    }

    if (result.cancelled) {
      const cancelEmbed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('⛔ Restart Server Dibatalkan')
        .setDescription(`Hitung mundur restart telah dibatalkan. Server Minecraft tetap beroperasi normal tanpa gangguan.`)
        .setTimestamp();
      await interaction.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
      return;
    }

    if (result.success) {
      const successEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🟢 Server Minecraft Berhasil Di-restart!')
        .setDescription([
          `Server Minecraft Bedrock telah selesai me-restart.`,
          `• Seluruh pemain yang terputus kini sudah dapat masuk kembali.`,
          `• Cache memori telah disegarkan.`,
          `• Seluruh cetak biru dan struktur telah dimuat ulang.`
        ].join('\n'))
        .setFooter({ text: 'Server Online Kembali' })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
    } else {
      await interaction.editReply({
        content: `⚠️ **Gagal me-restart server:** ${result.message}`,
        embeds: [],
        components: []
      }).catch(() => {});
    }
  }
};
