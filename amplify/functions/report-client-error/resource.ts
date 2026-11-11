import { defineFunction } from '@aws-amplify/backend';

export const reportClientErrorFn = defineFunction({
  name: 'report-client-error',
  entry: './handler.ts',
  resourceGroupName: 'data',
  logging: { retention: '1 month' }
});
