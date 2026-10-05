"""Compare identical native frames from three frozen recovery snapshots."""
import json
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parent


def main():
    result = {}
    for label, directory in [('before', 'lie_failure'), ('inner_radius', 'lie_reach_fix'),
                             ('coordinated', 'lie_plan_fix')]:
        folder = BASE / directory
        dump = json.loads((folder / 'runtime.json').read_text())
        result[label] = {'inputs': dump['inputs_after'], 'fps': dump['fps'], 'breeds': {}}
        for breed, record in dump['breeds'].items():
            scenario = record['scenarios'][0]
            names = record['names']
            frames = np.fromfile(scenario['file'], dtype='<f4').reshape(-1, len(names), 4, 3)
            speed = np.linalg.norm(np.diff(frames[:, :, 3], axis=0), axis=-1) * dump['fps']
            k, bone = np.unravel_index(speed.argmax(), speed.shape)
            sample = {'peak_joint': {'mps': float(speed[k, bone]), 'bone': names[bone],
                                    'from_frame': int(k), 'to_frame': int(k + 1),
                                    'from_time': k / dump['fps'], 'to_time': (k + 1) / dump['fps']},
                      'same_frames': []}
            for first in [1211, 1212, 1239, 1240]:
                row = {'from_frame': first, 'to_frame': first + 1, 'bones': {}}
                for name in ['Body', 'FrontUpperLeg.L', 'FrontLowerLeg.L', 'FF.L',
                             'BackLeg.R', 'BackUpperLeg.R']:
                    if name not in names:
                        continue
                    i = names.index(name)
                    old, new = frames[first, i, 3].astype(float), frames[first + 1, i, 3].astype(float)
                    row['bones'][name] = {'from_m': old.tolist(), 'to_m': new.tolist(),
                                          'delta_mm': ((new - old) * 1000).tolist(),
                                          'distance_mm': float(np.linalg.norm(new - old) * 1000)}
                sample['same_frames'].append(row)
            result[label]['breeds'][breed] = sample
    (BASE / 'recovery_comparison.json').write_text(json.dumps(result, indent=2) + '\n')
    for label, record in result.items():
        print(label, {breed: round(value['peak_joint']['mps'], 3)
                      for breed, value in record['breeds'].items()})


if __name__ == '__main__':
    main()
