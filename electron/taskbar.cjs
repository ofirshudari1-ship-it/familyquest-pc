// Restores the Windows taskbar (Shell_TrayWnd) via the standard ShowWindow
// technique. This module intentionally only ever SHOWS it, never hides it —
// an earlier version also hid it during kiosk lock, which caused a real
// incident: the app was killed (Task Manager / crash) while it had the
// taskbar hidden, and since that OS-level hide is not tied to the app's
// process lifetime, the user's taskbar stayed gone system-wide even with
// the app not running at all, until they manually restarted explorer.exe.
// Kiosk fullscreen + always-on-top already covers the taskbar visually while
// locked, without that failure mode — see SPEC.md nispach ד'.
const { execFile } = require('child_process');

// %CMD% is substituted with a hardcoded integer from this file only (never user
// input) before the script text is passed as a single PowerShell -Command argument
// via execFile (no shell involved, so nothing here is exposed to injection).
const PS_SNIPPET = `
Add-Type -Name Win32 -Namespace Native -MemberDefinition '
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
';
$tray = [Native.Win32]::FindWindow('Shell_TrayWnd', $null);
if ($tray -ne [IntPtr]::Zero) { [Native.Win32]::ShowWindow($tray, %CMD%) | Out-Null }
`;

function showTaskbar() {
  if (process.platform !== 'win32') return;
  const script = PS_SNIPPET.replace('%CMD%', '5'); // SW_SHOW
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], () => {
    /* best-effort; nothing to do if it fails (e.g. non-standard shell) */
  });
}

module.exports = { showTaskbar };
