import { defineFunction, secret } from '@aws-amplify/backend';

export const generateEventFn = defineFunction({
  name: 'generate-event',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  logging: { retention: '1 month' },
  environment: {
    TAVILY_API_KEY: secret('TAVILY_API_KEY'),
  },
});
