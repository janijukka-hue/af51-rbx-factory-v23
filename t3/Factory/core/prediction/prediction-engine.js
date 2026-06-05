// t3/Factory/core/prediction/prediction-engine.js
// Deterministic Prediction Engine
// T3 Layer - No external dependencies, injected clock only

var PREDICTION_STATE = {
  IDLE: "IDLE",
  TRAINING: "TRAINING",
  PREDICTING: "PREDICTING",
  ERROR: "ERROR"
};

var PREDICTION_TYPE = {
  NEXT_TOKEN: "NEXT_TOKEN",
  SEQUENCE: "SEQUENCE",
  PATTERN: "PATTERN",
  INTENT: "INTENT"
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function PredictionEngine(options) {
  if (!options) options = {};
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  // N-gram order (2 = bigram, 3 = trigram)
  this._order = options.order || 3;
  
  // Core data structures
  this._ngrams = new Map();
  this._vocabulary = new Map();
  this._documentFrequency = new Map();
  this._sequences = new Map();
  this._patterns = new Map();
  
  // Corpus stats
  this._documentCount = 0;
  this._totalTokens = 0;
  
  // State
  this._state = PREDICTION_STATE.IDLE;
  this._sequence = 0;
  
  // Limits
  this._maxVocabularySize = options.maxVocabularySize || 50000;
  this._maxNgramSize = options.maxNgramSize || 100000;
  this._maxPatternSize = options.maxPatternSize || 10000;
  this._minPatternFrequency = options.minPatternFrequency || 3;
  
  // Prediction config
  this._defaultPredictionCount = options.defaultPredictionCount || 5;
  this._smoothingFactor = options.smoothingFactor || 0.1;
  
  // Stats
  this._stats = {
    documentsProcessed: 0,
    predictionsRequested: 0,
    predictionsReturned: 0,
    cacheHits: 0,
    trainTimeMs: 0
  };
  
  // Prediction cache
  this._cache = new Map();
  this._cacheLimit = options.cacheLimit || 1000;
  this._cacheTTL = options.cacheTTL || 60000;
}

/* -------------------------------------------------------------------------- */
/*                              UTILITIES                                     */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

PredictionEngine.prototype._generateId = function(prefix) {
  this._sequence++;
  var seed = prefix + ":" + this._now() + ":" + this._sequence;
  return prefix + "_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

PredictionEngine.prototype._tokenize = function(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  
  return text
    .toLowerCase()
    .replace(/[^\w\säöåÄÖÅ]/g, " ")
    .split(/\s+/)
    .filter(function(w) { return w.length > 0; });
};

PredictionEngine.prototype._normalizeText = function(text) {
  if (!text || typeof text !== "string") {
    return "";
  }
  return text.toLowerCase().trim();
};

/* -------------------------------------------------------------------------- */
/*                              TRAINING                                      */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype.train = function(text, documentId) {
  if (!text || typeof text !== "string") {
    return { ok: false, error: "INVALID_TEXT" };
  }
  
  var startTime = this._now();
  this._state = PREDICTION_STATE.TRAINING;
  
  var docId = documentId || this._generateId("doc");
  this._documentCount++;
  
  var tokens = this._tokenize(text);
  
  if (tokens.length === 0) {
    this._state = PREDICTION_STATE.IDLE;
    return { ok: false, error: "NO_TOKENS" };
  }
  
  this._totalTokens += tokens.length;
  
  // Build vocabulary with document frequency
  var seenInDoc = new Set();
  
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    
    // Vocabulary count
    this._vocabulary.set(token, (this._vocabulary.get(token) || 0) + 1);
    
    // Document frequency (count docs containing token)
    if (!seenInDoc.has(token)) {
      seenInDoc.add(token);
      this._documentFrequency.set(token, (this._documentFrequency.get(token) || 0) + 1);
    }
    
    // Enforce vocabulary limit
    if (this._vocabulary.size > this._maxVocabularySize) {
      this._pruneVocabulary();
    }
  }
  
  // Build n-grams
  this._buildNgrams(tokens);
  
  // Detect patterns
  this._detectPatterns(tokens);
  
  // Track sequences
  this._trackSequence(docId, tokens);
  
  var durationMs = this._now() - startTime;
  this._stats.documentsProcessed++;
  this._stats.trainTimeMs += durationMs;
  
  this._state = PREDICTION_STATE.IDLE;
  
  if (this._debug) {
    
  }
  
  return {
    ok: true,
    documentId: docId,
    tokenCount: tokens.length,
    vocabularySize: this._vocabulary.size,
    ngramCount: this._ngrams.size,
    durationMs: durationMs
  };
};

PredictionEngine.prototype._buildNgrams = function(tokens) {
  for (var n = 1; n <= this._order; n++) {
    for (var i = 0; i <= tokens.length - n; i++) {
      var gram = tokens.slice(i, i + n).join(" ");
      var next = tokens[i + n] || null;
      
      if (!this._ngrams.has(gram)) {
        this._ngrams.set(gram, {
          count: 0,
          next: new Map(),
          order: n
        });
      }
      
      var entry = this._ngrams.get(gram);
      entry.count++;
      
      if (next) {
        entry.next.set(next, (entry.next.get(next) || 0) + 1);
      }
      
      // Enforce ngram limit
      if (this._ngrams.size > this._maxNgramSize) {
        this._pruneNgrams();
      }
    }
  }
};

PredictionEngine.prototype._detectPatterns = function(tokens) {
  // Detect repeating patterns (2-5 tokens)
  for (var patternLen = 2; patternLen <= 5; patternLen++) {
    for (var i = 0; i <= tokens.length - patternLen; i++) {
      var pattern = tokens.slice(i, i + patternLen).join(" ");
      
      if (!this._patterns.has(pattern)) {
        this._patterns.set(pattern, {
          count: 0,
          length: patternLen,
          contexts: []
        });
      }
      
      var entry = this._patterns.get(pattern);
      entry.count++;
      
      // Store context (previous token)
      if (i > 0 && entry.contexts.length < 10) {
        entry.contexts.push(tokens[i - 1]);
      }
    }
  }
  
  // Prune rare patterns
  if (this._patterns.size > this._maxPatternSize) {
    this._prunePatterns();
  }
};

PredictionEngine.prototype._trackSequence = function(docId, tokens) {
  // Store first N tokens as sequence signature
  var signatureLength = Math.min(10, tokens.length);
  var signature = tokens.slice(0, signatureLength).join(" ");
  
  this._sequences.set(docId, {
    signature: signature,
    length: tokens.length,
    timestamp: this._now()
  });
  
  // Limit sequence storage
  if (this._sequences.size > 1000) {
    var oldest = null;
    var oldestTime = Infinity;
    
    this._sequences.forEach(function(seq, id) {
      if (seq.timestamp < oldestTime) {
        oldestTime = seq.timestamp;
        oldest = id;
      }
    });
    
    if (oldest) {
      this._sequences.delete(oldest);
    }
  }
};

/* -------------------------------------------------------------------------- */
/*                              PRUNING                                       */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype._pruneVocabulary = function() {
  var entries = Array.from(this._vocabulary.entries());
  
  entries.sort(function(a, b) {
    return a[1] - b[1];
  });
  
  var removeCount = Math.floor(this._maxVocabularySize * 0.2);
  
  for (var i = 0; i < removeCount && i < entries.length; i++) {
    this._vocabulary.delete(entries[i][0]);
  }
};

PredictionEngine.prototype._pruneNgrams = function() {
  var entries = Array.from(this._ngrams.entries());
  
  entries.sort(function(a, b) {
    return a[1].count - b[1].count;
  });
  
  var removeCount = Math.floor(this._maxNgramSize * 0.2);
  
  for (var i = 0; i < removeCount && i < entries.length; i++) {
    this._ngrams.delete(entries[i][0]);
  }
};

PredictionEngine.prototype._prunePatterns = function() {
  var self = this;
  var toDelete = [];
  
  this._patterns.forEach(function(entry, pattern) {
    if (entry.count < self._minPatternFrequency) {
      toDelete.push(pattern);
    }
  });
  
  for (var i = 0; i < toDelete.length; i++) {
    this._patterns.delete(toDelete[i]);
  }
  
  // If still too large, remove lowest count
  if (this._patterns.size > this._maxPatternSize) {
    var entries = Array.from(this._patterns.entries());
    
    entries.sort(function(a, b) {
      return a[1].count - b[1].count;
    });
    
    var removeCount = this._patterns.size - this._maxPatternSize;
    
    for (var j = 0; j < removeCount; j++) {
      this._patterns.delete(entries[j][0]);
    }
  }
};

/* -------------------------------------------------------------------------- */
/*                              PREDICTION                                    */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype.predict = function(context, options) {
  if (!options) options = {};
  
  this._stats.predictionsRequested++;
  this._state = PREDICTION_STATE.PREDICTING;
  
  var type = options.type || PREDICTION_TYPE.NEXT_TOKEN;
  var count = options.count || this._defaultPredictionCount;
  
  // Check cache
  var cacheKey = type + ":" + this._normalizeText(context);
  var cached = this._getFromCache(cacheKey);
  
  if (cached) {
    this._stats.cacheHits++;
    this._state = PREDICTION_STATE.IDLE;
    return cached;
  }
  
  var result;
  
  switch (type) {
    case PREDICTION_TYPE.NEXT_TOKEN:
      result = this._predictNextToken(context, count);
      break;
    case PREDICTION_TYPE.SEQUENCE:
      result = this._predictSequence(context, count);
      break;
    case PREDICTION_TYPE.PATTERN:
      result = this._predictPattern(context, count);
      break;
    case PREDICTION_TYPE.INTENT:
      result = this._predictIntent(context, count);
      break;
    default:
      result = this._predictNextToken(context, count);
  }
  
  this._stats.predictionsReturned += result.predictions.length;
  
  // Cache result
  this._setCache(cacheKey, result);
  
  this._state = PREDICTION_STATE.IDLE;
  
  return result;
};

PredictionEngine.prototype._predictNextToken = function(context, count) {
  var tokens = this._tokenize(context);
  
  if (tokens.length === 0) {
    return { ok: true, predictions: [], type: PREDICTION_TYPE.NEXT_TOKEN };
  }
  
  var predictions = [];
  
  // Try different n-gram orders (longest first)
  for (var n = Math.min(this._order, tokens.length); n >= 1; n--) {
    var key = tokens.slice(-n).join(" ");
    var entry = this._ngrams.get(key);
    
    if (entry && entry.next.size > 0) {
      var total = 0;
      entry.next.forEach(function(c) { total += c; });
      
      var self = this;
      entry.next.forEach(function(nextCount, word) {
        var probability = nextCount / total;
        var tfidf = self._calculateTFIDF(word);
        
        // Combined score
        var score = probability * 0.7 + Math.min(tfidf / 10, 0.3) * 0.3;
        
        predictions.push({
          token: word,
          probability: probability,
          tfidf: tfidf,
          score: score,
          ngramOrder: n
        });
      });
      
      break;
    }
  }
  
  // Sort by score
  predictions.sort(function(a, b) {
    return b.score - a.score;
  });
  
  return {
    ok: true,
    predictions: predictions.slice(0, count),
    type: PREDICTION_TYPE.NEXT_TOKEN,
    context: tokens.slice(-this._order).join(" ")
  };
};

PredictionEngine.prototype._predictSequence = function(context, maxTokens) {
  var tokens = this._tokenize(context);
  var result = tokens.slice();
  
  for (var i = 0; i < maxTokens; i++) {
    var prediction = this._predictNextToken(result.join(" "), 1);
    
    if (prediction.predictions.length === 0) {
      break;
    }
    
    var nextToken = prediction.predictions[0].token;
    result.push(nextToken);
    
    // Stop at sentence end
    if (nextToken.match(/[.!?]$/)) {
      break;
    }
  }
  
  return {
    ok: true,
    predictions: [{
      sequence: result.join(" "),
      addedTokens: result.length - tokens.length
    }],
    type: PREDICTION_TYPE.SEQUENCE,
    originalLength: tokens.length
  };
};

PredictionEngine.prototype._predictPattern = function(context, count) {
  var tokens = this._tokenize(context);
  var contextStr = tokens.join(" ");
  
  var matches = [];
  var self = this;
  
  this._patterns.forEach(function(entry, pattern) {
    if (entry.count >= self._minPatternFrequency) {
      // Check if pattern could follow context
      var relevance = self._calculatePatternRelevance(pattern, contextStr, entry);
      
      if (relevance > 0) {
        matches.push({
          pattern: pattern,
          count: entry.count,
          length: entry.length,
          relevance: relevance
        });
      }
    }
  });
  
  matches.sort(function(a, b) {
    return b.relevance - a.relevance;
  });
  
  return {
    ok: true,
    predictions: matches.slice(0, count),
    type: PREDICTION_TYPE.PATTERN
  };
};

PredictionEngine.prototype._predictIntent = function(context, count) {
  var tokens = this._tokenize(context);
  
  // Score based on vocabulary overlap and patterns
  var scores = new Map();
  
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    var df = this._documentFrequency.get(token) || 0;
    
    if (df > 0) {
      var idf = Math.log(this._documentCount / df);
      var tf = 1;
      
      scores.set(token, {
        token: token,
        tfidf: tf * idf,
        frequency: this._vocabulary.get(token) || 0
      });
    }
  }
  
  var sorted = Array.from(scores.values());
  sorted.sort(function(a, b) {
    return b.tfidf - a.tfidf;
  });
  
  return {
    ok: true,
    predictions: sorted.slice(0, count),
    type: PREDICTION_TYPE.INTENT,
    tokenCount: tokens.length
  };
};

