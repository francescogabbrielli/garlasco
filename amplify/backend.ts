import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { generateEventFn } from './functions/generate-event/resource';
import { sendEmailFn } from './functions/send-email/resource';
import { authPostConfirmationFn } from './functions/auth-post-confirmation/resource';
import { getTableCountFn } from './functions/get-table-count/resource';
import { listUsersFn } from './functions/list-users/resource';
import { updateUserGroupsFn } from './functions/update-user-groups/resource';

const backend = defineBackend({
  
  auth,
  data,
  storage,

  //lambdas
  generateEventFn,
  sendEmailFn,
  authPostConfirmationFn,
  getTableCountFn,
  listUsersFn,
  updateUserGroupsFn,
  
})

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
)

// Aggiunge i permessi SES alla Lambda
backend.sendEmailFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'], // È consigliabile limitare la risorsa all'ARN SES in produzione
  })
)

backend.authPostConfirmationFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'], // È consigliabile limitare la risorsa all'ARN SES in produzione
  })
)


// 1. Recupera il riferimento alla tabella DynamoDB generata dal modello 'Event'
const eventTable = backend.data.resources.tables['Event'];
// 2. Concedi alla Lambda i permessi di lettura per i metadati della tabella
eventTable.grant(backend.getTableCountFn.resources.lambda, 'dynamodb:DescribeTable');
// 3. Inietta il nome REALE nel environment della Lambda usando la chiave che preferisci
backend.getTableCountFn.resources.cfnResources.cfnFunction.addPropertyOverride(
  'Environment.Variables.EVENT_TABLE_NAME',
  eventTable.tableName
)

// 4. Grant Cognito permissions to user management Lambdas
const userPoolArn = backend.auth.resources.userPool.userPoolArn;

backend.listUsersFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:ListUsers', 'cognito-idp:ListUsersInGroup'],
    resources: [userPoolArn],
  })
)

backend.updateUserGroupsFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminRemoveUserFromGroup', 'cognito-idp:AdminUserGlobalSignOut'],
    resources: [userPoolArn],
  })
)
backend.updateUserGroupsFn.resources.lambda.addToRolePolicy(  
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'], // È consigliabile limitare la risorsa all'ARN SES in produzione
  })
)

// 5. Inject the User Pool ID into both Lambdas
const userPoolId = backend.auth.resources.userPool.userPoolId;
backend.listUsersFn.resources.cfnResources.cfnFunction.addPropertyOverride(
  'Environment.Variables.AUTH_USERPOOL_ID',
  userPoolId
);
backend.updateUserGroupsFn.resources.cfnResources.cfnFunction.addPropertyOverride(
  'Environment.Variables.AUTH_USERPOOL_ID',
  userPoolId
)