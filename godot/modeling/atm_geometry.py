"""Construct the same legible 3-by-4 square keypad on both ATM types."""
from model_geometry import box, blind_cut


def keypad(spec):
    side, height = spec['key_side'], spec['key_height']
    pitch, center_z = spec['key_pitch'], spec['key_grid_z']
    if pitch <= side:
        raise ValueError('ATM keys need a positive, uniform separation')
    key_y = spec['key_top']-height/2
    for row in range(4):
        z = center_z+(row-1.5)*pitch
        for column in range(3):
            box(f'numeric_key_r{row+1}_c{column+1}',(side,height,side),
                ((column-1)*pitch,key_y,z),'metal')
        if row < 3:
            box(f'function_key_{row+1}',(side,height,side),
                (spec['function_x'],key_y,z),'accent')


def aperture(body, name, spec):
    """An opening passes through bezel and case, ending on a buried dark back.

    mouth_z is the physical front plane. A pickup at the centre of this plane
    belongs to the bill mouth, rather than to the front of an unrelated plaque.
    """
    x, y = spec['center']
    face = spec['mouth_z']
    outer = box(name+'_surround',
                (spec['outer_width'],spec['outer_height'],spec['surround_depth']),
                (x,y,face-spec['surround_depth']/2),'metal')
    back = face-spec['recess_depth']
    cut_depth = spec['recess_depth']+spec['cut_overshoot']
    cut_center = (x,y,back+cut_depth/2)
    cut_size = (spec['opening_width'],spec['opening_height'],cut_depth)
    blind_cut(body,name+'_case_opening',cut_size,cut_center)
    blind_cut(outer,name+'_surround_opening',cut_size,cut_center)
    overlap = spec['backing_overlap']
    # Half the backing thickness is buried in the uncut case; its sides also
    # extend into the aperture walls so the dark inset is supported all around.
    box(name+'_dark_back',
        (spec['opening_width']+2*overlap,spec['opening_height']+2*overlap,
         spec['backing_depth']),
        (x,y,back),'glass_dark')
