import { env } from 'process';
import { BotServiceError } from '../../data/bots';
import { classifyTavilyError } from './tavily-error';

interface TavilyResponse {
  results: {
    title: string
    url: string
    content: string
  }[]
}

function isTavilyResponse(value: unknown): value is TavilyResponse {
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

async function requestTavily(path: 'search' | 'crawl', body: unknown, context: any): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(`https://api.tavily.com/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(path === 'crawl' ? 45_000 : 20_000),
      body: JSON.stringify(body)
    })
  } catch (cause) {
    const timeout =
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || cause.name === 'AbortError')

    throw new BotServiceError({
      source: 'TAVILY',
      code: timeout ? 'TAVILY_TIMEOUT' : 'TAVILY_NETWORK_ERROR',
      message: timeout ? 'Richiesta web scaduta (ha richiesto troppo tempo).' : 'Impossibile contattare il servizio web.',
      retryable: true
    })
  }

  if (!response.ok) {
    console.warn('Tavily request rejected', {
      httpStatus: response.status,
      lambdaRequestId: context.awsRequestId
    })
    throw new BotServiceError(classifyTavilyError(response.status))
  }

  try {
    return await response.json() as unknown
  } catch (cause) {
    console.error('Errore nel parsing della risposta Tavily:', cause)
    throw new BotServiceError({
      source: 'TAVILY',
      code: 'TAVILY_INVALID_RESPONSE',
      message: 'Impossibile interpretare la risposta del servizio web.',
      retryable: true
    })
  }
}

interface TavilyCrawlResponse {
  base_url: string
  results: {
    url: string
    raw_content: string
  }[]
}

function isTavilyCrawlResponse(value: unknown): value is TavilyCrawlResponse {
  if (typeof value !== 'object' || value === null) return false
  if (!('base_url' in value) || typeof value.base_url !== 'string') return false
  if (!('results' in value) || !Array.isArray(value.results)) return false

  return value.results.every(result =>
    typeof result === 'object' &&
    result !== null &&
    'url' in result && typeof result.url === 'string' &&
    'raw_content' in result && typeof result.raw_content === 'string'
  )
}

async function crawlWebsite(
  args: { url?: string; instructions?: string; maxDepth?: number; maxPages?: number },
  context: any
) {
  try {
    let url: URL
    try {
      if (!args.url || args.url.length > 2048) throw new Error('Invalid URL')
      url = new URL(args.url.trim())
    } catch {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_CRAWL_URL',
        message: 'Per esplorare un sito, specifica un URL HTTP o HTTPS valido.',
        retryable: false
      })
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_CRAWL_URL',
        message: 'Per esplorare un sito, specifica un URL HTTP o HTTPS valido.',
        retryable: false
      })
    }

    const instructions = args.instructions?.trim()
    if (instructions && instructions.length > 1000) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_CRAWL_INSTRUCTIONS',
        message: 'Le istruzioni per esplorare il sito non possono superare 1000 caratteri.',
        retryable: false
      })
    }

    const maxPages = Math.min(10, Math.max(1, args.maxPages ?? 5))
    const maxDepth = Math.min(3, Math.max(1, args.maxDepth ?? 2))
    const request: Record<string, unknown> = {
      url: url.toString(),
      max_depth: maxDepth,
      limit: maxPages,
      allow_external: false,
      extract_depth: 'basic',
      format: 'markdown',
      timeout: 45
    }

    if (instructions) {
      request.instructions = instructions
      request.chunks_per_source = 3
    }

    const data = await requestTavily('crawl', request, context)

    if (!isTavilyCrawlResponse(data)) {
      throw new BotServiceError({
        source: 'TAVILY',
        code: 'TAVILY_INVALID_RESPONSE',
        message: 'La risposta del servizio di esplorazione web non rispetta il formato atteso.',
        retryable: true
      })
    }

    return {
      baseUrl: data.base_url,
      pages: data.results.slice(0, maxPages).map(page => ({
        url: page.url,
        content: page.raw_content
      }))
    }
  } catch (cause) {
    const details = cause instanceof BotServiceError
      ? cause.details
      : {
          source: 'APPLICATION' as const,
          code: 'CRAWL_INTERNAL_ERROR',
          message: 'Errore interno durante l’esplorazione web.',
          retryable: false
        }

    const error = new BotServiceError({
      ...details,
      requestId: context.awsRequestId
    })

    console.error('crawlWebsite failed', error.details)
    throw error
  }
}

export const handler = async (
  event:
    | { arguments: { query: string; maxResults?: number } }
    | { arguments: { url: string; instructions?: string; maxDepth?: number; maxPages?: number } },
  context: any
) => {
  if ('url' in event.arguments) {
    return crawlWebsite(event.arguments, context)
  }

  try {

    const query = event.arguments.query.trim()

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
      Math.max(1, event.arguments.maxResults ?? 5)
    )

    const data = await requestTavily('search', {
      query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false
    }, context)

    if (!isTavilyResponse(data)) {
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
        title: result.title,
        url: result.url,
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