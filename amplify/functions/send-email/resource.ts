import { defineFunction, secret } from '@aws-amplify/backend';

export const sendEmailFn = defineFunction({
  name: 'send-email',
  environment: {
    MAIL_SENDER: secret('MAIL_SENDER'),
    MAIL_ADMIN: secret('MAIL_ADMIN')
  },
});