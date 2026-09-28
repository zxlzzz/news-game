"""Assemble review sheets from Blender renders. Python + Pillow."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).resolve().parent
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22)
def text(draw,xy,value):draw.text(xy,value,font=FONT,fill='black')
def grid(items,path,columns=3,size=400):
 rows=(len(items)+columns-1)//columns;canvas=Image.new('RGB',(columns*size,rows*(size+38)),(215,215,215));draw=ImageDraw.Draw(canvas)
 for i,(file,label) in enumerate(items):
  x=i%columns*size;y=i//columns*(size+38);canvas.paste(Image.open(P/file).convert('RGB').resize((size,size)),(x,y));text(draw,(x+10,y+size+3),label)
 canvas.save(P/path)
grid([('rest_side.png','侧面'),('rest_top.png','正上方'),('rest_game.png','游戏角度 35° / 38°')],'review_sheet.png')
grid([(f'test_{name}.png',label) for name,label in [('sit','坐下'),('sphinx','趴下'),('side_lie','侧躺 90°'),('hind_leg_lift','抬左后腿'),('sniff_left45','嗅地 + 左转 45°'),('tail_high','尾巴高举'),('tail_down','尾巴下垂')]],'extreme_review.png',4)
actions=json.loads((P/'conversion_report.json').read_text())['actions'];canvas=Image.new('RGB',(1200,6*335),(215,215,215));draw=ImageDraw.Draw(canvas)
for i,a in enumerate(actions):
 x=i%2*600;y=i//2*335
 for j,prefix in enumerate(['source_','action_']):canvas.paste(Image.open(P/(prefix+a['name']+'.png')).convert('RGB').resize((300,300)),(x+j*300,y))
 text(draw,(x+8,y+302),a['name']+'   原版 | 转换')
 # Individual full-size side-by-side comparison, same camera and frame.
 panel=Image.new('RGB',(1600,840),(215,215,215));pd=ImageDraw.Draw(panel)
 for j,prefix in enumerate(['source_','action_']):panel.paste(Image.open(P/(prefix+a['name']+'.png')),(j*800,0))
 text(pd,(20,807),a['name']+' 原版');text(pd,(820,807),'转换后');panel.save(P/('compare_'+a['name']+'.png'))
canvas.save(P/'action_comparison.png')
size=Image.new('RGB',(800,845),(215,215,215));size.paste(Image.open(P/'size_comparison.png'),(0,0));text(ImageDraw.Draw(size),(25,807),'Husky 肩高 0.55 m  /  竖条高 1.74 m');size.save(P/'size_review.png')
