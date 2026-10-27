#!/usr/bin/env python3
"""
Draws every app icon, splash and favicon from the one mark, brand/mark.svg, for the app and the
website. Approved by Shaun on 2026-10-27 (the preview of 2026-10-26).

    python3 scripts/brand-assets.py

Needs rsvg-convert (brew install librsvg) and Pillow. Change the mark in brand/mark.svg (and its
twin in mobile/src/components/Logo.tsx), then run this; commit what it writes.

Light: the receipt in its teal print on cream paper, on a cream tile. Dark (iOS 18's dark icons,
the dark splash): the app's dark palette, lighter teal on near-black, as Logo.tsx draws it.
"""
import io
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MARK = (ROOT / 'brand' / 'mark.svg').read_text()
APP = ROOT / 'mobile' / 'assets'
PUBLIC = ROOT / 'public'
WEB_APP = ROOT / 'app'

CREAM = '#F2EFEA'
NIGHT = '#0E1110'
# The mark's own colours, and their dark-mode counterparts (mobile/src/components/Logo.tsx).
PAPER, PRINT, TICK = '#F2EFEA', '#04756F', '#2C9A6E'
DARK = {PAPER: '#1B1F1E', PRINT: '#3FB8A8', TICK: '#54C98F'}
GREY = {PAPER: '#FFFFFF', PRINT: '#8A8A8A', TICK: '#5E5E5E'}
WHITE = {PAPER: '#00000000', PRINT: '#FFFFFF', TICK: '#FFFFFF'}

# The mark's drawn bounds in its 512 box, its stroke included.
X0, X1, Y0, Y1 = 40, 472, 12, 474


def body(colours=None):
    """The mark's paths, recoloured."""
    inner = re.search(r'<svg[^>]*>(.*)</svg>', MARK, re.S).group(1)
    inner = re.sub(r'<!--.*?-->', '', inner, flags=re.S)
    for old, new in (colours or {}).items():
        inner = inner.replace(old, new)
    return inner


def icon(size, height, colours=None, background=None, radius=0):
    """An SVG of the mark, `height` of the canvas tall and centred on it."""
    scale = size * height / (Y1 - Y0)
    tx = size / 2 - scale * (X0 + X1) / 2
    ty = size / 2 - scale * (Y0 + Y1) / 2
    bg = f'<rect width="{size}" height="{size}" rx="{radius}" fill="{background}"/>' if background else ''
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" fill="none" xmlns="http://www.w3.org/2000/svg">'
        f'{bg}<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">{body(colours)}</g></svg>'
    )


def render(svg):
    png = subprocess.run(['rsvg-convert', '--format', 'png'], input=svg.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGBA')


def save(image, path, opaque=False, **options):
    if opaque:
        # App Store Connect rejects an icon with an alpha channel.
        image = image.convert('RGB')
    image.save(path, optimize=True, **options)
    print(path.relative_to(ROOT), image.size)


def app():
    # iOS: the light icon is opaque and square (iOS rounds it). Dark and tinted are the glyph
    # alone: iOS 18 puts its own background behind them, and tints the grey.
    save(render(icon(1024, 0.62, background=CREAM)), APP / 'icon.png', opaque=True)
    save(render(icon(1024, 0.62, DARK)), APP / 'icon-dark.png')
    save(render(icon(1024, 0.62, GREY)), APP / 'icon-tinted.png')

    # Android: 108dp layers, of which a launcher may show only the middle 66dp circle, so the mark
    # sits well inside it (app.config.ts sets the cream behind). Monochrome is for themed icons.
    save(render(icon(1024, 0.46)), APP / 'adaptive-icon.png')
    save(render(icon(1024, 0.46, WHITE)), APP / 'adaptive-icon-monochrome.png')

    # The splash is the glyph alone on the theme's background, with room for Android 12's crop.
    save(render(icon(1024, 0.7)), APP / 'splash-icon.png')
    save(render(icon(1024, 0.7, DARK)), APP / 'splash-icon-dark.png')
    save(render(icon(48, 0.7, background=CREAM, radius=10.8)), APP / 'favicon.png')
    # Android draws a notification's small icon as a white silhouette.
    save(render(icon(96, 0.8, WHITE)), APP / 'notification-icon.png')

    # Google Play's 512px listing icon.
    store = ROOT / 'mobile' / 'store'
    store.mkdir(exist_ok=True)
    save(render(icon(512, 0.62, background=CREAM)), store / 'play-icon.png', opaque=True)


def website():
    # Next's file conventions (app/icon.png, app/apple-icon.png, app/favicon.ico) write the links.
    save(render(icon(512, 0.84)), WEB_APP / 'icon.png')
    # iOS rounds the touch icon itself, and fills transparency with black: an opaque cream tile.
    save(render(icon(180, 0.62, background=CREAM)), WEB_APP / 'apple-icon.png', opaque=True)
    tile = render(icon(256, 0.86))
    save(tile, WEB_APP / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    # The manifest's icons, and the logo the pages and emails use.
    save(render(icon(512, 0.9)), PUBLIC / 'logo.png')
    save(render(icon(128, 0.9)), PUBLIC / 'logo-mark.png')
    # Maskable: the mark keeps inside the 80% safe circle.
    save(render(icon(512, 0.5, background=CREAM)), PUBLIC / 'icon-maskable.png', opaque=True)


if __name__ == '__main__':
    app()
    website()
