param(
    [string]$Scene = 'res://scenes/market_quarter/level.tscn',
    [string]$OutputDirectory = '.tmp/static-scene-review',
    [string]$Godot = 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe',
    [string]$Python = 'D:/anaconda/python.exe'
)
$ErrorActionPreference = 'Stop'
$reviewRoot = Split-Path -Parent $PSScriptRoot
$reviewOutput = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $reviewRoot $OutputDirectory }
New-Item -ItemType Directory -Path $reviewOutput -Force | Out-Null
$geometryPath = Join-Path $reviewOutput 'geometry.json'
$reportPath = Join-Path $reviewOutput 'review.json'
$reviewLog = Join-Path $reviewOutput 'godot.log'
$reviewErrors = Join-Path $reviewOutput 'godot.err'
& $Godot --headless --path (Join-Path $reviewRoot 'godot') -s res://tools/check_static_scene.gd -- $Scene $geometryPath 1> $reviewLog 2> $reviewErrors
if ($LASTEXITCODE -ne 0) { Get-Content -LiteralPath $reviewLog, $reviewErrors; exit $LASTEXITCODE }
if ((Get-Content -LiteralPath $reviewErrors -Raw) -match '(SCRIPT ERROR|ERROR:)') { throw 'Godot reported errors; inspect the output logs.' }
if (!(Test-Path -LiteralPath $geometryPath)) { throw 'Expected geometry export was not written.' }
& $Python (Join-Path $PSScriptRoot 'check_static_scene.py') $geometryPath $reportPath
exit $LASTEXITCODE
