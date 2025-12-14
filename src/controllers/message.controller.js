const { asyncHandler } = require('../middleware/asyncHandler')
const messageService = require('../services/message.service')
const { success } = require('../utils/response')
const logger = require('../utils/logger')

const createMessage = asyncHandler(async (request, response) => {
  const startTime = Date.now()
  const chatId = request.params.chatId || null
  const { content, mode, requestId } = request.body

  // Basic deduplication based on content and user within a short timeframe
  const dedupeKey = `${request.user.id}-${content?.substring(0, 50)}-${mode}`
  
  logger.info(
    `📨 [MESSAGE CONTROLLER START] chatId=${chatId} | mode=${mode} | content="${content?.substring(
      0,
      50
    )}..." | dedupeKey=${dedupeKey.substring(0, 30)}...`
  )

  try {
    const serviceStartTime = Date.now()
    const result = await messageService.createMessage({
      chatId,
      userId: request.user.id,
      content,
      mode,
    })
    const serviceTime = Date.now() - serviceStartTime
    const totalTime = Date.now() - startTime

    logger.info(
      `✅ [MESSAGE CONTROLLER SUCCESS] Total: ${totalTime}ms | Service: ${serviceTime}ms`
    )

    // Convert mongoose documents to plain objects to avoid serialization issues
    const cleanResult = {
      chatId: result.chatId,
      userMessage: result.userMessage?.toObject
        ? result.userMessage.toObject()
        : result.userMessage,
      assistantMessage: result.assistantMessage?.toObject
        ? result.assistantMessage.toObject()
        : result.assistantMessage,
      isFirstMessage: result.isFirstMessage,
      title: result.title || null,
    }

    // Test JSON serialization before sending response
    try {
      const serialized = JSON.stringify(cleanResult)
      logger.info(`[RESPONSE] Successfully serialized response data (${serialized.length} chars)`)
    } catch (serializationError) {
      logger.error(
        `[RESPONSE ERROR] JSON serialization failed: ${serializationError.message}`
      )
      throw new Error(
        `Response serialization failed: ${serializationError.message}`
      )
    }

    logger.info(`[RESPONSE] Sending response to client...`)
    const successResponse = success(response, 201, 'Message created', cleanResult)
    logger.info(`[RESPONSE] Response sent successfully`)
    
    return successResponse
  } catch (error) {
    const totalTime = Date.now() - startTime
    logger.error(
      `❌ [MESSAGE CONTROLLER ERROR] Total: ${totalTime}ms | Error: ${error?.message}`
    )

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

  return success(response, 200, 'Assistant regenerated', result)
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
