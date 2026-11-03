"""Static geometry, normals, topology and deterministic rebuild evidence for the supplied assets.

python godot/modeling/verify_supply.py --snapshot <temp.json>
<rebuild with Blender>
python godot/modeling/verify_supply.py --compare <temp.json>

check_model.py remains the normative compliance check. This adds normals/volume checks and
writes the full unabridged compliance report for each model and the whole batch.
"""
import argparse
import contextlib
import hashlib
import io
import json
import math
from pathlib import Path
import check_model as checker

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / 'supply_catalog.json'
OUTPUT = ROOT / 'review' / 'supply'


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def geometry(path):
    g,b = checker.read_glb(path)
    slots=sorted(m['name'] for m in g['materials'])
    bad=[]
    triangles=0
    for mesh in g['meshes']:
        volume=0
        is_flat=True
        for primitive in mesh['primitives']:
            slot=g['materials'][primitive['material']]['name']
            is_flat &= slot in checker.FLAT_SLOTS
            p=checker.accessor(g,b,primitive['attributes']['POSITION'])
            normals=checker.accessor(g,b,primitive['attributes']['NORMAL'])
            ids=[x[0] for x in checker.accessor(g,b,primitive['indices'])]
            if not all(math.isfinite(v) for row in p+normals for v in row):
                bad.append(mesh['name']+': non-finite data')
            for i in range(0,len(ids),3):
                ia,ib,ic=ids[i:i+3]
                a,bb,c=p[ia],p[ib],p[ic]
                face=cross([bb[k]-a[k] for k in range(3)],[c[k]-a[k] for k in range(3)])
                area2=dot(face,face)
                if area2 < 1e-20:
                    bad.append(mesh['name']+': degenerate face')
                elif dot(face,[normals[ia][k]+normals[ib][k]+normals[ic][k] for k in range(3)]) <= 0:
                    bad.append(mesh['name']+': normal disagrees with winding')
                volume+=dot(a,cross(bb,c))/6
            triangles+=len(ids)//3
        if not is_flat and volume<=1e-10:
            bad.append(mesh['name']+': nonpositive solid volume')
    return dict(slots=slots,triangles=triangles,mesh_count=len(g['meshes']),errors=bad)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--snapshot',type=Path)
    parser.add_argument('--compare',type=Path)
    args=parser.parse_args()
    catalog=json.loads(CATALOG.read_text(encoding='utf-8'))
    paths={e['name']:ROOT.parent/'models'/(e['name']+'.glb') for e in catalog}
    hashes={name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in paths.items()}
    if args.snapshot:
        args.snapshot.write_text(json.dumps(hashes,indent=2),encoding='utf-8')
        print('SNAPSHOT',len(hashes))
        return
    previous=json.loads(args.compare.read_text(encoding='utf-8')) if args.compare else None
    (OUTPUT/'assets').mkdir(parents=True,exist_ok=True)
    all_reports=[]
    measurements=[]
    for entry in catalog:
        name=entry['name']
        path=paths[name]
        capture=io.StringIO()
        with contextlib.redirect_stdout(capture):
            code=checker.main([str(path)])
        fails,warns,info=checker.check(path)
        shape=geometry(path)
        if code or shape['errors']:
            raise RuntimeError(name+': '+str(fails+shape['errors']))
        if previous is not None and previous.get(name)!=hashes[name]:
            raise RuntimeError(name+': rebuild SHA-256 mismatch')
        # Parse the checker's measured bounds; no duplicated size constants in the catalog.
        dims=[float(info[0].split()[i]) for i in (2,4,6)]
        report=capture.getvalue()
        report+='   EXTRA: outward volume and normal/winding consistency PASS\n'
        report+='   SHA256 '+hashes[name]+'\n'
        report+='   REBUILD '+('IDENTICAL' if previous else 'NOT CHECKED')+'\n'
        (OUTPUT/'assets'/(name+'.txt')).write_text(report,encoding='utf-8')
        all_reports.append(report)
        if entry['group']=='buildings':
            origin='正面墙脚中点；正面墙 z=0，主体向 -Z 延伸。'
        elif name=='path_curve':
            origin='弧段中心线中点的地面投影，详见下方拼接坐标。'
        elif name in ('street_lamp','park_lamp','bus_stop_sign'):
            origin='杆底中心。'
        else:
            origin='底部接触平面中心；立面和屋顶配件由场景另给安装高度。'
        note=entry['notes'] or '简化的封闭块体，无纹理。'
        text=f'''# {entry['label']} · `{name}`

![Godot 实拍](../images/{name}.png)

- 模型：[GLB](../../../../models/{name}.glb)
- 重建脚本：[build_{name}.py](../../../build_{name}.py)；尺寸在开头 `P` 中。
- 依赖：[model_geometry.py](../../../model_geometry.py)'''
        if entry['group']=='buildings':
            text+='、[building_geometry.py](../../../building_geometry.py)'
        if entry['group']=='vehicles':
            text+='、[vehicle_geometry.py](../../../vehicle_geometry.py)'
        text+=f'''
- 实测尺寸：X 宽 **{dims[0]:g}** × Z 深 **{dims[2]:g}** × Y 高 **{dims[1]:g}** 米。
- 色槽：{', '.join('`'+s+'`' for s in shape['slots'])}。
- 原点：{origin} +Y 向上，正面/车头/使用面朝 +Z。
- 几何：{shape['triangles']} 三角面，{shape['mesh_count']} 个封闭零件或规范允许的贴花片。
- 设计：{note}
- 交互参考：{entry['interaction'] or '无预埋交互节点；由类型库以后标注。'}
- 来源：本项目原创脚本基本体建模；未使用第三方模型、纹理或生成服务。
- 检查：PASS；{len(warns)} WARN。{'无警告。' if not warns else ' / '.join(warns)}
- 复现：{'完整重跑后 GLB SHA-256 逐字节相同。' if previous else '尚未对拍。'}

完整检查输出（同时保存为 [{name}.txt]({name}.txt)）：

```text
{report.rstrip()}
```
'''
        (OUTPUT/'assets'/(name+'.md')).write_text(text,encoding='utf-8')
        measurements.append(dict(**entry,dimensions_xyz=dims,**shape,sha256=hashes[name],warnings=warns,rebuild_identical=previous is not None))
    (OUTPUT/'check_model.txt').write_text('\n'.join(all_reports),encoding='utf-8')
    (OUTPUT/'measurements.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2),encoding='utf-8')
    print('SUPPLY_VERIFY_OK',len(catalog),'WARN',sum(len(m['warnings']) for m in measurements),'REBUILD',bool(previous))


if __name__=='__main__':
    main()
