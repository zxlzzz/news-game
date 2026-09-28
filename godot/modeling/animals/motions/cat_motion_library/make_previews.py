"""Python + Pillow: animated review gallery and phase sheets from Blender renders."""
from pathlib import Path
import json,html
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
SMALL=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
data=json.loads((P/'motion_report.json').read_text(encoding='utf-8'));specs=data['clips']
(P/'previews').mkdir(exist_ok=True);(P/'sheets').mkdir(exist_ok=True)
def preview_frame(name,view,k):
 path=P/'frames'/f'{name}__{view}__{k:02}.png'
 if path.exists():return Image.open(path)
 # Partial re-renders retain already accepted previews of unchanged clips.
 with Image.open(P/'previews'/f'{name}.gif') as movie:
  movie.seek(k if k<movie.n_frames else 0)
  x=0 if view=='side' else 400
  return movie.convert('RGB').crop((x,0,x+400,400))

gallery=[]
for spec in specs:
 name=spec['name'];frames=[]
 if not (P/'frames'/f'{name}__side__00.png').exists():
  assert (P/'previews'/f'{name}.gif').exists() and (P/'sheets'/f'{name}.png').exists()
  gallery.append({'name':name,'label':spec['label'],'seconds':spec['seconds'],'loop':spec['loop']});continue
 for k in range(25):
  frame=Image.new('RGB',(800,436),(214,214,214))
  for j,view in enumerate(['side','game']):frame.paste(preview_frame(name,view,k),(j*400,0))
  ImageDraw.Draw(frame).text((12,405),spec['label']+f" | {k/24*spec['seconds']:.2f} s / {spec['seconds']:g} s",font=FONT,fill='black');frames.append(frame)
 durations=[round(spec['seconds']*1000/24)]*(24 if spec['loop'] else 25)
 if not spec['loop']:durations[-1]=700
 selected=frames[:-1] if spec['loop'] else frames
 selected[0].save(P/'previews'/f'{name}.gif',save_all=True,append_images=selected[1:],loop=0,duration=durations,optimize=False,disposal=2)
 sheet=Image.new('RGB',(1200,445),(214,214,214));draw=ImageDraw.Draw(sheet)
 for i,k in enumerate([0,5,10,14,19,24]):
  for j,view in enumerate(['side','game']):sheet.paste(preview_frame(name,view,k).resize((200,200)),(i*200,j*220))
  draw.text((i*200+8,200),f'{k/24*spec["seconds"]:.2f}s',font=SMALL,fill='black')
 sheet.save(P/'sheets'/f'{name}.png')
 gallery.append({'name':name,'label':spec['label'],'seconds':spec['seconds'],'loop':spec['loop']})
for start in range(0,len(specs),8):
 sheet=Image.new('RGB',(1080,8*196),(214,214,214));draw=ImageDraw.Draw(sheet)
 for row,spec in enumerate(specs[start:start+8]):
  y=row*196;draw.text((10,y+2),spec['name']+' · '+spec['label'],font=SMALL,fill='black')
  for col,k in enumerate([0,5,10,14,19,24]):sheet.paste(preview_frame(spec['name'],'game',k).resize((180,170)),(col*180,y+25))
 sheet.save(P/f'overview_{start//8+1:02}.png')
page='''<!doctype html><meta charset="utf-8"><title>cat 动作库</title><style>body{margin:30px auto;max-width:1100px;background:#ececec;color:#222;font:16px system-ui}button{padding:8px 12px;border:1px solid #bbb;border-radius:8px;margin:4px;cursor:pointer}button.active{background:#222;color:white}img{width:100%;max-width:1000px}#tabs{max-height:230px;overflow:auto}small{color:#555}h1{font-size:26px}</style><h1>cat 动作库</h1><p>左：侧面；右：游戏角度。点名称播放。过渡片段播完后重置重放；重置跳变不属于动画。</p><p><a href="sit_comparison.png">猫坐姿返工前后对比</a></p><div id="tabs"></div><h2 id="name"></h2><img id="movie"><p id="meta"></p><a id="sheet" target="_blank">查看六阶段姿势图</a><script>const clips='''+json.dumps(gallery,ensure_ascii=False)+''';const tabs=document.querySelector('#tabs');function show(i){let c=clips[i];document.querySelector('#movie').src='previews/'+c.name+'.gif';document.querySelector('#name').textContent=c.label+' · '+c.name;document.querySelector('#meta').textContent=c.seconds+' 秒 · '+(c.loop?'循环':'单次 / 过渡')+' · 30 fps';document.querySelector('#sheet').href='sheets/'+c.name+'.png';[...tabs.children].forEach((b,j)=>b.classList.toggle('active',i===j))}clips.forEach((c,i)=>{let b=document.createElement('button');b.textContent=c.label;b.onclick=()=>show(i);tabs.append(b)});show(Math.max(0,clips.findIndex(c=>c.name===new URLSearchParams(location.search).get('clip'))))</script>'''
import hashlib
version=hashlib.sha256((P.parents[3]/'models/animal_cat.glb').read_bytes()+(P/'make_previews.py').read_bytes()).hexdigest()[:12]
page=page.replace(".gif';",".gif?v="+version+"';").replace(".png';",".png?v="+version+"';")
(P/'review.html').write_text(page,encoding='utf-8')
print('PREVIEWS',len(specs))