/* -------------------------------------------------------------------------- */
/*                              SCORING                                       */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype._calculateTFIDF = function(word) {
  var tf = this._vocabulary.get(word) || 0;
  var df = this._documentFrequency.get(word) || 1;
  var idf = Math.log((this._documentCount + 1) / df);
  
  return tf * idf;
};

PredictionEngine.prototype._calculatePatternRelevance = function(pattern, context, entry) {
  var patternTokens = pattern.split(" ");
  var contextTokens = context.split(" ");
  
  // Check context overlap
  var overlap = 0;
  for (var i = 0; i < entry.contexts.length; i++) {
    if (contextTokens.indexOf(entry.contexts[i]) !== -1) {
      overlap++;
    }
  }
  
  // Check if last context token matches pattern start
  var lastContextToken = contextTokens[contextTokens.length - 1];
  var startsWithContext = patternTokens[0] === lastContextToken ? 1 : 0;
  
  // Combined relevance
  return (overlap / Math.max(1, entry.contexts.length)) * 0.5 +
         startsWithContext * 0.3 +
         Math.log(entry.count + 1) * 0.2;
};

/* -------------------------------------------------------------------------- */
/*                              CACHE                                         */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype._getFromCache = function(key) {
  var entry = this._cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  var now = this._now();
  if (now - entry.timestamp > this._cacheTTL) {
    this._cache.delete(key);
    return null;
  }
  
  return entry.value;
};

