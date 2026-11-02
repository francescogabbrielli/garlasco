import { defineStorage } from '@aws-amplify/backend';
import { sendEmailFn } from '../functions/send-email/resource';
import { authPostConfirmationFn } from '../functions/auth-post-confirmation/resource';

export const storage = defineStorage({
  name: 'templates',
  access: (allow) => ({ 
    'mail/*': [
        allow.resource(sendEmailFn).to(['read']),
        allow.resource(authPostConfirmationFn).to(['read'])
    ]})
})