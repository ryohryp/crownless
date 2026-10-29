param([Parameter(Mandatory=$true)][string]$ComfyRoot)
$python = Join-Path $ComfyRoot 'python_embeded\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw "Portable Python not found: $python" }
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber | Format-List
Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | Format-Table
& $python -c "import torch; print('torch:', torch.__version__, 'HIP:', torch.version.hip); print('GPU available:', torch.cuda.is_available()); print('devices:', [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]); x=torch.ones(8, device='cuda'); print('GPU tensor sum:', x.sum().item())"
if ($LASTEXITCODE -ne 0) { throw 'PyTorch GPU tensor check failed. This does not prove the hardware is unsupported.' }
