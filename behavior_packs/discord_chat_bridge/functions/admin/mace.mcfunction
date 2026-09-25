# ========================================================
# ADMIN INSTANT MAX ENCHANT - MACE (1.21+)
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Full Enchant untuk Admin
execute as @s[tag=admin] run enchant @s density 5
execute as @s[tag=admin] run enchant @s wind_burst 3
execute as @s[tag=admin] run enchant @s breach 4
execute as @s[tag=admin] run enchant @s unbreaking 3
execute as @s[tag=admin] run enchant @s mending 1
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN ENCHANT] §r§aMace berhasil di-enchant FULL MAX! (Density V, Wind Burst III, Breach IV, Unbreaking III, Mending I)"}]}
