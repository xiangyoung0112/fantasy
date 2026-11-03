@echo off
setlocal
title Fantasy Matchup - Local Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
echo Starting Fantasy Matchup...
echo Keep this window open while using the app.
echo URL: http://127.0.0.1:47831
echo.
start "" "http://127.0.0.1:47831"
node "%~dp0server.mjs"
echo.
echo The server stopped. Any error message is shown above.
pause
exit /b
:missing_node
echo Node.js was not found. Install Node.js 24 or newer.
echo Then reopen this launcher.
pause
exit /b 1
