"""Open umbrella: a closed thin canopy and separate ribs below the fabric."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import *

P={'radius':.60,'height':.99,'canopy_h':.30,'canopy_t':.025,
   'rib_r':.013,'rib_clearance':.006,'rib_count':8,'shaft_r':.016,
   'shaft_bottom':-.12,'handle_r':.027,'handle_h':.13,'handle_y':-.035,
   'hub_r':.022,'hub_shaft_overlap':.012,'hub_fabric_overlap':.006,
   'tie_r':.006,'tie_fabric_overlap':.005,'tie_fractions':(.50,.94)}

def build():
    reset()
    shaft_top=P['height']-P['canopy_t']-P['shaft_r']*P['canopy_h']/P['radius']-P['rib_clearance']
    cylinder('shaft',P['shaft_r'],shaft_top-P['shaft_bottom'],
             (0,(shaft_top+P['shaft_bottom'])/2,0),'metal')
    cylinder('handle',P['handle_r'],P['handle_h'],(0,P['handle_y'],0),'wood')
    n=CIRCLE_SEGMENTS;vertices=[]
    for drop in (0,P['canopy_t']):
        vertices.append((0,P['height']-drop,0))
        vertices.extend((P['radius']*cos(i*2*pi/n),P['height']-P['canopy_h']-drop,
                         P['radius']*sin(i*2*pi/n)) for i in range(n))
    faces=[]
    for i in range(n):
        a,b=1+i,1+(i+1)%n
        faces.extend([(0,a,b),(n+1,b+n+1,a+n+1),(a,a+n+1,b+n+1,b)])
    mesh('canopy_shell',vertices,faces,'fabric')
    drop=P['canopy_t']+P['rib_r']*(1+(P['canopy_h']/P['radius'])**2)**.5+P['rib_clearance']
    # Small fittings join the shell to the ribs without burying the long ribs.
    hub_low=shaft_top-P['hub_shaft_overlap']
    hub_high=P['height']-P['canopy_t']+P['hub_fabric_overlap']
    cylinder('hub',P['hub_r'],hub_high-hub_low,(0,(hub_low+hub_high)/2,0),'metal_dark')
    for i in range(P['rib_count']):
        a=i*2*pi/P['rib_count']
        bar('rib',(0,P['height']-drop,0),
            (P['radius']*cos(a),P['height']-P['canopy_h']-drop,P['radius']*sin(a)),P['rib_r'],'metal_dark')
        for fraction in P['tie_fractions']:
            radius=P['radius']*fraction
            x,z=radius*cos(a),radius*sin(a)
            rib_y=P['height']-drop-P['canopy_h']*fraction
            fabric_y=P['height']-P['canopy_t']-P['canopy_h']*fraction
            bar('fabric_tie',(x,rib_y,z),
                (x,fabric_y+P['tie_fabric_overlap'],z),P['tie_r'],'fabric')
    export('held_umbrella_open')

if __name__=='__main__':
    build()
    from model_contacts import apply
    apply(Path(__file__).resolve().parents[1]/'models/held_umbrella_open.glb')
