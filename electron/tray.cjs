const { Tray, Menu, nativeImage, app } = require('electron');
const economy = require('./economy.cjs');
const lockManager = require('./lockManager.cjs');
const windows = require('./windows.cjs');
const { ICON_PNG_BASE64 } = require('./icon.cjs');

let tray = null;

function buildMenu() {
  const settings = require('./store.cjs').getSettings();
  const pendingCount = economy.getTasks().filter((t) => t.status === 'submitted').length;

  return Menu.buildFromTemplate([
    { label: `FamilyQuest PC v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    {
      label: pendingCount > 0 ? `פתח דשבורד הורים (${pendingCount} ממתינים)` : 'פתח דשבורד הורים',
      click: () => windows.getOrCreateDashboardWindow()
    },
    {
      label: 'הקפא מחשב עכשיו',
      click: () => {
        if (settings.activeChildId) lockManager.freeze(settings.activeChildId);
      }
    },
    { type: 'separator' },
    { label: 'אודות', role: 'about' }
  ]);
}

function createTray() {
  const icon = nativeImage.createFromBuffer(Buffer.from(ICON_PNG_BASE64, 'base64'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('FamilyQuest PC');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => windows.getOrCreateDashboardWindow());

  // Refresh the menu label whenever a quest is submitted for approval, so the
  // pending count in the tray stays live without the parent reopening the menu.
  lockManager.on('state', () => tray.setContextMenu(buildMenu()));

  return tray;
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildMenu());
}

module.exports = { createTray, refreshTray };
