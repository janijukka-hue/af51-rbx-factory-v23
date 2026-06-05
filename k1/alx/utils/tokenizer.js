// k1/alx/utils/tokenizer.js
// Deterministic Tokenizer - No external dependencies

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just",
  "and", "but", "if", "or", "because", "until", "while", "this",
  "that", "these", "those", "it", "its", "i", "me", "my", "myself",
  "we", "our", "ours", "you", "your", "yours", "he", "him", "his",
  "she", "her", "hers", "they", "them", "their", "what", "which",
  "who", "whom", "please", "thanks", "thank"
]);

export function tokenize(input) {
  if (!input || typeof input !== "string") return [];
  
  return input
    .toLowerCase()
    .replace(/[^\w\säöåÄÖÅ-]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 0);
}

export function tokenizeClean(input) {
  return tokenize(input).filter(token => !STOP_WORDS.has(token));
}

export function tokenizeWithPositions(input) {
  if (!input || typeof input !== "string") return [];
  
  const tokens = [];
  const regex = /\S+/g;
  let match;
  
  while ((match = regex.exec(input)) !== null) {
    tokens.push({
      text: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return tokens;
}

export function stem(word) {
  if (!word || word.length < 3) return word;
  
  let stemmed = word.toLowerCase();
  
  const suffixes = ["ing", "ed", "ly", "es", "s", "ment", "ness", "tion", "ation"];
  
  for (const suffix of suffixes) {
    if (stemmed.endsWith(suffix) && stemmed.length > suffix.length + 2) {
      stemmed = stemmed.slice(0, -suffix.length);
      break;
    }
  }
  
  return stemmed;
}

export function ngrams(tokens, n = 2) {
  if (tokens.length < n) return [];
  
  const result = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(" "));
  }
  return result;
}

export function similarity(tokens1, tokens2) {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export default {
  tokenize,
  tokenizeClean,
  tokenizeWithPositions,
  stem,
  ngrams,
  similarity
};