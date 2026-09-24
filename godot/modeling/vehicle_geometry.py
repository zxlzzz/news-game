"""Vehicle construction, dimensions supplied by each asset's build script."""
from model_geometry import *


def side_prism(name, profile, thickness, x, slot):
    n=len(profile)
    vertices=[(x+dx,y,z) for dx in (-thickness/2,thickness/2) for z,y in profile]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vertices,faces,slot)


def loft(name, sections, slot):
    """Each station: z and an identical-length clockwise XY section."""
    n=len(sections[0][1])
    verts=[(x,y,z) for z,section in sections for x,y in section]
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(sections)-1)*n,len(sections)*n))]
    for j in range(len(sections)-1):
        for i in range(n):
            k=(i+1)%n
            faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    return mesh(name,verts,faces,slot)


def build_car(p):
    w,l=p['width'],p['length']
    def rect(width,bottom,top):
        return [(-width/2,bottom),(width/2,bottom),(width/2,top),(-width/2,top)]
    loft('body',[(z,rect(bw,p['body_bottom'],top)) for z,bw,top in p['body_stations']],'metal')
    sections=[]
    for z,cw,top in p['cabin_stations']:
        r=min(p['roof_round'],(top-p['belt_y'])/2)
        sections.append((z,[(-cw/2,p['belt_y']),(cw/2,p['belt_y']),
            (cw/2,top-r),(cw/2-r*.134,top-r*.5),(cw/2-r*.5,top-r*.134),(cw/2-r,top),
            (-cw/2+r,top),(-cw/2+r*.5,top-r*.134),(-cw/2+r*.134,top-r*.5),(-cw/2,top-r)]))
    loft('cabin',sections,'metal')
    for x in (-w/2,w/2):
        for z in p['axles_z']:
            cylinder('tire',p['wheel_r'],p['wheel_t'],(x,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
            cylinder('hub',p['hub_r'],p['wheel_t']+p['hub_out'],(x,p['wheel_r'],z),'metal',axis=(1,0,0))
        for profile in p['side_windows']:
            side_prism('side_window',profile,p['pane_t'],x*p['cabin_stations'][1][1]/w,'window')
    # Derive panes from the actual cabin slope, so they cannot float like spoilers.
    for name,i,j in [('windshield',2,3),('rear_window',0,1)]:
        za,_,ya=p['cabin_stations'][i]
        zb,_,yb=p['cabin_stations'][j]
        ta,tb=p['glass_inset_fractions']
        z0,z1=za+(zb-za)*ta,za+(zb-za)*tb
        y0,y1=ya+(yb-ya)*ta,ya+(yb-ya)*tb
        normal=Vector((0,z1-z0,y0-y1)).normalized()
        w=p['glass_width']/2
        surface=[(-w,y0,z0),(w,y0,z0),(w,y1,z1),(-w,y1,z1)]
        vertices=[Vector(v)+normal*offset for offset in (p['glass_lift'],p['glass_lift']+p['pane_t']) for v in surface]
        mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'window')
    for z in (-l/2,l/2):
        box('bumper',(w*.88,p['bumper_h'],p['bumper_t']),(0,p['bumper_y'],z),'metal_dark')
        for x in (-w*.32,w*.32):
            box('head_or_tail_lamp',p['lamp_size'],(x,p['lamp_y'],z),'accent' if z>0 else 'trim_dark')
    if p['taxi']:
        box('taxi_roof_sign',p['taxi_sign'],(0,p['height']+p['taxi_sign'][1]/2,p['taxi_sign_z']),'accent')


def build_two_wheeler(p):
    for z in (-p['wheelbase']/2,p['wheelbase']/2):
        ring('tire',p['wheel_r'],p['wheel_r']-p['tire_wall'],p['tire_t'],(0,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
        cylinder('hub',p['hub_r'],p['tire_t'],(0,p['wheel_r'],z),'metal',axis=(1,0,0))
        from math import sin,cos,pi
        for angle in (0,pi/3,2*pi/3):
            a=(0,p['wheel_r']+cos(angle)*(p['wheel_r']-p['tire_wall']),z+sin(angle)*(p['wheel_r']-p['tire_wall']))
            b=(0,p['wheel_r']-cos(angle)*(p['wheel_r']-p['tire_wall']),z-sin(angle)*(p['wheel_r']-p['tire_wall']))
            bar('wheel_spoke',a,b,p['spoke_r'],'metal')
    for a,b in p['frame_segments']:
        bar('frame',a,b,p['frame_r'],'metal')
    box('saddle',p['seat_size'],p['seat_center'],'metal_dark')
    bar('handlebar',(-p['handle_w']/2,p['handle_y'],p['handle_z']),
        (p['handle_w']/2,p['handle_y'],p['handle_z']),p['handle_r'],'metal_dark')
    if p['motor']:
        box('battery_body',p['body_size'],p['body_center'],'metal')
        box('front_fairing',p['fairing_size'],p['fairing_center'],'metal')
        cylinder('headlamp',p['headlamp_r'],p['headlamp_t'],p['headlamp_center'],'accent',axis=(0,0,1))
    else:
        bar('crank',(-p['crank_w']/2,p['crank_y'],0),(p['crank_w']/2,p['crank_y'],0),p['frame_r'],'metal_dark')
        for sign in (-1,1):
            box('pedal',p['pedal_size'],(sign*p['crank_w']/2,p['crank_y'],0),'metal_dark')
