#!/usr/bin/env python3
import sys
import os
import shutil
import io
import struct

def enable_experiments_for_file(level_dat_path):
    if not os.path.isfile(level_dat_path):
        print(f"[enable_experiments] File tidak ditemukan: {level_dat_path}")
        return False

    backup_path = level_dat_path + ".bak"
    try:
        shutil.copyfile(level_dat_path, backup_path)
    except Exception as e:
        print(f"[enable_experiments] Gagal membuat backup: {e}")
        return False

    try:
        import nbtlib
        from nbtlib import File
        from nbtlib.tag import Byte, Compound

        with open(level_dat_path, 'rb') as f:
            header = f.read(8)
            if len(header) < 8:
                print(f"[enable_experiments] File level.dat terlalu pendek: {level_dat_path}")
                return False
            level = File.parse(f, byteorder='little')

        if 'experiments' not in level:
            level['experiments'] = Compound()

        level['experiments']['gametest'] = Byte(1)
        level['experiments']['experiments_ever_used'] = Byte(1)
        level['experiments']['saved_with_toggled_experiments'] = Byte(1)

        buf = io.BytesIO()
        level.write(buf, byteorder='little')
        payload = buf.getvalue()

        version = header[:4]
        new_header = version + struct.pack('<I', len(payload))

        with open(level_dat_path, 'wb') as f:
            f.write(new_header)
            f.write(payload)

        print(f"[enable_experiments] ✅ Berhasil mengaktifkan Beta APIs di: {level_dat_path}")
        return True
    except Exception as e:
        print(f"[enable_experiments] ⚠️ Gagal memodifikasi {level_dat_path}: {e}")
        # Kembalikan backup jika terjadi kesalahan
        if os.path.exists(backup_path):
            shutil.copyfile(backup_path, level_dat_path)
        return False

def main():
    if len(sys.argv) < 2:
        print("Penggunaan: python3 enable_experiments.py <path_ke_level.dat atau path_ke_bedrock_server>")
        sys.exit(1)

    target = sys.argv[1]

    if os.path.isfile(target):
        enable_experiments_for_file(target)
    elif os.path.isdir(target):
        worlds_dir = os.path.join(target, "worlds") if not target.endswith("worlds") else target
        if not os.path.isdir(worlds_dir):
            worlds_dir = target

        found = False
        for root, dirs, files in os.walk(worlds_dir):
            for file in files:
                if file == "level.dat":
                    level_path = os.path.join(root, file)
                    enable_experiments_for_file(level_path)
                    found = True

        if not found:
            print(f"[enable_experiments] Tidak ada file level.dat yang ditemukan di {worlds_dir}")
    else:
        print(f"[enable_experiments] Target tidak valid: {target}")

if __name__ == "__main__":
    main()
