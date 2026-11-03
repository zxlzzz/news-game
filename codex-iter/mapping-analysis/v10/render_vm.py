"""Native frame image evidence and a standalone three-view review player."""
import argparse,json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from sources import HERE,J,read
EDGES=[(0,1),(1,2),(2,3),(1,4),(4,5),(0,6),(6,7),(7,8),(1,9),(9,10),(0,11),(11,12),(12,13)]
P=read(HERE/'params.json');FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
CHAINS=[('Hips','Spine1'),('Spine1','Spine2'),('Spine2','Chest'),('Chest','Neck1'),('Neck1','Head'),('Head','HeadEnd')]
for sd in ['Left','Right']:CHAINS += [('Hips',sd+'Leg'),(sd+'Leg',sd+'Shin'),(sd+'Shin',sd+'Foot'),(sd+'Foot',sd+'ToeEnd'),('Neck1',sd+'Arm'),(sd+'Arm',sd+'ForeArm'),(sd+'ForeArm',sd+'Hand'),(sd+'Hand',sd+'HandMiddle2')]
SOURCE_EDGES=[(J[a],J[b]) for a,b in CHAINS]
def panel(q,raw,angle,size=(200,240),label=''):
    w,h=size;im=Image.new('RGB',size,'#f1f2ef');d=ImageDraw.Draw(im)
    yaw,pitch=np.radians([angle,10]);right=np.array([np.cos(yaw),0,-np.sin(yaw)]);up=np.array([-np.sin(pitch)*np.sin(yaw),np.cos(pitch),-np.sin(pitch)*np.cos(yaw)]);back=np.cross(right,up)
    hip=q[J['Hips'] if raw else 0];target=np.array([hip[0],.95,hip[2]]);scale=h/2.45
    def xy(p):
        v=np.asarray(p)-target;return np.stack([w/2+v@right*scale,h/2-v@up*scale],-1)
    for axis in [0,2]:
        for value in np.arange(np.floor(hip[axis]*2)/2-3,np.floor(hip[axis]*2)/2+3.1,.5):
            a=hip.copy();b=hip.copy();a[1]=b[1]=0;a[axis]=b[axis]=value;a[2-axis]-=3;b[2-axis]+=3;d.line([tuple(xy(a)),tuple(xy(b))],fill='#c9d4cd')
    edges=SOURCE_EDGES if raw else EDGES;left={J[k] for k in J if k.startswith('Left')} if raw else {4,5,6,7,8};rs={J[k] for k in J if k.startswith('Right')} if raw else {9,10,11,12,13};projected=xy(q)
    items=[(float((q[a]+q[b])@back/2),'line',(a,b)) for a,b in edges if raw or (a,b)!=(2,3)]
    if not raw:items.append((float(q[3]@back),'head',None))
    for _,kind,ids in sorted(items):
        if kind=='head':
            x,y=projected[3];r=P['lengths']['head_radius']*scale;d.ellipse((x-r,y-r,x+r,y+r),fill='#e5e9e2',outline='#29322f',width=2);continue
        a,b=ids;color='#286293' if b in left else '#aa4c42' if b in rs else '#29322f';width=3 if raw else max(2,round(P['line_radius']*2*scale*(P['torso_line_factor'] if (a,b) in [(0,1),(1,2)] else 1)))
        d.line([tuple(projected[a]),tuple(projected[b])],fill=color,width=width)
        for j in [a,b]:
            x,y=projected[j];r=width/2;d.ellipse((x-r,y-r,x+r,y+r),fill=color)
    if raw:
        for k in ['LeftEye','RightEye','Jaw']:
            x,y=projected[J[k]];d.ellipse((x-2,y-2,x+2,y+2),fill='#54854f')
    else:
        d.line([tuple(projected[2]),tuple(projected[3])],fill='#54854f',width=1)
    d.text((5,4),label,fill='#182a23',font=FONT);return im
def sheet(s,q,frames,key,fps,path,size=(180,220)):
    w,h=size;im=Image.new('RGB',(w*6,h*len(frames)),'white')
    for row,f in enumerate(frames):
        for view,angle in enumerate([0,90,45]):
            for col,raw in enumerate([True,False]):
                arr=s if raw else q;label=f'{key} f{f} {angle}deg\n'+('SOURCE' if raw else 'V10')
                im.paste(panel(arr[f],raw,angle,size,label),(w*(view*2+col),h*row))
    im.save(path,quality=90)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='*');ap.add_argument('--keys',action='store_true');ap.add_argument('--index-only',action='store_true');args=ap.parse_args();m=read(HERE/'manifest.json');web=[]
    for row in m['clips']:
        key=row['id']
        if args.only and key not in args.only:continue
        z=np.load(HERE/'clips'/key/'comparison.npz');s=z['source'];q=z['target'];out=HERE/'review'/key;out.mkdir(parents=True,exist_ok=True);n=len(s)
        keys=np.unique(np.rint(np.linspace(0,n-1,min(8,n))).astype(int))
        if not args.index_only:sheet(s,q,keys,key,row['fps'],out/'overview.jpg')
        pages=[]
        if not args.keys:
            for i in range(0,n,8):
                frames=list(range(i,min(n,i+8)));name=f'frames-{i//8:04d}.jpg'
                if not args.index_only:sheet(s,q,frames,key,row['fps'],out/name)
                pages.append(dict(path=f'review/{key}/{name}',start=i,end=frames[-1]))
        if not args.index_only:
            data=dict(source=np.round(s,5).tolist(),target=np.round(q,5).tolist());(out/'data.js').write_text('window.CLIP_DATA='+json.dumps(data,separators=(',',':'))+';','utf-8')
        web.append(dict(**row,pages=pages));print('RENDERED',key,n,flush=True)
    if not args.only:
        notes={}
        for line in (HERE/'PROGRESS.md').read_text('utf-8').splitlines():
            if line.startswith('| '):
                fields=[x.strip() for x in line.strip('|').split('|')]
                if len(fields)==3:notes[fields[0]]=fields[1]+' — '+fields[2]
        visual=HERE/'visual-r7.json'
        if visual.exists():
            for key,row in read(visual).items():
                notes[key]='R7 · f'+', '.join(map(str,row['frames']))+' · '+row['observation']
        (HERE/'index.js').write_text('const REVIEW='+json.dumps(dict(clips=web,sourceEdges=SOURCE_EDGES,targetEdges=EDGES,joints=J,params=P,notes=notes),ensure_ascii=False,separators=(',',':'))+';','utf-8')
if __name__=='__main__':main()
