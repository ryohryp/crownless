"""Package original art for Pixelorama; never resample or redraw source pixels."""
import pathlib
import struct
import zipfile
import xml.etree.ElementTree as ET

root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'docs/assets/candidates/hero-still-v1'
source = (folder / 'source-v2.png').read_bytes()
assert source[:8] == b'\x89PNG\r\n\x1a\n'
width, height = struct.unpack('>II', source[16:24])
image = ET.Element('image', {'version': '0.0.3', 'w': str(width), 'h': str(height), 'name': 'Unapproved hero still'})
stack = ET.SubElement(image, 'stack')
ET.SubElement(stack, 'layer', {'name': 'Coherent body - original generated candidate', 'src': 'data/body.png',
                             'x': '0', 'y': '0', 'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
with zipfile.ZipFile(folder / 'hero-review.ora', 'w') as archive:
    archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
    archive.writestr('stack.xml', ET.tostring(image, encoding='utf-8'))
    archive.writestr('data/body.png', source)
    archive.writestr('mergedimage.png', source)
print(f'OpenRaster source: {width}x{height}, one coherent body layer; no animation claimed')
