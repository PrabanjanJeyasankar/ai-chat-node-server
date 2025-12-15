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
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.includes(',')
      ? process.env.CORS_ORIGIN.split(',')
      : process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    model: process.env.OPENAI_MODEL,
  },

  redis: {
    url: process.env.REDIS_URL || null,
    ttlSeconds: Number(process.env.CHAT_HISTORY_CACHE_TTL_SECONDS) || 60 * 60,
    maxMessages: Number(process.env.CHAT_HISTORY_CACHE_MAX_MESSAGES) || 200,
    inMemoryMaxChats:
      Number(process.env.CHAT_HISTORY_IN_MEMORY_MAX_CHATS) || 200,
  },

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || null,
    checkCompatibility:
      process.env.QDRANT_CHECK_COMPATIBILITY === undefined
        ? true
        : String(process.env.QDRANT_CHECK_COMPATIBILITY).toLowerCase() ===
          'true',
  },

  rag: {
    rerankerUrl: process.env.RERANKER_URL || null,
  },
}
