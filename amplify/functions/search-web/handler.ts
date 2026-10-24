import { env } from 'process';

interface TavilyResponse {
  results: {
    title: string;
    url: string;
    content: string;
  }[];
}

export const handler = async (event: { arguments: { query: string; maxResults?: number } }) => {
    const query = event.arguments.query.trim();

    if (!query || query.length > 1000) {
      throw new Error('La ricerca deve contenere da 1 a 1000 caratteri.');
    }

    const maxResults = Math.min(
      10,
      Math.max(1, event.arguments.maxResults ?? 5)
    );

    const response = await fetch('https://api.tavily.com/search', {
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
    });

    if (!response.ok) {
      console.error('Tavily HTTP status:', response.status);
      throw new Error('Ricerca web temporaneamente non disponibile.');
    }

    const data = await response.json() as TavilyResponse;

    return {
      query,
      results: data.results.slice(0, maxResults).map(result => ({
        title: result.title,
        url: result.url,
        content: result.content
      }))
    };
  };