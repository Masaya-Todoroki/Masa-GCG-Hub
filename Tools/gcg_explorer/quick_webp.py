"""Explorer quick converter: PNG files or directories -> WebP beside originals."""
import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description='Convert PNG files to WebP (quality 90).')
    parser.add_argument('paths', nargs='+', help='PNG files or directories')
    parser.add_argument('--quality', type=int, default=90)
    parser.add_argument('--recursive', action='store_true', help='Include subfolders')
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error('quality must be between 1 and 100')
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print('Pillow is missing. Install with: python -m pip install pillow')
        input('Press Enter to close...')
        return 1
    paths = []
    for item in args.paths:
        path = Path(item)
        if path.is_dir():
            paths.extend((path.rglob('*.png') if args.recursive else path.glob('*.png')))
            paths.extend((path.rglob('*.PNG') if args.recursive else path.glob('*.PNG')))
        elif path.is_file() and path.suffix.lower() == '.png':
            paths.append(path)
    seen = set()
    converted = skipped = failed = 0
    for src in paths:
        key = str(src.resolve()).casefold()
        if key in seen:
            continue
        seen.add(key)
        dst = src.with_suffix('.webp')
        if dst.exists():
            print(f'SKIP (exists): {dst}')
            skipped += 1
            continue
        try:
            with Image.open(src) as image:
                image = ImageOps.exif_transpose(image)
                if image.mode not in ('RGB', 'RGBA'):
                    image = image.convert('RGBA' if 'transparency' in image.info or image.mode in ('LA', 'PA') else 'RGB')
                image.save(dst, format='WEBP', quality=args.quality)
            print(f'OK: {src.name} -> {dst.name}')
            converted += 1
        except Exception as exc:
            print(f'ERROR: {src}: {exc}')
            failed += 1
    print(f'\nFinished: {converted} converted, {skipped} skipped, {failed} failed.')
    if not paths:
        print('No PNG files found.')
    input('Press Enter to close...')
    return 1 if failed else 0

if __name__ == '__main__':
    sys.exit(main())
