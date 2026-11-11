import { defineFunction } from '@aws-amplify/backend';

export const listUsersFn = defineFunction({
  name: 'list-users',
  entry: './handler.ts',
  resourceGroupName: 'auth',
  logging: { retention: '1 month' }
});
