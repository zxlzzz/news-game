"""Architecture construction shared by this supply batch; dimensions come from each build script."""
from model_geometry import box, cylinder, roof_panel, prism, subtract, rotate, xyz
from math import pi, sin, cos


def window_outline(width, height, shape, p):
    if shape == 'arch':
        rise=min(width/2, height*p['arch_rise_ratio'])
        return [(-width/2,0),(width/2,0)] + [
            (width/2*cos(i*pi/p['arch_segments']), height-rise+rise*sin(i*pi/p['arch_segments']))
            for i in range(p['arch_segments']+1)]
    if shape == 'clipped':
        c=min(width,height)*p['corner_clip_ratio']
        return [(-width/2,0),(width/2,0),(width/2,height-c),(width/2-c,height),(-width/2+c,height),(-width/2,height-c)]
    return [(-width/2,0),(width/2,0),(width/2,height),(-width/2,height)]


def build_building(p):
    w,d,h = p['width'],p['depth'],p['ground_h']+(p['floors']-1)*p['floor_h']
    wall=p['wall_slot']
    body = box('sealed_masonry',(w,h,d),(0,h/2,-d/2),wall)
    openings = []
    for level in range(1,p['floors']):
        bottom = p['ground_h']+(level-1)*p['floor_h']+p['window_base']
        for x in p['window_x']:
            if p['window_shape']=='paired':
                small=(p['window_w']-p['pair_gap'])/2
                for sign in (-1,1):
                    openings.append((x+sign*(small+p['pair_gap'])/2,bottom,small,p['window_h'],'window',False,'rect'))
            else:
                openings.append((x,bottom,p['window_w'],p['window_h'],'window',False,p['window_shape']))
        if p['corner']:
            for z in p['side_window_z']:
                openings.append((z,bottom,p['window_w'],p['window_h'],'window',True,p['window_shape']))
    for x,win_w in p['shop_windows']:
        openings.append((x,p['shop_base'],win_w,p['shop_h'],'window',False,p['shop_shape']))
    openings.append((p['door_x'],0,p['door_w'],p['door_h'],'door',False,'rect'))
    if p['corner']:
        for z in p['side_window_z']:
            openings.append((z,p['shop_base'],p['window_w'],p['shop_h'],'window',True,p['shop_shape']))
    for i,(x,b,ow,oh,slot,side,shape) in enumerate(openings):
        r,t = p['recess'],p['pane_thickness']
        outline=window_outline(ow,oh,shape,p)
        for cutter,depth,z in [(True,r+p['cut_overlap'],(p['cut_overlap']-r)/2),(False,t,-r+t/2)]:
            center=(w/2+z,b,x) if side else (x,b,z)
            obj=prism('opening_%02d'%i if cutter else 'opaque_'+slot,outline,depth,(0,0,0),None if cutter else slot)
            if side: rotate(obj,90)
            obj.location=xyz(center)
            if cutter: subtract(body,obj,'recess_%02d'%i)
        # Small sill only, rather than a bright frame outlining every recess.
        if slot == 'window':
            sz,at=(ow+p['sill_extra'],p['sill_h'],p['sill_depth']),(x,b-p['sill_h']/2,0)
            if side:
                sz,at=(p['sill_depth'],p['sill_h'],ow+p['sill_extra']),(w/2,b-p['sill_h']/2,x)
            box('sill',sz,at,'trim' if p['traditional'] else 'concrete')
            upper=b>=p['ground_h']
            count=p['vertical_bars'] if upper else int(p['mullions'])
            bar_h=oh-(min(ow/2,oh*p['arch_rise_ratio']) if shape=='arch' else 0)
            for k in range(count):
                off=ow*((k+1)/(count+1)-.5)
                sz,at=(p['mullion_w'],bar_h,p['frame_depth']),(x+off,b+bar_h/2,-r/2)
                if side: sz,at=(p['frame_depth'],bar_h,p['mullion_w']),(w/2-r/2,b+bar_h/2,x-off)
                box('window_mullion',sz,at,'metal_dark')
            if upper and p['transom_ratio']:
                sz,at=(ow,p['mullion_w'],p['frame_depth']),(x,b+bar_h*p['transom_ratio'],-r/2)
                if side: sz,at=(p['frame_depth'],p['mullion_w'],ow),(w/2-r/2,b+bar_h*p['transom_ratio'],x)
                box('window_transom',sz,at,'metal_dark')
    # Rooftop deck is masonry, with a four-sided coping ring: never a full bright lid.
    pt,ph,ct = p['parapet_t'],p['parapet_h'],p['coping_h']
    for z in (-pt/2,-d+pt/2):
        box('parapet',(w,ph,pt),(0,h+ph/2,z),wall)
        box('coping',(w,ct,pt+p['coping_extra']),(0,h+ph+ct/2,z),'concrete')
    for x in (-(w-pt)/2,(w-pt)/2):
        box('side_parapet',(pt,ph,d-2*pt),(x,h+ph/2,-d/2),wall)
        box('side_coping',(pt+p['coping_extra'],ct,d-2*pt),(x,h+ph+ct/2,-d/2),'concrete')
    rw,rh,rd=p['roof_room']
    rx,rz=p['roof_room_xz']
    box('roof_stair_room',(rw,rh,rd),(rx,h+rh/2,rz),wall)
    if p['roof_kind']=='gable':
        prism('stair_room_gable',[(-rw/2,0),(rw/2,0),(0,p['roof_rise'])],rd,(rx,h+rh,rz),'concrete')
    elif p['roof_kind']=='slope':
        obj=roof_panel('stair_room_slope',rw,rd,h+rh,p['roof_rise'],ct,rz,'concrete')
        obj.location.x += rx
    elif p['roof_kind']=='tank':
        cylinder('roof_tank',p['tank_radius'],p['tank_h'],(rx,h+rh+p['tank_h']/2,rz),'metal')
    else:
        box('roof_room_cap',(rw,ct,rd),(rx,h+rh+ct/2,rz),'concrete')
    for x,z in p['roof_vents']:
        box('roof_vent',p['vent_size'],(x,h+p['vent_size'][1]/2,z),'metal')
    box('blank_shop_sign',(p['sign_w'],p['sign_h'],p['sign_t']),
        (p['sign_x'],p['sign_y'],p['sign_t']/2),'trim_dark')
    if p['canopy_w']:
        roof_panel('shop_canopy',p['canopy_w'],p['canopy_depth'],p['canopy_y'],p['canopy_rise'],p['canopy_t'],p['canopy_depth']/2,'fabric' if p['fabric_canopy'] else 'metal_dark')
    if p['traditional']:
        box('shop_cornice',(w,p['band_h'],p['band_depth']),(0,p['ground_h'],p['band_depth']/2),'concrete')
    for level,x in p['balconies']:
        sy=p['ground_h']+(level-1)*p['floor_h']+p['window_base']-p['balcony_slab_h']
        bw,bd=p['balcony_w'],p['balcony_depth']
        box('balcony_deck',(bw,p['balcony_slab_h'],bd),(x,sy,bd/2),'concrete')
        box('balcony_front',(bw,p['rail_h'],p['rail_t']),(x,sy+p['rail_h']/2,bd-p['rail_t']/2),'metal')
        for side in (-1,1):
            box('balcony_side',(p['rail_t'],p['rail_h'],bd),(x+side*(bw-p['rail_t'])/2,sy+p['rail_h']/2,bd/2),'metal')
