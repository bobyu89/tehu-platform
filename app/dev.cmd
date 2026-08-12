@echo off
set "PATH=%LOCALAPPDATA%\Programs\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0"
npm run dev
