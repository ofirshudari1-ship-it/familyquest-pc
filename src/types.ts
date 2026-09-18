export type Recurrence = 'once' | 'daily' | 'weekly';
export type TaskStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface Child {
  id: string;
  name: string;
  avatarId: string;
  coinBalance: number;
  lifetimeCoinsEarned: number;
  dailyTimeLimitMins: number;
  weekendDailyLimitMins: number | null;
  bedtimeStart: string;
  bedtimeEnd: string;
  streakMilestonesAwarded: number[];
  restrictedWindows: RestrictedWindow[];
  allowedApps: string[];
  coinMultiplier: CoinMultiplier | null;
  companionId: string;
  themeColor: string;
  lastSpinDate: string | null;
  createdAt: string;
}

export interface CoinMultiplier {
  value: number;
  expiresAt: string;
}

export interface Insight {
  id: string;
  icon: string;
  title: string;
  message: string;
}

export interface RestrictedWindow {
  id: string;
  label: string;
  days: number[]; // 0=Sunday .. 6=Saturday
  start: string;
  end: string;
}

export interface Level {
  level: number;
  title: string;
  coinsIntoLevel: number;
  coinsToNextLevel: number;
  progress: number; // 0..1
}

export interface Task {
  id: string;
  childId: string;
  title: string;
  rewardCoins: number;
  requiresProof: boolean; // parent requires a proof photo before this task can be submitted
  recurrence: Recurrence;
  activeDays?: number[] | null; // 0=Sunday..6=Saturday; null = plain daily/weekly period reset
  coopId?: string | null; // shared by every sibling task in the same co-op quest
  status: TaskStatus;
  notes: string;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  proofPath: string | null;
}

export interface CoopQuest {
  id: string;
  title: string;
  bonusCoins: number;
  childIds: string[];
  taskIds: string[];
  createdAt: string;
  completedAt: string | null;
  approvedCount: number;
  totalCount: number;
  // Representative per-child terms (from a still-pending sibling task, or any
  // sibling task if none are pending) — for display and as edit-form defaults.
  rewardCoins: number;
  requiresProof: boolean;
}

export interface FamilyGoal {
  id: string;
  title: string;
  emoji: string;
  targetCoins: number;
  rewardText: string;
  contributedCoins: number;
  createdAt: string;
  completedAt: string | null;
}

export interface CoinsDay {
  date: string;
  coins: number;
}

export interface FamilyWeeklyRow {
  childId: string;
  name: string;
  coinsThisWeek: number;
  tasksApprovedThisWeek: number;
}

export interface WeeklyStar {
  childId: string;
  name: string;
  rate: number;
}

export interface WeeklyDigest {
  shouldShow: boolean;
  totalCoins: number;
  totalTasksApproved: number;
  totalMinutes: number;
  childCount: number;
  starName: string | null;
}

export interface SecurityQuestion {
  id: string;
  text: string;
}

export interface ScreenSession {
  id: string;
  childId: string;
  coinsSpent: number;
  minutesGranted: number;
  startTime: string;
  endTime: string;
  actualEndTime: string | null;
  reason: 'redeem' | 'homework_pass';
}

export interface AuditEntry {
  id: string;
  ts: string;
  childId: string | null;
  type: string;
  message: string;
}

export interface Settings {
  onboarded: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  coinsPerMinute: number;
  autostart: boolean;
  activeChildId: string | null;
  whitelist: string[];
  soundEffectsEnabled: boolean;
  lowBalanceThreshold: number;
  updateFeedUrl: string | null;
  siblingRecognitionEnabled: boolean;
  securityQuestionId: string | null;
  securityAnswerHash: string | null;
  securityAnswerSalt: string | null;
}

export type LockState =
  | { status: 'setup' }
  | { status: 'picker' }
  | { status: 'locked'; childId: string; reason: 'no_time' | 'bedtime' }
  | { status: 'locked'; childId: string; reason: 'restricted'; label: string }
  | { status: 'unlocked'; childId: string; reason: 'redeem' | 'homework_pass'; sessionId: string; remainingMs: number };

export interface UsageDay {
  date: string;
  minutes: number;
}

export interface CompletionRate {
  approved: number;
  total: number;
  rate: number | null;
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
}

export interface BadgeProgress {
  id: string;
  emoji: string;
  title: string;
  target: number;
  current: number;
  unlocked: boolean;
}

export interface SpinPrize {
  id: string;
  emoji: string;
  label: string;
  weight: number;
  type: 'coins' | 'multiplier';
  amount: number;
  durationMs?: number;
}

export interface SpinResult {
  prizeId: string;
  emoji: string;
  label: string;
  type: 'coins' | 'multiplier';
  amount: number;
}

export interface Reward {
  id: string;
  childId: string;
  title: string;
  cost: number;
  emoji: string;
  tier: 'small' | 'medium' | 'large';
  createdAt: string;
}

export type RedemptionStatus = 'pending' | 'fulfilled';

export interface Redemption {
  id: string;
  childId: string;
  rewardId: string;
  rewardTitle: string;
  rewardEmoji: string;
  cost: number;
  status: RedemptionStatus;
  requestedAt: string;
  fulfilledAt: string | null;
}

export type CelebrationEvent =
  | { childId: string; type: 'level_up'; payload: { level: number; title: string } }
  | { childId: string; type: 'streak_milestone'; payload: { days: number; bonus: number } }
  | { childId: string | null; type: 'family_goal_complete'; payload: { title: string; rewardText: string } }
  | { childId: string | null; type: 'coop_complete'; payload: { title: string; bonusCoins: number } };

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'dev-mode'; message: string }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

