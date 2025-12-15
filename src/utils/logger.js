const fs = require('fs')
const path = require('path')
const config = require('../config')

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

const logFile = path.join(logDir, 'app.log')

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const configuredLevel = String(config?.logging?.level || 'info').toLowerCase()
const configuredRank = LEVELS[configuredLevel] ?? LEVELS.info

const shouldLog = (level) => {
  const rank = LEVELS[level] ?? LEVELS.info
  return rank >= configuredRank
}

const write = (level, message) => {
  const entry = `${new Date().toISOString()} [${level}] ${message}\n`
  fs.appendFileSync(logFile, entry)
}

const devLogger = {
  debug: (...args) => {
    if (!shouldLog('debug')) return
    console.log(...args)
  },
  info: (...args) => {
    if (!shouldLog('info')) return
    console.log(...args)
  },
  warn: (...args) => {
    if (!shouldLog('warn')) return
    console.warn(...args)
  },
  error: (...args) => {
    if (!shouldLog('error')) return
    console.error(...args)
  },
}

const prodLogger = {
  debug: (...args) => {
    if (!shouldLog('debug')) return
    console.log(...args)
    write(
      'DEBUG',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    )
  },
  info: (...args) => {
    if (!shouldLog('info')) return
    console.log(...args)
    write(
      'INFO',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    )
  },
  warn: (...args) => {
    if (!shouldLog('warn')) return
    console.warn(...args)
    write(
      'WARN',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    )
  },
  error: (...args) => {
    if (!shouldLog('error')) return
    console.error(...args)
    write(
      'ERROR',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    )
  },
}

module.exports = process.env.NODE_ENV === 'production' ? prodLogger : devLogger
