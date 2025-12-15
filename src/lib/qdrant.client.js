const { QdrantClient } = require('@qdrant/js-client-rest')
const config = require('../config')
const logger = require('../utils/logger')

let client = null

try {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.QDRANT_URL || process.env.QDRANT_URL.trim() === '')
  ) {
    logger.error(
      'QDRANT_URL is not set in production; defaulting to http://localhost:6333 will fail on Render. Set QDRANT_URL (and QDRANT_API_KEY for Qdrant Cloud).'
    )
  }

  const qdrantOptions = {
    url: config.qdrant.url,
    checkCompatibility: config.qdrant.checkCompatibility,
  }
  if (config.qdrant.apiKey) {
    qdrantOptions.apiKey = config.qdrant.apiKey
  }

  client = new QdrantClient(qdrantOptions)

  logger.info(`Qdrant client initialized: ${config.qdrant.url}`)
} catch (error) {
  logger.error(`Failed to initialize Qdrant client: ${error.message}`)
  throw error
}

module.exports = client
