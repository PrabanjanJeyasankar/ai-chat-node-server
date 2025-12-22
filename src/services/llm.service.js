const { ChatOpenAI } = require('@langchain/openai')
const { ChatOllama } = require('@langchain/ollama')
const { HumanMessage, AIMessage } = require('@langchain/core/messages')
const providers = require('../config/providers')
const config = require('../config')
const { ApiError } = require('../utils/ApiError')
const { MAX_SINGLE_MESSAGE_CHARS, ERRORS } = require('../config/llmLimits')
const logger = require('../utils/logger')

const resolveProvider = () => {
  const provider = config.ai.provider || 'openai'

  if (provider === 'ollama') {
    return {
      name: 'ollama',
      model: providers.ollama.model,
      baseUrl: providers.ollama.baseUrl,
    }
  }

  return {
    name: 'openai',
    model: providers.openai.model,
    apiKey: providers.openai.apiKey,
  }
}

const validateLLMInput = (messages) => {
  if (!messages || messages.length === 0) return

  const last = messages[messages.length - 1]
  const charCount = [...last.content].length

  if (charCount > MAX_SINGLE_MESSAGE_CHARS) {
    throw new ApiError(400, ERRORS.TOO_LONG_SINGLE)
  }
}

const createLangChainModel = () => {
  const { name, model, baseUrl, apiKey } = resolveProvider()

  if (name === 'ollama') {
    return new ChatOllama({
      model,
      baseUrl: baseUrl.replace(/\/$/, ''),
      temperature: 0.7,
    })
  }

  return new ChatOpenAI({
    modelName: model,
    openAIApiKey: apiKey,
    temperature: 0.7,
    streaming: true,
  })
}

const convertMessagesToLangChain = (messages) => {
  return messages.map((msg) => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content)
    } else if (msg.role === 'assistant') {
      return new AIMessage(msg.content)
    }
    // Handle system messages if needed
    return new HumanMessage(msg.content)
  })
}

const processLLMStreaming = async ({
  messages,
  isFirstMessage,
  onChunk,
  onComplete,
  onError,
}) => {
  try {
    validateLLMInput(messages)

    const model = createLangChainModel()
    const langChainMessages = convertMessagesToLangChain(messages)

    let assistantReply = ''
    let chunkCount = 0

    logger.info(
      `[Streaming LLM] Starting streaming with ${messages.length} messages`
    )

    // Stream the main response
    const stream = await model.stream(langChainMessages)

    for await (const chunk of stream) {
      const content = chunk.content || ''

      if (content) {
        assistantReply += content
        chunkCount++

        // Emit chunk through callback
        if (onChunk && typeof onChunk === 'function') {
          onChunk({
            type: 'chunk',
            content,
            fullContent: assistantReply,
            chunkIndex: chunkCount,
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    logger.info(`[Streaming LLM] Completed streaming with ${chunkCount} chunks`)

    // Generate title if it's the first message
    let autoTitle = null
    if (isFirstMessage) {
      try {
        const titleMessages = generateTitlePrompt(messages[0].content)
        const titleLangChainMessages = convertMessagesToLangChain(titleMessages)

        // For title generation, we don't need streaming
        const titleModel = createLangChainModel()
        const titleResponse = await titleModel.invoke(titleLangChainMessages)
        const raw = titleResponse.content || ''

        autoTitle = raw.replace(/["']/g, '').trim().slice(0, 80)
        logger.info(`[Streaming LLM] Generated title: ${autoTitle}`)
      } catch (titleError) {
        logger.warn(
          `[Streaming LLM] Title generation failed: ${titleError.message}`
        )
        autoTitle = null
      }
    }

    // Emit completion
    if (onComplete && typeof onComplete === 'function') {
      onComplete({
        type: 'complete',
        assistantReply: assistantReply.trim(),
        title: autoTitle,
        totalChunks: chunkCount,
        timestamp: new Date().toISOString(),
      })
    }

    return {
      assistantReply: assistantReply.trim(),
      title: autoTitle,
      totalChunks: chunkCount,
    }
  } catch (error) {
    logger.error(`[Streaming LLM] Error during streaming: ${error.message}`)

    if (onError && typeof onError === 'function') {
      onError({
        type: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    }

    throw error
  }
}

/**
 * Generates a prompt for creating a concise title from user message
 * @param {string} message - The user's original message
 * @returns {Array} Array of message objects for title generation
 */
const generateTitlePrompt = (message) => [
  {
    role: 'user',
    content:
      "Generate a short factual title summarizing the user's message. Strict rules: 1) Maximum 4 words, 2) No poetic or motivational phrases, 3) No punctuation, 4) Must directly reflect message topic, 5) Output only the title.",
  },
  { role: 'user', content: message },
]

// Non-streaming version for compatibility
const processLLM = async ({ messages, isFirstMessage }) => {
  return new Promise((resolve, reject) => {
    let result = {
      assistantReply: '',
      title: null,
    }

    processLLMStreaming({
      messages,
      isFirstMessage,
      onChunk: (data) => {
        // Just accumulate chunks for non-streaming compatibility
        result.assistantReply = data.fullContent
      },
      onComplete: (data) => {
        result = {
          assistantReply: data.assistantReply,
          title: data.title,
        }
        resolve(result)
      },
      onError: (error) => {
        reject(new Error(error.error))
      },
    })
  })
}

module.exports = {
  processLLM,
  processLLMStreaming,
  createLangChainModel,
  convertMessagesToLangChain,
  // Utility functions (shared)
  resolveProvider,
  validateLLMInput,
  generateTitlePrompt,
}
