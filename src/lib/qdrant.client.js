const { QdrantClient } = require('@qdrant/js-client-rest')
const config = require('../config')
const logger = require('../utils/logger')

let client = null

try {
  client = new QdrantClient({
    url: config.qdrant?.url || process.env.QDRANT_URL,
  })

  logger.info(`Qdrant client initialized: ${process.env.QDRANT_URL}`)
} catch (error) {
  logger.error(`Failed to initialize Qdrant client: ${error.message}`)
  throw error
}

module.exports = client
