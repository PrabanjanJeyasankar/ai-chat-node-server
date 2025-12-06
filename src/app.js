const express = require('express')
const cors = require('cors')
const router = require('./routes')
const { AppError, errorHandler } = require('./middleware/errorHandler')
const logger = require('./utils/logger')
const { globalRateLimiter } = require('./utils/rateLimiter')

const app = express()

app.use((request, response, next) => {
  logger.info(`${request.method} ${request.originalUrl}`)
  next()
})

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1', globalRateLimiter, router)

app.use((request, response, next) => {
  next(new AppError('Route not found', 404))
})

app.use(errorHandler)

module.exports = app
