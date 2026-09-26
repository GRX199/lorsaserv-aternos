# ========================================================
# ADMIN SPAWN EASY IRON FARM (23x9x23)
# ========================================================

execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin!"}]}

execute as @s[tag=admin] at @s run structure load easy_ironfarm ~ ~ ~
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN] §r§aEasy Iron Farm [23x9x23] berhasil dimunculkan!"}]}
