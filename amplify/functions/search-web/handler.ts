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

export const handler = async (event: { arguments: { query: string; maxResults?: number } }, context: any) => {

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

    let response: Response

    try {
      response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TAVILY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: 'advanced',
          include_answer: false,
          include_raw_content: false
        })
      })
    } catch (cause) {

      const timeout =
          cause instanceof Error &&
          (cause.name === 'TimeoutError' || cause.name === 'AbortError');
      
      throw new BotServiceError({
        source: 'TAVILY',
        code: timeout ? 'TAVILY_TIMEOUT' : 'TAVILY_NETWORK_ERROR',
        message: timeout ? 'Richiesta web scaduta (ha richiesto troppo tempo).' : 'Impossibile contatttare il servizio per la ricerca web.',
        retryable: true
      })
    }

    if (!response.ok) {
        console.warn('Tavily request rejected', {
          httpStatus: response.status,
          lambdaRequestId: context.awsRequestId
        })

        throw new BotServiceError(
          classifyTavilyError(response.status)
        )
    }
    
    let data: unknown

    try {
      data = await response.json() as TavilyResponse;
    } catch (cause) {
      console.error('Errore nel parsing della risposta Tavily:', cause);
      throw new BotServiceError({
        source: 'TAVILY',
        code: 'TAVILY_INVALID_RESPONSE',
        message: 'Impossibile interpretare la risposta del servizio di ricerca web.',
        retryable: true
      })
    }

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