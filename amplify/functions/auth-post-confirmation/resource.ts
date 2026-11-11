import { defineFunction } from '@aws-amplify/backend';

export const authPostConfirmationFn = defineFunction({
  name: 'auth-post-confirmation',
  entry: './handler.ts',
  logging: { retention: '1 month' }
});