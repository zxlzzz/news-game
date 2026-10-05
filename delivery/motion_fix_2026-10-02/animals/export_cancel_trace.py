"""Export an existing cancellation diagnostic for GPU matrix replay only."""
from copy import deepcopy
import json
from pathlib import Path
import sys

import numpy as np

HERE = Path(__file__).resolve().parent


def main(case_path, folder, label='scratch_mid_cancel'):
    case = json.loads(Path(case_path).read_text())
    base = json.loads((HERE / 'final_low_pose/runtime.json').read_text())
    breed = case['breed']
    assert base['inputs_after']['res://npc/animal.gd'] == case['inputs']['animal']
    assert base['inputs_after']['res://npc/animal_model.gd'] == case['inputs']['model']
    assert base['inputs_after']['res://models/animal_' + breed + '.glb'] == case['inputs']['glb']
    folder = Path(folder).resolve()
    folder.mkdir(exist_ok=True)
    info = deepcopy(base['breeds'][breed])
    names = info['names']
    frames = [[case['captured_bones'][name] for name in names]]
    frames += [[frame['bones'][name]['world'] for name in names] for frame in case['frames']]
    path = folder / (breed + '_' + label + '.f32')
    np.array(frames, dtype='<f4').tofile(path)
    states = [{'time': 0, 'phase': 'captured'}]
    states += [{'time': (i+1)/case['fps'], 'phase': frame.get('phase', 'return' if frame['unprojected'] else 'walk')}
               for i, frame in enumerate(case['frames'])]
    info['scenarios'] = [{'file': str(path), 'label': label, 'states': states}]
    output = {'scope': 'GPU replay only: captured source pose then recorded cancellation matrices; not a full verification dataset',
              'replay_only': True, 'source_diagnostic': str(Path(case_path).resolve()),
              'fps': case['fps'], 'inputs_before': base['inputs_after'], 'inputs_after': base['inputs_after'],
              'breeds': {breed: info}}
    (folder / 'runtime.json').write_text(json.dumps(output) + '\n')
    print('C0_REPLAY', len(frames), 'frames;', folder / 'runtime.json')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv)>3 else 'scratch_mid_cancel')
