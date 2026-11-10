"""
Dev-only: write the /board background art (docs/archived/BOARD_APP_PLAN.md, Rendering).

Scales docs/map-board-full.jpg to half the board's coordinate size and saves it as WebP at
src/board/assets/map-board.webp. The board SVG uses 6660x4173 board-pixel coordinates;
the <image> element stretches this file over the full viewBox.

Never bundled. Requires: Pillow
  python -m pip install Pillow
  python scripts/make-board-webp.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs' / 'map-board-full.jpg'
TARGET = ROOT / 'src' / 'board' / 'assets' / 'map-board.webp'
SIZE = (3330, 2086)
QUALITY = 82


def main() -> None:
    image = Image.open(SOURCE).convert('RGB')
    scaled = image.resize(SIZE, Image.Resampling.LANCZOS)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    scaled.save(TARGET, 'WEBP', quality=QUALITY, method=6)
    print(f'Wrote {TARGET.relative_to(ROOT)} ({SIZE[0]}x{SIZE[1]}, {TARGET.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
