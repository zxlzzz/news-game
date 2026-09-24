// Writes npc/mapping_reference.json for tools/check_mapping.gd: the accepted mapping, imported from
// sth/motion-study in this repo (not copied), applied to phone_walk and stand_idle frame 0 and middle frame, using the
// same exported clips (npc/motion) and parameter copy (npc/skeleton-params.json) the Godot side reads.
// (in godot/) node tools/make_mapping_reference.mjs --mapping ../sth/motion-study/skeleton-mapping.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const at = process.argv.indexOf('--mapping');
if (at < 0 || !process.argv[at + 1]) throw new Error('usage: node tools/make_mapping_reference.mjs --mapping <path of skeleton-mapping.mjs>');
const mappingPath = resolve(process.argv[at + 1]);
const {createSkeletonMapper} = await import(pathToFileURL(mappingPath).href);
const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const index = readJson(join(PROJ, 'npc/motion/index.json'));
const params = readJson(join(PROJ, 'npc/skeleton-params.json'));
const clip = id => readJson(join(PROJ, 'npc/motion', id + '.json'));
const REST = {clip: 'stand_idle', frame: 0};  // same as npc_data.gd REST_CLIP / REST_FRAME
const mapFrame = createSkeletonMapper(index.names, clip(REST.clip).frames[REST.frame]);
const hips = index.names.indexOf('Hips');
const cases = [];
for (const id of ['phone_walk', 'stand_idle']) {
  const c = clip(id);
  for (const frame of [0, Math.floor(c.frames.length / 2)]) {
    const origin = c.frames[0][hips];  // clipOrigin: the clip's first-frame Hips
    const f = mapFrame(c.frames[frame], params, origin);
    cases.push({clip: id, frame, origin, H: f.H, N: f.N, neckEnd: f.neckEnd, head: f.head, segs: f.segs});
  }
}
const out = join(PROJ, 'npc/mapping_reference.json');
writeFileSync(out, JSON.stringify({
  mapping: relative(PROJ, mappingPath).split(sep).join('/'),
  mapping_sha256: createHash('sha256').update(readFileSync(mappingPath)).digest('hex'),
  params, rest: REST, cases,
}, null, 1) + '\n');
console.log(`${cases.length} frames -> ${out}`);
