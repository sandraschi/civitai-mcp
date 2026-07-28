set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    @just --list

UV := "C:\\Users\\sandr\\.local\\bin\\uv.exe"
REPO := "D:\\Dev\\repos\\civitai-mcp"

install:
    & "{{UV}}" sync --extra dev

bootstrap: install
    Set-Location "{{REPO}}"; & "{{UV}}" run pre-commit install
    Write-Host "Pre-commit hooks installed." -ForegroundColor Green

serve:
    Set-Location "{{REPO}}"; powershell.exe -NoProfile -ExecutionPolicy Bypass -File start.ps1

dev: serve

lint:
    & "{{UV}}" run ruff check src tests
    & "{{UV}}" run ruff format --check src tests

test:
    & "{{UV}}" run python -m pytest -q tests/

ci:
    & "{{UV}}" run ruff check src tests
    & "{{UV}}" run ruff format --check src tests
    & "{{UV}}" run python -m pytest -q tests/
    Set-Location "{{REPO}}\\webapp"; npm run check; npm run biome:ci

test-e2e:
    Set-Location "{{REPO}}\\webapp"; npm run test:e2e

# Bundle MCP server for Claude Desktop (MCPB)
mcpb-pack:
    Set-Location "{{REPO}}"; powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/mcpb-pack.ps1

# Tauri NSIS release build (requires icons, PyInstaller spec, webapp dist)
build-native:
    $env:Path = "$env:USERPROFILE\\.cargo\\bin;$env:Path"
    Set-Location "{{REPO}}"; powershell.exe -NoProfile -ExecutionPolicy Bypass -File src-tauri/build.ps1

# Tauri debug build (skip PyInstaller when backend exe already in resources/)
build-native-debug:
    $env:Path = "$env:USERPROFILE\\.cargo\\bin;$env:Path"
    Set-Location "{{REPO}}\\src-tauri"
    npx @tauri-apps/cli build --debug
