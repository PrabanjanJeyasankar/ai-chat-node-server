const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { ApiError } = require('../utils/ApiError')
const { processLLM, processLLMStreaming } = require('./llm.service')
const chatService = require('./chat.service')
const memoryService = require('./embeddings/memory.service')
const chatHistoryCache = require('../cache/chatHistoryCache')
const { runNewsRagPipeline } = require('../rag/pipeline/ragPipeline')
const { createProgressData } = require('../utils/progressMessages')
const { generateChainOfThoughts } = require('./chainOfThoughts.service')
const logger = require('../utils/logger')

const getLatestVersionContent = (message) =>
  message.versions[message.currentVersionIndex].content

const emitProgress = (onProgress, stage, substage, additionalData = {}) => {
  if (onProgress && typeof onProgress === 'function') {
    const progressData = createProgressData(stage, substage, additionalData)
    onProgress(stage, progressData)
  }
}

const buildMemoryInstructions = (memory) => {
  if (memory.length === 0) return ''

  const memoryContext = memory.map((m) => `(${m.role}) ${m.text}`).join('\n')

  return `
You have access to previous important context:
${memoryContext}

Do NOT mention memory in your answer.
`
}

const buildNewsContext = (newsResults) => {
  if (newsResults.length === 0) return ''

  const sourcesList = newsResults
    .map((result, idx) => {
      const { title, url, source, startLine, endLine, text } = result.payload
      return `
SOURCE ${idx + 1}:
Title: ${title}
URL: ${url}
Source: ${source}
Lines: ${startLine}-${endLine}
Content:
${text}
---`
    })
    .join('\n\n')

  return `
You must answer strictly using the provided context.
If the answer is not fully supported by the context, say you don't have enough information.
Do not add external knowledge.

CONTEXT:
${sourcesList}
`
}

const buildMessageSources = (newsResults) => {
  return newsResults.map((result) => ({
    title: result.payload.title,
    url: result.payload.url,
    source: result.payload.source,
    lines: `${result.payload.startLine}-${result.payload.endLine}`,
    publishedAt: new Date(result.payload.publishedAt).toISOString(),
    similarity: result.rerankScore ?? 0,
    finalScore: result.rerankScore ?? 0,
  }))
}

