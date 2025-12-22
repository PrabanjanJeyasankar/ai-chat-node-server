const {
  createLangChainModel,
  convertMessagesToLangChain,
} = require('./llm.service')
const logger = require('../utils/logger')

/**
 * Chain of Thoughts Service
 * Implements step-by-step reasoning for news mode queries
 */

const CHAIN_OF_THOUGHTS_PHASES = {
  ANALYZE_QUERY: 'analyze_query',
  SEARCH_STRATEGY: 'search_strategy',
  EVALUATE_SOURCES: 'evaluate_sources',
  SYNTHESIZE_ANSWER: 'synthesize_answer',
}

/**
 * Generate a chain of thoughts reasoning for news queries
 * @param {string} userQuery - The original user question
 * @param {Array} newsResults - Results from RAG pipeline
 * @param {Function} onThoughtProgress - Callback for live updates
 * @returns {Object} Chain of thoughts data
 */
const generateChainOfThoughts = async ({
  userQuery,
  newsResults,
  onThoughtProgress,
}) => {
  try {
    logger.info('[Chain of Thoughts] Starting chain of thoughts generation')

    const thoughts = []
    const model = createLangChainModel()

    // Phase 1: Analyze the query
    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.ANALYZE_QUERY,
      'starting'
    )

    const queryAnalysis = await analyzeQuery(model, userQuery)
    thoughts.push({
      phase: CHAIN_OF_THOUGHTS_PHASES.ANALYZE_QUERY,
      content: queryAnalysis,
      timestamp: new Date().toISOString(),
    })

    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.ANALYZE_QUERY,
      'completed',
      {
        analysis: queryAnalysis,
      }
    )

    // Phase 2: Search strategy reasoning
    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.SEARCH_STRATEGY,
      'starting'
    )

    const searchStrategy = await generateSearchStrategy(
      model,
      userQuery,
      queryAnalysis
    )
    thoughts.push({
      phase: CHAIN_OF_THOUGHTS_PHASES.SEARCH_STRATEGY,
      content: searchStrategy,
      timestamp: new Date().toISOString(),
    })

    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.SEARCH_STRATEGY,
      'completed',
      {
        strategy: searchStrategy,
      }
    )

    // Phase 3: Evaluate sources
    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.EVALUATE_SOURCES,
      'starting'
    )

    const sourceEvaluation = await evaluateSources(
      model,
      userQuery,
      newsResults
    )
    thoughts.push({
      phase: CHAIN_OF_THOUGHTS_PHASES.EVALUATE_SOURCES,
      content: sourceEvaluation,
      timestamp: new Date().toISOString(),
    })

    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.EVALUATE_SOURCES,
      'completed',
      {
        evaluation: sourceEvaluation,
        sourceCount: newsResults.length,
      }
    )

    // Phase 4: Synthesis reasoning
    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.SYNTHESIZE_ANSWER,
      'starting'
    )

    const synthesisReasoning = await generateSynthesisReasoning(
      model,
      userQuery,
      newsResults,
      thoughts
    )
    thoughts.push({
      phase: CHAIN_OF_THOUGHTS_PHASES.SYNTHESIZE_ANSWER,
      content: synthesisReasoning,
      timestamp: new Date().toISOString(),
    })

    await emitThought(
      onThoughtProgress,
      CHAIN_OF_THOUGHTS_PHASES.SYNTHESIZE_ANSWER,
      'completed',
      {
        reasoning: synthesisReasoning,
      }
    )

    logger.info('[Chain of Thoughts] Completed chain of thoughts generation')

    return {
      success: true,
      thoughts,
      totalPhases: Object.keys(CHAIN_OF_THOUGHTS_PHASES).length,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    logger.error(`[Chain of Thoughts] Error: ${error.message}`)

    if (onThoughtProgress) {
      onThoughtProgress('chain_of_thoughts_error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    }

    throw error
  }
}

/**
 * Analyze the user query to understand intent and key concepts
 */
const analyzeQuery = async (model, userQuery) => {
  const analysisPrompt = [
    {
      role: 'system',
      content: `You are analyzing a news-related query to understand its key components. 
      
Your task: Break down the query to identify:
1. Core topic/subject
2. Type of information sought (facts, opinions, updates, analysis)
3. Time sensitivity (recent events vs historical)
4. Key entities (people, companies, locations, events)
5. Potential subtopics to explore

Be concise and focused. Output your analysis in a clear, structured way.`,
    },
    {
      role: 'user',
      content: `Analyze this query: "${userQuery}"`,
    },
  ]

  const langChainMessages = convertMessagesToLangChain(analysisPrompt)
  const response = await model.invoke(langChainMessages)
  return response.content.trim()
}

/**
 * Generate search strategy based on query analysis
 */
const generateSearchStrategy = async (model, userQuery, queryAnalysis) => {
  const strategyPrompt = [
    {
      role: 'system',
      content: `Based on the query analysis, determine the best search strategy for finding relevant news.

Consider:
1. What keywords would be most effective?
2. What time range should be prioritized?
3. What types of sources would be most valuable?
4. What potential biases or blind spots to watch for?

Provide a clear strategy for information gathering.`,
    },
    {
      role: 'user',
      content: `Query: "${userQuery}"
Analysis: ${queryAnalysis}

What's the optimal search strategy?`,
    },
  ]

  const langChainMessages = convertMessagesToLangChain(strategyPrompt)
  const response = await model.invoke(langChainMessages)
  return response.content.trim()
}

/**
 * Evaluate the quality and relevance of found sources
 */
const evaluateSources = async (model, userQuery, newsResults) => {
  const sourceTitles = newsResults
    .slice(0, 10)
    .map(
      (result, idx) =>
        `${idx + 1}. "${result.payload.title}" (${result.payload.source})`
    )
    .join('\n')

  const evaluationPrompt = [
    {
      role: 'system',
      content: `Evaluate news sources for their relevance and quality regarding a specific query.

For each source, consider:
1. Direct relevance to the query
2. Source credibility and reputation
3. Recency and timeliness
4. Potential bias or perspective
5. Completeness of information

Provide insights about the overall source quality and any gaps.`,
    },
    {
      role: 'user',
      content: `Query: "${userQuery}"

Available sources:
${sourceTitles}

Evaluate these sources for answering the query.`,
    },
  ]

  const langChainMessages = convertMessagesToLangChain(evaluationPrompt)
  const response = await model.invoke(langChainMessages)
  return response.content.trim()
}

/**
 * Generate reasoning for how to synthesize the final answer
 */
const generateSynthesisReasoning = async (
  model,
  userQuery,
  newsResults,
  previousThoughts
) => {
  const thoughtsSummary = previousThoughts
    .map((t) => `${t.phase}: ${t.content.slice(0, 200)}...`)
    .join('\n\n')

  const synthesisPrompt = [
    {
      role: 'system',
      content: `Based on your analysis and source evaluation, explain your approach for synthesizing a comprehensive answer.

Consider:
1. How to prioritize different pieces of information
2. How to handle conflicting reports or viewpoints
3. What context or background is needed
4. How to structure the response for clarity
5. What limitations or uncertainties to acknowledge

Explain your reasoning process for creating the final answer.`,
    },
    {
      role: 'user',
      content: `Query: "${userQuery}"

Previous thinking:
${thoughtsSummary}

Available sources: ${newsResults.length} articles

How will you synthesize the final answer?`,
    },
  ]

  const langChainMessages = convertMessagesToLangChain(synthesisPrompt)
  const response = await model.invoke(langChainMessages)
  return response.content.trim()
}

/**
 * Emit thought progress updates
 */
const emitThought = async (
  onThoughtProgress,
  phase,
  status,
  additionalData = {}
) => {
  if (onThoughtProgress && typeof onThoughtProgress === 'function') {
    onThoughtProgress('chain_of_thoughts', {
      phase,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    })
  }
}

module.exports = {
  generateChainOfThoughts,
  CHAIN_OF_THOUGHTS_PHASES,
}
