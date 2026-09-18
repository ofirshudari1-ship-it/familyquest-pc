const crypto = require('crypto');
const store = require('./store.cjs');

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

function setPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const pinHash = hashPin(pin, salt);
  store.setSettings({ pinHash, pinSalt: salt });
}

function hasPin() {
  const { pinHash, pinSalt } = store.getSettings();
  return Boolean(pinHash && pinSalt);
}

function verifyPin(pin) {
  const { pinHash, pinSalt } = store.getSettings();
  if (!pinHash || !pinSalt) return false;
  const candidate = hashPin(pin, pinSalt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(pinHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---------- Local PIN recovery (security question) ----------
// No email, no server — a preset question the parent answers at setup, hashed
// with the same scrypt+salt approach as the PIN itself. Honest limitation: this
// only protects against a child who doesn't know/guess the answer, not a
// determined one — documented in SPEC.md alongside this app's other honesty notes.

const SECURITY_QUESTIONS = [
  { id: 'first_pet', text: 'מה השם של חיית המחמד הראשונה שלך?' },
  { id: 'birth_city', text: 'באיזו עיר נולדת?' },
  { id: 'mother_name', text: 'מה השם הפרטי של אמא שלך?' },
  { id: 'first_school', text: 'מה שם בית הספר היסודי שלך?' },
  { id: 'favorite_teacher', text: 'מי היה המורה/ה האהוב/ה עליך?' }
];

function normalizeAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}

function setSecurityQuestion(questionId, answer) {
  if (!SECURITY_QUESTIONS.some((q) => q.id === questionId)) throw new Error('שאלת אבטחה לא תקינה');
  const normalized = normalizeAnswer(answer);
  if (normalized.length < 2) throw new Error('התשובה קצרה מדי');
  const salt = crypto.randomBytes(16).toString('hex');
  const securityAnswerHash = hashPin(normalized, salt);
  store.setSettings({ securityQuestionId: questionId, securityAnswerHash, securityAnswerSalt: salt });
}

function hasSecurityQuestion() {
  const { securityQuestionId, securityAnswerHash, securityAnswerSalt } = store.getSettings();
  return Boolean(securityQuestionId && securityAnswerHash && securityAnswerSalt);
}

// Returns { id, text } without ever exposing the stored answer/hash.
function getSecurityQuestion() {
  const { securityQuestionId } = store.getSettings();
  return SECURITY_QUESTIONS.find((q) => q.id === securityQuestionId) || null;
}

function verifySecurityAnswer(answer) {
  const { securityAnswerHash, securityAnswerSalt } = store.getSettings();
  if (!securityAnswerHash || !securityAnswerSalt) return false;
  const candidate = hashPin(normalizeAnswer(answer), securityAnswerSalt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(securityAnswerHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Verifies the answer itself (never trusts the renderer's word for it) before
// applying the new PIN — the one place a PIN can be replaced without knowing the old one.
function resetPinViaRecovery(answer, newPin) {
  if (!verifySecurityAnswer(answer)) throw new Error('התשובה שגויה');
  setPin(newPin);
  return true;
}

module.exports = {
  setPin,
  hasPin,
  verifyPin,
  SECURITY_QUESTIONS,
  setSecurityQuestion,
  hasSecurityQuestion,
  getSecurityQuestion,
  verifySecurityAnswer,
  resetPinViaRecovery
};
