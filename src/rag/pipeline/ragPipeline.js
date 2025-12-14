const { hybridRetrieve } = require('../retrieval/hybridRetriever')
const { rerankResults } = require('../reranking/rerankResults')
const { filterRelevant } = require('../filtering/relevanceFilter')
const {
  NEWS_TOP_K,
  MIN_RELEVANT_CHUNKS,
  NOT_ENOUGH_INFO_MESSAGE,
} = require('../../config/rag')

const normalizeQuery = (query) =>
  String(query || '')
    .trim()
    .replace(/\s+/g, ' ')

const runNewsRagPipeline = async ({ query, onProgress }) => {
  const normalizedQuery = normalizeQuery(query)

  if (onProgress) {
    onProgress('rag_pipeline', 'retrieving', { source: 'news articles' })
  }

  const candidates = await hybridRetrieve(normalizedQuery)

  if (onProgress) {
    onProgress('rag_pipeline', 'reranking', { count: candidates.length })
  }

  const reranked = await rerankResults(normalizedQuery, candidates)

  if (onProgress) {
    onProgress('rag_pipeline', 'filtering')
  }

  const { filtered, isEnough } = filterRelevant(reranked)

  if (!isEnough) {
    return {
      ok: false,
      message:
        NOT_ENOUGH_INFO_MESSAGE ||
        `The available sources are not relevant enough to answer accurately. (need at least ${MIN_RELEVANT_CHUNKS} relevant chunks)`,
      chunks: [],
    }
  }

  return { ok: true, chunks: filtered.slice(0, NEWS_TOP_K) }
}

module.exports = { runNewsRagPipeline, normalizeQuery }