PredictionEngine.prototype._setCache = function(key, value) {
  if (this._cache.size >= this._cacheLimit) {
    // Remove oldest
    var oldest = null;
    var oldestTime = Infinity;
    
    this._cache.forEach(function(entry, k) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = k;
      }
    });
    
    if (oldest) {
      this._cache.delete(oldest);
    }
  }
  
  this._cache.set(key, {
    value: value,
    timestamp: this._now()
  });
};

PredictionEngine.prototype.clearCache = function() {
  this._cache.clear();
};

/* -------------------------------------------------------------------------- */
/*                              COMPLETION                                    */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype.complete = function(input, options) {
  if (!options) options = {};
  
  var maxTokens = options.maxTokens || 20;
  var stopPatterns = options.stopPatterns || [/[.!?]$/];
  
  var result = this._predictSequence(input, maxTokens);
  
  if (!result.ok || result.predictions.length === 0) {
    return {
      ok: true,
      text: input,
      addedTokens: 0
    };
  }
  
  return {
    ok: true,
    text: result.predictions[0].sequence,
    addedTokens: result.predictions[0].addedTokens
  };
};

/* -------------------------------------------------------------------------- */
/*                              EXPORT / IMPORT                               */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype.export = function() {
  return {
    version: "1.0",
    order: this._order,
    documentCount: this._documentCount,
    totalTokens: this._totalTokens,
    vocabulary: Array.from(this._vocabulary.entries()),
    documentFrequency: Array.from(this._documentFrequency.entries()),
    ngrams: Array.from(this._ngrams.entries()).map(function(entry) {
      return [
        entry[0],
        {
          count: entry[1].count,
          order: entry[1].order,
          next: Array.from(entry[1].next.entries())
        }
      ];
    }),
    patterns: Array.from(this._patterns.entries()),
    stats: this._stats
  };
};

