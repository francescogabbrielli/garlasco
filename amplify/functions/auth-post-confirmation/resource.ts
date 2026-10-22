import { defineFunction, secret } from '@aws-amplify/backend';

export const authPostConfirmationFn = defineFunction({
  name: 'auth-post-confirmation',
  environment: {
    MAIL_SENDER: secret('MAIL_SENDER'),
    WELCOME_SUBJECT: secret('WELCOME_SUBJECT'),
    WELCOME_MESSAGE: secret('WELCOME_MESSAGE')
  }
});