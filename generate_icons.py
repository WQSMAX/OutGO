"""生成 PWA + Android 全平台图标 PNG 文件

用法：
  python generate_icons.py              # 输出到当前目录下的 assets/ 和 android/
  python generate_icons.py --dir D:\项目  # 指定项目根目录

首次运行后，Android 自适应图标的背景色需手动确认：
  android/app/src/main/res/values/ic_launcher_background.xml → #5B9BD5

如需使用 AI 生成的图标：
  1. 将 1024x1024 的 PNG 放到 assets/source-icon.png
  2. 脚本会自动检测并缩放使用（待实现）
"""

import struct, zlib, os, sys


# ===================== Android 密度配置 =====================
ANDROID_DENSITIES = {
    'mdpi':    48,   # 48x48 px
    'hdpi':    72,   # 72x72 px
    'xhdpi':   96,   # 96x96 px
    'xxhdpi':  144,  # 144x144 px
    'xxxhdpi': 192,  # 192x192 px
}

# PWA 图标尺寸
PWA_SIZES = [192, 512]


def create_png(width, height, mode='full'):
    """创建带蓝色圆形和白色房子图标的 PNG

    Args:
        width: 图像宽度
        height: 图像高度
        mode: 'full' — 蓝色圆形背景 + 白房子（用于 PWA 和 ic_launcher）
              'foreground' — 透明背景，图标居中在 66.67% 安全区内（用于 adaptive icon foreground）
    """
    pixels = []
    cx, cy = width / 2, height / 2

    if mode == 'foreground':
        # 自适应图标前景：图标在中心 66.67% 安全区内
        safe_scale = 2.0 / 3.0  # 66.67%
        radius = (width * safe_scale) / 2 * 0.85  # 圆占安全区的 85%
    else:
        radius = width * 0.42

    for y in range(height):
        row = [0]  # filter byte: None
        for x in range(width):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5

            if dist <= radius:
                # 蓝色渐变圆形背景
                t = dist / radius
                r_val = int(91 + (125 - 91) * t)
                g_val = int(155 + (185 - 155) * t)
                b_val = int(213 + (232 - 213) * t)
                a_val = 255

                # 白色房子图标
                house_cx, house_cy = cx, cy + radius * 0.12
                house_size = radius * 0.55
                hx_start = house_cx - house_size
                hy_body = house_cy - house_size * 0.45

                # 屋顶三角形区域
                roof_top = hy_body - house_size * 0.55
                if y >= roof_top and y <= hy_body + house_size * 0.05:
                    half_width_at_y = house_size * (1 - (y - roof_top) / (hy_body + house_size * 0.05 - roof_top))
                    if abs(x - house_cx) <= half_width_at_y:
                        r_val, g_val, b_val, a_val = 255, 255, 255, 255

                # 房子主体
                body_left = house_cx - house_size * 0.28
                body_right = house_cx + house_size * 0.28
                body_top = hy_body + house_size * 0.05
                body_bottom = hy_body + house_size * 0.75
                if (body_left <= x <= body_right and body_top <= y <= body_bottom):
                    r_val, g_val, b_val, a_val = 255, 255, 255, 255

                # 门
                door_left = house_cx - house_size * 0.09
                door_right = house_cx + house_size * 0.09
                door_top = body_bottom - house_size * 0.32
                if (door_left <= x <= door_right and door_top <= y <= body_bottom):
                    r_val, g_val, b_val = 91, 155, 213
                    a_val = 255

            elif dist <= radius + 2 and mode != 'foreground':
                # 圆外细边框（仅 full 模式）
                r_val, g_val, b_val, a_val = 255, 255, 255, 255
            else:
                # 完全透明
                r_val, g_val, b_val, a_val = 0, 0, 0, 0

            row.extend([r_val, g_val, b_val, a_val])
        pixels.append(bytes(row))

    raw_data = b''.join(pixels)

    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG 文件头
    signature = b'\x89PNG\r\n\x1a\n'
    # IHDR: 宽, 高, 位深, 颜色类型(RGBA), 压缩, 滤镜, 隔行
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)
    # IDAT
    idat = make_chunk(b'IDAT', zlib.compress(raw_data))
    # IEND
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def save_png(path, png_data):
    """保存 PNG 文件"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'  [OK] {path} ({len(png_data):,} bytes)')


def main():
    # 解析 --dir 参数
    base_dir = ''
    args = sys.argv[1:]
    if '--dir' in args:
        idx = args.index('--dir')
        if idx + 1 < len(args):
            base_dir = args[idx + 1]
            if not base_dir.endswith(os.sep):
                base_dir += os.sep

    print('OutGO — 图标生成器')
    print('=' * 50)

    # ========== PWA 图标 ==========
    print('\n[PWA 图标]')
    pwa_dir = os.path.join(base_dir, 'assets', 'icons')
    for size in PWA_SIZES:
        png_data = create_png(size, size, mode='full')
        path = os.path.join(pwa_dir, f'icon-{size}.png')
        save_png(path, png_data)

    # 同时输出到 www/assets/icons/
    www_pwa_dir = os.path.join(base_dir, 'www', 'assets', 'icons')
    if os.path.exists(os.path.join(base_dir, 'www')):
        for size in PWA_SIZES:
            png_data = create_png(size, size, mode='full')
            path = os.path.join(www_pwa_dir, f'icon-{size}.png')
            save_png(path, png_data)

    # ========== Android 自适应图标 ==========
    android_res = os.path.join(base_dir, 'android', 'app', 'src', 'main', 'res')
    if os.path.exists(android_res):
        print('\n[Android 自适应图标]')

        for density, size in ANDROID_DENSITIES.items():
            mipmap_dir = os.path.join(android_res, f'mipmap-{density}')

            # ic_launcher_foreground.png — 透明背景，用于自适应图标
            fg_data = create_png(size, size, mode='foreground')
            save_png(os.path.join(mipmap_dir, 'ic_launcher_foreground.png'), fg_data)

            # ic_launcher.png — 完整图标（旧设备兼容）
            full_data = create_png(size, size, mode='full')
            save_png(os.path.join(mipmap_dir, 'ic_launcher.png'), full_data)

            # ic_launcher_round.png — 圆形图标
            save_png(os.path.join(mipmap_dir, 'ic_launcher_round.png'), full_data)

        print('\n  自适应图标背景色请确认为 #5B9BD5：')
        print(f'  {os.path.join(android_res, "values", "ic_launcher_background.xml")}')
    else:
        print('\n[Android] android/ 目录不存在，跳过 Android 图标生成')

    print('\n' + '=' * 50)
    print('图标生成完毕！')
    print('\n未来可用 AI 生成图标：')
    print('  将 1024x1024 PNG 放到 assets/source-icon.png')
    print('  然后修改本脚本读取该文件进行缩放即可')


if __name__ == '__main__':
    main()
