"""Regenerate independent animal GIFs, contact sheets and same-camera comparisons."""
import os,subprocess,tempfile
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[2]
GODOT=os.environ.get('GODOT','D:/Godot/Godot_v4.7.2-stable_win64_console.exe')
CONFIG=json.loads((ROOT/'godot/npc/animal-actions.json').read_text())

def run(extra):
 cmd=[GODOT,'--path',str(ROOT/'godot'),'--resolution','960x640','--log-file',str(Path(tempfile.gettempdir())/'news-game-animal-capture.log'),'res://tools/animal_review.tscn','--']+extra
 result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=180)
 if result.returncode or not any(s in result.stdout for s in ['ANIMAL_CAPTURED','ANIMAL_SHOT_SAVED']):raise RuntimeError(result.stdout+result.stderr)

def record(folder,name,species,action,breed='medium'):
 target=ROOT/'delivery/animals'/folder
 every=int(CONFIG['review']['capture_every'])
 frames=int(CONFIG['review']['frames'])
 if action=='behaviour':
  every=15
  frames=round(CONFIG['review']['behaviour_duration']/CONFIG['review']['dt']/every)
 with tempfile.TemporaryDirectory() as tmp:
  run(['--species',species,'--breed',breed,'--action',action,'--capture',tmp,'--frames',str(frames),'--every',str(every)])
  images=[Image.open(p).convert('RGB').resize((480,320),Image.Resampling.LANCZOS) for p in sorted(Path(tmp).glob('*.png'))]
  pal=[im.quantize(colors=32) for im in images]
  pal[0].save(target/(name+'.gif'),save_all=True,append_images=pal[1:],duration=round(1000*CONFIG['review']['dt']*every),loop=0)
  sheet=Image.new('RGB',(1440,640))
  for i in range(6):sheet.paste(images[round(i*(len(images)-1)/5)],((i%3)*480,(i//3)*320))
  sheet.save(target/(name+'.png'))
 print(name,'recorded',flush=True)

if __name__=='__main__':
 for action in ['sit','lie','side_lie','sniff','shake','scratch','urinate','wag','wait']:record('dog',action,'dog',action)
 for action in ['sit','loaf','groom','stretch','arch','side_lie','walk','trot','jump']:record('cat',action,'cat',action)
 for species in ['dog','cat']:record('behaviour',species+'_behaviour',species,'behaviour')
 for breed in ['small','medium','large']:
  run(['--species','dog','--breed',breed,'--action','sit','--time','6','--shot',str(ROOT/'delivery/animals/dog'/(breed+'.png'))])
 for species in ['dog','cat']:
  run(['--species',species,'--breed','medium','--action','walk','--time','1','--compare','--shot',str(ROOT/'delivery/animals/cat'/(species+'_comparison.png'))])
