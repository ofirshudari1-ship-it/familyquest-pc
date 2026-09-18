@echo off
setlocal EnableDelayedExpansion
title FamilyQuest PC - Watchdog Installer

:: Self-elevate to Administrator if not already running as one.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo  FamilyQuest PC - Watchdog Installer
echo ============================================================
echo.
echo This creates TWO Windows Scheduled Tasks that keep FamilyQuest
echo PC running: one at logon, one every minute. Both simply try to
echo (re)start the app - if it is already running this is a harmless
echo no-op, and if a child closed it via Task Manager it comes back
echo within about a minute.
echo.
echo Both tasks run as SYSTEM, so a standard (non-admin) Windows
echo account cannot disable or delete them from Task Scheduler -
echo only an Administrator can, using Uninstall-Watchdog.bat.
echo.

:: As of v2.2.1 the installer defaults to a per-machine install under
:: Program Files (perMachine: true in package.json). Older installs (pre
:: v2.2.1, or a per-user install picked manually in the setup wizard) still
:: land under %LOCALAPPDATA%\Programs, so we check both.
set "DEFAULT_EXE=%ProgramFiles%\FamilyQuest PC\FamilyQuest PC.exe"
set "LEGACY_EXE=%LOCALAPPDATA%\Programs\FamilyQuest PC\FamilyQuest PC.exe"
set "APP_EXE=%DEFAULT_EXE%"

if not exist "%APP_EXE%" (
    if exist "%LEGACY_EXE%" (
        set "APP_EXE=%LEGACY_EXE%"
    )
)

if not exist "%APP_EXE%" (
    echo Could not find FamilyQuest PC at the default location:
    echo   %DEFAULT_EXE%
    echo or the legacy per-user location:
    echo   %LEGACY_EXE%
    echo.
    set /p APP_EXE=Enter the full path to "FamilyQuest PC.exe":
)

if not exist "%APP_EXE%" (
    echo.
    echo ERROR: That path does not exist. Install FamilyQuest PC first ^
(run the Setup file^), then re-run this installer.
    pause
    exit /b 1
)

echo.
echo Using: %APP_EXE%
echo.

schtasks /Create /TN "FamilyQuestPC-Watchdog-Logon" /TR "\"%APP_EXE%\"" /SC ONLOGON /RU SYSTEM /RL HIGHEST /IT /F
schtasks /Create /TN "FamilyQuestPC-Watchdog-Minute" /TR "\"%APP_EXE%\"" /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /IT /F

echo.
echo ============================================================
echo  Done. FamilyQuest PC will now relaunch automatically if it
echo  is ever closed or killed while the child is logged on.
echo  To remove this later, run Uninstall-Watchdog.bat as admin.
echo ============================================================
pause
