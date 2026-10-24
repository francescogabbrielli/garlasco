import { defineFunction, secret } from '@aws-amplify/backend';

export const searchWebFn = defineFunction({
  name: 'search-web',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    TAVILY_API_KEY: secret('TAVILY_API_KEY')
  }
});