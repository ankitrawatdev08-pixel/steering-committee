/**
 * STEERING COMMITTEE — Profanity Filter & Player Name Sanitizer
 * Replaces matched vulgarities (English & Hinglish transliterations) with asterisks.
 * Enforces 12-char limit, trims whitespace, defaults empty names to 'Player'.
 */

const PROFANITY_WORDS = [
  // English common profanities & slurs
  'fuck', 'fucker', 'fucking', 'shit', 'shitty', 'bitch', 'asshole', 'ass', 'bastard',
  'dick', 'cock', 'pussy', 'cunt', 'twat', 'wank', 'wanker', 'prick', 'slut', 'whore',
  'douche', 'motherfucker', 'crap', 'bullshit', 'blowjob', 'clit', 'dildo', 'nigger',
  'nigga', 'fag', 'faggot', 'retard', 'spic', 'chink', 'kike', 'dyke',

  // Hinglish transliterated vulgarities & slurs
  'madarchod', 'mc', 'bhenchod', 'bc', 'chutiya', 'chutiye', 'chut', 'gaand', 'gand',
  'gaandu', 'gandu', 'bhosdike', 'bhosadi', 'bhosada', 'harami', 'kameena', 'kamine',
  'lauda', 'lawda', 'loda', 'lund', 'randi', 'saala', 'saale', 'kutta', 'kutti',
  'kamina', 'suar', 'hijra', 'tatti', 'jhatu', 'jhaatu', 'jhaat', 'bhadva', 'bhadwe',
  'chod', 'chudai', 'behenchod', 'maarchod', 'randwa', 'lavde', 'lavda'
];

// Build regex matching whole or substring vulgarities safely
const profanityPattern = new RegExp(
  PROFANITY_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gi'
);

/**
 * Filters out profanity by replacing matches with asterisks
 * @param {string} text
 * @returns {string} Sanitized text
 */
function maskProfanity(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(profanityPattern, match => '*'.repeat(match.length));
}

/**
 * Sanitizes and validates a player name
 * @param {string} rawName
 * @returns {string} Sanitized name (max 12 characters, trimmed, default 'Player')
 */
function sanitizePlayerName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return 'Player';
  }

  let cleaned = rawName.trim();
  if (cleaned.length === 0) {
    return 'Player';
  }

  cleaned = maskProfanity(cleaned);

  // Limit to 12 characters
  if (cleaned.length > 12) {
    cleaned = cleaned.substring(0, 12).trim();
  }

  return cleaned.length > 0 ? cleaned : 'Player';
}

/**
 * Resolves duplicate player names within a room
 * @param {string} baseName
 * @param {Array<string>} existingNames
 * @returns {string} Unique player name (e.g. "Alice 2")
 */
function resolveDuplicateName(baseName, existingNames = []) {
  const normalizedExisting = new Set(existingNames.map(n => n.toLowerCase()));
  if (!normalizedExisting.has(baseName.toLowerCase())) {
    return baseName;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${baseName} ${suffix}`;
    if (!normalizedExisting.has(candidate.toLowerCase())) {
      return candidate;
    }
    suffix++;
  }
}

module.exports = {
  maskProfanity,
  sanitizePlayerName,
  resolveDuplicateName,
  PROFANITY_WORDS
};
