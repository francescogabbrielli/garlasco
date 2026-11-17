import { BotServiceError } from "../../../data/bots"
import { requestTavily } from "../tavily-utils"

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

export const handler = async (
  event:
    { arguments: { query?: string; url?: string; maxDepth?: number, maxResults?: number } },
  context: any
) => {

  const args = event.arguments

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

    const instructions = args.query?.trim()
    if (instructions && instructions.length > 1000) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_CRAWL_INSTRUCTIONS',
        message: 'Le istruzioni per esplorare il sito non possono superare 1000 caratteri.',
        retryable: false
      })
    }

    const maxLinks = Math.min(10, Math.max(1, args.maxResults ?? 5))
    const maxDepth = Math.min(3, Math.max(1, args.maxDepth ?? 2))
    const request: Record<string, unknown> = {
      url: url.toString(),
      max_depth: maxDepth,
      limit: maxLinks,
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
      pages: data.results.slice(0, maxLinks).map(page => ({
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
