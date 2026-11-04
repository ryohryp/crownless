# Register two v2 review-only contact workflows using the already trusted local Python and ComfyUI.
# Select an EXISTING v1 workflow JSON in its configured MCP allowlist; never expose port 8188.
param(
    [string]$McpWorkflowDir = ""
)
$ErrorActionPreference = 'Stop'
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
$comfy = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$anchor = Join-Path $repo 'docs\assets\adventurer-a-approved-anchor-v1.png'
$installer = Join-Path $PSScriptRoot 'contact_v2.py'
foreach ($file in @($python, $anchor, $installer)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Required file missing: $file. Use the existing tested TheRock environment and the Crownless v2 PR checkout."
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $comfy 'input') -PathType Container)) {
    throw "Existing ComfyUI input folder missing: $comfy"
}
if (-not $McpWorkflowDir) {
    # The original MCP server does not expose its allowlist directory. Let the PC owner
    # identify a known v1 JSON rather than guessing or traversing private folders.
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.OpenFileDialog
        $picker.Title = 'Select the EXISTING adventurer-a-near-contact.json in your ComfyUI Local MCP workflow folder'
        $picker.Filter = 'ComfyUI workflow JSON (*.json)|*.json'
        $picker.FileName = 'adventurer-a-near-contact.json'
        $picker.CheckFileExists = $true
        if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $McpWorkflowDir = Split-Path -Parent $picker.FileName
        }
    } catch {
        Write-Host 'File picker unavailable. Enter the folder containing the existing v1 MCP workflow JSONs.'
    }
}
if (-not $McpWorkflowDir) {
    $McpWorkflowDir = Read-Host 'Folder containing adventurer-a-near-contact.json'
}
if (-not $McpWorkflowDir -or -not (Test-Path -LiteralPath $McpWorkflowDir -PathType Container)) {
    throw 'No valid existing ComfyUI Local MCP workflow directory was selected.'
}
$nearPath = Join-Path $McpWorkflowDir 'adventurer-a-near-contact.json'
$farPath = Join-Path $McpWorkflowDir 'adventurer-a-far-contact.json'
foreach ($file in @($nearPath, $farPath)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Cannot validate previously registered v1 candidate JSON: $file"
    }
}
$nearGraph = Get-Content -LiteralPath $nearPath -Raw -Encoding UTF8 | ConvertFrom-Json
$farGraph = Get-Content -LiteralPath $farPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedAnchor = 'crownless-mcp-adventurer-a-v1/anchor.png'
if ($nearGraph.'4'.inputs.image -ne $expectedAnchor -or $farGraph.'4'.inputs.image -ne $expectedAnchor) {
    throw 'The selected files do not match the existing approved-anchor v1 workflow contract.'
}
$study = Join-Path 'I:\02_AI\ComfyUI-Crownless' ('contact-v2-study-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
Write-Host "Existing MCP allowlist: $McpWorkflowDir"
Write-Host "Writing new v2 input study: $study"
& $python $installer --study $study --anchor $anchor --comfy $comfy --workflow-dir $McpWorkflowDir
if ($LASTEXITCODE -ne 0) {
    throw "v2 registration failed, exit code $LASTEXITCODE. Existing v1 workflows remain unchanged."
}
Write-Host 'Registration completed. Ask ChatGPT to list ComfyUI Local workflows and run near-v2 first.'
