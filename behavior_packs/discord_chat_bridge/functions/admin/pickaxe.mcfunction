# ========================================================
# ADMIN INSTANT MAX ENCHANT - PICKAXE (FORTUNE)
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Full Enchant untuk Admin
execute as @s[tag=admin] run enchant @s efficiency 5
execute as @s[tag=admin] run enchant @s unbreaking 3
execute as @s[tag=admin] run enchant @s mending 1
execute as @s[tag=admin] run enchant @s fortune 3
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN ENCHANT] §r§aPickaxe Fortune berhasil di-enchant FULL MAX! (Efficiency V, Unbreaking III, Mending I, Fortune III)"}]}
