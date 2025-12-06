const axios = require('axios')
const providers = require('../../config/providers')
const { ApiError } = require('../../utils/ApiError')
const logger = require('../../utils/logger')

class EmbeddingService {
  /**
   * Generates embeddings using Google Gemini API (text-embedding-004)
   * Requested dimension: 384 (Matryoshka slicing) to match Qdrant config
   */
  static async embedText(text) {
    // Basic validation
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text for embedding')
    }

    const apiKey = providers.gemini.apiKey
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          content: { parts: [{ text }] },
          outputDimensionality: 384,
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const vector = response.data?.embedding?.values

      if (!vector || !Array.isArray(vector)) {
        throw new Error('Invalid vector response from Gemini API')
      }

      // Sanity check
      if (vector.length !== 384) {
        throw new Error(
          `Vector dimension mismatch: got ${vector.length}, expected 384`
        )
      }

      return vector
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message
      logger.error('Gemini Embedding Error:', errorMsg)

      if (error.response?.data) {
        console.error(
          'Gemini Error Details:',
          JSON.stringify(error.response.data, null, 2)
        )
      }

      throw new ApiError(500, `Embedding failed: ${errorMsg}`)
    }
  }
}

module.exports = EmbeddingService
