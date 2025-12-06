const express = require('express')
const router = express.Router()

const { protect } = require('../middleware/authMiddleware')

const {
  createMessage,
  editMessage,
  regenerateMessage,
  getMessages,
} = require('../controllers/message.controller')

const { messageLimiter, regenerateLimiter } = require('../utils/rateLimiter')

router.post('/', protect, messageLimiter, createMessage)
router.post('/:chatId/messages', protect, messageLimiter, createMessage)

router.get('/:chatId/messages', protect, getMessages)

router.patch('/:messageId', protect, editMessage)
router.post(
  '/:messageId/regenerate',
  protect,
  regenerateLimiter,
  regenerateMessage
)

module.exports = router
