import { defineFunction } from '@aws-amplify/backend';

export const updateUserGroupsFn = defineFunction({
  name: 'update-user-groups',
  entry: './handler.ts',
  resourceGroupName: 'auth',
  logging: { retention: '1 month' }
});
