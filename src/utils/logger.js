const fs = require('fs')
const path = require('path')

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

const logFile = path.join(logDir, 'app.log')

const write = (level, message) => {
  const entry = `${new Date().toISOString()} [${level}] ${message}\n`
  fs.appendFileSync(logFile, entry)
}

const devLogger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

const prodLogger = {
  info: (...args) =>
    write(
      'INFO',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    ),
  warn: (...args) =>
    write(
      'WARN',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    ),
  error: (...args) =>
    write(
      'ERROR',
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
    ),
}

module.exports = process.env.NODE_ENV === 'production' ? prodLogger : devLogger
