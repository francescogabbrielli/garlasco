import { BotServiceError } from "../../../data/bots"
import { requestTavily } from "../tavily-utils"

interface TavilyExtractResponse {
  results: {
    url: string
    raw_content: string
  }[]
  failed_results: {
    url: string
    error: string
  }[]
}

function isTavilyExtractResponse(value: unknown): value is TavilyExtractResponse {
  if (typeof value !== 'object' || value === null) return false
  if (!('results' in value) || !Array.isArray(value.results)) return false
  if (!('failed_results' in value) || !Array.isArray(value.failed_results)) return false

  return value.results.every(result =>
    typeof result === 'object' &&
    result !== null &&
    'url' in result && typeof result.url === 'string' &&
    'raw_content' in result && typeof result.raw_content === 'string'
  ) && value.failed_results.every(result =>
    typeof result === 'object' &&
    result !== null &&
    'url' in result && typeof result.url === 'string' &&
    'error' in result && typeof result.error === 'string'
  )
}

export const handler = async (
  event:
    { arguments: { query?: string; url?: string; maxDepth?: number, maxResults?: number } },
  context: any
) => {

  const args = event.arguments

  try {
    if (!args.url) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_EXTRACT_URL',
        message: 'Specifica un URL da estrarre.',
        retryable: false
      })
    }

    let normalizedUrl
    try {
      if (typeof args.url !== 'string' || args.url.length > 2048) throw new Error('URL non valido')
      const url = new URL(args.url.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('URL non valido, deve includere http(s)')
      }
      normalizedUrl = url.toString()
    } catch (e:any) {
      console.error(e)
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_EXTRACT_URL',
        message: `L’URL non è un URL HTTP o HTTPS valido. (${e})`,
        retryable: false
      })
    }

    const query = args.query?.trim() || ''
    if (query && query.length > 1000) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_EXTRACT_QUERY',
        message: 'La richiesta di estrazione non può superare 1000 caratteri.',
        retryable: false
      })
    }

    const data = await requestTavily('extract', {
      urls: normalizedUrl,
      extract_depth: 'basic',
      format: 'markdown',
      ...(query ? { query, chunks_per_source: 3 } : {})
    }, context)

    if (!isTavilyExtractResponse(data)) {
      throw new BotServiceError({
        source: 'TAVILY',
        code: 'TAVILY_INVALID_RESPONSE',
        message: 'La risposta del servizio di estrazione web non rispetta il formato atteso.',
        retryable: true
      })
    }

    return data.results?.length ? data.results[0].raw_content : []

  } catch (cause) {
    const details = cause instanceof BotServiceError
      ? cause.details
      : {
          source: 'APPLICATION' as const,
          code: 'EXTRACT_INTERNAL_ERROR',
          message: 'Errore interno durante l’estrazione web.',
          retryable: false
        }

    const error = new BotServiceError({
      ...details,
      requestId: context.awsRequestId
    })

    console.error('extractWeb failed', error.details)
    throw error
  }
}