const createMessage = async ({
  chatId,
  userId,
  content,
  mode,
  streaming = true,
  onProgress,
  onLLMChunk,
  onLLMComplete,
  onLLMError,
}) => {
  try {
    emitProgress(onProgress, 'chat_setup', 'initializing')

    let chat = null
    let isFirstMessage = false

    if (!chatId) {
      emitProgress(onProgress, 'chat_setup', 'creating_new_chat')
      chat = await chatService.createChat({
        userId,
        firstMessageContent: content,
        mode,
      })
      chatId = chat._id
      isFirstMessage = true
    } else {
      emitProgress(onProgress, 'chat_setup', 'loading_existing_chat')
      chat = await Chat.findById(chatId)
      if (!chat) throw new ApiError(404, 'Chat not found')

      if (mode && mode !== chat.mode) {
        chat.mode = mode
        await chat.save()
      }
    }

    emitProgress(onProgress, 'chat_setup', 'completed', { chatId })
    emitProgress(onProgress, 'user_message', 'creating')

    const userMessage = await Message.create({
      chatId,
      userId,
      role: 'user',
      mode: chat.mode,
      versions: [{ content }],
      currentVersionIndex: 0,
    })

    emitProgress(onProgress, 'user_message', 'completed', {
      messageId: userMessage._id,
    })

    emitProgress(onProgress, 'memory_vector', 'processing')

    await memoryService.saveMessageVector({
      userId,
      chatId,
      messageId: userMessage._id,
      role: 'user',
      content,
    })

    emitProgress(onProgress, 'memory_vector', 'completed')

    let memory = []

    if (!isFirstMessage && chat.mode !== 'news') {
      emitProgress(onProgress, 'memory_recall', 'searching')

      logger.info(
        `[Message Service] Calling memory search - userId: ${userId}, chatId: ${chatId}, isFirstMessage: ${isFirstMessage}`
      )

      memory = await memoryService.searchRelevant({
        userId,
        chatId,
        content,
        limit: 5,
        minScore: 0.35,
      })

      logger.info(
        `[Message Service] Memory search completed - found ${memory.length} results`
      )

      if (memory.length > 0) {
        emitProgress(onProgress, 'memory_recall', 'found', {
          count: memory.length,
        })
      } else {
        emitProgress(onProgress, 'memory_recall', 'none_found')
      }
    }

    let newsResults = []
    let newsAbortMessage = null
    let chainOfThoughts = null

    if (chat.mode === 'news') {
      emitProgress(onProgress, 'rag_pipeline', 'starting', {
        source: 'news articles',
      })

      const ragResult = await runNewsRagPipeline({
        query: content,
        onProgress: (stage, data) => emitProgress(onProgress, stage, data),
      })

      if (!ragResult.ok) {
        emitProgress(onProgress, 'rag_pipeline', 'insufficient_data')
        newsAbortMessage = ragResult.message
      } else {
        emitProgress(onProgress, 'rag_pipeline', 'completed', {
          count: ragResult.chunks?.length || 0,
        })
        newsResults = ragResult.chunks

        // Generate chain of thoughts for news mode
        if (newsResults.length > 0) {
          emitProgress(onProgress, 'chain_of_thoughts', 'starting')

          try {
            chainOfThoughts = await generateChainOfThoughts({
              userQuery: content,
              newsResults,
              onThoughtProgress: (stage, data) =>
                emitProgress(onProgress, stage, data),
            })

            emitProgress(onProgress, 'chain_of_thoughts', 'completed', {
              phases: chainOfThoughts.totalPhases,
            })
          } catch (chainError) {
            logger.error(
              `[Message Service] Chain of thoughts failed: ${chainError.message}`
            )
            emitProgress(onProgress, 'chain_of_thoughts', 'error', {
              error: chainError.message,
            })
          }
        }
      }
    }

    const memoryInstructions = buildMemoryInstructions(memory)
    const newsContext = buildNewsContext(newsResults)

    const systemContent = (
      chat.mode === 'news' ? [newsContext] : [memoryInstructions, newsContext]
    )
      .filter((s) => s.trim())
      .join('\n\n')

    let assistantReply = null
    let title = null

    if (chat.mode === 'news' && newsAbortMessage) {
      assistantReply = newsAbortMessage
    } else {
      const llmMessages = [
        ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
        { role: 'user', content },
      ]

      emitProgress(onProgress, 'llm_generation', 'generating', {
        model: chat.model,
      })

      if (streaming) {
        // Use streaming LLM service
        let streamingAssistantMessage = null
        let currentContent = ''

        const llmOut = await processLLMStreaming({
          messages: llmMessages,
          isFirstMessage,
          onChunk: (chunkData) => {
            currentContent = chunkData.fullContent

            // Create or update the assistant message with the current content
            if (!streamingAssistantMessage) {
              // Create the assistant message on first chunk
              Message.create({
                chatId,
                userId: null,
                role: 'assistant',
                mode: chat.mode,
                versions: [{ content: currentContent, model: chat.model }],
                currentVersionIndex: 0,
                sources:
                  chat.mode === 'news' && newsResults.length > 0
                    ? buildMessageSources(newsResults)
                    : [],
                chainOfThoughts:
                  chat.mode === 'news' && chainOfThoughts
                    ? chainOfThoughts
                    : undefined,
              })
                .then((msg) => {
                  streamingAssistantMessage = msg
                  if (onLLMChunk) {
                    onLLMChunk({
                      ...chunkData,
                      messageId: msg._id,
                    })
                  }
                })
                .catch((err) => {
                  console.error('Error creating streaming message:', err)
                })
            } else {
              // Update the existing message
              streamingAssistantMessage.versions[0].content = currentContent
              streamingAssistantMessage.save().catch((err) => {
                console.error('Error updating streaming message:', err)
              })

              if (onLLMChunk) {
                onLLMChunk({
                  ...chunkData,
                  messageId: streamingAssistantMessage._id,
                })
              }
            }
          },
          onComplete: (completeData) => {
            assistantReply = completeData.assistantReply
            title = completeData.title

            if (onLLMComplete) {
              onLLMComplete({
                ...completeData,
                messageId: streamingAssistantMessage?._id,
              })
            }
          },
          onError: (errorData) => {
            if (onLLMError) {
              onLLMError(errorData)
            }
          },
        })

        emitProgress(onProgress, 'llm_generation', 'completed', {
          model: chat.model,
          streaming: true,
        })

        assistantReply = llmOut.assistantReply
        title = llmOut.title
      } else {
        // Use non-streaming LLM service (backward compatibility)
        const llmOut = await processLLM({
          messages: llmMessages,
          isFirstMessage,
        })

        emitProgress(onProgress, 'llm_generation', 'completed', {
          model: chat.model,
          streaming: false,
        })

        assistantReply = llmOut.assistantReply
        title = llmOut.title
      }
    }

    const messageSources =
      chat.mode === 'news' && newsResults.length > 0
        ? buildMessageSources(newsResults)
        : []

    emitProgress(onProgress, 'assistant_message', 'creating')

    // For streaming, the message might already be created
    let assistantMessage
    if (streaming) {
      // Look for existing streaming message or create new one
      assistantMessage = await Message.findOne({
        chatId,
        role: 'assistant',
        createdAt: { $gte: new Date(Date.now() - 10000) }, // Created within last 10 seconds
      }).sort({ createdAt: -1 })

      if (!assistantMessage) {
        assistantMessage = await Message.create({
          chatId,
          userId: null,
          role: 'assistant',
          mode: chat.mode,
          versions: [{ content: assistantReply, model: chat.model }],
          currentVersionIndex: 0,
          sources: messageSources,
          chainOfThoughts:
            chat.mode === 'news' && chainOfThoughts
              ? chainOfThoughts
              : undefined,
        })
      } else {
        // Update existing message with final content and sources
        assistantMessage.versions[0].content = assistantReply
        assistantMessage.sources = messageSources
        if (chat.mode === 'news' && chainOfThoughts) {
          assistantMessage.chainOfThoughts = chainOfThoughts
        }
        await assistantMessage.save()
      }
    } else {
      // Non-streaming: create message normally
      assistantMessage = await Message.create({
        chatId,
        userId: null,
        role: 'assistant',
        mode: chat.mode,
        versions: [{ content: assistantReply, model: chat.model }],
        currentVersionIndex: 0,
        sources: messageSources,
        chainOfThoughts:
          chat.mode === 'news' && chainOfThoughts ? chainOfThoughts : undefined,
      })
    }

    chatHistoryCache
      .append(chatId.toString(), [userMessage, assistantMessage])
      .catch(() => {})

    await memoryService.saveMessageVector({
      userId,
      chatId,
      messageId: assistantMessage._id,
      role: 'assistant',
      content: assistantReply,
    })

    emitProgress(onProgress, 'assistant_message', 'completed')

    chat.lastMessage = content
    chat.lastMessageAt = new Date()
    if (isFirstMessage && title) chat.title = title
    await chat.save()

    return {
      chatId,
      userMessage,
      assistantMessage,
      isFirstMessage,
      title,
    }
  } catch (error) {
    throw error
  }
}

