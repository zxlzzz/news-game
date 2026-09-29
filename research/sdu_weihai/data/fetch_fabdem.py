"""FABDEM tile N37E122 -> FABDEM_N37E122.tif: only that tile, read out of the publisher's 640 MB ZIP with HTTP ranges."""
import io
import json
import struct
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = 'https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/N30E120-N40E130_FABDEM_V1-2.zip'

def request_range(start, end):
    req = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=40) as response:
        if response.status != 206:
            raise RuntimeError(f'Range request not honored: {response.status}')
        data = response.read()
        if len(data) != end-start+1:
            raise RuntimeError('Unexpected range length')
        return data

with urllib.request.urlopen(urllib.request.Request(URL, method='HEAD'), timeout=30) as response:
    size = int(response.headers['Content-Length'])
tail_start = max(0, size-65557)
tail = request_range(tail_start, size-1)
eocd = tail.rfind(b'PK\x05\x06')
if eocd < 0:
    raise RuntimeError('ZIP end record missing')
_, _, _, _, count, directory_size, directory_offset, _ = struct.unpack_from('<4s4H2LH', tail, eocd)
if directory_offset == 0xffffffff:
    raise RuntimeError('ZIP64 directory requires another reader')
directory = request_range(directory_offset, directory_offset+directory_size-1)
pos = 0
entries = []
selected = None
while pos < len(directory):
    fields = struct.unpack_from('<4s6H3L5H2L', directory, pos)
    if fields[0] != b'PK\x01\x02':
        raise RuntimeError('Invalid central directory')
    nlen, xlen, clen = fields[10:13]
    name = directory[pos+46:pos+46+nlen].decode('utf-8')
    entries.append(name)
    if 'N37E122' in name and name.lower().endswith('.tif'):
        selected = (name, fields[8], fields[16])
    pos += 46+nlen+xlen+clen
if selected is None:
    raise RuntimeError('Campus tile not found')
name, compressed_size, offset = selected
header = request_range(offset, offset+29)
local = struct.unpack('<4s5H3L2H', header)
total = 30+local[-2]+local[-1]+compressed_size
member = request_range(offset, offset+total-1)
# Preserve publisher-compressed bytes and use zipfile's CRC validation.
single_directory = bytearray()
pos = 0
while pos < len(directory):
    f = struct.unpack_from('<4s6H3L5H2L', directory, pos)
    length = 46+sum(f[10:13])
    if f[16] == offset:
        single_directory = bytearray(directory[pos:pos+length])
        struct.pack_into('<L', single_directory, 42, 0)
        break
    pos += length
end = struct.pack('<4s4H2LH', b'PK\x05\x06', 0, 0, 1, 1, len(single_directory), len(member), 0)
with zipfile.ZipFile(io.BytesIO(member+single_directory+end)) as archive:
    content = archive.read(name)
target = ROOT / 'FABDEM_N37E122.tif'
target.write_bytes(content)
print('saved', target, len(content), 'bytes from', name)
