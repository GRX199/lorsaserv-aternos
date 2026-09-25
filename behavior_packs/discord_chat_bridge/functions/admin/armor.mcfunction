# ========================================================
# ADMIN INSTANT MAX ENCHANT - ARMOR (UNIVERSAL)
# Pegang Helm / Baju / Celana / Sepatu di tangan utama
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Full Enchant untuk Admin
# Enchant Umum untuk semua bagian armor
execute as @s[tag=admin] run enchant @s protection 4
execute as @s[tag=admin] run enchant @s unbreaking 3
execute as @s[tag=admin] run enchant @s mending 1
execute as @s[tag=admin] run enchant @s thorns 3

# Khusus Helm (otomatis terpasang jika memegang helm)
execute as @s[tag=admin] run enchant @s respiration 3
execute as @s[tag=admin] run enchant @s aqua_affinity 1

# Khusus Celana (otomatis terpasang jika memegang celana)
execute as @s[tag=admin] run enchant @s swift_sneak 3

# Khusus Sepatu (otomatis terpasang jika memegang sepatu)
execute as @s[tag=admin] run enchant @s feather_falling 4
execute as @s[tag=admin] run enchant @s depth_strider 3
execute as @s[tag=admin] run enchant @s soul_speed 3

execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN ENCHANT] §r§aArmor di tangan Anda berhasil di-enchant FULL MAX!"}]}
