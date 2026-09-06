@echo off
title Montador de Time Pokemon (Cobbleverse)
cd /d "%~dp0"
start "" http://localhost:5173
node server.js
pause
