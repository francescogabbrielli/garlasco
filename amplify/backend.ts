import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { generateEventFn } from './functions/generate-event/resource';
import { sendEmailFn } from './functions/send-email/resource';

const backend = defineBackend({
  auth,
  data,
  generateEventFn,
  sendEmailFn,
});

backend.generateEventFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'bedrock:InvokeModel',
      'bedrock:InvokeModelWithResponseStream',
      'aws-marketplace:ViewSubscriptions',
      'aws-marketplace:Subscribe'
    ],
    resources: ['*'], // È consigliabile limitare la risorsa all'ARN SES in produzione
  }),
);

// Aggiunge i permessi SES alla Lambda
backend.sendEmailFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'], // È consigliabile limitare la risorsa all'ARN SES in produzione
  })
);
