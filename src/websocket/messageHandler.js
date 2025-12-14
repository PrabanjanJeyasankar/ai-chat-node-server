const jwt = require('jsonwebtoken')
const config = require('../config')
const authService = require('../services/auth.service')
const messageService = require('../services/message.service')
const logger = require('../utils/logger')
const { PROGRESS_SCHEMA_VERSION } = require('../utils/progressMessages')

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.headers.cookie
      ?.split(';')
      ?.find((c) => c.trim().startsWith('accessToken='))
      ?.split('=')[1]

    if (!token) {
      return next(new Error('No authentication token provided'))
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret)
    const user = await authService.getUserById(decoded.id)

    if (!user) {
      return next(new Error('User no longer exists'))
    }

    if (user.isActive === false) {
      return next(new Error('Account is disabled'))
    }

    socket.user = user
    next()
  } catch (error) {
    logger.error(`[WebSocket Auth] Authentication failed: ${error.message}`)
    next(new Error('Authentication failed'))
  }
}

const handleCreateMessage = async (socket, data) => {
  try {
    const { chatId, content, mode, messageId } = data

    logger.info(`[WebSocket] Message creation started: ${messageId}`)

    socket.emit('message:received', {
      messageId,
      status: 'received',
    })

    socket.emit('message:processing', {
      messageId,
      status: 'processing',
      stage: 'creating_user_message',
    })

    const result = await messageService.createMessage({
      chatId,
      userId: socket.user.id,
      content,
      mode,
      onProgress: (stage, details) => {
        try {
          const debug = {
            messageId,
            stage,
            detailsStage: details?.stage,
            substage: details?.substage,
            substageType: typeof details?.substage,
            message: details?.message,
            progressVersion:
              details?.progressVersion ??
              details?.schemaVersion ??
              details?.version,
            serverTime: new Date().toISOString(),
          }
          logger.info(`VL_BACKEND_PROGRESS ${JSON.stringify(debug)}`)
        } catch (e) {
          logger.warn(`VL_BACKEND_PROGRESS_LOG_ERROR ${e?.message || e}`)
        }

        socket.emit('message:progress', {
          messageId,
          stage,
          details,
          timestamp: new Date().toISOString(),
        })
      },
    })

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

    socket.emit('message:completed', {
      messageId,
      status: 'completed',
      data: cleanResult,
    })

    logger.info(`[WebSocket] Message creation completed: ${messageId}`)
  } catch (error) {
    logger.error(
      `[WebSocket] Message creation failed: ${messageId} - ${error.message}`
    )

    socket.emit('message:error', {
      messageId,
      status: 'error',
      error: {
        message: error.message,
        code: error.statusCode || error.status || 500,
      },
    })
  }
}

const setupWebSocketHandlers = (io) => {
  io.use(authenticateSocket)

  io.on('connection', (socket) => {
    logger.info(
      `[WebSocket] Client connected: ${socket.id} (user: ${socket.user.id})`
    )

    socket.join(`user_${socket.user.id}`)

    socket.on('message:create', (data) => handleCreateMessage(socket, data))

    socket.on('disconnect', (reason) => {
      logger.info(
        `[WebSocket] Client disconnected: ${socket.id} (reason: ${reason})`
      )
    })

    socket.on('error', (error) => {
      logger.error(`[WebSocket] Socket error: ${socket.id} - ${error.message}`)
    })

    socket.emit('connected', {
      socketId: socket.id,
      userId: socket.user.id,
      progressVersion: PROGRESS_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    })
  })

  logger.info('[WebSocket] Handlers setup completed')
}

module.exports = {
  setupWebSocketHandlers,
}
