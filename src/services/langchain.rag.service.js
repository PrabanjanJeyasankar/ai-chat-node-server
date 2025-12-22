const axios = require('axios')

class LangChainRAGService {
  constructor(baseUrl = 'http://localhost:8001') {
    this.baseUrl = baseUrl
  }

  async runNewsRagPipeline({ query, onProgress }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/rag`,
        { query },
        { timeout: 30000 }
      )

      return response.data
    } catch (error) {
      console.error('LangChain RAG Service error:', error.message)

      return {
        ok: false,
        message: 'RAG service unavailable',
        chunks: [],
      }
    }
  }
}

module.exports = { LangChainRAGService }
