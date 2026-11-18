import { defineFunction, secret } from '@aws-amplify/backend';

export const createBotEventFn = defineFunction({
  name: 'create-bot-event',
  entry: './handler.ts',
  resourceGroupName: 'data',
  logging: { retention: '1 month' },
  environment: {
    BOT_FALLBACK_PERSON_ID: secret('BOT_FALLBACK_PERSON_ID')
  }
});
