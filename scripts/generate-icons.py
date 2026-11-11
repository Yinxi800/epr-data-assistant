"""Generate the project's geometric report icon at Chrome and web sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="4" y="4" width="120" height="120" rx="28" fill="#284b9b"/><path d="M34 22H76L96 42V106H34Z" fill="#ffffff"/><path d="M76 22V42H96Z" fill="#adc8f5"/><path d="M46 52H82M46 68H74" stroke="#284b9b" stroke-width="8"/><path d="M46 86H82" stroke="#197c79" stroke-width="8"/></svg>'''
(root/'public/brand/epr-icon.svg').write_text(svg+'\n')
s=8
im=Image.new('RGBA',(128*s,128*s));d=ImageDraw.Draw(im)
def points(p):return [(x*s,y*s) for x,y in p]
d.rounded_rectangle((4*s,4*s,124*s,124*s),radius=28*s,fill='#284b9b')
d.polygon(points([(34,22),(76,22),(96,42),(96,106),(34,106)]),fill='white')
d.polygon(points([(76,22),(76,42),(96,42)]),fill='#adc8f5')
for y,end,color in [(52,82,'#284b9b'),(68,74,'#284b9b'),(86,82,'#197c79')]:d.rectangle((46*s,(y-4)*s,end*s,(y+4)*s),fill=color)
for size in [16,32,48,128,256,512]:
 out=im.resize((size,size),Image.Resampling.LANCZOS)
 out.save(root/f'public/brand/icon-{size}.png')
 if size<=128:out.save(root/f'extension/icons/icon-{size}.png')