declare global {
  interface Window {
    familyquest: {
      listChildren: () => Promise<Child[]>;
      addChild: (data: Partial<Child>) => Promise<Child>;
      updateChild: (id: string, patch: Partial<Child>) => Promise<Child>;
      removeChild: (id: string) => Promise<void>;
      selectChild: (id: string | null) => Promise<LockState>;

      listTasks: (childId?: string) => Promise<Task[]>;
      createTask: (data: Partial<Task>) => Promise<Task>;
      submitTask: (taskId: string, attachProof: boolean) => Promise<Task>;
      approveTask: (taskId: string) => Promise<Task>;
      rejectTask: (taskId: string, note?: string) => Promise<Task>;
      removeTask: (taskId: string) => Promise<void>;
      createCoopQuest: (data: {
        title: string;
        rewardCoins: number;
        bonusCoins: number;
        requiresProof: boolean;
        recurrence?: Recurrence;
        childIds: string[];
      }) => Promise<CoopQuest>;
      listCoopQuests: (childId?: string) => Promise<CoopQuest[]>;
      updateCoopQuest: (
        coopId: string,
        patch: { title?: string; rewardCoins?: number; bonusCoins?: number; requiresProof?: boolean }
      ) => Promise<CoopQuest>;
      cancelCoopQuest: (coopId: string) => Promise<void>;
      getProofImage: (proofPath: string) => Promise<string | null>;

      redeemMinutes: (childId: string, minutes: number) => Promise<ScreenSession>;
      grantHomeworkPass: (childId: string, minutes: number) => Promise<ScreenSession>;
      getLockState: () => Promise<LockState>;
      freeze: (childId: string) => Promise<void>;
      onLockState: (cb: (state: LockState) => void) => () => void;
      onWarning: (cb: (payload: { childId: string; minutesLeft: number }) => void) => () => void;

      usageByDay: (childId: string, days?: number) => Promise<UsageDay[]>;
      completionRate: (childId: string, days?: number) => Promise<CompletionRate>;
      getAudit: (childId?: string, limit?: number) => Promise<AuditEntry[]>;
      getTodayLimit: (childId: string) => Promise<number>;
      getBadges: (childId: string) => Promise<Badge[]>;
      getBadgeProgress: (childId: string) => Promise<BadgeProgress[]>;
      getStreak: (childId: string) => Promise<number>;
      getLevel: (childId: string) => Promise<Level | null>;
      getInsights: (childId: string) => Promise<Insight[]>;
      coinsEarnedByDay: (childId: string, days?: number) => Promise<CoinsDay[]>;
      familyWeeklySummary: () => Promise<FamilyWeeklyRow[]>;
      getWeeklyStar: () => Promise<WeeklyStar | null>;
      getWeeklyDigest: () => Promise<WeeklyDigest>;
      markWeeklyDigestSeen: () => Promise<void>;
      exportReportCsv: (childId: string, days: number) => Promise<{ ok: boolean; path?: string }>;
      onAppFlagged: (cb: (payload: { childId: string; app: string }) => void) => () => void;
      onCelebrate: (cb: (event: CelebrationEvent) => void) => () => void;

      grantMultiplier: (childId: string, value: number, durationMs: number) => Promise<Child>;
      clearMultiplier: (childId: string) => Promise<Child>;

      getFamilyGoal: () => Promise<FamilyGoal | null>;
      createFamilyGoal: (data: { title: string; emoji: string; targetCoins: number; rewardText: string }) => Promise<FamilyGoal>;
      clearFamilyGoal: () => Promise<void>;

      exportBackup: () => Promise<{ ok: boolean; message: string | null }>;
      importBackup: () => Promise<{ ok: boolean; message: string | null }>;

      getWheelCatalog: () => Promise<SpinPrize[]>;
      getWheelStatus: (childId: string) => Promise<boolean>;
      spinWheel: (childId: string) => Promise<SpinResult>;

      createRestrictedWindow: (data: { childId: string; label: string; days: number[]; start: string; end: string }) => Promise<RestrictedWindow>;
      removeRestrictedWindow: (childId: string, windowId: string) => Promise<void>;

      listRewards: (childId?: string) => Promise<Reward[]>;
      createReward: (data: Partial<Reward>) => Promise<Reward>;
      removeReward: (rewardId: string) => Promise<void>;
      listRedemptions: (childId?: string) => Promise<Redemption[]>;
      requestReward: (childId: string, rewardId: string) => Promise<Redemption>;
      fulfillRedemption: (redemptionId: string) => Promise<Redemption>;

      getSettings: () => Promise<Settings>;
      setSettings: (patch: Partial<Settings>) => Promise<Settings>;
      hasPin: () => Promise<boolean>;
      setPin: (pin: string) => Promise<boolean>;
      verifyPin: (pin: string) => Promise<boolean>;
      getSecurityQuestions: () => Promise<SecurityQuestion[]>;
      setSecurityQuestion: (questionId: string, answer: string) => Promise<boolean>;
      hasSecurityQuestion: () => Promise<boolean>;
      getSecurityQuestion: () => Promise<SecurityQuestion | null>;
      verifySecurityAnswer: (answer: string) => Promise<boolean>;
      resetPinViaRecovery: (answer: string, newPin: string) => Promise<boolean>;

      checkForUpdates: () => Promise<UpdateStatus>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;

      appInfo: () => Promise<{ name: string; version: string }>;
      quitApp: () => Promise<void>;
      openDashboard: () => Promise<void>;
      openServiceFolder: () => Promise<void>;
    };
  }
}
