const { asyncHandler } = require('../middleware/asyncHandler')
const messageService = require('../services/message.service')
const { success } = require('../utils/response')

const createMessage = asyncHandler(async (request, response) => {
  const chatId = request.params.chatId || null
  const { content } = request.body

  try {
    const result = await messageService.createMessage({
      chatId,
      userId: request.user.id,
      content,
    })

    return success(response, 201, 'Message created', result)
  } catch (error) {
    const status = error.statusCode || error.status || 500

    const message =
      error?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      'LLM generation failed'

    const details = error?.details || error?.response?.data || {}

    return response.status(status).json({
      success: false,
      message,
      details,
    })
  }
})

const editMessage = asyncHandler(async (request, response) => {
  const { messageId } = request.params
  const { content } = request.body

  const result = await messageService.editUserMessage({
    messageId,
    newContent: content,
  })

  return success(response, 200, 'Message edited', result)
})

const regenerateMessage = asyncHandler(async (request, response) => {
  const { messageId } = request.params
  const result = await messageService.regenerateAssistantResponse({
    messageId,
  })

  return success(response, 200, 'Assistant regenerated', { assistant: result })
})

const getMessages = asyncHandler(async (request, response) => {
  const { chatId } = request.params

  const messages = await messageService.getMessagesByChatId(chatId)

  return success(response, 200, 'Messages fetched', { messages })
})

module.exports = {
  createMessage,
  editMessage,
  regenerateMessage,
  getMessages,
}
