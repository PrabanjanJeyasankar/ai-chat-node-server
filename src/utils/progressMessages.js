const PROGRESS_SCHEMA_VERSION = 'vl-progress-v2-2025-12-14'

const PROGRESS_MESSAGES = {
  chat_setup: {
    initializing: {
      message: 'Setting up...',
    },
    creating_new_chat: {
      message: 'Starting conversation...',
    },
    loading_existing_chat: {
      message: 'Loading history...',
    },
    completed: {
      message: 'Ready...',
    },
  },

  user_message: {
    creating: {
      message: 'Processing message...',
    },
    completed: {
      message: 'Message received...',
    },
  },

  memory_vector: {
    processing: {
      message: 'Analyzing...',
    },
    completed: {
      message: 'Context ready...',
    },
  },

  memory_recall: {
    searching: {
      message: 'Searching previous conversations...',
    },
    found: {
      message: 'Found {count} relevant items...',
    },
    none_found: {
      message: 'Starting fresh...',
    },
  },

  rag_pipeline: {
    starting: {
      message: 'Scanning headlines...',
    },
    retrieving: {
      message: 'Searching news articles...',
    },
    ranking: {
      message: 'Matching your request...',
    },
    reranking: {
      message: 'Refining results...',
    },
    filtering: {
      message: 'Filtering sources...',
    },
    completed: {
      message: 'Found {count} sources...',
    },
    insufficient_data: {
      message: 'Limited information available...',
    },
  },

  llm_generation: {
    generating: {
      message: 'Scanning latest headlines...',
    },
    completed: {
      message: 'Response ready...',
    },
  },

  assistant_message: {
    creating: {
      message: 'Finalizing...',
    },
    completed: {
      message: 'Done',
    },
  },
}

const normalizeIdentifier = (value) => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'object') {
    const candidate =
      (typeof value.stage === 'string' && value.stage) ||
      (typeof value.substage === 'string' && value.substage) ||
      (typeof value.name === 'string' && value.name) ||
      (typeof value.key === 'string' && value.key) ||
      (typeof value.id === 'string' && value.id)
    if (candidate) return candidate

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function getProgressMessage(stage, substage, data = {}) {
  const normalizedStage = normalizeIdentifier(stage)
  const normalizedSubstage = normalizeIdentifier(substage)

  const stageMessages = PROGRESS_MESSAGES[normalizedStage]
  if (!stageMessages) {
    return {
      message: `Processing ${normalizedStage || 'request'}...`,
    }
  }

  const substageMessage = stageMessages[normalizedSubstage]
  if (!substageMessage) {
    return {
      message: `Processing ${normalizedStage} - ${normalizedSubstage}...`,
    }
  }

  const result = { ...substageMessage }

  if (data && typeof result.message === 'string') {
    result.message = result.message.replace(/{(\w+)}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match
    })
  }

  return result
}

function createProgressData(stage, substage, additionalData = {}) {
  const normalizedStage = normalizeIdentifier(stage)
  const normalizedSubstage = normalizeIdentifier(substage)

  const humanMessage = getProgressMessage(
    normalizedStage,
    normalizedSubstage,
    additionalData
  )

  return {
    stage: normalizedStage,
    substage: {
      stage: normalizedStage,
      substage: normalizedSubstage,
      message: humanMessage.message,
      icon: humanMessage.icon || null,
    },
    timestamp: new Date().toISOString(),
    progressVersion: PROGRESS_SCHEMA_VERSION,
    ...additionalData,
  }
}

module.exports = {
  getProgressMessage,
  createProgressData,
  PROGRESS_MESSAGES,
  PROGRESS_SCHEMA_VERSION,
}
