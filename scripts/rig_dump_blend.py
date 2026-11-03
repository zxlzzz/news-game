#!/usr/bin/env python
"""读 .blend 里的骨架与动作清单，不需要装 Blender。

用于 anim.md 的源 rig 核查：assets/rigs/pigeon/bird.blend

    python scripts/rig_dump_blend.py <file.blend>            骨架树（全部骨头）+ 动作清单
    python scripts/rig_dump_blend.py <file.blend> --deform   只列 DEF- 变形骨

实现：直接解析 .blend 的 SDNA（Blender 自描述的结构定义表），按 struct 名找出
Bone / bAction / bArmature 块。Blender 3.0+ 默认用 zstd 压存档，文件头是
`28 B5 2F FD` 而不是 `BLENDER`，这里会先解压。
"""
import argparse
import pathlib
import re
import struct
import sys

try:
    import zstandard
except ImportError:
    zstandard = None

# Rigify 生成的控制骨前缀。真正绑到网格上的只有 DEF-。
CTRL_PREFIX = ('MCH-', 'ORG-', 'WGT-', 'VIS-')


class Blend:
    def __init__(self, path):
        raw = pathlib.Path(path).read_bytes()
        if raw[:4] == b'\x28\xb5\x2f\xfd':
            if zstandard is None:
                sys.exit('这个 .blend 是 zstd 压缩的，需要 `pip install zstandard`')
            raw = zstandard.ZstdDecompressor().stream_reader(raw).read()
        if raw[:7] != b'BLENDER':
            sys.exit(f'{path}: 不是 .blend（magic={raw[:7]!r}）')
        self.d = raw
        self.psize = 8 if raw[7:8] == b'-' else 4
        self.end = '<' if raw[8:9] == b'v' else '>'
        self.version = raw[9:12].decode()
        self.pfmt = self.end + ('Q' if self.psize == 8 else 'I')
        self._scan_blocks()
        self._parse_sdna()

    def _scan_blocks(self):
        self.blocks = []
        off, d = 12, self.d
        hdr = 4 + 4 + self.psize + 4 + 4
        while off < len(d):
            code = d[off:off + 4]
            length, = struct.unpack_from(self.end + 'i', d, off + 4)
            sdna, count = struct.unpack_from(self.end + 'ii', d, off + 8 + self.psize)
            body = off + hdr
            self.blocks.append((code, sdna, count, body))
            if code == b'ENDB':
                break
            off = body + length

    def _parse_sdna(self):
        d = self.d
        p = next(b[3] for b in self.blocks if b[0] == b'DNA1')
        assert d[p:p + 8] == b'SDNANAME'
        p += 8

        def strings(p):
            n, = struct.unpack_from(self.end + 'i', d, p)
            p += 4
            out = []
            for _ in range(n):
                e = d.index(b'\0', p)
                out.append(d[p:e].decode())
                p = e + 1
            return out, (p + 3) & ~3

        self.names, p = strings(p)
        p += 4  # 'TYPE'
        self.types, p = strings(p)
        p += 4  # 'TLEN'
        self.tlen = list(struct.unpack_from(self.end + '%dh' % len(self.types), d, p))
        p = (p + 2 * len(self.types) + 3) & ~3
        p += 4  # 'STRC'
        n, = struct.unpack_from(self.end + 'i', d, p)
        p += 4
        self.structs = []
        for _ in range(n):
            ti, nf = struct.unpack_from(self.end + 'hh', d, p)
            p += 4
            fields = []
            for _ in range(nf):
                fti, fni = struct.unpack_from(self.end + 'hh', d, p)
                p += 4
                fields.append((fti, fni))
            self.structs.append((ti, fields))
        self.sidx = {self.types[s[0]]: i for i, s in enumerate(self.structs)}

    def _field_size(self, ti, name):
        if name.startswith('*'):
            return self.psize
        size = self.tlen[ti]
        for dim in re.findall(r'\[(\d+)\]', name):
            size *= int(dim)
        return size

    def fields(self, sdna):
        off = 0
        for fti, fni in self.structs[sdna][1]:
            name = self.names[fni]
            size = self._field_size(fti, name)
            yield name, self.types[fti], off, size
            off += size

    def struct_size(self, sdna):
        return self.tlen[self.structs[sdna][0]]

    def records(self, type_name):
        """→ [(自身地址, {字段: 值})]，只解出指针 / char[] / float[3] / 标量。"""
        if type_name not in self.sidx:
            return []
        sdna = self.sidx[type_name]
        size = self.struct_size(sdna)
        layout = list(self.fields(sdna))
        out = []
        for code, bsdna, count, body in self.blocks:
            if bsdna != sdna:
                continue
            for i in range(count):
                base = body + i * size
                rec = {}
                for name, ty, off, sz in layout:
                    p = base + off
                    if name.startswith('*'):
                        rec[name.lstrip('*')] = struct.unpack_from(self.pfmt, self.d, p)[0]
                    elif ty == 'char' and '[' in name:
                        rec[name.split('[')[0]] = self.d[p:p + sz].split(b'\0')[0].decode('utf-8', 'replace')
                    elif ty == 'float' and name.endswith('[3]'):
                        rec[name[:-3]] = struct.unpack_from(self.end + '3f', self.d, p)
                    elif ty == 'float' and '[' not in name:
                        rec[name] = struct.unpack_from(self.end + 'f', self.d, p)[0]
                out.append((base, rec))
        return out

    def id_names(self, type_name):
        """读 ID.name（前两字符是类型码，如 AC=Action、AR=Armature、OB=Object）。"""
        if type_name not in self.sidx:
            return []
        off_name = next(o for n, _, o, _ in self.fields(self.sidx['ID']) if n.startswith('name['))
        sdna = self.sidx[type_name]
        size = self.struct_size(sdna)
        out = []
        for code, bsdna, count, body in self.blocks:
            if bsdna != sdna:
                continue
            for i in range(count):
                p = body + i * size + off_name
                s = self.d[p:p + 66].split(b'\0')[0].decode('utf-8', 'replace')
                if s:
                    out.append(s[2:])
        return sorted(set(out))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('blend')
    ap.add_argument('--deform', action='store_true', help='只列 DEF- 变形骨')
    args = ap.parse_args()

    b = Blend(args.blend)
    print(f'{pathlib.Path(args.blend).name}: Blender {b.version}, {b.psize*8}bit, '
          f'解压后 {len(b.d):,} 字节')

    bones = b.records('Bone')
    by_addr = {addr: rec for addr, rec in bones}
    children = {}
    for addr, rec in bones:
        children.setdefault(rec.get('parent', 0), []).append(addr)

    def name_of(addr):
        return by_addr[addr].get('name', '?')

    def bone_len(rec):
        h, t = rec.get('head', (0, 0, 0)), rec.get('tail', (0, 0, 0))
        return sum((t[i] - h[i]) ** 2 for i in range(3)) ** 0.5

    if args.deform:
        defs = sorted((r for _, r in bones if r.get('name', '').startswith('DEF-')),
                      key=lambda r: r['name'])
        print(f'\nDEF- 变形骨 {len(defs)} / 全部 {len(bones)}:')
        for r in defs:
            print(f"  {r['name']:<22} len={bone_len(r):.4f}")
    else:
        buckets = {}
        for _, r in bones:
            nm = r.get('name', '')
            key = next((p for p in ('DEF-',) + CTRL_PREFIX if nm.startswith(p)), '控制/其他')
            buckets[key] = buckets.get(key, 0) + 1
        print(f'\n骨头 {len(bones)} 根，按前缀:')
        for k, v in sorted(buckets.items(), key=lambda kv: -kv[1]):
            print(f'  {k:<12} {v}')

        print('\n骨架树:')

        def walk(addr, depth):
            r = by_addr[addr]
            h = r.get('head', (0, 0, 0))
            print('  ' + '  ' * depth + f"{r.get('name','?'):<24} len={bone_len(r):.4f} "
                  f"head=({h[0]:+.3f},{h[1]:+.3f},{h[2]:+.3f})")
            for c in sorted(children.get(addr, []), key=name_of):
                walk(c, depth + 1)

        for root in sorted(children.get(0, []), key=name_of):
            walk(root, 0)

    print(f'\n骨架 (bArmature): {", ".join(b.id_names("bArmature")) or "（无）"}')
    print(f'动作 (bAction): {", ".join(b.id_names("bAction")) or "（无）"}')


if __name__ == '__main__':
    main()
