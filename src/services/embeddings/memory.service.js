const qdrant = require('../../lib/qdrant.client')
const { MESSAGE_COLLECTION } = require('../../lib/qdrant.collections')
const EmbeddingService = require('./embedding.service')
const logger = require('../../utils/logger')
const { ApiError } = require('../../utils/ApiError')
const crypto = require('crypto')

function objectIdToUuid(objectId) {
  const hash = crypto.createHash('md5').update(String(objectId)).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(
    12,
    16
  )}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

class MemoryService {
  static scoreMemory(item) {
    const v = item.payload

    const recencyBoost = 1 / (1 + (Date.now() - v.createdAt) / 1000)
    const roleBoost = v.role === 'user' ? 1.2 : 1.0
    const similarity = item.score || 0

    return similarity * 0.7 + recencyBoost * 0.2 + roleBoost * 0.1
  }

  static async saveMessageVector({ messageId, chatId, userId, role, content }) {
    try {
      if (!content) throw new Error('No content provided')

      const vector = await EmbeddingService.embedText(content)

      const payload = {
        messageId,
        chatId,
        userId,
        role,
        text: content,
        createdAt: Date.now(),
      }

      logger.info(
        `Upserting vector: messageId=${messageId}, vectorDim=${vector.length}`
      )

      await qdrant.upsert(MESSAGE_COLLECTION, {
        wait: true,
        points: [
          {
            id: objectIdToUuid(messageId),
            vector,
            payload,
          },
        ],
      })

      return true
    } catch (error) {
      logger.error(`Vector save failed: ${error.message}`)
      logger.error(`Full error:`, error)
      throw new ApiError(500, 'Vector save failed', { messageId, chatId })
    }
  }

  static async deleteVector(messageId) {
    try {
      await qdrant.delete(MESSAGE_COLLECTION, {
        points: [objectIdToUuid(messageId)],
        wait: true,
      })

      logger.info(`Vector deleted: ${messageId}`)
    } catch (error) {
      logger.error(`Vector delete failed: ${error.message}`)
      throw new ApiError(500, 'Vector delete failed')
    }
  }

  static async searchRelevant({ userId, chatId, content, limit = 5 }) {
    try {
      const vector = await EmbeddingService.embedText(content)

      const filter = {
        must: [
          { key: 'userId', match: { value: userId } },
          { key: 'chatId', match: { value: chatId } },
        ],
      }

      const raw = await qdrant.search(MESSAGE_COLLECTION, {
        vector,
        filter,
        limit: limit * 3,
      })

      const scored = raw
        .map((item) => ({
          id: item.id,
          role: item.payload.role,
          text: item.payload.text,
          similarity: item.score,
          score: MemoryService.scoreMemory(item),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return scored
    } catch (error) {
      logger.error(`Vector search failed: ${error.message}`)
      throw new ApiError(500, 'Memory search failed')
    }
  }

  static async deleteChatMemory(chatId) {
    try {
      const filter = {
        must: [{ key: 'chatId', match: { value: chatId } }],
      }

      await qdrant.delete(MESSAGE_COLLECTION, {
        filter,
        wait: true,
      })

      logger.info(`Memory cleared for chat=${chatId}`)
    } catch (error) {
      logger.error(`Vector batch delete failed: ${error.message}`)
    }
  }
}

module.exports = MemoryService
