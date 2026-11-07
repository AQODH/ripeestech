@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or later is required. Install Node.js 24 LTS and try again.
  pause
  exit /b 1
)
if not exist "node_modules\esbuild\package.json" if not exist ".local\dependencies.json" (
  echo Installing project dependencies...
  call npm run install:ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts/local-server.mjs
pause

