@echo off
title FamilyQuest PC - Watchdog Uninstaller

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Removing FamilyQuest PC watchdog scheduled tasks...
schtasks /Delete /TN "FamilyQuestPC-Watchdog-Logon" /F
schtasks /Delete /TN "FamilyQuestPC-Watchdog-Minute" /F
echo Done. FamilyQuest PC will no longer auto-relaunch if closed.
pause
