# ========================================================
# ADMIN ENCHANT - DAFTAR PERINTAH
# ========================================================

# 1. Verifikasi Admin
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Hubungi admin server."}]}

# 2. Daftar Perintah untuk Admin
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§6§l=== 🛡️ ADMIN INSTANT ENCHANT MENU ===§r\n§ePegang item di tangan utama, lalu ketik:\n§b/function admin/all §7- Otomatis deteksi & enchant item apa pun\n§b/function admin/sword §7- Max Enchant Pedang\n§b/function admin/pickaxe §7- Max Enchant Pickaxe (Fortune)\n§b/function admin/silkpick §7- Max Enchant Pickaxe (Silk Touch)\n§b/function admin/axe §7- Max Enchant Kapak\n§b/function admin/shovel §7- Max Enchant Sekop\n§b/function admin/bow §7- Max Enchant Busur Panah\n§b/function admin/crossbow §7- Max Enchant Crossbow\n§b/function admin/trident §7- Max Enchant Trident\n§b/function admin/mace §7- Max Enchant Mace (1.21)\n§b/function admin/armor §7- Max Enchant Armor di tangan\n§6======================================="}]}
