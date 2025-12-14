const { rerank } = require('./crossEncoderClient')
const { ENABLE_RERANKING } = require('../../config/rag')

const rerankResults = async (query, items) => {
  if (!ENABLE_RERANKING) {
    const enriched = items.map((item) => ({
      ...item,
      rerankScore: item.rrfScore || 0,
    }))
    enriched.sort((a, b) => b.rerankScore - a.rerankScore)
    return enriched
  }

  const documents = items.map((i) => i.text || '')
  const scores = await rerank({ query, documents })

  const byIndex = new Map(scores.map((s) => [s.index, s.score]))

  const enriched = items.map((item, idx) => ({
    ...item,
    rerankScore: byIndex.get(idx) ?? 0,
  }))

  enriched.sort((a, b) => b.rerankScore - a.rerankScore)

  return enriched
}

module.exports = { rerankResults }
