const Message = require('../models/Message')
const Chat = require('../models/Chat')

const searchMessages = async ({ userId, query, limit = 20, page = 1 }) => {
  const skip = (page - 1) * limit

  const results = await Message.find({
    userId,
    'versions.content': { $regex: query, $options: 'i' },
  })
    .skip(skip)
    .limit(limit)
    .lean()

  const populated = await Chat.populate(results, {
    path: 'chatId',
    select: 'title lastMessage lastMessageAt',
  })

  const extractSnippet = (content, term) => {
    if (!content) return ''
    const idx = content.toLowerCase().indexOf(term.toLowerCase())
    if (idx === -1) return content.substring(0, 100) + '...'

    const start = Math.max(0, idx - 40)
    const end = Math.min(content.length, idx + term.length + 40)
    return (
      (start > 0 ? '...' : '') +
      content.substring(start, end) +
      (end < content.length ? '...' : '')
    )
  }

  return populated
    .filter((m) => m.chatId)
    .map((m) => {
      const latest = m.versions[m.currentVersionIndex]?.content || ''
      m.content = latest
      m.snippet = extractSnippet(latest, query)
      return m
    })
}

module.exports = { searchMessages }
