const client = require('./qdrant.client')
const logger = require('../utils/logger')

const MESSAGE_COLLECTION = 'messages_memory'
const NEWS_COLLECTION = 'news_articles'
const VECTOR_DIM = 384

async function initQdrantCollections() {
  try {
    const existing = await client.getCollections()

    const hasMessages = existing.collections.some(
      (c) => c.name === MESSAGE_COLLECTION
    )

    if (!hasMessages) {
      logger.info('Creating Qdrant collection: messages_memory')

      await client.createCollection(MESSAGE_COLLECTION, {
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
        },
      })

      logger.info('messages_memory collection created')
    } else {
      const collectionInfo = await client.getCollection(MESSAGE_COLLECTION)
      const currentDim = collectionInfo.config?.params?.vectors?.size

      if (currentDim !== VECTOR_DIM) {
        logger.warn(
          `Collection exists with wrong dimension (${currentDim} vs ${VECTOR_DIM}). Recreating...`
        )
        await client.deleteCollection(MESSAGE_COLLECTION)

        await client.createCollection(MESSAGE_COLLECTION, {
          vectors: {
            size: VECTOR_DIM,
            distance: 'Cosine',
          },
        })

        logger.info(
          'messages_memory collection recreated with correct dimensions'
        )
      } else {
        logger.info('messages_memory already exists with correct dimensions')
      }
    }

    const hasNews = existing.collections.some((c) => c.name === NEWS_COLLECTION)

    if (!hasNews) {
      logger.info('Creating Qdrant collection: news_articles')

      await client.createCollection(NEWS_COLLECTION, {
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
        },
      })

      logger.info('news_articles collection created')
    } else {
      const newsCollectionInfo = await client.getCollection(NEWS_COLLECTION)
      const newsDim = newsCollectionInfo.config?.params?.vectors?.size

      if (newsDim !== VECTOR_DIM) {
        logger.warn(
          `news_articles exists with wrong dimension (${newsDim} vs ${VECTOR_DIM}). Recreating...`
        )
        await client.deleteCollection(NEWS_COLLECTION)

        await client.createCollection(NEWS_COLLECTION, {
          vectors: {
            size: VECTOR_DIM,
            distance: 'Cosine',
          },
        })

        logger.info(
          'news_articles collection recreated with correct dimensions'
        )
      } else {
        logger.info('news_articles already exists with correct dimensions')
      }
    }
  } catch (error) {
    const hostname = error?.cause?.hostname
    const code = error?.cause?.code
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'

    if (code === 'ENOTFOUND' && hostname) {
      logger.error(
        `Qdrant collection init failed: cannot resolve host "${hostname}" (QDRANT_URL=${qdrantUrl}). Set QDRANT_URL to a reachable host (Render internal URL or Qdrant Cloud URL).`
      )
    } else if (String(error?.message || '').includes('fetch failed')) {
      logger.error(
        `Qdrant collection init failed: fetch failed (QDRANT_URL=${qdrantUrl}). Check that Qdrant is reachable and, if using Qdrant Cloud, that QDRANT_API_KEY is set.`
      )
    } else {
      logger.error(`Qdrant collection init failed: ${error.message}`)
    }
    throw error
  }
}

module.exports = {
  MESSAGE_COLLECTION,
  NEWS_COLLECTION,
  initQdrantCollections,
}
