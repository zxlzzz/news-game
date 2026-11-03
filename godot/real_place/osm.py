"""OpenStreetMap XML -> ways in scene metres."""
import xml.etree.ElementTree as ET


def load_ways(path, site):
    """[{id, tags, pts: [(x, z)...], closed}] for every way, in scene metres."""
    root = ET.parse(path).getroot()
    nodes = {n.get('id'): site.lonlat_to_xz(float(n.get('lon')), float(n.get('lat'))) for n in root.iter('node')}
    ways = []
    for w in root.iter('way'):
        refs = [nd.get('ref') for nd in w.iter('nd')]
        if any(r not in nodes for r in refs):
            continue  # clipped at the download edge
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        pts = [nodes[r] for r in refs]
        ways.append({'id': w.get('id'), 'tags': tags, 'pts': pts, 'closed': len(refs) > 3 and refs[0] == refs[-1]})
    return ways
