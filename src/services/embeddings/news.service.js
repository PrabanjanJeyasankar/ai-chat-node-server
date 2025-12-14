const { v4: uuidv4 } = require('uuid')
const client = require('../../lib/qdrant.client')
const { NEWS_COLLECTION } = require('../../lib/qdrant.collections')
const EmbeddingService = require('./embedding.service')
const { getSourceScore } = require('../../config/newsSources')
const NewsArticle = require('../../models/NewsArticle')
const {
  NEWS_TOP_K,
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_PARAGRAPHS,
} = require('../../config/rag')
const logger = require('../../utils/logger')
const { runNewsRagPipeline } = require('../../rag/pipeline/ragPipeline')
const { indexNewsChunks } = require('../../rag/retrieval/keywordRetriever')
const { makeChunkKey } = require('../../rag/retrieval/vectorRetriever')

class NewsService {
  static chunkText(articleText, articleId, title, url, source, publishedAt) {
    const lines = articleText.split('\n').filter((line) => line.trim())
    const chunks = []
    let currentChunk = []
    let currentChars = 0
    let currentStartLine = 1
    let chunkIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length

      if (
        currentChars + lineLength > CHUNK_MAX_CHARS &&
        currentChunk.length > 0
      ) {
        const chunkText = currentChunk.join('\n')
        const endLine = currentStartLine + currentChunk.length - 1

        chunks.push({
          text: chunkText,
          chunkIndex,
          startLine: currentStartLine,
          endLine,
          articleId,
          title,
          url,
          source,
          publishedAt,
          section: 'body',
        })

        const overlapStart = Math.max(
          0,
          currentChunk.length - CHUNK_OVERLAP_PARAGRAPHS
        )
        currentChunk = currentChunk.slice(overlapStart)
        currentStartLine = currentStartLine + overlapStart
        currentChars = currentChunk.reduce((sum, l) => sum + l.length, 0)
        chunkIndex++
      }

      currentChunk.push(line)
      currentChars += lineLength
    }

    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join('\n')
      const endLine = currentStartLine + currentChunk.length - 1

      chunks.push({
        text: chunkText,
        chunkIndex,
        startLine: currentStartLine,
        endLine,
        articleId,
        title,
        url,
        source,
        publishedAt,
        section: 'body',
      })
    }

    return chunks
  }

  static async indexArticle(article) {
    // STEP A (Ingestion-time): chunk the article and store:
    // - vectors in Qdrant (semantic retrieval)
    // - chunks in the in-memory BM25 index (keyword retrieval)
    //
    // This keeps retrieval free and fast (no extra LLM calls).
    const chunks = this.chunkText(
      article.content,
      article._id.toString(),
      article.title,
      article.url,
      article.source,
      article.publishedAt
    )

    if (chunks.length === 0) {
      logger.warn(`No chunks created for article: ${article.title}`)
      return 0
    }

    const points = []
    const keywordChunks = []

    for (const chunk of chunks) {
      // STEP A1: embedding generation for the chunk text
      const vector = await EmbeddingService.embedText(chunk.text)

      // STEP A2: prepare Qdrant upsert payload
      const point = {
        id: uuidv4(),
        vector,
        payload: {
          articleId: chunk.articleId,
          title: chunk.title,
          url: chunk.url,
          source: chunk.source,
          publishedAt: new Date(chunk.publishedAt).getTime(),
          chunkIndex: chunk.chunkIndex,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          text: chunk.text,
          section: chunk.section,
          sourceScore: getSourceScore(chunk.source),
        },
      }

      points.push(point)

      // STEP A3: keep keyword/BM25 index in sync with ingested chunks.
      keywordChunks.push({
        key: makeChunkKey(point.payload),
        text: point.payload.text,
        payload: point.payload,
      })
    }

    // STEP A4: update in-memory keyword index (fast, best-effort)
    indexNewsChunks(keywordChunks)

    // STEP A5: persist vectors in Qdrant
    await client.upsert(NEWS_COLLECTION, {
      wait: true,
      points,
    })

    logger.info(`Indexed ${points.length} chunks for article: ${article.title}`)
    return points.length
  }

  /**
   * Warms up the keyword/BM25 index from MongoDB on startup.
   *
   * Why:
   * - Keyword retrieval is in-memory.
   * - The RSS ingester skips already-existing articles, so without a warmup
   *   step the keyword index would be empty after a server restart.
   *
   * @param {{limit?: number}} [opts]
   */
  static async warmupKeywordIndexFromMongo(opts = {}) {
    // STEP 0 (Startup): warm up the in-memory BM25 index from MongoDB
    // so keyword retrieval works even after a server restart.
    const limit = Number(opts.limit) || 500

    const articles = await NewsArticle.find({})
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()

    let chunksCount = 0
    for (const article of articles) {
      // STEP 0.1: re-chunk stored article content (same chunking strategy)
      const chunks = this.chunkText(
        article.content,
        article._id.toString(),
        article.title,
        article.url,
        article.source,
        article.publishedAt
      )

      // STEP 0.2: insert chunks into BM25 index
      indexNewsChunks(
        chunks.map((c) => {
          const payload = {
            articleId: c.articleId,
            title: c.title,
            url: c.url,
            source: c.source,
            publishedAt: new Date(c.publishedAt).getTime(),
            chunkIndex: c.chunkIndex,
            startLine: c.startLine,
            endLine: c.endLine,
            text: c.text,
            section: c.section,
            sourceScore: getSourceScore(c.source),
          }
          return { key: makeChunkKey(payload), text: payload.text, payload }
        })
      )

      chunksCount += chunks.length
    }

    logger.info(
      `Keyword index warmup complete: articles=${articles.length}, chunks=${chunksCount}`
    )
  }

  static async searchNews(query, limit = NEWS_TOP_K) {
    // IMPORTANT:
    // This function now uses the upgraded hybrid RAG pipeline:
    // Step 1 normalize -> Step 2 hybrid retrieve -> Step 3 RRF merge ->
    // Step 4 rerank -> Step 5 filter -> Step 6 return final chunks.
    const result = await runNewsRagPipeline({ query })
    if (!result.ok) return []

    const chunks = result.chunks.slice(0, limit)

    // Keep return shape compatible with existing callers (message.service.js)
    return chunks.map((c) => ({
      score: c.vectorScore ?? 0,
      finalScore: c.rerankScore ?? 0,
      payload: c.payload,
    }))
  }
}

module.exports = NewsService
