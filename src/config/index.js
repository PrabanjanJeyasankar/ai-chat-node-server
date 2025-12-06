const dotenv = require('dotenv')
dotenv.config()

module.exports = {
  server: {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },

  database: {
    uri: process.env.MONGO_URI,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    model: process.env.GEMINI_MODEL,
  },
}
