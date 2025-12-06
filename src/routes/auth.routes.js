const express = require('express')
const { signup, login, me } = require('../controllers/auth.controller.js')
const validate = require('../middleware/validate')
const { signupSchema, loginSchema } = require('../validators/auth.validator')
const { protect } = require('../middleware/authMiddleware')

const { signupLimiter, loginLimiter } = require('../utils/rateLimiter')

const router = express.Router()

router.post('/signup', signupLimiter, validate(signupSchema), signup)
router.post('/login', loginLimiter, validate(loginSchema), login)
router.get('/me', protect, me)

module.exports = router
