# One-time Windows prep for the Crownless Adventurer A Depth experiment.
# Downloads ONLY the expected free SD1.5 Depth model, verifies the published
# SHA-256 before installation, generates new 3D depth controls, and calls the
# existing guarded MCP workflow registrar. Does not queue any GPU jobs.
[CmdletBinding()]
param(
    [string]$Python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe',
    [string]$DepthPython = '',
    [string]$ComfyRoot = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI',
    [string]$McpWorkflowDir = '',
    [string]$DepthDir = '',
    [switch]$SkipDownload
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generator = Join-Path $PSScriptRoot 'export_depth_controls.py'
$geometry = Join-Path $PSScriptRoot 'prepare_pose_3d.py'
$registrar = Join-Path $PSScriptRoot 'register_depth_mcp.ps1'
$controlDir = Join-Path $ComfyRoot 'models\controlnet'
$modelName = 'control_v11f1p_sd15_depth_fp16.safetensors'
$modelPath = Join-Path $controlDir $modelName
$expectedSha = '1c4a79aa52fb63f607cb9ff479ea5aa1923b6ceb21267bd14b69bd05d7b617be'
$modelUrl = 'https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/resolve/main/control_v11f1p_sd15_depth_fp16.safetensors?download=true'

foreach ($path in @($Python, $generator, $geometry, $registrar)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required existing Crownless file is missing: $path"
    }
}
if (-not (Test-Path -LiteralPath $controlDir -PathType Container)) {
    throw "ComfyUI controlnet folder not found: $controlDir"
}

if (Test-Path -LiteralPath $modelPath) {
    if (-not (Test-Path -LiteralPath $modelPath -PathType Leaf)) {
        throw "Depth model path exists but is not a file: $modelPath"
    }
    $existingSha = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($existingSha -ne $expectedSha) {
        throw "Existing Depth model has unexpected SHA-256; refusing to overwrite: $modelPath"
    }
    Write-Host "Verified existing Depth model: $modelPath"
} else {
    if ($SkipDownload) {
        throw "Depth model missing and -SkipDownload was specified: $modelPath"
    }
    $partial = Join-Path $controlDir ('.' + $modelName + '.' + [guid]::NewGuid().ToString('N') + '.partial')
    try {
        Write-Host "Downloading free 723 MB SD1.5 Depth model from the official Hugging Face repository..."
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri $modelUrl -OutFile $partial -MaximumRedirection 10
        $downloadSha = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($downloadSha -ne $expectedSha) {
            throw "Depth download SHA-256 mismatch ($downloadSha); refusing installation"
        }
        if (Test-Path -LiteralPath $modelPath) {
            throw "Another process created the model while downloading; refusing overwrite"
        }
        Move-Item -LiteralPath $partial -Destination $modelPath
        Write-Host "Verified and installed new Depth model: $modelPath"
    } finally {
        if (Test-Path -LiteralPath $partial) {
            Remove-Item -LiteralPath $partial -Force
        }
    }
}

if (-not $DepthDir) {
    if (-not $DepthPython) { $DepthPython = $Python }
    if (-not (Test-Path -LiteralPath $DepthPython -PathType Leaf)) {
        throw "Choose a Python containing numpy, trimesh and Pillow with -DepthPython"
    }
    # Distinct output to protect earlier reference images and candidate studies.
    $studyRoot = Split-Path (Split-Path $ComfyRoot -Parent) -Parent
    $DepthDir = Join-Path $studyRoot ('depth-contact-' + [guid]::NewGuid().ToString('N'))
    Write-Host "Generating new A/B depth controls in $DepthDir"
    & $DepthPython $generator $DepthDir --source $geometry
    if ($LASTEXITCODE -ne 0) {
        throw "Depth generation failed. Supply -DepthPython with numpy/trimesh/Pillow, or -DepthDir with the verified prior output; existing TheRock environment was not modified."
    }
} else {
    Write-Host "Using supplied depth reference directory: $DepthDir"
}

foreach ($name in @('pose-a-depth.png','pose-b-depth.png','depth-manifest.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $DepthDir $name) -PathType Leaf)) {
        throw "Required depth output missing: $name"
    }
}
Write-Host "Calling existing fail-closed MCP workflow registrar (no GPU jobs will be queued)..."
if ($McpWorkflowDir) {
    & $registrar -DepthDir $DepthDir -McpWorkflowDir $McpWorkflowDir
} else {
    & $registrar -DepthDir $DepthDir
}
if ($LASTEXITCODE -ne 0) {
    throw "Depth MCP registration helper failed with exit code $LASTEXITCODE"
}
Write-Host "Depth setup completed. In ChatGPT list workflows, then run adventurer-a-3d-depth-a ONCE only."
