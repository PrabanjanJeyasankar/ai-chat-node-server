const router = require('express').Router()
const { search } = require('../controllers/search.controller')
const { protect } = require('../middleware/authMiddleware')

const { searchLimiter } = require('../utils/rateLimiter')

router.get('/', protect, searchLimiter, search)

module.exports = router
