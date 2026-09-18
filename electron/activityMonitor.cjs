// Detects which application is in the foreground during an active (unlocked)
// screen-time session, so a parent-configured "approved apps" list can be
// enforced. Deliberately DETECT + LOG + NOTIFY only — it never force-closes
// anything. Killing an arbitrary foreground app risks destroying a kid's
// unsaved work or closing something legitimate the parent didn't think to
// allow-list, which is a worse outcome than a logged, gently-flagged app.
const { execFile } = require('child_process');

// Windows shell/system surfaces a child will legitimately touch just by using
// the Start menu, search, or window switching — never worth flagging.
const EXEMPT = new Set([
  'explorer',
  'dwm',
  'LockApp',
  'ApplicationFrameHost',
  'SearchHost',
  'ShellExperienceHost',
  'SystemSettings',
  'TextInputHost',
  'StartMenuExperienceHost',
  'electron',
  'FamilyQuest PC'
]);

const PS_SNIPPET = `
Add-Type -Name Win32 -Namespace Native -MemberDefinition '
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
';
$hwnd = [Native.Win32]::GetForegroundWindow();
$procId = 0;
[Native.Win32]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null;
if ($procId -ne 0) { (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName }
`;

function getForegroundProcessName() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_SNIPPET], { timeout: 4000 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve((stdout || '').trim() || null);
    });
  });
}

// True if `name` (a raw process name from Windows, no .exe) is allowed for a
// child whose allow-list is `allowedApps` (free-text entries the parent typed,
// compared case-insensitively, with or without a trailing .exe).
function isAppAllowed(name, allowedApps) {
  if (!name) return true;
  if (EXEMPT.has(name)) return true;
  const norm = name.toLowerCase().replace(/\.exe$/, '');
  return (allowedApps || []).some((a) => String(a).toLowerCase().replace(/\.exe$/, '') === norm);
}

module.exports = { getForegroundProcessName, isAppAllowed, EXEMPT };
