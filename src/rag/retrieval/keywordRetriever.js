const natural = require('natural')
const { removeStopwords } = require('stopword')
const { KEYWORD_TOP_K } = require('../../config/rag')

const tokenizer = new natural.WordTokenizer()

const normalizeText = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const tokenize = (text) => {
  const tokens = tokenizer.tokenize(normalizeText(text))
  return removeStopwords(tokens).filter(Boolean)
}

class BM25Index {
  constructor() {
    this.docs = new Map()
    this.docFreq = new Map()
    this.docCount = 0
    this.totalDocLen = 0
  }

  _incDf(term) {
    this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1)
  }

  upsert(key, text, payload) {
    if (!key) return

    const existing = this.docs.get(key)
    if (existing) {
      for (const term of existing.tf.keys()) {
        const prev = this.docFreq.get(term) || 0
        const next = prev - 1
        if (next <= 0) this.docFreq.delete(term)
        else this.docFreq.set(term, next)
      }
      this.totalDocLen -= existing.len
    } else {
      this.docCount += 1
    }

    const terms = tokenize(text)
    const tf = new Map()
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1)

    for (const term of tf.keys()) this._incDf(term)

    const len = terms.length
    this.totalDocLen += len

    this.docs.set(key, { text, payload, tf, len })
  }

  score(queryTerms, opts = {}) {
    const k1 = opts.k1 ?? 1.5
    const b = opts.b ?? 0.75

    const scores = new Map()
    const N = Math.max(1, this.docCount)
    const avgdl = this.totalDocLen / N

    for (const [key, doc] of this.docs) {
      let score = 0
      for (const term of queryTerms) {
        const df = this.docFreq.get(term) || 0
        if (df === 0) continue

        const tf = doc.tf.get(term) || 0
        if (tf === 0) continue

        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
        const denom = tf + k1 * (1 - b + (b * doc.len) / (avgdl || 1))
        score += idf * ((tf * (k1 + 1)) / denom)
      }
      if (score > 0) scores.set(key, score)
    }

    return scores
  }

  search(query, topK) {
    const queryTerms = tokenize(query)
    if (queryTerms.length === 0) return []

    const scored = this.score(queryTerms)

    const results = []
    for (const [key, keywordScore] of scored) {
      const doc = this.docs.get(key)
      if (!doc) continue
      results.push({ key, text: doc.text, payload: doc.payload, keywordScore })
    }

    results.sort((a, b) => b.keywordScore - a.keywordScore)
    return results.slice(0, topK)
  }
}

const index = new BM25Index()

const indexNewsChunks = (chunks) => {
  if (!Array.isArray(chunks)) return
  for (const c of chunks) index.upsert(c.key, c.text, c.payload)
}

const keywordSearch = (query, topK = KEYWORD_TOP_K) => {
  return index.search(query, topK)
}

module.exports = { keywordSearch, indexNewsChunks, tokenize, normalizeText }
