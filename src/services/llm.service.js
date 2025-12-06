const axios = require('axios')
const providers = require('../config/providers')
const { ApiError } = require('../utils/ApiError')
const logger = require('../utils/logger')

const resolveProvider = () => {
  return {
    provider: 'gemini',
    model: providers.gemini.model,
    apiKey: providers.gemini.apiKey,
  }
}

const callGemini = async (model, messages) => {
  try {
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${providers.gemini.apiKey}`,
      { contents },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    )

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return text.trim()
  } catch (error) {
    logger.error('Gemini API error:', error.response?.data || error.message)

    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.error?.message || 'Gemini request failed',
      error.response?.data || {}
    )
  }
}

const generateTitlePrompt = (message) => [
  {
    role: 'user',
    content:
      "Generate a short factual title summarizing the user's message. Strict rules: 1) Maximum 4 words, 2) No poetic or motivational phrases, 3) No punctuation, 4) Must directly reflect message topic, 5) Output only the title.",
  },
  { role: 'user', content: message },
]

const processLLM = async ({ messages, isFirstMessage }) => {
  const { model } = resolveProvider()

  const assistantReply = await callGemini(model, messages)

  let autoTitle = null

  if (isFirstMessage) {
    const titlePrompt = generateTitlePrompt(messages[0].content)
    const raw = await callGemini(model, titlePrompt)
    autoTitle = raw.replace(/["']/g, '').trim()
  }

  return {
    assistantReply,
    title: autoTitle,
  }
}

module.exports = {
  processLLM,
}
