const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const store = require('./store.cjs');

// The set of top-level keys a valid backup file must have — matches store.cjs's
// own schema. Used to sanity-check an import before it overwrites real data.
const REQUIRED_KEYS = ['children', 'tasks', 'sessions', 'audit', 'rewards', 'redemptions', 'settings'];

function isValidBackupShape(data) {
  if (!data || typeof data !== 'object') return false;
  return REQUIRED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(data, key));
}

// dialog-driven — call only from the (already PIN-gated) parent dashboard.
async function exportBackup() {
  const defaultName = `familyquest-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const result = await dialog.showSaveDialog({
    title: 'שמירת גיבוי',
    defaultPath: defaultName,
    filters: [{ name: 'קובץ גיבוי', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, message: null };
  fs.writeFileSync(result.filePath, JSON.stringify(store.store, null, 2), 'utf-8');
  return { ok: true, message: `הגיבוי נשמר ב-${result.filePath}` };
}

async function importBackup() {
  const result = await dialog.showOpenDialog({
    title: 'בחירת קובץ גיבוי לשחזור',
    properties: ['openFile'],
    filters: [{ name: 'קובץ גיבוי', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false, message: null };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
  } catch {
    return { ok: false, message: 'הקובץ אינו קובץ גיבוי תקין (JSON פגום)' };
  }
  if (!isValidBackupShape(data)) {
    return { ok: false, message: 'הקובץ אינו קובץ גיבוי של FamilyQuest PC' };
  }
  for (const key of REQUIRED_KEYS) store.set(key, data[key]);
  if (Object.prototype.hasOwnProperty.call(data, 'familyGoal')) store.set('familyGoal', data.familyGoal);
  return { ok: true, message: 'השחזור הושלם — מומלץ להפעיל מחדש את התוכנה' };
}

// A lightweight safety net, no scheduling: keep the last 5 automatic snapshots of
// the data file, refreshed once on every app launch. Silent/best-effort — a failed
// snapshot should never block the app from starting.
function autoSnapshot() {
  try {
    const dataFile = path.join(app.getPath('userData'), 'familyquest-data.json');
    if (!fs.existsSync(dataFile)) return;
    const backupsDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(dataFile, path.join(backupsDir, `familyquest-data-${stamp}.json`));
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith('familyquest-data-'))
      .sort();
    while (files.length > 5) {
      fs.unlinkSync(path.join(backupsDir, files.shift()));
    }
  } catch {
    // Best-effort only — never let a snapshot failure block startup.
  }
}

module.exports = { exportBackup, importBackup, autoSnapshot, isValidBackupShape, REQUIRED_KEYS };
