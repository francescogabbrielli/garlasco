import { defineFunction, secret } from '@aws-amplify/backend';

export const extractWebContentFn = defineFunction({
  name: 'extract-web',
  entry: './handler.ts',
  timeoutSeconds: 60,
  logging: { retention: '1 month' },
  environment: {
    TAVILY_API_KEY: secret('TAVILY_API_KEY')
  }
});