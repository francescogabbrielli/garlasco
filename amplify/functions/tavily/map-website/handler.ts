import { BotServiceError } from "../../../data/bots"
import { requestTavily } from "../tavily-utils"

interface TavilyMapResponse {
  base_url: string
  results: string[]
}

function isTavilyMapResponse(value: unknown): value is TavilyMapResponse {
  if (typeof value !== 'object' || value === null) return false
  if (!('base_url' in value) || typeof value.base_url !== 'string') return false
  if (!('results' in value) || !Array.isArray(value.results)) return false

  return value.results.every(result => typeof result === 'string')
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
        code: 'INVALID_MAP_URL',
        message: 'Per mappare un sito, specifica un URL HTTP o HTTPS valido.',
        retryable: false
      })
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_MAP_URL',
        message: 'Per mappare un sito, specifica un URL HTTP o HTTPS valido.',
        retryable: false
      })
    }

    const instructions = args.query?.trim()
    if (instructions && instructions.length > 1000) {
      throw new BotServiceError({
        source: 'APPLICATION',
        code: 'INVALID_MAP_INSTRUCTIONS',
        message: 'Le istruzioni per mappare il sito non possono superare 1000 caratteri.',
        retryable: false
      })
    }

    const maxResults = Math.min(10, Math.max(1, args.maxResults ?? 0))
    const maxDepth = Math.min(3, Math.max(1, args.maxDepth ?? 0))
    const escapedHostname = url.hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mapped = await requestTavily('map', {
      url: url.toString(),
      max_depth: maxDepth,
      limit: maxResults,
      select_domains: [`^${escapedHostname}$`],
      allow_external: false,
      timeout: 90,
      ...(instructions ? { instructions } : {})
    }, context)

    if (!isTavilyMapResponse(mapped)) {
      throw new BotServiceError({
        source: 'TAVILY',
        code: 'TAVILY_INVALID_RESPONSE',
        message: 'La risposta del servizio di mappatura web non rispetta il formato atteso.',
        retryable: true
      })
    }

    const urls = mapped.results
      .filter(candidate => {
        try {
          const mappedUrl = new URL(candidate)
          return ['http:', 'https:'].includes(mappedUrl.protocol)
        } catch {
          return false
        }
      })

    return {
      baseUrl: mapped.base_url,
      urls: urls
    }
  } catch (cause) {
    const details = cause instanceof BotServiceError
      ? cause.details
      : {
          source: 'APPLICATION' as const,
          code: 'MAP_INTERNAL_ERROR',
          message: 'Errore interno durante la mappatura web.',
          retryable: false
        }

    const error = new BotServiceError({
      ...details,
      requestId: context.awsRequestId
    })

    console.error('mapWebsite failed', error.details)
    throw error
  }

}
