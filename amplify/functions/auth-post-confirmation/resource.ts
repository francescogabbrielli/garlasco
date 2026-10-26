import { defineFunction, secret } from '@aws-amplify/backend';

export const authPostConfirmationFn = defineFunction({
  name: 'auth-post-confirmation',
  environment: {
    MAIL_ADMIN: secret('MAIL_ADMIN'),
    WELCOME_SUBJECT: secret('WELCOME_SUBJECT'),
    WELCOME_MESSAGE: secret('WELCOME_MESSAGE')
  }
});