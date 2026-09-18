const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('familyquest', {
  // Children
  listChildren: () => ipcRenderer.invoke('children:list'),
  addChild: (data) => ipcRenderer.invoke('children:add', data),
  updateChild: (id, patch) => ipcRenderer.invoke('children:update', id, patch),
  removeChild: (id) => ipcRenderer.invoke('children:remove', id),
  selectChild: (id) => ipcRenderer.invoke('children:select', id),

  // Tasks / quests
  listTasks: (childId) => ipcRenderer.invoke('tasks:list', childId),
  createTask: (data) => ipcRenderer.invoke('tasks:create', data),
  submitTask: (taskId, attachProof) => ipcRenderer.invoke('tasks:submit', taskId, attachProof),
  approveTask: (taskId) => ipcRenderer.invoke('tasks:approve', taskId),
  rejectTask: (taskId, note) => ipcRenderer.invoke('tasks:reject', taskId, note),
  removeTask: (taskId) => ipcRenderer.invoke('tasks:remove', taskId),
  createCoopQuest: (data) => ipcRenderer.invoke('coop:create', data),
  listCoopQuests: (childId) => ipcRenderer.invoke('coop:list', childId),
  updateCoopQuest: (coopId, patch) => ipcRenderer.invoke('coop:update', coopId, patch),
  cancelCoopQuest: (coopId) => ipcRenderer.invoke('coop:cancel', coopId),

  // Screen time
  redeemMinutes: (childId, minutes) => ipcRenderer.invoke('sessions:redeem', childId, minutes),
  grantHomeworkPass: (childId, minutes) => ipcRenderer.invoke('sessions:homeworkPass', childId, minutes),
  getLockState: () => ipcRenderer.invoke('lock:getState'),
  freeze: (childId) => ipcRenderer.invoke('lock:freeze', childId),
  onLockState: (callback) => on('lock:state', callback),
  onWarning: (callback) => on('lock:warning', callback),

  // Reports
  usageByDay: (childId, days) => ipcRenderer.invoke('reports:usageByDay', childId, days),
  completionRate: (childId, days) => ipcRenderer.invoke('reports:completionRate', childId, days),
  getAudit: (childId, limit) => ipcRenderer.invoke('reports:audit', childId, limit),
  getTodayLimit: (childId) => ipcRenderer.invoke('reports:todayLimit', childId),
  getBadges: (childId) => ipcRenderer.invoke('reports:badges', childId),
  getBadgeProgress: (childId) => ipcRenderer.invoke('reports:badgeProgress', childId),
  getStreak: (childId) => ipcRenderer.invoke('reports:streak', childId),
  getLevel: (childId) => ipcRenderer.invoke('reports:level', childId),
  getInsights: (childId) => ipcRenderer.invoke('reports:insights', childId),
  coinsEarnedByDay: (childId, days) => ipcRenderer.invoke('reports:coinsEarnedByDay', childId, days),
  familyWeeklySummary: () => ipcRenderer.invoke('reports:familyWeeklySummary'),
  getWeeklyStar: () => ipcRenderer.invoke('reports:weeklyStar'),
  getWeeklyDigest: () => ipcRenderer.invoke('reports:weeklyDigest'),
  markWeeklyDigestSeen: () => ipcRenderer.invoke('reports:markWeeklyDigestSeen'),
  exportReportCsv: (childId, days) => ipcRenderer.invoke('reports:exportCsv', childId, days),
  getProofImage: (proofPath) => ipcRenderer.invoke('reports:proofImage', proofPath),
  onAppFlagged: (callback) => on('lock:appFlagged', callback),
  onCelebrate: (callback) => on('lock:celebrate', callback),

  // Family goal
  getFamilyGoal: () => ipcRenderer.invoke('family:get'),
  createFamilyGoal: (data) => ipcRenderer.invoke('family:create', data),
  clearFamilyGoal: () => ipcRenderer.invoke('family:clear'),

  // Backup & restore
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // Prize wheel
  getWheelCatalog: () => ipcRenderer.invoke('wheel:catalog'),
  getWheelStatus: (childId) => ipcRenderer.invoke('wheel:status', childId),
  spinWheel: (childId) => ipcRenderer.invoke('wheel:spin', childId),

  // Coin multiplier events
  grantMultiplier: (childId, value, durationMs) => ipcRenderer.invoke('children:grantMultiplier', childId, value, durationMs),
  clearMultiplier: (childId) => ipcRenderer.invoke('children:clearMultiplier', childId),

  // Restricted time windows (beyond bedtime)
  createRestrictedWindow: (data) => ipcRenderer.invoke('restrictions:create', data),
  removeRestrictedWindow: (childId, windowId) => ipcRenderer.invoke('restrictions:remove', childId, windowId),

  // Reward shop
  listRewards: (childId) => ipcRenderer.invoke('rewards:list', childId),
  createReward: (data) => ipcRenderer.invoke('rewards:create', data),
  removeReward: (rewardId) => ipcRenderer.invoke('rewards:remove', rewardId),
  listRedemptions: (childId) => ipcRenderer.invoke('redemptions:list', childId),
  requestReward: (childId, rewardId) => ipcRenderer.invoke('redemptions:request', childId, rewardId),
  fulfillRedemption: (redemptionId) => ipcRenderer.invoke('redemptions:fulfill', redemptionId),

  // Settings / PIN
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  hasPin: () => ipcRenderer.invoke('pin:has'),
  setPin: (pin) => ipcRenderer.invoke('pin:set', pin),
  verifyPin: (pin) => ipcRenderer.invoke('pin:verify', pin),
  getSecurityQuestions: () => ipcRenderer.invoke('pin:securityQuestions'),
  setSecurityQuestion: (questionId, answer) => ipcRenderer.invoke('pin:setSecurityQuestion', questionId, answer),
  hasSecurityQuestion: () => ipcRenderer.invoke('pin:hasSecurityQuestion'),
  getSecurityQuestion: () => ipcRenderer.invoke('pin:getSecurityQuestion'),
  verifySecurityAnswer: (answer) => ipcRenderer.invoke('pin:verifySecurityAnswer', answer),
  resetPinViaRecovery: (answer, newPin) => ipcRenderer.invoke('pin:resetViaRecovery', answer, newPin),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  getUpdateStatus: () => ipcRenderer.invoke('updates:getStatus'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback) => on('updates:status', callback),

  // App
  appInfo: () => ipcRenderer.invoke('app:info'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openDashboard: () => ipcRenderer.invoke('app:openDashboard'),
  openServiceFolder: () => ipcRenderer.invoke('app:openServiceFolder')
});
