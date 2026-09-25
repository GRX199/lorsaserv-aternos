# ========================================================
# ADMIN SPAWN AUTO STORAGE (GOLEM)
# Ukuran Bangunan: 22 blok (Panjang) x 10 blok (Tinggi) x 20 blok (Lebar)
# Pastikan berada di area lapang sebelum menjalankan perintah ini!
# ========================================================

# 1. Verifikasi Admin: Jika bukan admin, tolak akses
execute as @s[tag=!admin] run playsound note.bass @s
execute as @s[tag=!admin] run tellraw @s {"rawtext":[{"text":"§c§l[DITOLAK] §r§cPerintah ini khusus Admin! Tag 'admin' tidak ditemukan."}]}

# 2. Eksekusi Load Structure di posisi pemain
execute as @s[tag=admin] at @s run structure load easyautostorage ~ ~ ~
execute as @s[tag=admin] run playsound random.levelup @s
execute as @s[tag=admin] run tellraw @s {"rawtext":[{"text":"§a§l[ADMIN] §r§aGudang Auto Storage (Golem) [22x10x20] berhasil dimunculkan di lokasi Anda!"}]}
