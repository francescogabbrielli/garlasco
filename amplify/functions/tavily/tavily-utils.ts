import { env } from 'process';
import { type BotError, BotServiceError } from '../../data/bots';

export function classifyTavilyError(status: number): BotError {
  switch (status) {
    case 429:
      return {
        source: 'TAVILY',
        code: 'TAVILY_RATE_LIMITED',
        message: 'Il servizio web è temporaneamente al limite.',
        retryable: true
      };

    case 432:
    case 433:
      return {
        source: 'TAVILY',
        code: 'TAVILY_QUOTA_EXCEEDED',
        message: 'La quota del servizio di ricerca web è esaurita.',
        retryable: false
      };

    case 401:
    case 403:
      return {
        source: 'TAVILY',
        code: 'TAVILY_ACCESS_DENIED',
        message: 'Il servizio di ricerca web non è disponibile.',
        retryable: false
      };

    default:
      return {
        source: 'TAVILY',
        code: 'TAVILY_REQUEST_FAILED',
        message: 'Impossibile completare la richiesta web.',
        retryable: status >= 500
      };
  }
}

export async function requestTavily(path: 'search' | 'crawl' | 'map' | 'extract', body: unknown, context: any): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(`https://api.tavily.com/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(path === 'search' ? 20_000 : path === 'map' ? 90_000 : 45_000),
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
