@echo off
setlocal
cd /d "%~dp0"

set "TARGET_VBS=%~dp0ORBIT.vbs"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ORBIT AI.lnk"
set "ICON_PATH=%~dp0nova-os\public\favicon.ico"

echo Creating Windows Desktop shortcut for ORBIT...

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = 'wscript.exe'; " ^
    "$s.Arguments = '\"%TARGET_VBS%\"'; " ^
    "$s.WorkingDirectory = '%~dp0'; " ^
    "$s.Description = 'ORBIT — Native AI Command Center'; " ^
    "if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%, 0' }; " ^
    "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Desktop shortcut created at: "%SHORTCUT_PATH%"
) else (
    echo [ERROR] Failed to create desktop shortcut.
)
pause