const editUserMessage = async ({ messageId, newContent }) => {
  const message = await Message.findById(messageId)
  if (!message) throw new ApiError(404, 'Message not found')
  if (message.role !== 'user')
    throw new ApiError(400, 'Only user messages can be edited')

  message.versions.push({ content: newContent })
  message.currentVersionIndex = message.versions.length - 1
  await message.save()

  chatHistoryCache.invalidate(message.chatId.toString()).catch(() => {})

  const chat = await Chat.findById(message.chatId)
  if (!chat) throw new ApiError(404, 'Chat not found')

  if (!message.mode) {
    message.mode = chat.mode || 'default'
  }

  await memoryService.saveMessageVector({
    userId: message.userId,
    chatId: message.chatId,
    messageId: message._id,
    role: 'user',
    content: newContent,
  })

  const memory =
    chat.mode === 'news'
      ? []
      : await memoryService.searchRelevant({
          userId: message.userId,
          chatId: message.chatId,
          content: newContent,
          limit: 5,
        })

  let newsResults = []
  let newsAbortMessage = null

  if (chat.mode === 'news') {
    const ragResult = await runNewsRagPipeline({ query: newContent })
    if (!ragResult.ok) {
      newsAbortMessage = ragResult.message
    } else {
      newsResults = ragResult.chunks
    }
  }

  const memoryInstructions = buildMemoryInstructions(memory)
  const newsContext = buildNewsContext(newsResults)

  const systemContent = (
    chat.mode === 'news' ? [newsContext] : [memoryInstructions, newsContext]
  )
    .filter((s) => s.trim())
    .join('\n\n')

  let assistantReply = null
  if (chat.mode === 'news' && newsAbortMessage) {
    assistantReply = newsAbortMessage
  } else {
    const llmInput = [
      ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
      { role: 'user', content: newContent },
    ]

    const llmOut = await processLLM({
      model: chat.model,
      messages: llmInput,
      isFirstMessage: false,
    })

    assistantReply = llmOut.assistantReply
  }

  const assistant = await Message.findOne({
    chatId: message.chatId,
    role: 'assistant',
  }).sort({ createdAt: -1 })

  if (!assistant) throw new ApiError(404, 'Assistant message not found')

  if (!assistant.mode) {
    assistant.mode = chat.mode || 'default'
  }

  assistant.sources =
    chat.mode === 'news' && newsResults.length > 0
      ? buildMessageSources(newsResults)
      : []

  assistant.versions.push({ content: assistantReply, model: chat.model })
  assistant.currentVersionIndex = assistant.versions.length - 1
  await assistant.save()

  await memoryService.saveMessageVector({
    userId: message.userId,
    chatId: message.chatId,
    messageId: assistant._id,
    role: 'assistant',
    content: assistantReply,
  })

  return {
    editedUserMessage: message,
    newAssistantMessage: assistant,
  }
}

