# Register the existing 3D A/B reference controls in the approved MCP allowlist.
# No GPU job is submitted. Leave v1/v2 workflows and all approved assets intact.
param([string]$McpWorkflowDir = "", [string]$PoseGuideDir = "")
$ErrorActionPreference = 'Stop'
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
$comfy = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$anchor = Join-Path $repo 'docs\assets\adventurer-a-approved-anchor-v1.png'
$installer = Join-Path $PSScriptRoot 'register_3d_contact_mcp.py'
foreach ($path in @($python,$anchor,$installer)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing: $path" }
}
if (-not (Test-Path -LiteralPath (Join-Path $comfy 'input') -PathType Container)) {
  throw "ComfyUI input directory not found. No installation attempted."
}
if (-not $McpWorkflowDir) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Choose existing adventurer-a-near-contact.json from ComfyUI Local MCP allowlist'
    $dialog.Filter = 'JSON files (*.json)|*.json'
    $dialog.FileName = 'adventurer-a-near-contact.json'
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $McpWorkflowDir = Split-Path -Parent $dialog.FileName
    }
  } catch { Write-Host 'MCP allowlist picker unavailable' }
}
if (-not $McpWorkflowDir) {
  $McpWorkflowDir = Read-Host 'Full path to existing ComfyUI Local MCP allowlist'
}
if (-not $PoseGuideDir) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Choose pose-a-openpose.png from extracted 3D contact ZIP exports'
    $dialog.Filter = 'PNG files (*.png)|*.png'
    $dialog.FileName = 'pose-a-openpose.png'
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $PoseGuideDir = Split-Path -Parent $dialog.FileName
    }
  } catch { Write-Host '3D pose picker unavailable' }
}
if (-not $PoseGuideDir) {
  $PoseGuideDir = Read-Host 'Full path to extracted 3D pose PNG files'
}
if (-not (Test-Path -LiteralPath $McpWorkflowDir -PathType Container)) {
  throw 'Valid MCP allowlist directory is required'
}
if (-not (Test-Path -LiteralPath $PoseGuideDir -PathType Container)) {
  throw 'Extract the previously generated 3D pose ZIP first'
}
foreach ($name in @('pose-a-openpose.png','pose-b-openpose.png')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PoseGuideDir $name) -PathType Leaf)) {
    throw "Missing 3D pose control: $name"
  }
}
foreach ($name in @('adventurer-a-near-contact.json','adventurer-a-far-contact.json')) {
  $path = Join-Path $McpWorkflowDir $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "No known registered v1 MCP workflow found at: $path"
  }
  $graph = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($graph.'4'.inputs.image -ne 'crownless-mcp-adventurer-a-v1/anchor.png') {
    throw "Selected MCP folder does not contain the expected Crownless approved-anchor workflows"
  }
}
& $python $installer --study $PoseGuideDir --anchor $anchor --comfy $comfy --workflow-dir $McpWorkflowDir
if ($LASTEXITCODE -ne 0) {
  throw "3D candidate registration failed with exit code $LASTEXITCODE"
}
Write-Host 'Registered A and B as review-only. Ask ChatGPT to list workflows and run A only.'
