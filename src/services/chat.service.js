const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { ApiError } = require('../utils/ApiError')
const { ai } = require('../config')
const MemoryService = require('../services/embeddings/memory.service')

const createChat = async ({ userId, firstMessageContent }) => {
  const provisionalTitle =
    firstMessageContent?.trim()?.slice(0, 50) || 'New Chat'

  const defaultModel =
    ai.provider === 'ollama' ? ai.defaultModelOllama : ai.defaultModelOpenRouter

  const chat = await Chat.create({
    userId,
    title: provisionalTitle,
    lastMessage: firstMessageContent,
    model: defaultModel,
  })

  return chat
}

const setFinalTitle = async (chatId, userId, finalTitle) => {
  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, userId },
    { title: finalTitle, isTitleFinal: true },
    { new: true }
  )

  if (!chat) throw new ApiError(404, 'Chat not found')
  return chat
}

const updateChatPreview = async (chatId, latestContent) => {
  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: latestContent,
    lastMessageAt: Date.now(),
  })
}

const getUserChats = async (userId) => {
  return Chat.find({ userId }).sort({ lastMessageAt: -1 })
}

const getChatById = async (chatId, userId) => {
  const chat = await Chat.findOne({ _id: chatId, userId })
  if (!chat) throw new ApiError(404, 'Chat not found')
  return chat
}

const renameChat = async (chatId, userId, title) => {
  const updatedChat = await Chat.findOneAndUpdate(
    { _id: chatId, userId },
    { title, isTitleFinal: true },
    { new: true }
  )

  if (!updatedChat) throw new ApiError(404, 'Chat not found')
  return updatedChat
}

const deleteChat = async (chatId, userId) => {
  const deletionResult = await Chat.findOneAndDelete({
    _id: chatId,
    userId,
  })

  if (!deletionResult) throw new ApiError(404, 'Chat not found')

  await Message.deleteMany({ chatId })

  await MemoryService.deleteChatMemory(chatId)

  return deletionResult
}
module.exports = {
  createChat,
  setFinalTitle,
  updateChatPreview,
  getUserChats,
  getChatById,
  renameChat,
  deleteChat,
}
