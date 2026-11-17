import { BotServiceError } from "../../../data/bots"
import { requestTavily } from "../tavily-utils"

interface TavilySearchResponse {
  results: {
    title: string
    url: string
    content: string
  }[]
}

function isTavilySearchResponse(value: unknown): value is TavilySearchResponse {
  if (typeof value !== 'object' || value === null) return false
  if (!('results' in value) || !Array.isArray(value.results)) return false

  return value.results.every(result =>
    typeof result === 'object' &&
    result !== null &&
    'title' in result && typeof result.title === 'string' &&
    'url' in result && typeof result.url === 'string' &&
    'content' in result && typeof result.content === 'string'
  )
}

export const handler = async (
  event:
    { arguments: { query?: string; url?: string; maxDepth?: number, maxResults?: number } },
  context: any
) => {

  const args = event.arguments

  try {
    if (!('query' in args)) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_SEARCH_REQUEST',
        message: 'La richiesta di ricerca non contiene una query valida.',
        retryable: false
      })
    }

    const query = args.query?.trim()

    if (!query || query.length > 1000) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_SEARCH_QUERY',
        message: 'La ricerca deve contenere da 1 a 1000 caratteri.',
        retryable: false
      })
    }

    const maxResults = Math.min(
      10,
      Math.max(1, args.maxResults ?? 5)
    )

    const data = await requestTavily('search', {
      query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false
    }, context)

    if (!isTavilySearchResponse(data)) {
      throw new BotServiceError({
        source: 'TAVILY',
        code: 'TAVILY_INVALID_RESPONSE',
        message: 'La risposta del servizio di ricerca web non rispetta il formato atteso.',
        retryable: true
      });
    }

    return {
      query,
      results: data.results.slice(0, maxResults).map(result => ({
        url: result.url,
        title: result.title,
        content: result.content
      }))
    }

  } catch (cause) {
    const details = cause instanceof BotServiceError
      ? cause.details
      : {
          source: 'APPLICATION' as const,
          code: 'SEARCH_INTERNAL_ERROR',
          message: 'Errore interno durante la ricerca web.',
          retryable: false
        }

    const error = new BotServiceError({
      ...details,
      requestId: context.awsRequestId
    })

    console.error('searchWeb failed', error.details)
    throw error

  }

}
