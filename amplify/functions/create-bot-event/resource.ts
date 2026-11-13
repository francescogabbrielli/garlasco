import { defineFunction } from '@aws-amplify/backend';

export const createBotEventFn = defineFunction({
  name: 'create-bot-event',
  entry: './handler.ts',
  resourceGroupName: 'data',
  logging: { retention: '1 month' },
  environment: {
    BOT_FALLBACK_PERSON_ID: '45f03321-c6f4-466b-8417-ba99fb785a86'
  }
});
