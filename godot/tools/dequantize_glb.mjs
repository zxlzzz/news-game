// Removes KHR_mesh_quantization from GLB files in place: every mesh vertex attribute stored as
// (normalized) integers is rewritten as float32, so Godot can import the file. Geometry is unchanged;
// everything else in the file (indices, textures, animations, node transforms) is kept byte for byte,
// the float data is appended to the binary chunk.
// node tools/dequantize_glb.mjs <file.glb> [...]
import {readFileSync, writeFileSync} from 'node:fs';

const COUNT = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16};
const COMP = {  // componentType -> [bytes, reader, normalize]
  5120: [1, (d, o) => d.getInt8(o), c => Math.max(c / 127, -1)],
  5121: [1, (d, o) => d.getUint8(o), c => c / 255],
  5122: [2, (d, o) => d.getInt16(o, true), c => Math.max(c / 32767, -1)],
  5123: [2, (d, o) => d.getUint16(o, true), c => c / 65535],
  5125: [4, (d, o) => d.getUint32(o, true), c => c / 4294967295],
};
const EXT = 'KHR_mesh_quantization';

for (const file of process.argv.slice(2)) {
  const glb = readFileSync(file);
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a GLB');
  const jsonLen = glb.readUInt32LE(12);
  const j = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  if (!(j.extensionsUsed || []).includes(EXT)) { console.log(file, ': no', EXT); continue; }
  const binStart = 20 + jsonLen + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
  if ((j.buffers || []).length !== 1 || j.buffers[0].uri !== undefined) throw new Error(file + ': expects one embedded buffer');
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);

  const attrAccessors = new Set();
  for (const m of j.meshes || []) for (const p of m.primitives) {
    for (const a of Object.values(p.attributes)) attrAccessors.add(a);
    for (const t of p.targets || []) for (const a of Object.values(t)) attrAccessors.add(a);
  }
  const extra = [];
  let extraLen = bin.byteLength + ((4 - bin.byteLength % 4) % 4);
  let converted = 0;
  for (const ai of attrAccessors) {
    const acc = j.accessors[ai];
    if (acc.componentType === 5126) continue;
    if (acc.sparse) throw new Error(file + `: accessor ${ai} is sparse (not handled)`);
    const [size, read, norm] = COMP[acc.componentType];
    const n = COUNT[acc.type];
    const bv = j.bufferViews[acc.bufferView];
    const stride = bv.byteStride || size * n;
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float32Array(acc.count * n);
    for (let i = 0; i < acc.count; i++) for (let k = 0; k < n; k++) {
      const c = read(view, base + i * stride + k * size);
      out[i * n + k] = acc.normalized ? norm(c) : c;
    }
    const bytes = Buffer.from(out.buffer);
    j.bufferViews.push({buffer: 0, byteOffset: extraLen, byteLength: bytes.length, target: 34962});
    extra.push(bytes);
    extraLen += bytes.length;
    acc.bufferView = j.bufferViews.length - 1;
    delete acc.byteOffset;
    acc.componentType = 5126;
    delete acc.normalized;
    if (acc.min || acc.max) {
      const mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity);
      for (let i = 0; i < acc.count; i++) for (let k = 0; k < n; k++) {
        mn[k] = Math.min(mn[k], out[i * n + k]); mx[k] = Math.max(mx[k], out[i * n + k]);
      }
      acc.min = mn; acc.max = mx;
    }
    converted++;
  }
  j.extensionsUsed = j.extensionsUsed.filter(e => e !== EXT);
  if (j.extensionsRequired) j.extensionsRequired = j.extensionsRequired.filter(e => e !== EXT);
  if (!j.extensionsUsed.length) delete j.extensionsUsed;
  if (j.extensionsRequired && !j.extensionsRequired.length) delete j.extensionsRequired;

  const newBin = Buffer.concat([bin, Buffer.alloc((4 - bin.byteLength % 4) % 4), ...extra]);
  j.buffers[0].byteLength = newBin.length;
  let js = Buffer.from(JSON.stringify(j), 'utf8');
  js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const binPad = Buffer.alloc((4 - newBin.length % 4) % 4);
  const total = 12 + 8 + js.length + 8 + newBin.length + binPad.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length + binPad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(file, Buffer.concat([head, jh, js, bh, newBin, binPad]));
  console.log(file, `: ${converted} accessors -> float32`);
}
