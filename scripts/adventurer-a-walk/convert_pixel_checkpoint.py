"""Convert the pinned PublicPrompts pixel checkpoint using tensor-only loading.

This accepts only the known upstream bytes and refuses to overwrite an existing
output. PyTorch's restricted weights-only loader is required; there is no unsafe
pickle fallback.
"""
import argparse
import hashlib
from pathlib import Path
import torch
from safetensors.torch import save_file

EXPECTED = 'd7fb6396ab39b73019f37040977e15ec76a2548372daa534f9ac44b61c3d9548'

def convert(source: Path, target: Path):
    with source.open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    if digest != EXPECTED:
        raise ValueError('Source checkpoint hash differs from the pinned release')
    if target.exists():
        raise FileExistsError(f'Refusing to replace {target}')
    data = torch.load(source, map_location='cpu', weights_only=True)
    state = data.get('state_dict') if isinstance(data, dict) else None
    if not isinstance(state, dict) or not state or not all(isinstance(k, str) and isinstance(v, torch.Tensor) for k, v in state.items()):
        raise ValueError('Unexpected checkpoint: state_dict must contain only named tensors')
    # Clone to avoid shared-storage serialization errors, preserving values.
    tensors = {key: value.detach().contiguous().clone() for key, value in state.items()}
    # Reserve the path atomically before save_file; leave failed outputs for inspection.
    with target.open('xb'):
        pass
    save_file(tensors, str(target), metadata={'source_sha256': digest})
    with target.open('rb') as f:
        print('Safetensors SHA-256:', hashlib.file_digest(f, 'sha256').hexdigest())
    print('Tensor count:', len(tensors))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    convert(args.source, args.target)
