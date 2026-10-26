import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmailFn = defineFunction({
  name: 'send-email',
  environment: {
    MAIL_ADMIN: secret('MAIL_ADMIN')
  },
});