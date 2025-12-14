const axios = require('axios')
const http = require('http')
const { Server } = require('socket.io')
const connectDB = require('./config/db')
const app = require('./app')
const config = require('./config')
const { initQdrantCollections } = require('./lib/qdrant.collections')
const CronService = require('./services/cron.service')
const { setupWebSocketHandlers } = require('./websocket/messageHandler')

const waitForReranker = async () => {
  const rerankerUrl = process.env.RERANKER_URL || config?.rag?.rerankerUrl

  if (!rerankerUrl) {
    return
  }

  const healthUrl = rerankerUrl.replace(/\/rerank$/, '/health')
  const maxAttempts = 30
  const delayMs = 2000

  console.log(
    `[reranker] Waiting for reranker service at ${healthUrl} before starting server...`
  )

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.get(healthUrl, { timeout: 2000 })

      if (res.status === 200) {
        console.log(
          `[reranker] Reranker service is healthy (attempt ${attempt}/${maxAttempts}).`
        )
        return
      }
    } catch (error) {
      console.log(
        `[reranker] Not ready yet (attempt ${attempt}/${maxAttempts}): ${error.message}`
      )
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  console.error(
    '[reranker] Reranker service did not become healthy in time. Exiting.'
  )
  process.exit(1)
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

const startServer = async () => {
  await connectDB()
  await initQdrantCollections()
  await waitForReranker()

  CronService.startDailyNewsIngestion()

  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  setupWebSocketHandlers(io)

  server.listen(config.server.port, () => {
    const { host, port, env } = config.server
    const ragConfig = require('./config/rag')

    const provider = process.env.AI_PROVIDER || 'hf'
    const activeModel = 'embeddings-only'
    const rerankerUrl =
      process.env.RERANKER_URL || config?.rag?.rerankerUrl || 'disabled'
    const rerankingEnabled = ragConfig.ENABLE_RERANKING ? 'ENABLED' : 'DISABLED'
    const rerankingStatus = ragConfig.ENABLE_RERANKING ? '✓' : '✗'

    const version = process.env.npm_package_version || '1.0.0'
    const nodeVersion = process.version
    const time = new Date().toISOString()

    const BLUE = '\x1b[34m'
    const CYAN = '\x1b[36m'
    const GREEN = '\x1b[32m'
    const MAGENTA = '\x1b[35m'
    const YELLOW = '\x1b[33m'
    const RED = '\x1b[31m'
    const RESET = '\x1b[0m'

    console.log(
      `
    ${BLUE}============================================================${RESET}
    ${CYAN}  AI Chat Server${RESET}
    ${BLUE}------------------------------------------------------------${RESET}

    ${GREEN}  Environment     :${RESET} ${env}
    ${GREEN}  Host            :${RESET} ${host}
    ${GREEN}  Port            :${RESET} ${port}
    ${GREEN}  URL             :${RESET} http://${host}:${port}

    ${MAGENTA}  AI Provider     :${RESET} ${provider}
    ${MAGENTA}  Active Model    :${RESET} ${activeModel}
    ${MAGENTA}  Reranker URL    :${RESET} ${rerankerUrl}
    ${
      ragConfig.ENABLE_RERANKING ? GREEN : RED
    }  Reranking       :${RESET} ${rerankingStatus} ${rerankingEnabled}

    ${YELLOW}  App Version     :${RESET} ${version}
    ${YELLOW}  Node Version    :${RESET} ${nodeVersion}
    ${YELLOW}  Started At      :${RESET} ${time}

    ${BLUE}============================================================${RESET}
    `
    )
  })

  server.setTimeout(30000)

  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error)
    server.close(() => process.exit(1))
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down')
    CronService.stopDailyNewsIngestion()
    server.close(() => console.log('Process terminated'))
  })
}

startServer()
