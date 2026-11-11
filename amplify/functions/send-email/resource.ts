import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmailFn = defineFunction({
  name: 'send-email',
  entry: './handler.ts',
  logging: { retention: '1 month' }
});