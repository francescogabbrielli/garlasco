import { defineFunction } from '@aws-amplify/backend';

export const listUsersFn = defineFunction({
  name: 'list-users',
  entry: './handler.ts',
  resourceGroupName: 'auth'
});
