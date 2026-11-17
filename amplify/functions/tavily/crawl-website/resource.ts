import { defineFunction, secret } from '@aws-amplify/backend';

export const mapWebsiteFn = defineFunction({
  name: 'crawl-website',
  entry: './handler.ts',
  timeoutSeconds: 120,
  logging: { retention: '1 month' },
  environment: {
    TAVILY_API_KEY: secret('TAVILY_API_KEY')
  }
});