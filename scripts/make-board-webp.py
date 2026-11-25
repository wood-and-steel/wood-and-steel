"""
Dev-only: write the map art as WebP. Both images are drawn in 6660x4173 board-pixel
coordinates; an SVG <image> stretches the file over the full board.

  python scripts/make-board-webp.py           # the board app's art, with city names
  python scripts/make-board-webp.py --plain   # the round report's art, without names

Board: docs/map-board-full.jpg -> src/board/assets/map-board.webp (docs/archived/BOARD_APP_PLAN.md,
Rendering). Playtest only, never in production builds.

Plain: docs/map-plain-full.jpg -> src/map/assets/map-plain.webp. Ships to players in the round
report's mini maps, so it's smaller: 0.4 of board size is as sharp as the full image on a phone at
the report's tightest crop. Keep "map-board" out of its name; scripts/check-board-build.mjs
treats that string as board code.

Requires: Pillow
  python -m pip install Pillow
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

TARGETS = {
    'board': {
        'source': ROOT / 'docs' / 'map-board-full.jpg',
        'target': ROOT / 'src' / 'board' / 'assets' / 'map-board.webp',
        'size': (3330, 2086),
        'quality': 82,
    },
    'plain': {
        'source': ROOT / 'docs' / 'map-plain-full.jpg',
        'target': ROOT / 'src' / 'map' / 'assets' / 'map-plain.webp',
        'size': (2664, 1669),
        'quality': 70,
    },
}


def main() -> None:
    spec = TARGETS['plain' if '--plain' in sys.argv[1:] else 'board']
    target = spec['target']
    image = Image.open(spec['source']).convert('RGB')
    scaled = image.resize(spec['size'], Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    scaled.save(target, 'WEBP', quality=spec['quality'], method=6)
    width, height = spec['size']
    print(f'Wrote {target.relative_to(ROOT)} ({width}x{height}, {target.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
