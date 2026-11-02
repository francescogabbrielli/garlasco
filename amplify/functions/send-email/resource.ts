import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmailFn = defineFunction({
  name: 'send-email'
});