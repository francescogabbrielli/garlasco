import type { BotError } from '../../data/bots';

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
