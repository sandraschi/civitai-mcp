param([switch]$FrontendOnly)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RepoName = "civitai-mcp"
$Triple = "x86_64-pc-windows-msvc"
$ResourceDir = "$PSScriptRoot\resources"
$DevDir = "$PSScriptRoot\binaries"
New-Item -ItemType Directory -Force -Path $ResourceDir, $DevDir | Out-Null

Write-Host "=== ${RepoName} Tauri Release Build ===" -ForegroundColor Cyan
Write-Host "Ports: backend 11124 / frontend 11125" -ForegroundColor Gray

# Step 1: Frontend build
$frontend = Join-Path $Root "webapp"
if (-not (Test-Path "$frontend\package.json")) {
    throw "webapp/package.json not found"
}
Write-Host "-> [1/4] Building frontend (webapp)..." -ForegroundColor Yellow
Push-Location $frontend
npm install --silent 2>$null
Write-Host "  tsc --noEmit..." -ForegroundColor Gray
$tscOut = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $tscOut
    throw "TypeScript compilation failed"
}
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
Pop-Location

if ($FrontendOnly) {
    Write-Host "FrontendOnly - skipping PyInstaller and Tauri bundle" -ForegroundColor Yellow
    exit 0
}

# Step 2: PyInstaller backend
Write-Host "-> [2/4] PyInstaller backend..." -ForegroundColor Yellow
$specFile = "$Root\${RepoName}-backend.spec"
if (-not (Test-Path $specFile)) {
    throw "Missing $specFile - add PyInstaller spec before build-native (see mcp-central-docs/standards/rules/tauri_nsis_building.md)"
}
Push-Location $Root
uv run pyinstaller "$specFile" --clean --noconfirm
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }
Pop-Location

# Step 3: Embed backend + .env.example
Write-Host "-> [3/4] Embedding backend..." -ForegroundColor Yellow
$src = "$Root\dist\${RepoName}-backend.exe"
if (-not (Test-Path $src)) { throw "Backend exe not found at $src" }
$sizeMB = (Get-Item $src).Length / 1MB
if ($sizeMB -lt 5) {
    throw "Backend exe is only $([math]::Round($sizeMB, 1)) MB - PyInstaller produced an empty/broken binary"
}
$envExample = "$Root\.env.example"
if (Test-Path $envExample) {
    Copy-Item $envExample "$ResourceDir\.env.example" -Force
    Write-Host "  Bundled .env.example" -ForegroundColor Green
}
Copy-Item $src "$ResourceDir\${RepoName}-backend.exe" -Force
Copy-Item $src "$DevDir\${RepoName}-backend-$Triple.exe" -Force

# Step 4: NSIS bundle
Write-Host "-> [4/4] Tauri NSIS bundle..." -ForegroundColor Yellow
if (-not (Test-Path "$PSScriptRoot\icons\icon.ico")) {
    throw "Missing src-tauri/icons/icon.ico - run: npx @tauri-apps/cli icon path/to/source.png"
}
Push-Location $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npx @tauri-apps/cli build --bundles nsis
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE" }
Pop-Location

$distDir = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$nsisDir = "$PSScriptRoot\target\release\bundle\nsis"
if (Test-Path $nsisDir) { Copy-Item "$nsisDir\*-setup.exe" "$distDir\" -Force }
Write-Host "=== Build complete ===" -ForegroundColor Green
Write-Host "Ship: $nsisDir\*.exe"