const regenerateAssistantResponse = async ({ messageId }) => {
  const userMessage = await Message.findById(messageId)
  if (!userMessage) throw new ApiError(404, 'Message not found')
  if (userMessage.role !== 'user')
    throw new ApiError(400, 'Only user messages can regenerate')

  const chat = await Chat.findById(userMessage.chatId)
  if (!chat) throw new ApiError(404, 'Chat not found')

  chatHistoryCache.invalidate(userMessage.chatId.toString()).catch(() => {})

  if (!userMessage.mode) {
    userMessage.mode = chat.mode || 'default'
    await userMessage.save()
  }

  const latestUserText = getLatestVersionContent(userMessage)

  const memory =
    chat.mode === 'news'
      ? []
      : await memoryService.searchRelevant({
          userId: userMessage.userId,
          chatId: userMessage.chatId,
          content: latestUserText,
          limit: 5,
        })

  let newsResults = []
  let newsAbortMessage = null

  if (chat.mode === 'news') {
    const ragResult = await runNewsRagPipeline({ query: latestUserText })
    if (!ragResult.ok) {
      newsAbortMessage = ragResult.message
    } else {
      newsResults = ragResult.chunks
    }
  }

  const memoryInstructions = buildMemoryInstructions(memory)
  const newsContext = buildNewsContext(newsResults)

  const systemContent = (
    chat.mode === 'news' ? [newsContext] : [memoryInstructions, newsContext]
  )
    .filter((s) => s.trim())
    .join('\n\n')

  let assistantReply = null
  if (chat.mode === 'news' && newsAbortMessage) {
    assistantReply = newsAbortMessage
  } else {
    const llmInput = [
      ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
      { role: 'user', content: latestUserText },
    ]

    const llmOut = await processLLM({
      model: chat.model,
      messages: llmInput,
      isFirstMessage: false,
    })

    assistantReply = llmOut.assistantReply
  }

  const assistant = await Message.findOne({
    chatId: userMessage.chatId,
    role: 'assistant',
  }).sort({ createdAt: -1 })

  if (!assistant.mode) {
    assistant.mode = chat.mode || 'default'
  }

  assistant.sources =
    chat.mode === 'news' && newsResults.length > 0
      ? buildMessageSources(newsResults)
      : []

  assistant.versions.push({ content: assistantReply, model: chat.model })
  assistant.currentVersionIndex = assistant.versions.length - 1
  await assistant.save()

  await memoryService.saveMessageVector({
    userId: userMessage.userId,
    chatId: userMessage.chatId,
    messageId: assistant._id,
    role: 'assistant',
    content: assistantReply,
  })

  return { assistant }
}

const getMessagesByChatId = async (chatId) => {
  const cached = await chatHistoryCache.get(chatId.toString())
  if (cached) {
    return cached.map((message) => ({
      ...message,
      mode: message.mode || 'default',
    }))
  }

  const messages = await Message.find({ chatId }).sort({ createdAt: 1 }).lean()

  const normalized = messages.map((message) => ({
    ...message,
    mode: message.mode || 'default',
  }))

  chatHistoryCache.set(chatId.toString(), normalized).catch(() => {})

  return normalized
}

module.exports = {
  createMessage,
  editUserMessage,
  regenerateAssistantResponse,
  getMessagesByChatId,
}
