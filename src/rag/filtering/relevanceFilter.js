const {
  RERANK_MIN_SCORE,
  MIN_RELEVANT_CHUNKS,
  ENABLE_RERANKING,
} = require('../../config/rag')

const filterRelevant = (items) => {
  const threshold = ENABLE_RERANKING ? RERANK_MIN_SCORE : 0.01

  const filtered = items.filter((i) => (i.rerankScore ?? 0) >= threshold)

  return {
    filtered,
    isEnough: filtered.length >= MIN_RELEVANT_CHUNKS,
  }
}

module.exports = { filterRelevant }
