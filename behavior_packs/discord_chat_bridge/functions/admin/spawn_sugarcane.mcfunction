# ========================================================
# ADMIN SPAWN SUGARCANE FARM (OBSERVER-PISTON)
# Ukuran: 8 blok (Panjang) x 5 blok (Tinggi) x 5 blok (Lebar)
# ========================================================

execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin!"}]}

execute as @s[tag=admin] at @s run structure load sugarcane_farm ~ ~ ~
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN] §r§aAuto Sugarcane Farm [8x5x5] berhasil dimunculkan!"}]}
