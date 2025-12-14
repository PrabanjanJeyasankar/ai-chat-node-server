const axios = require('axios')
const config = require('../../config')

const rerank = async ({ query, documents }) => {
  const url = process.env.RERANKER_URL || config?.rag?.rerankerUrl

  if (!url) {
    return documents.map((_d, idx) => ({ index: idx, score: 1 }))
  }

  try {
    const response = await axios.post(
      url,
      { query, documents },
      { timeout: 15000 }
    )

    return response.data
  } catch (error) {
    return documents.map((_d, idx) => ({ index: idx, score: 1 }))
  }
}

module.exports = { rerank }
