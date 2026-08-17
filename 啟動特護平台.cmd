@echo off
set "PATH=%LOCALAPPDATA%\Programs\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0app"
echo ============================================
echo   TeHu Platform dev server
echo   Keep this window open. Close = stop.
echo ============================================
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000/today"
npm run dev
