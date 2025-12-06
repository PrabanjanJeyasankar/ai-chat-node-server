const client = require('./qdrant.client')
const logger = require('../utils/logger')

const MESSAGE_COLLECTION = 'messages_memory'
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
  } catch (error) {
    logger.error(`Qdrant collection init failed: ${error.message}`)
    throw error
  }
}

module.exports = {
  MESSAGE_COLLECTION,
  initQdrantCollections,
}
