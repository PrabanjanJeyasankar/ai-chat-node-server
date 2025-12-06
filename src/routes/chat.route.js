const express = require('express')
const router = express.Router()

const {
  createChat,
  getChats,
  getChat,
  renameChat,
  deleteChat,
} = require('../controllers/chat.controller')

const { protect } = require('../middleware/authMiddleware')

const {
  chatCreateLimiter,
  chatRenameLimiter,
  chatDeleteLimiter,
} = require('../utils/rateLimiter')

router.post('/', protect, chatCreateLimiter, createChat)
router.get('/', protect, getChats)

router.get('/:chatId', protect, getChat)
router.patch('/:chatId', protect, chatRenameLimiter, renameChat)
router.delete('/:chatId', protect, chatDeleteLimiter, deleteChat)

module.exports = router
