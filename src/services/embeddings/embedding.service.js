const axios = require('axios')
const providers = require('../../config/providers')
const { ApiError } = require('../../utils/ApiError')

class EmbeddingService {
  static async embedText(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text for embedding')
    }

    const apiKey = providers.gemini.apiKey
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

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

    if (vector.length !== 384) {
      throw new Error(
        `Vector dimension mismatch: got ${vector.length}, expected 384`
      )
    }

    return vector
  }
}

module.exports = EmbeddingService
