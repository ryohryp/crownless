# Review-only: register A/B Depth workflows; DO NOT queue jobs or replace art.
param([string]$DepthDir = '', [string]$McpWorkflowDir = '')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
$comfy = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI'
$anchor = Join-Path $repo 'docs\assets\adventurer-a-approved-anchor-v1.png'
$installer = Join-Path $PSScriptRoot 'register_depth_mcp.py'
foreach ($p in @($python, $anchor, $installer)) {
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Required file missing: $p" }
}
if (-not (Test-Path -LiteralPath (Join-Path $comfy 'input') -PathType Container)) {
  throw "ComfyUI input directory missing: $comfy"
}
if (-not $McpWorkflowDir) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = 'Choose existing adventurer-a-near-contact.json from ComfyUI Local MCP'
  $dialog.FileName = 'adventurer-a-near-contact.json'
  $dialog.Filter = 'JSON (*.json)|*.json'
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw 'No MCP workflow allowlist selected'
  }
  $McpWorkflowDir = Split-Path -Parent $dialog.FileName
}
if (-not $DepthDir) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = 'Choose pose-a-depth.png from generated Depth controls'
  $dialog.FileName = 'pose-a-depth.png'
  $dialog.Filter = 'PNG (*.png)|*.png'
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw 'No Depth control directory selected'
  }
  $DepthDir = Split-Path -Parent $dialog.FileName
}
foreach ($name in @('adventurer-a-near-contact.json','adventurer-a-far-contact.json')) {
  $path = Join-Path $McpWorkflowDir $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Wrong MCP allowlist: missing $name"
  }
  $graph = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($graph.'4'.inputs.image -ne 'crownless-mcp-adventurer-a-v1/anchor.png') {
    throw "MCP allowlist approved-anchor mismatch: $name"
  }
}
foreach ($name in @('pose-a-depth.png','pose-b-depth.png','depth-manifest.json')) {
  if (-not (Test-Path -LiteralPath (Join-Path $DepthDir $name) -PathType Leaf)) {
    throw "Missing depth candidate: $name"
  }
}
& $python $installer --comfy $comfy --anchor $anchor --depth-dir $DepthDir --allowlist $McpWorkflowDir
if ($LASTEXITCODE -ne 0) {
  throw "Depth MCP registration failed with exit code $LASTEXITCODE"
}
Write-Host 'Registration complete. In ChatGPT run adventurer-a-3d-depth-a once and review.'
