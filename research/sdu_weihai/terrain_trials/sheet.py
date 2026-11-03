"""Contact sheet of a video: one frame every `step` seconds, labelled with its time.

Usage: python sheet.py video.mp4 out.jpg [step_s] [cols] [t0] [t1]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main(video, out, step=2.0, cols=8, t0=0.0, t1=None):
    with tempfile.TemporaryDirectory() as d:
        args = ['ffmpeg', '-v', 'error', '-ss', str(t0)] + (['-to', str(t1)] if t1 else []) + ['-i', video, '-vf', f'fps=1/{step},scale=320:-1', f'{d}/f%04d.jpg']
        subprocess.run(args, check=True)
        fs = sorted(Path(d).glob('f*.jpg'))
        ims = [Image.open(f).convert('RGB') for f in fs]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (w * cols, h * rows))
    dr = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('arial.ttf', 18)
    for i, im in enumerate(ims):
        x, y = i % cols * w, i // cols * h
        sheet.paste(im, (x, y))
        dr.text((x + 4, y + 2), f'{t0 + i * step:.0f}s', fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    sheet.save(out, quality=85)
    print('SHEET', out, len(ims), 'frames', sheet.size)


if __name__ == '__main__':
    a = sys.argv
    main(a[1], a[2], float(a[3]) if len(a) > 3 else 2.0, int(a[4]) if len(a) > 4 else 8,
         float(a[5]) if len(a) > 5 else 0.0, float(a[6]) if len(a) > 6 else None)
