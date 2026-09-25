# ========================================================
# ADMIN INSTANT MAX ENCHANT - ALL IN ONE (ANY HELD ITEM)
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Enchant Serbaguna (Minecraft otomatis menerapkan enchant yang cocok untuk item di tangan)
# Durabilitas & Mending
execute as @s[tag=admin] run enchant @s unbreaking 3
execute as @s[tag=admin] run enchant @s mending 1

# Pedang & Senjata
execute as @s[tag=admin] run enchant @s sharpness 5
execute as @s[tag=admin] run enchant @s looting 3
execute as @s[tag=admin] run enchant @s fire_aspect 2
execute as @s[tag=admin] run enchant @s knockback 2

# Alat Tambang (Pickaxe / Axe / Shovel / Hoe)
execute as @s[tag=admin] run enchant @s efficiency 5
execute as @s[tag=admin] run enchant @s fortune 3

# Busur & Crossbow
execute as @s[tag=admin] run enchant @s power 5
execute as @s[tag=admin] run enchant @s flame 1
execute as @s[tag=admin] run enchant @s infinity 1
execute as @s[tag=admin] run enchant @s punch 2
execute as @s[tag=admin] run enchant @s quick_charge 3
execute as @s[tag=admin] run enchant @s multishot 1

# Trident
execute as @s[tag=admin] run enchant @s impaling 5
execute as @s[tag=admin] run enchant @s loyalty 3
execute as @s[tag=admin] run enchant @s channeling 1

# Mace (1.21)
execute as @s[tag=admin] run enchant @s density 5
execute as @s[tag=admin] run enchant @s wind_burst 3
execute as @s[tag=admin] run enchant @s breach 4

# Armor Universal
execute as @s[tag=admin] run enchant @s protection 4
execute as @s[tag=admin] run enchant @s thorns 3
execute as @s[tag=admin] run enchant @s respiration 3
execute as @s[tag=admin] run enchant @s aqua_affinity 1
execute as @s[tag=admin] run enchant @s swift_sneak 3
execute as @s[tag=admin] run enchant @s feather_falling 4
execute as @s[tag=admin] run enchant @s depth_strider 3
execute as @s[tag=admin] run enchant @s soul_speed 3

execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN ENCHANT] §r§aItem di tangan Anda berhasil di-enchant MAX!"}]}
