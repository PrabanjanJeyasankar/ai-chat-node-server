const NewsIngestService = require('./news.ingest.service')
const NewsService = require('./embeddings/news.service')
const logger = require('../utils/logger')

class CronService {
  static newsIngestInterval = null

  static startDailyNewsIngestion() {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

    logger.info('Starting daily news ingestion cron job')

    this.newsIngestInterval = setInterval(async () => {
      try {
        logger.info('Running scheduled news ingestion...')
        const results = await NewsIngestService.ingestAll()
        logger.info(
          `Scheduled ingestion complete: ${results.successful} articles ingested`
        )
      } catch (error) {
        logger.error(`Scheduled news ingestion failed: ${error.message}`)
      }
    }, TWENTY_FOUR_HOURS)

    this.runInitialIngestion()
  }

  static async runInitialIngestion() {
    try {
      logger.info('Running initial news ingestion on startup...')
      await NewsService.warmupKeywordIndexFromMongo().catch((err) => {
        logger.warn(`Keyword index warmup failed: ${err.message}`)
      })
      const results = await NewsIngestService.ingestAll()
      logger.info(
        `Initial ingestion complete: ${results.successful} articles ingested`
      )
    } catch (error) {
      logger.error(`Initial news ingestion failed: ${error.message}`)
    }
  }

  static stopDailyNewsIngestion() {
    if (this.newsIngestInterval) {
      clearInterval(this.newsIngestInterval)
      this.newsIngestInterval = null
      logger.info('Daily news ingestion cron job stopped')
    }
  }
}

module.exports = CronService
