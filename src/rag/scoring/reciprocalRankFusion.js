const { RRF_K } = require('../../config/rag')

const reciprocalRankFusion = (rankedLists) => {
  const fused = new Map()

  for (const list of rankedLists) {
    if (!Array.isArray(list)) continue

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (!item || !item.key) continue

      const rank = i + 1
      const add = 1 / (RRF_K + rank)
      fused.set(item.key, (fused.get(item.key) || 0) + add)
    }
  }

  return fused
}

module.exports = { reciprocalRankFusion }
