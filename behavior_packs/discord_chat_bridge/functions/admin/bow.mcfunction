# ========================================================
# ADMIN INSTANT MAX ENCHANT - BOW
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Full Enchant untuk Admin
execute as @s[tag=admin] run enchant @s power 5
execute as @s[tag=admin] run enchant @s unbreaking 3
execute as @s[tag=admin] run enchant @s flame 1
execute as @s[tag=admin] run enchant @s infinity 1
execute as @s[tag=admin] run enchant @s punch 2
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN ENCHANT] §r§aBusur (Bow) berhasil di-enchant FULL MAX! (Power V, Unbreaking III, Flame I, Infinity I, Punch II)"}]}
