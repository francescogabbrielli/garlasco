import { defineFunction, secret } from '@aws-amplify/backend';

export const generateEventFn = defineFunction({
  name: 'generate-event',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    TAVILY_API_KEY: secret('TAVILY_API_KEY'),
  },
});
