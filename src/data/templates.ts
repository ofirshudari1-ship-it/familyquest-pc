// Curated common quests/rewards — the honest, zero-cost stand-in for "AI
// suggestions to save setup time" (see SPEC.md). Plain content, not a live
// service: picking one pre-fills the create form so the parent still reviews
// and can tweak before saving anything.
import type { Recurrence } from '../types';

export interface QuestTemplate {
  title: string;
  rewardCoins: number;
  recurrence: Recurrence;
  requiresProof?: boolean;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { title: 'לסדר את החדר', rewardCoins: 10, recurrence: 'daily', requiresProof: true },
  { title: 'לצחצח שיניים', rewardCoins: 5, recurrence: 'daily' },
  { title: 'שיעורי בית', rewardCoins: 20, recurrence: 'daily' },
  { title: 'לקרוא 20 דקות', rewardCoins: 15, recurrence: 'daily' },
  { title: 'לפנות כלים מהמדיח', rewardCoins: 8, recurrence: 'daily' },
  { title: 'להוציא זבל', rewardCoins: 8, recurrence: 'weekly' },
  { title: 'לסדר תיק לבית ספר', rewardCoins: 5, recurrence: 'daily' },
  { title: 'להאכיל את חיית המחמד', rewardCoins: 6, recurrence: 'daily' },
  { title: 'לקפל כביסה', rewardCoins: 10, recurrence: 'weekly' },
  { title: 'להתרחץ בלי תזכורת', rewardCoins: 5, recurrence: 'daily' },
  { title: 'לעזור בהכנת ארוחה', rewardCoins: 12, recurrence: 'weekly', requiresProof: true },
  { title: 'לתרגל כלי נגינה', rewardCoins: 10, recurrence: 'daily' }
];

// Bundles of the templates above — the honest, zero-cost version of "automation":
// one click creates several quests at once instead of the parent repeating the
// single-quest flow. Titles must match an entry in QUEST_TEMPLATES above.
export interface QuestPack {
  id: string;
  title: string;
  icon: string;
  questTitles: string[];
}

export const QUEST_PACKS: QuestPack[] = [
  { id: 'morning', title: 'שגרת בוקר', icon: '🌅', questTitles: ['לצחצח שיניים', 'להתרחץ בלי תזכורת', 'לסדר תיק לבית ספר'] },
  { id: 'evening', title: 'שגרת ערב', icon: '🌙', questTitles: ['לסדר את החדר', 'לפנות כלים מהמדיח', 'שיעורי בית'] },
  { id: 'house_help', title: 'עזרה בבית', icon: '🧹', questTitles: ['לקפל כביסה', 'להוציא זבל', 'לעזור בהכנת ארוחה'] },
  { id: 'learning', title: 'הרגלי למידה', icon: '📚', questTitles: ['לקרוא 20 דקות', 'לתרגל כלי נגינה'] }
];

export interface RewardTemplate {
  title: string;
  cost: number;
  emoji: string;
  tier: 'small' | 'medium' | 'large';
}

export const REWARD_TEMPLATES: RewardTemplate[] = [
  { title: 'פרק נוסף בסדרה', cost: 15, emoji: '📺', tier: 'small' },
  { title: 'ממתק אחרי ארוחה', cost: 10, emoji: '🍬', tier: 'small' },
  { title: 'סרט משפחתי', cost: 30, emoji: '🎬', tier: 'medium' },
  { title: 'פיצה ביום שישי', cost: 50, emoji: '🍕', tier: 'medium' },
  { title: 'לילה מאוחר בסופ"ש', cost: 40, emoji: '🌙', tier: 'medium' },
  { title: 'בילוי אחד-על-אחד עם הורה', cost: 60, emoji: '❤️', tier: 'medium' },
  { title: 'חבר/ה בא/ה לבקר', cost: 45, emoji: '👫', tier: 'medium' },
  { title: 'צעצוע חדש', cost: 200, emoji: '🧸', tier: 'large' },
  { title: 'טיול משפחתי', cost: 250, emoji: '🎡', tier: 'large' },
  { title: 'משחק וידאו חדש', cost: 300, emoji: '🎮', tier: 'large' }
];
