@echo off
setlocal enabledelayedexpansion
title ORBIT AI Command Center

cd /d "%~dp0"

echo ===================================================
echo     ORBIT — NATIVE DESKTOP AI OPERATING SYSTEM
echo ===================================================
echo.

REM 1. Verify / Build Production Frontend if needed
if not exist "nova-os\dist\index.html" (
    echo [*] First-time setup: Building optimized production bundle...
    cd nova-os
    call npm run build
    cd ..
)

REM 2. Check if Python AI Backend is running on port 7915
if "%1"=="--restart" (
    echo [*] Resetting previous backend on port 7915...
    for /f "tokens=5" %%p in ('netstat -aon ^| findstr :7915') do (
        taskkill /F /PID %%p >nul 2>&1
    )
    timeout /t 1 >nul
)

netstat -ano | findstr :7915 >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Starting ORBIT Hybrid Intelligence Engine...
    start /b python server.py >nul 2>&1
    
    REM Wait up to 5 seconds for backend to initialize
    for /l %%i in (1,1,10) do (
        timeout /t 1 /nobreak >nul
        netstat -ano | findstr :7915 >nul 2>&1
        if !errorlevel! equ 0 goto backend_ready
    )
) else (
    echo [*] AI Backend already active on port 7915.
)

:backend_ready
echo [*] Launching Native ORBIT Application Window...

REM 3. Launch in Dedicated Native Windows Application Window (No browser chrome)
set EDGE_EXE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE_EXE% set EDGE_EXE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE_EXE% set EDGE_EXE="%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if exist %EDGE_EXE% (
    start "" %EDGE_EXE% --app="http://localhost:7915" --window-size=1440,920 --app-name="ORBIT AI" --enable-features=OverlayScrollbar,VaapiVideoDecoder --high-dpi-support=1
    exit /b 0
)

REM Fallback to Chrome App Mode if Edge not found
where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start "" chrome --app="http://localhost:7915" --window-size=1440,920
    exit /b 0
)

REM Ultimate fallback: Default Browser
start "" "http://localhost:7915"
exit /b 0
