const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { ApiError } = require('../utils/ApiError')
const { processLLM } = require('./llm.service')
const chatService = require('./chat.service')
const memoryService = require('./embeddings/memory.service')
const logger = require('../utils/logger')

const getLatestVersionContent = (message) =>
  message.versions[message.currentVersionIndex].content

const createMessage = async ({ chatId, userId, content }) => {
  let chat = null
  let isFirstMessage = false

  if (!chatId) {
    chat = await chatService.createChat({
      userId,
      firstMessageContent: content,
    })
    chatId = chat._id
    isFirstMessage = true
  } else {
    chat = await Chat.findById(chatId)
    if (!chat) throw new ApiError(404, 'Chat not found')
  }

  // save user msg
  const userMessage = await Message.create({
    chatId,
    userId,
    role: 'user',
    versions: [{ content }],
    currentVersionIndex: 0,
  })

  await memoryService.saveMessageVector({
    userId,
    chatId,
    messageId: userMessage._id,
    role: 'user',
    content,
  })

  // memory recall only when not first message
  let memory = []
  let memoryInstructions = ''

  if (!isFirstMessage) {
    memory = await memoryService.searchRelevant({
      userId,
      chatId,
      content,
      limit: 5,
      minScore: 0.35, // optional optimization
    })

    if (memory.length > 0) {
      const memoryContext = memory
        .map((m) => `(${m.role}) ${m.text}`)
        .join('\n')

      memoryInstructions = `
        You have access to previous important context:
        ${memoryContext}

        Do NOT mention memory in your answer.
      `
    }
  }

  const llmMessages = [
    ...(memoryInstructions
      ? [{ role: 'system', content: memoryInstructions }]
      : []),
    { role: 'user', content },
  ]

  const { assistantReply, title } = await processLLM({
    model: chat.model,
    messages: llmMessages,
    isFirstMessage,
  })

  const assistantMessage = await Message.create({
    chatId,
    userId: null,
    role: 'assistant',
    versions: [{ content: assistantReply, model: chat.model }],
    currentVersionIndex: 0,
  })

  await memoryService.saveMessageVector({
    userId,
    chatId,
    messageId: assistantMessage._id,
    role: 'assistant',
    content: assistantReply,
  })

  chat.lastMessage = content
  chat.lastMessageAt = new Date()
  if (isFirstMessage && title) chat.title = title
  await chat.save()

  return {
    chatId,
    userMessage,
    assistantMessage,
    memory,
    isFirstMessage,
    title,
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

  const chat = await Chat.findById(message.chatId)
  if (!chat) throw new ApiError(404, 'Chat not found')

  await memoryService.saveMessageVector({
    userId: message.userId,
    chatId: message.chatId,
    messageId: message._id,
    role: 'user',
    content: newContent,
  })

  const memory = await memoryService.searchRelevant({
    userId: message.userId,
    chatId: message.chatId,
    content: newContent,
    limit: 5,
  })

  const memoryContext = memory.map((m) => `(${m.role}) ${m.text}`).join('\n')

  const llmInput = [
    ...(memory.length
      ? [
          {
            role: 'system',
            content: `Use past context to respond:\n\n` + memoryContext,
          },
        ]
      : []),
    { role: 'user', content: newContent },
  ]

  const { assistantReply } = await processLLM({
    model: chat.model,
    messages: llmInput,
    isFirstMessage: false,
  })

  const assistant = await Message.findOne({
    chatId: message.chatId,
    role: 'assistant',
  }).sort({ createdAt: -1 })

  if (!assistant) throw new ApiError(404, 'Assistant message not found')

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

  return { userMessage: message, assistantMessage: assistant, memory }
}

const regenerateAssistantResponse = async ({ messageId }) => {
  const userMessage = await Message.findById(messageId)
  if (!userMessage) throw new ApiError(404, 'Message not found')
  if (userMessage.role !== 'user')
    throw new ApiError(400, 'Only user messages can regenerate')

  const chat = await Chat.findById(userMessage.chatId)
  if (!chat) throw new ApiError(404, 'Chat not found')

  const latestUserText = getLatestVersionContent(userMessage)

  const memory = await memoryService.searchRelevant({
    userId: userMessage.userId,
    chatId: userMessage.chatId,
    content: latestUserText,
    limit: 5,
  })

  const memoryContext = memory.map((m) => `(${m.role}) ${m.text}`).join('\n')

  const llmInput = [
    ...(memory.length
      ? [
          {
            role: 'system',
            content: `Use past context:\n` + memoryContext,
          },
        ]
      : []),
    { role: 'user', content: latestUserText },
  ]

  const { assistantReply } = await processLLM({
    model: chat.model,
    messages: llmInput,
    isFirstMessage: false,
  })

  const assistant = await Message.findOne({
    chatId: userMessage.chatId,
    role: 'assistant',
  }).sort({ createdAt: -1 })

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

  return assistant
}

const getMessagesByChatId = async (chatId) => {
  return Message.find({ chatId }).sort({ createdAt: 1 })
}

module.exports = {
  createMessage,
  editUserMessage,
  regenerateAssistantResponse,
  getMessagesByChatId,
}
