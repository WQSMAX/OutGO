"""处理 AI 生成的图标和宠物图片 — 缩放并放到正确位置"""
from PIL import Image
import os, shutil

SRC = r"C:\Users\冯子璇\Pictures\OutGo"
PROJ = r"d:\zhaijiajiliruanjian"

# ==================== 1. App 图标 ====================
ICON_SRC = os.path.join(SRC, "apk图标", "app软件图标.png")
icon = Image.open(ICON_SRC).convert("RGBA")
print(f"App 图标: {icon.size[0]}x{icon.size[1]}")

# PWA 尺寸
PWA_SIZES = [192, 512]
for size in PWA_SIZES:
    img = icon.resize((size, size), Image.LANCZOS)
    for subdir in ["assets/icons", "www/assets/icons"]:
        path = os.path.join(PROJ, subdir, f"icon-{size}.png")
        img.save(path)
        print(f"  [OK] {path} ({os.path.getsize(path):,} bytes)")

# Android mipmap 密度
DENSITIES = {
    'mdpi': 48, 'hdpi': 72, 'xhdpi': 96,
    'xxhdpi': 144, 'xxxhdpi': 192
}

for density, size in DENSITIES.items():
    mipmap_dir = os.path.join(PROJ, "android", "app", "src", "main", "res", f"mipmap-{density}")

    # 自适应图标前景：图标缩放到中心 66.67% 安全区
    safe_px = int(size * 2/3)  # 安全区大小
    icon_inner = icon.resize((safe_px, safe_px), Image.LANCZOS)

    # 创建透明底 把图标放中间
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - safe_px) // 2
    fg.paste(icon_inner, (offset, offset))
    fg_path = os.path.join(mipmap_dir, "ic_launcher_foreground.png")
    fg.save(fg_path)
    print(f"  [OK] {fg_path}")

    # ic_launcher / ic_launcher_round：完整图标
    full = icon.resize((size, size), Image.LANCZOS)
    for name in ["ic_launcher.png", "ic_launcher_round.png"]:
        path = os.path.join(mipmap_dir, name)
        full.save(path)

# ==================== 2. 宠物阶段图片 ====================
PET_MAP = {
    "小猫": "cat",
    "小狗": "dog",
    "小兔": "bunny",
    "小鸡": "bird",  # 文件夹叫小鸡，代码里是 bird/小鸟
}

STAGE_MAP = {
    "幼崽期": "1",
    "成长期": "2",
    "成熟期": "3",
    "完全体": "4",
}

PET_DIR = os.path.join(PROJ, "www", "assets", "pets")
os.makedirs(PET_DIR, exist_ok=True)

for folder, type_key in PET_MAP.items():
    folder_path = os.path.join(SRC, "宠物图片", folder)
    for stage_name, stage_num in STAGE_MAP.items():
        # 匹配文件名（小鸡文件夹里文件叫小鸟xxx.png）
        if folder == "小鸡":
            file_stem = f"小鸟{stage_name}"
        else:
            file_stem = f"{folder}{stage_name}"

        src_path = os.path.join(folder_path, f"{file_stem}.png")
        dst_name = f"{type_key}-{stage_num}.png"
        dst_path = os.path.join(PET_DIR, dst_name)

        if os.path.exists(src_path):
            img = Image.open(src_path).convert("RGBA")
            img = img.resize((512, 512), Image.LANCZOS)
            img.save(dst_path)
            print(f"  [OK] {dst_path} ({os.path.getsize(dst_path):,} bytes)")
        else:
            print(f"  [MISS] {src_path}")

print("\n所有图片处理完毕！")
