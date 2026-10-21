"""Draw the Trustry favicon into a PNG that matches the mark in the header.

The mark is the notary's seal: a ring with a cross, in the wax red, on the
near black ground the whole interface sits on.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

APP_DIR = Path(__file__).resolve().parent.parent / "src" / "app"
APPLE_ICON = APP_DIR / "apple-icon.png"

GROUND = (7, 8, 11, 255)
WAX = (200, 69, 47, 255)
CORNER = 7 / 32  # the radius used in icon.svg, as a fraction of the size


def draw(size: int) -> Image.Image:
    scale = size / 32
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # The rounded ground, drawn at a larger size so the corners come out clean.
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size * 4 - 1, size * 4 - 1], radius=int(CORNER * size * 4), fill=255
    )
    mask = mask.resize((size, size), Image.LANCZOS)

    ground = Image.new("RGBA", (size, size), GROUND)
    image.paste(ground, (0, 0), mask)

    draw_on = ImageDraw.Draw(image)
    centre = size / 2

    # The same double ring and cross the header mark uses, drawn heavy enough
    # to still read at the size a favicon is shown.
    outer = 10 * scale
    outer_stroke = 2 * scale
    inner = 6.6 * scale
    inner_stroke = max(1, round(0.8 * scale))
    arm = 4.8 * scale
    cross_stroke = 2 * scale

    draw_on.ellipse(
        [centre - outer, centre - outer, centre + outer, centre + outer],
        outline=WAX,
        width=max(1, round(outer_stroke)),
    )
    draw_on.ellipse(
        [centre - inner, centre - inner, centre + inner, centre + inner],
        outline=(200, 69, 47, 100),
        width=inner_stroke,
    )
    draw_on.line(
        [centre, centre - arm, centre, centre + arm],
        fill=WAX,
        width=max(1, round(cross_stroke)),
    )
    draw_on.line(
        [centre - arm, centre, centre + arm, centre],
        fill=WAX,
        width=max(1, round(cross_stroke)),
    )
    return image


def main() -> None:
    # The scalable one is the icon.svg that sits next to this file, the PNGs are
    # the fallbacks for browsers that do not take an SVG favicon.
    for size, name in ((32, "icon.png"), (180, "apple-icon.png")):
        target = APP_DIR / name
        draw(size).save(target, format="PNG")
        print(f"written {target} ({size}x{size})")


if __name__ == "__main__":
    main()
