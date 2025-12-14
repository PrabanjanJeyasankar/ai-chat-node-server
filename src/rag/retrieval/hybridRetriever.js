const { vectorSearch } = require('./vectorRetriever')
const { keywordSearch } = require('./keywordRetriever')
const { reciprocalRankFusion } = require('../scoring/reciprocalRankFusion')
const { HYBRID_CANDIDATES } = require('../../config/rag')

const hybridRetrieve = async (query) => {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query),
    Promise.resolve(keywordSearch(query)),
  ])

  const fusedScores = reciprocalRankFusion([vectorResults, keywordResults])
  const byKey = new Map()

  for (const r of vectorResults) {
    byKey.set(r.key, {
      key: r.key,
      text: r.text,
      payload: r.payload,
      vectorScore: r.vectorScore,
      keywordScore: undefined,
      rrfScore: fusedScores.get(r.key) || 0,
    })
  }

  for (const r of keywordResults) {
    const existing = byKey.get(r.key)
    if (existing) {
      existing.keywordScore = r.keywordScore
      existing.rrfScore = fusedScores.get(r.key) || existing.rrfScore
    } else {
      byKey.set(r.key, {
        key: r.key,
        text: r.text,
        payload: r.payload,
        vectorScore: undefined,
        keywordScore: r.keywordScore,
        rrfScore: fusedScores.get(r.key) || 0,
      })
    }
  }

  const merged = [...byKey.values()]
  merged.sort((a, b) => b.rrfScore - a.rrfScore)

  return merged.slice(0, HYBRID_CANDIDATES)
}

module.exports = { hybridRetrieve }
