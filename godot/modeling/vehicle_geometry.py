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


def fitted_glazing(name, outline, shell, axis, sign, thickness, inset, slot='window'):
    """Clip the original pane outline onto the actual convex shell surface.

    Projection coordinates are the two axes other than the pane's outward axis.
    Subdividing on the shell faces retains its changing width and roof rounding;
    shared edges become one watertight pane, not separate overlapping plates.
    """
    bpy.context.view_layer.update()
    projection = [i for i in range(3) if i != axis]
    points = [(shell.matrix_world @ vertex.co) for vertex in shell.data.vertices]
    points = [Vector((p.x,p.z,-p.y)) for p in points]
    vertices, faces, lookup, edges = [], [], {}, {}

    def cross2(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

    def clip(polygon, boundary):
        if cross2(*boundary[:3])<0:
            boundary=list(reversed(boundary))
        for a,b in zip(boundary,boundary[1:]+boundary[:1]):
            result=[]
            for c,d in zip(polygon,polygon[1:]+polygon[:1]):
                dc,dd=cross2(a,b,c),cross2(a,b,d)
                if dc>=-1e-10:
                    result.append(c)
                if (dc>=0)!=(dd>=0):
                    t=dc/(dc-dd)
                    result.append(tuple(c[k]+t*(d[k]-c[k]) for k in range(2)))
            polygon=result
            if len(polygon)<3:
                return []
        # Boundary clipping can repeat a corner exactly or leave a collinear
        # midpoint. Remove these before matching neighbouring face edges.
        clean=[]
        for point in polygon:
            if not clean or sum((point[k]-clean[-1][k])**2 for k in range(2))>1e-18:
                clean.append(point)
        if len(clean)>1 and sum((clean[0][k]-clean[-1][k])**2 for k in range(2))<1e-18:
            clean.pop()
        changed=True
        while changed and len(clean)>3:
            changed=False
            for i in range(len(clean)):
                if abs(cross2(clean[i-1],clean[i],clean[(i+1)%len(clean)]))<1e-10:
                    clean.pop(i)
                    changed=True
                    break
        polygon=clean
        return polygon

    def index(point):
        key=tuple(round(value,10) for value in point)
        if key not in lookup:
            lookup[key]=len(vertices)
            vertices.append(tuple(point))
        return lookup[key]

    for polygon in shell.data.polygons:
        corners=[points[i] for i in polygon.vertices]
        # Current cabin prisms/lofts use convex planar faces. Clipping the
        # complete face avoids artificial diagonal seams in an unbroken pane.
        first=min(range(len(corners)),key=lambda i:tuple(corners[i]))
        corners=corners[first:]+corners[:first]
        a,b,c=corners[:3]
        normal=(b-a).cross(c-a).normalized()
        # Parallel faces have a projected line, not a glazing surface. Their
        # float32 cross-product noise must not become an enormous fake plane.
        if normal[axis]*sign<=0.01:
            continue
        assert max(abs(normal.dot(v-a)) for v in corners)<1e-6,(name,'Non-planar shell face')
        boundary=[tuple(p[k] for k in projection) for p in corners]
        clipped=clip(list(outline),boundary)
        if len(clipped)<3:
            continue
        surface=[]
        for q in clipped:
            p=Vector((0,0,0))
            for k,value in zip(projection,q):
                p[k]=value
            p[axis]=a[axis]-sum(normal[k]*(p[k]-a[k]) for k in projection)/normal[axis]
            surface.append(p)
        inner=[index(p+Vector(tuple(-sign*inset if i==axis else 0 for i in range(3)))) for p in surface]
        outer=[index(p+Vector(tuple(sign*(thickness-inset) if i==axis else 0 for i in range(3)))) for p in surface]
        for i in range(1,len(inner)-1):
            if (surface[i]-surface[0]).cross(surface[i+1]-surface[0]).length<1e-10:
                continue
            faces.append((inner[0],inner[i+1],inner[i]))
            faces.append((outer[0],outer[i],outer[i+1]))
        for i,j in zip(range(len(inner)),list(range(1,len(inner)))+[0]):
            if inner[i]==inner[j]:
                continue
            key=tuple(sorted((inner[i],inner[j])))
            edges.setdefault(key,[]).append((inner[i],inner[j],outer[j],outer[i]))
    assert faces, (name,'Glazing outline missed the shell')
    for boundary in edges.values():
        assert len(boundary)<=2, (name,'Overlapping shell faces')
        if len(boundary)==1:
            faces.append(boundary[0])
    return mesh(name,vertices,faces,slot)


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
    cabin=loft('cabin',sections,'metal')
    for x in (-w/2,w/2):
        for z in p['axles_z']:
            cylinder('tire',p['wheel_r'],p['wheel_t'],(x,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
            cylinder('hub',p['hub_r'],p['wheel_t']+p['hub_out'],(x,p['wheel_r'],z),'metal',axis=(1,0,0))
        for profile in p['side_windows']:
            fitted_glazing('side_window',[(y,z) for z,y in profile],cabin,0,
                          1 if x>0 else -1,p['pane_t'],p['glass_surface_inset'])
    # Derive panes from the actual cabin slope, so they cannot float like spoilers.
    for name,i,j in [('windshield',2,3),('rear_window',0,1)]:
        za,_,ya=p['cabin_stations'][i]
        zb,_,yb=p['cabin_stations'][j]
        ta,tb=p['glass_inset_fractions']
        z0,z1=za+(zb-za)*ta,za+(zb-za)*tb
        y0,y1=ya+(yb-ya)*ta,ya+(yb-ya)*tb
        normal=Vector((0,z1-z0,y0-y1)).normalized()
        pane_half_width=p['glass_width']/2
        surface=[(-pane_half_width,y0,z0),(pane_half_width,y0,z0),(pane_half_width,y1,z1),(-pane_half_width,y1,z1)]
        vertices=[Vector(v)+normal*offset for offset in (p['glass_lift'],p['glass_lift']+p['pane_t']) for v in surface]
        mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'window')
    for z in (-l/2,l/2):
        box('bumper',(w*.88,p['bumper_h'],p['bumper_t']),(0,p['bumper_y'],z),'metal_dark')
        for x in (-w*.32,w*.32):
            box('head_or_tail_lamp',p['lamp_size'],(x,p['lamp_y'],z),'accent' if z>0 else 'trim_dark')
    if p['taxi']:
        box('taxi_roof_sign',p['taxi_sign'],(0,p['height']+p['taxi_sign'][1]/2,p['taxi_sign_z']),'accent')


def build_two_wheeler(p):
    def group(name, center, objects):
        node=bpy.data.objects.new(name,None)
        bpy.context.collection.objects.link(node)
        node.location=xyz(center)
        bpy.context.view_layer.update()
        for obj in sorted(objects, key=lambda item: item.name):
            world=obj.matrix_world.copy()
            obj.parent=node
            obj.matrix_world=world
        return node
    crank_z=p.get('crank_z',0.0)
    axles_z=(p.get('rear_axle_z',-p['wheelbase']/2),p['wheelbase']/2)
    for z in axles_z:
        before=set(bpy.context.scene.objects)
        ring('tire',p['wheel_r'],p['wheel_r']-p['tire_wall'],p['tire_t'],(0,p['wheel_r'],z),'metal_dark',axis=(1,0,0))
        hub_width=p.get('rear_hub_width',p.get('hub_width',p['tire_t'])) if z<0 else p.get('hub_width',p['tire_t'])
        hub=cylinder('hub',p['hub_r'],hub_width,(0,p['wheel_r'],z),'metal',axis=(1,0,0))
        axle_radius=p.get('rear_wheel_axle_r',p['frame_r']) if z<0 else p['frame_r']
        # Two short fixed spindle ends sit in blind bearing seats. The central
        # hub web and full diameter spokes remain in the rotating wheel.
        assert p['tire_t']/2>p['spoke_r']+p['fork_clearance']
        for sign in (-1,1):
            inner=p['spoke_r']
            outer=hub_width/2+p['fork_clearance']
            cutter=cylinder('wheel_bearing_cut',axle_radius+p['fork_clearance'],outer-inner,
                            (sign*(inner+outer)/2,p['wheel_r'],z),None,axis=(1,0,0))
            subtract(hub,cutter,'wheel_bearing')
        from math import sin,cos,pi
        for angle in (0,pi/3,2*pi/3):
            a=(0,p['wheel_r']+cos(angle)*(p['wheel_r']-p['tire_wall']),z+sin(angle)*(p['wheel_r']-p['tire_wall']))
            b=(0,p['wheel_r']-cos(angle)*(p['wheel_r']-p['tire_wall']),z-sin(angle)*(p['wheel_r']-p['tire_wall']))
            bar('wheel_spoke',a,b,p['spoke_r'],'metal')
        group('wheel_front' if z>0 else 'wheel_rear',(0,p['wheel_r'],z),set(bpy.context.scene.objects)-before)
    fork_x=p.get('hub_width',p['tire_t'])/2+p['frame_r']+p['fork_clearance']
    axle_points=[Vector((0,p['wheel_r'],z)) for z in axles_z]
    bridges=set()
    for a,b in p['frame_segments']:
        at_axle=any((Vector(v)-axle).length<.0001 for v in (a,b) for axle in axle_points)
        if at_axle:
            # Forks straddle the complete hub. Rear bicycle stays converge only
            # after leaving the tyre, rather than remaining two parallel frames.
            axle=next(axle for axle in axle_points if any((Vector(v)-axle).length<.0001 for v in (a,b)))
            mount=Vector(b if (Vector(a)-axle).length<.0001 else a)
            if not p['motor'] and axle.z<0:
                for sign in (-1,1):
                    rear_fork_x=p.get('rear_hub_width',p.get('hub_width',p['tire_t']))/2+p['frame_r']+p['fork_clearance']
                    start=(sign*rear_fork_x,axle.y,axle.z)
                    if abs(mount.y-p['crank_y'])<.0001 and abs(mount.z-crank_z)<.0001:
                        end=(sign*p['chainstay_mount_x'],mount.y,mount.z)
                        bend=axle+(mount-axle)*p['chainstay_bend_fraction']
                        corner=(sign*rear_fork_x,bend.y,bend.z)
                        bar('frame',start,corner,p['frame_r'],'metal')
                        bar('frame',corner,end,p['frame_r'],'metal')
                    else:
                        bend=axle+(mount-axle)*p['seatstay_bend_fraction']
                        corner=(sign*rear_fork_x,bend.y,bend.z)
                        bar('frame',start,corner,p['frame_r'],'metal')
                        bar('frame',corner,mount,p['frame_r'],'metal')
                bridges.add((axle.y,axle.z))
            else:
                for sign in (-1,1):
                    bar('frame',(sign*fork_x,a[1],a[2]),(sign*fork_x,b[1],b[2]),p['frame_r'],'metal')
                bridges.update((v[1],v[2]) for v in (a,b))
        else:bar('frame',a,b,p['frame_r'],'metal')
    for y,z in sorted(bridges):
        if any(abs(y-axle.y)<.0001 and abs(z-axle.z)<.0001 for axle in axle_points):
            inner=p['spoke_r']+p['fork_clearance']
            for sign in (-1,1):
                axle_fork_x=(p.get('rear_hub_width',p.get('hub_width',p['tire_t']))/2+p['frame_r']+p['fork_clearance']) if z<0 else fork_x
                bar('fork_spindle',(sign*axle_fork_x,y,z),(sign*inner,y,z),p['frame_r'],'metal')
        else:
            bar('fork_bridge',(-fork_x,y,z),(fork_x,y,z),p['frame_r'],'metal')
    if p['motor']:
        box('saddle',p['seat_size'],p['seat_center'],'metal_dark')
    else:
        # The fixed bottom bracket surrounds a separate rotating shaft. Clear
        # the tube mounting ends as well: an outer ring alone would hide a solid
        # bridge still occupying the shaft inside it.
        for obj in list(bpy.context.scene.objects):
            if obj.type=='MESH' and obj.name.split('.')[0]=='frame':
                cutter=cylinder('crank_bore_cut',p['crank_bearing_r'],
                                p['bottom_bracket_w']+2*p['crank_bore_margin'],
                                (0,p['crank_y'],crank_z),None,axis=(1,0,0))
                subtract(obj,cutter,'crank_bearing')
        ring('bottom_bracket',p['bottom_bracket_r'],p['crank_bearing_r'],
             p['bottom_bracket_w'],(0,p['crank_y'],crank_z),'metal',axis=(1,0,0))
        bar('frame_head_tube',p['head_tube_start'],p['head_tube_end'],p['head_tube_r'],'metal')
        bar('seatpost',p['seatpost_start'],p['seatpost_end'],p['seatpost_r'],'metal')
        bar('steering_stem',p['head_tube_end'],p['steerer_top'],p['stem_r'],'metal')
        bar('handle_stem',p['steerer_top'],(0,p['handle_y'],p['handle_center_z']),p['handle_stem_r'],'metal')
        # The saddle is one continuous rounded shell, not a full-thickness box.
        # The broad rear supports the hips; the lowered narrow nose clears the thighs.
        w,h,l=p['seat_size']; x,y,z=p['seat_center']
        sections=[]
        for depth,width,drop in p['saddle_stations']:
            half=w*width/2; top=y+h/2-drop; bottom=y-h/2
            section=[(-half,top-p['saddle_round']),(-half*.64,top),
                     (half*.64,top),(half,top-p['saddle_round']),
                     (half*.90,bottom+p['saddle_lower_round']),(half*.50,bottom),
                     (-half*.50,bottom),(-half*.90,bottom+p['saddle_lower_round'])]
            sections.append((z+l*depth,[(x+sx,sy) for sx,sy in section]))
        loft('saddle',sections,'metal_dark')
    if p['motor']:
        bar('handlebar',(-p['handle_w']/2,p['handle_y'],p['handle_z']),
            (p['handle_w']/2,p['handle_y'],p['handle_z']),p['handle_r'],'metal_dark')
    else:
        # A short stem carries the centre; the bar itself sweeps back to the
        # actual grip surfaces. No disconnected point or long cantilever is used.
        center_z=p['handle_center_z']; half=p['handle_middle_w']/2
        handle=bpy.data.objects.new('handlebar',None)
        bpy.context.collection.objects.link(handle)
        handle.location=xyz((0,p['handle_y'],center_z))
        parts=[bar('handlebar_center',(-half,p['handle_y'],center_z),
                   (half,p['handle_y'],center_z),p['handle_r'],'metal_dark')]
        for sign in (-1,1):
            corner=(sign*p['handle_grip_inner_x'],p['handle_y'],p['handle_z'])
            parts.append(bar('handlebar_sweep',(sign*half,p['handle_y'],center_z),
                             corner,p['handle_r'],'metal_dark'))
            parts.append(bar('handlebar_grip',corner,
                             (sign*p['handle_w']/2,p['handle_y'],p['handle_z']),
                             p['handle_r'],'metal_dark'))
        bpy.context.view_layer.update()
        for obj in parts:
            world=obj.matrix_world.copy()
            obj.parent=handle
            obj.matrix_world=world
    if p['motor']:
        body=box('battery_body',p['body_size'],p['body_center'],'metal')
        # Preserve the case silhouette, saddle and foot supports while the
        # complete rear wheel clears a narrow, closed wheel well inside it.
        wheel_z=axles_z[0]
        cutter=cylinder('rear_wheel_well_cut',p['wheel_r']+p['fork_clearance'],
                        p['tire_t']+2*p['fork_clearance'],(0,p['wheel_r'],wheel_z),None,axis=(1,0,0))
        subtract(body,cutter,'rear_wheel_well')
        body_top=p['body_center'][1]+p['body_size'][1]/2
        seat_bottom=p['seat_center'][1]-p['seat_size'][1]/2
        assert seat_bottom>body_top,'Seat mounting space must be positive'
        box('seat_mount',(p['seat_mount_width'],seat_bottom-body_top,p['seat_mount_depth']),
            (p['seat_center'][0],(body_top+seat_bottom)/2,p['seat_center'][2]),'metal_dark')
        box('front_fairing',p['fairing_size'],p['fairing_center'],'metal')
        cylinder('headlamp',p['headlamp_r'],p['headlamp_t'],p['headlamp_center'],'accent',axis=(0,0,1))
        # Steering stem reaches the revised grip position; feet have real supports.
        bar('handle_stem',(0,p['frame_segments'][-2][1][1],p['frame_segments'][-2][1][2]),
            (0,p['handle_y'],p['handle_z']),p['frame_r'],'metal')
        for sign in (-1,1):
            box('footrest_left' if sign>0 else 'footrest_right',p['footrest_size'],
                (sign*p['footrest_x'],p['footrest_y'],p['footrest_z']),'metal_dark')
            # The plates rest on rails connected to the battery case and fairing.
            x=sign*p['floor_rail_x']
            y=p['footrest_y']-p['footrest_size'][1]/2-p['floor_rail_r']
            rear=p['body_center'][2]+p['body_size'][2]/2
            front=p['fairing_center'][2]-p['fairing_size'][2]/2+p['floor_rail_r']
            bar('floor_rail',(x,y,rear),(x,y,front),p['floor_rail_r'],'metal_dark')
            bar('floor_upright',(x,y,front),
                (x,p['fairing_center'][1]-p['fairing_size'][1]/2,front),p['floor_rail_r'],'metal_dark')
    else:
        parts=[bar('crank_axle',(-p['crank_w']/2,p['crank_y'],crank_z),(p['crank_w']/2,p['crank_y'],crank_z),p['crank_axle_r'],'metal_dark')]
        chain_center=(p['chain_x'],p['crank_y'],crank_z)
        parts.append(ring('chainring',p['chainring_r'],p['chainring_r']-p['chainring_wall'],p['chainring_t'],chain_center,'metal',axis=(1,0,0)))
        for a in (0,pi/2):
            r=p['chainring_r']-p['chainring_wall']
            parts.append(bar('chainring_spoke',(p['chain_x'],p['crank_y']-cos(a)*r,crank_z-sin(a)*r),
                             (p['chain_x'],p['crank_y']+cos(a)*r,crank_z+sin(a)*r),p['chain_r'],'metal'))
        rear=(p['chain_x'],p['wheel_r'],-p['wheelbase']/2)
        sprocket=ring('rear_sprocket',p['sprocket_r'],p['frame_r']+p['fork_clearance'],
                      p['chainring_t'],rear,'metal_dark',axis=(1,0,0))
        # The cog is mounted to the rotating rear hub inside the dropout.
        bpy.context.view_layer.update()
        sprocket_world=sprocket.matrix_world.copy()
        sprocket.parent=bpy.data.objects['wheel_rear']
        sprocket.matrix_world=sprocket_world
        # A single closed belt follows both sprockets and their external tangents.
        # Continuous faces avoid the dense outlines of disconnected tiny links.
        from math import atan2
        delta=Vector((chain_center[1]-rear[1],chain_center[2]-rear[2]))
        distance=delta.length; direction=delta.normalized()
        projection=(p['sprocket_r']-p['chainring_r'])/distance
        perpendicular=Vector((-direction.y,direction.x))
        normals=[direction*projection+perpendicular*(sign*(1-projection**2)**.5) for sign in (-1,1)]
        angles=[atan2(normal.y,normal.x) for normal in normals]
        while angles[1]<=angles[0]: angles[1]+=2*pi
        path=[]
        for center,radius,start,stop in [(chain_center,p['chainring_r'],angles[0],angles[1]),
                                         (rear,p['sprocket_r'],angles[1],angles[0]+2*pi)]:
            for k in range(p['chain_arc_segments']+1):
                angle=start+(stop-start)*k/p['chain_arc_segments']
                normal=Vector((cos(angle),sin(angle)))
                path.append((center,normal,radius))
        vertices=[]
        for center,normal,radius in path:
            for dx,radial in [(-p['chain_r'],-p['chain_r']),(-p['chain_r'],p['chain_r']),
                              (p['chain_r'],p['chain_r']),(p['chain_r'],-p['chain_r'])]:
                vertices.append((center[0]+dx,center[1]+normal.x*(radius+radial),
                                 center[2]+normal.y*(radius+radial)))
        faces=[]
        for k in range(len(path)):
            nxt=(k+1)%len(path)
            for j in range(4): faces.append((4*k+j,4*k+(j+1)%4,4*nxt+(j+1)%4,4*nxt+j))
        mesh('chain',vertices,faces,'metal_dark')
        for sign in (-1,1):
            arm_x=sign*p['crank_w']/2
            center=(arm_x+sign*p['pedal_offset'],p['crank_y']+sign*p['crank_radius'],crank_z)
            parts.append(bar('crank_arm',(arm_x,p['crank_y'],crank_z),(arm_x,center[1],crank_z),p['crank_arm_r'],'metal_dark'))
            parts.append(bar('pedal_spindle',(arm_x,center[1],crank_z),center,p['spindle_r'],'metal'))
            w,h,l=p['pedal_size']; corner=p['pedal_corner']
            outline=[(-w/2+corner,-l/2),(w/2-corner,-l/2),(w/2,-l/2+corner),
                     (w/2,l/2-corner),(w/2-corner,l/2),(-w/2+corner,l/2),
                     (-w/2,l/2-corner),(-w/2,-l/2+corner)]
            top=center[1]+h/2; bottom=top-p['pedal_deck_t']
            vertices=[(center[0]+x,y,center[2]+z) for y in (bottom,top) for x,z in outline]
            n=len(outline)
            faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
            faces += [(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
            plate=mesh('pedal_platform',vertices,faces,'metal')
            parts.append(group('pedal_left' if sign>0 else 'pedal_right',center,[plate]))
        group('crank_set',(0,p['crank_y'],crank_z),parts)


def finish_wheeled_vehicle(objects, clearance, axle_radius, axle_clearance):
    """Keep fixed shells clear of complete wheels and add real wheel-centre pivots.

    Wheel dimensions come from the builder's actual cylinders; each builder owns
    clearance and axle dimensions. Finite side cuts retain the central chassis.
    """
    bpy.context.view_layer.update()
    objects = list(objects)
    tires = sorted((obj for obj in objects if obj.type == 'MESH' and obj.name.split('.')[0] == 'tire'), key=lambda obj: obj.name)
    assert len(tires) == 4, 'Four-wheel vehicle must have four separate tires'
    hubs = [obj for obj in objects if obj.type == 'MESH' and obj.name.split('.')[0] == 'hub']
    fixed = [obj for obj in objects if obj.type == 'MESH' and obj not in tires and obj not in hubs]
    axles = {}
    for tire in tires:
        points = [tire.matrix_world @ vertex.co for vertex in tire.data.vertices]
        center = (tire.location.x, tire.location.z, -tire.location.y)
        # Applied scales leave dimensions in the primitive's local axes. Use
        # actual world geometry after its X-axis rotation for the wheel well.
        radius = (max(point.z for point in points) - min(point.z for point in points)) / 2
        thickness = max(point.x for point in points) - min(point.x for point in points)
        cutter_low = Vector((center[0] - thickness / 2 - clearance, center[1] - radius - clearance, center[2] - radius - clearance))
        cutter_high = Vector((center[0] + thickness / 2 + clearance, center[1] + radius + clearance, center[2] + radius + clearance))
        for shell in fixed:
            points = [shell.matrix_world @ Vector(v) for v in shell.bound_box]
            low = Vector((min(v.x for v in points), min(v.z for v in points), min(-v.y for v in points)))
            high = Vector((max(v.x for v in points), max(v.z for v in points), max(-v.y for v in points)))
            if any(high[k] < cutter_low[k] or low[k] > cutter_high[k] for k in range(3)):
                continue
            cutter = cylinder('wheel_well_cut', radius + clearance, thickness + 2 * clearance, center, None, axis=(1, 0, 0))
            subtract(shell, cutter, 'wheel_well')
        attached = [tire] + [hub for hub in hubs if (hub.location - tire.location).length < 0.000001]
        assert len(attached) == 2, 'Each tire needs its own concentric hub'
        # Blind bearing seats open toward the chassis. The rotating tire and
        # hub clear the stationary shaft while their visible outer caps stay whole.
        for moving in attached:
            points = [moving.matrix_world @ vertex.co for vertex in moving.data.vertices]
            low_x = min(point.x for point in points) - axle_clearance if center[0] > 0 else center[0] - axle_clearance
            high_x = center[0] + axle_clearance if center[0] > 0 else max(point.x for point in points) + axle_clearance
            cutter = cylinder('wheel_bearing_cut', axle_radius + axle_clearance,
                              high_x - low_x, ((low_x + high_x) / 2, center[1], center[2]),
                              None, axis=(1, 0, 0))
            subtract(moving, cutter, 'bearing_seat')
        name = 'wheel_' + ('front_' if center[2] > 0 else 'rear_') + ('left' if center[0] > 0 else 'right')
        node = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(node)
        node.location = xyz(center)
        bpy.context.view_layer.update()
        for obj in attached:
            world = obj.matrix_world.copy()
            obj.parent = node
            obj.matrix_world = world
        axles.setdefault((center[1], center[2]), []).append(center[0])
    for (y, z), xs in sorted(axles.items()):
        assert len(xs) == 2, 'Each vehicle axle must connect two wheels'
        bar('wheel_axle', (min(xs), y, z), (max(xs), y, z), axle_radius, 'metal_dark')