PredictionEngine.prototype.import = function(data) {
  if (!data || data.version !== "1.0") {
    return { ok: false, error: "INVALID_DATA_VERSION" };
  }
  
  this._order = data.order;
  this._documentCount = data.documentCount;
  this._totalTokens = data.totalTokens;
  
  this._vocabulary = new Map(data.vocabulary);
  this._documentFrequency = new Map(data.documentFrequency);
  
  this._ngrams = new Map();
  for (var i = 0; i < data.ngrams.length; i++) {
    var entry = data.ngrams[i];
    this._ngrams.set(entry[0], {
      count: entry[1].count,
      order: entry[1].order,
      next: new Map(entry[1].next)
    });
  }
  
  this._patterns = new Map(data.patterns);
  this._stats = data.stats;
  
  return {
    ok: true,
    vocabularySize: this._vocabulary.size,
    ngramCount: this._ngrams.size,
    patternCount: this._patterns.size
  };
};

/* -------------------------------------------------------------------------- */
/*                              STATS                                         */
/* -------------------------------------------------------------------------- */

PredictionEngine.prototype.getState = function() {
  return this._state;
};

PredictionEngine.prototype.getStats = function() {
  return {
    state: this._state,
    order: this._order,
    documentCount: this._documentCount,
    totalTokens: this._totalTokens,
    vocabularySize: this._vocabulary.size,
    ngramCount: this._ngrams.size,
    patternCount: this._patterns.size,
    sequenceCount: this._sequences.size,
    cacheSize: this._cache.size,
    documentsProcessed: this._stats.documentsProcessed,
    predictionsRequested: this._stats.predictionsRequested,
    predictionsReturned: this._stats.predictionsReturned,
    cacheHits: this._stats.cacheHits,
    cacheHitRate: this._stats.predictionsRequested > 0
      ? Math.round((this._stats.cacheHits / this._stats.predictionsRequested) * 100)
      : 0,
    avgTrainTimeMs: this._stats.documentsProcessed > 0
      ? Math.round(this._stats.trainTimeMs / this._stats.documentsProcessed)
      : 0
  };
};

PredictionEngine.prototype.reset = function() {
  this._ngrams.clear();
  this._vocabulary.clear();
  this._documentFrequency.clear();
  this._sequences.clear();
  this._patterns.clear();
  this._cache.clear();
  
  this._documentCount = 0;
  this._totalTokens = 0;
  this._sequence = 0;
  
  this._stats = {
    documentsProcessed: 0,
    predictionsRequested: 0,
    predictionsReturned: 0,
    cacheHits: 0,
    trainTimeMs: 0
  };
  
  this._state = PREDICTION_STATE.IDLE;
};

/* -------------------------------------------------------------------------- */
/*                              FACTORY                                       */
/* -------------------------------------------------------------------------- */

function createPredictionEngine(options) {
  return new PredictionEngine(options);
}

export {
  PredictionEngine,
  createPredictionEngine,
  PREDICTION_STATE,
  PREDICTION_TYPE
};