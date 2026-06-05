// k1/alx/config/language.config.js
// Language Configuration - Finnish + English
// Version: 2.1.0 - Fixed BUILD priority

export var VOCABULARY = {
  greetings: {
    fi: ["moi", "hei", "terve", "moikka", "heippa", "huomenta", "iltaa"],
    en: ["hi", "hello", "hey", "greetings", "morning", "evening"]
  },
  affirmative: {
    fi: ["kyllä", "joo", "jep", "ok", "selvä", "totta", "aivan"],
    en: ["yes", "yeah", "yep", "ok", "sure", "right", "correct"]
  },
  negative: {
    fi: ["ei", "en", "älä", "lopeta", "peru"],
    en: ["no", "nope", "stop", "cancel", "abort"]
  },
  thanks: {
    fi: ["kiitos", "kiitti", "thx"],
    en: ["thanks", "thank", "thx"]
  },
  help: {
    fi: ["apua", "auta", "ohje", "miten"],
    en: ["help", "assist", "guide", "how"]
  }
};

export var SYNONYMS = {
  build: ["rakenna", "buildaa", "kompiloi", "compile", "make", "create"],
  analyze: ["analysoi", "tutki", "tarkista", "check", "inspect", "review"],
  status: ["tila", "tilanne", "state", "info"],
  publish: ["julkaise", "deploy", "release", "ship"],
  test: ["testaa", "kokeile", "try", "verify"],
  help: ["apua", "ohje", "auta", "guide"],
  stop: ["lopeta", "keskeytä", "abort", "cancel", "halt"],
  clear: ["tyhjennä", "puhdista", "reset", "wipe"],
  show: ["näytä", "listaa", "display", "list", "print"],
  run: ["aja", "suorita", "execute", "start"],
  code: ["koodi", "tiedosto", "file", "source"],
  memory: ["muisti", "historia", "history", "log"]
};

export var INTENT_PATTERNS = [
  // FACTORY - korkein prioriteetti (20)
  { pattern: "build", intent: "BUILD", priority: 20 },
  { pattern: "rakenna", intent: "BUILD", priority: 20 },
  { pattern: "buildaa", intent: "BUILD", priority: 20 },
  { pattern: "compile", intent: "BUILD", priority: 20 },
  { pattern: "käännä", intent: "BUILD", priority: 20 },
  { pattern: "publish", intent: "PUBLISH", priority: 18 },
  { pattern: "julkaise", intent: "PUBLISH", priority: 18 },
  { pattern: "pipeline", intent: "PIPELINE", priority: 15 },
  { pattern: "putki", intent: "PIPELINE", priority: 15 },
  
  // TIME (15)
  { pattern: "time", intent: "TIME", priority: 15 },
  { pattern: "aika", intent: "TIME", priority: 15 },
  { pattern: "kello", intent: "TIME", priority: 15 },
  
  // CODE ANALYSIS (15)
  { pattern: "analyze code", intent: "ANALYZE_CODE", priority: 15 },
  { pattern: "analysoi koodi", intent: "ANALYZE_CODE", priority: 15 },
  { pattern: "analyze", intent: "ANALYZE_CODE", priority: 12 },
  { pattern: "analysoi", intent: "ANALYZE_CODE", priority: 12 },
  { pattern: "tarkista", intent: "ANALYZE_CODE", priority: 12 },
  
  // MEMORY (10) - alempi prioriteetti kuin build
  { pattern: "memory query", intent: "MEMORY_QUERY", priority: 12 },
  { pattern: "muisti haku", intent: "MEMORY_QUERY", priority: 12 },
  { pattern: "memory", intent: "MEMORY_QUERY", priority: 10 },
  { pattern: "muisti", intent: "MEMORY_QUERY", priority: 10 },
  { pattern: "historia", intent: "MEMORY_QUERY", priority: 10 },
  { pattern: "history", intent: "MEMORY_QUERY", priority: 10 },
  
  // STATUS & SYSTEM (10)
  { pattern: "status", intent: "STATUS", priority: 10 },
  { pattern: "tila", intent: "STATUS", priority: 10 },
  { pattern: "help", intent: "HELP", priority: 10 },
  { pattern: "apua", intent: "HELP", priority: 10 },
  { pattern: "ohje", intent: "HELP", priority: 8 },
  { pattern: "test", intent: "TEST", priority: 10 },
  { pattern: "testaa", intent: "TEST", priority: 10 },
  { pattern: "clear", intent: "CLEAR", priority: 10 },
  { pattern: "tyhjennä", intent: "CLEAR", priority: 10 },
  { pattern: "audit", intent: "AUDIT", priority: 10 },
  { pattern: "loki", intent: "AUDIT", priority: 10 },
  
  // SHOW (5)
  { pattern: "show", intent: "SHOW", priority: 5 },
  { pattern: "näytä", intent: "SHOW", priority: 5 },
  
  // GREETINGS (3) - alin prioriteetti
  { pattern: "moi", intent: "GREETING", priority: 3 },
  { pattern: "hei", intent: "GREETING", priority: 3 },
  { pattern: "hello", intent: "GREETING", priority: 3 },
  { pattern: "hi", intent: "GREETING", priority: 3 }
];

export var RESPONSES = {
  fi: {
    greeting: "Moi! Miten voin auttaa?",
    help: "Kirjoita 'apua' nähdäksesi komennot.",
    unknown: "En ymmärtänyt. Kokeile 'apua'.",
    success: "Valmis.",
    error: "Virhe tapahtui.",
    thanks: "Ole hyvä!"
  },
  en: {
    greeting: "Hello! How can I help?",
    help: "Type 'help' to see commands.",
    unknown: "I didn't understand. Try 'help'.",
    success: "Done.",
    error: "An error occurred.",
    thanks: "You're welcome!"
  }
};

export function detectLanguage(tokens) {
  var fiScore = 0;
  var enScore = 0;
  
  var fiWords = [].concat(VOCABULARY.greetings.fi, VOCABULARY.affirmative.fi, VOCABULARY.negative.fi);
  var enWords = [].concat(VOCABULARY.greetings.en, VOCABULARY.affirmative.en, VOCABULARY.negative.en);
  
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (fiWords.indexOf(token) !== -1) fiScore++;
    if (enWords.indexOf(token) !== -1) enScore++;
  }
  
  var joined = tokens.join(" ");
  if (/[äöåÄÖÅ]/.test(joined)) fiScore += 2;
  
  return fiScore >= enScore ? "fi" : "en";
}

export default {
  VOCABULARY: VOCABULARY,
  SYNONYMS: SYNONYMS,
  INTENT_PATTERNS: INTENT_PATTERNS,
  RESPONSES: RESPONSES,
  detectLanguage: detectLanguage
};