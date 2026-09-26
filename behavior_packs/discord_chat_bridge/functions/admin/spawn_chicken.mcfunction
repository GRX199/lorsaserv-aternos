# ========================================================
# ADMIN SPAWN COOKED CHICKEN FARM (INFINITE FOOD)
# Ukuran: 3 blok (Panjang) x 5 blok (Tinggi) x 4 blok (Lebar)
# ========================================================

execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin!"}]}

execute as @s[tag=admin] at @s run structure load chicken_farm ~ ~ ~
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN] §r§aAuto Cooked Chicken Farm [3x5x4] berhasil dimunculkan!"}]}
