import { defineAuth } from '@aws-amplify/backend';
import { authPostConfirmationFn } from '../functions/auth-post-confirmation/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    //TODO: externalProviders: {
    //  google: ...,
    //  facebook: ...
    // }
  },
  triggers: {
    postConfirmation: authPostConfirmationFn,
  },
  userAttributes: {
    givenName: {
      mutable: true,
      required: true,
    },
    familyName: {
      mutable: true,
      required: true,
    },
    'custom:privacyAccepted': { 
      dataType: 'String',
      mutable: true,
    }
  },
});
