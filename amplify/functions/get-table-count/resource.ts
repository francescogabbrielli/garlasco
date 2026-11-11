import { defineFunction } from '@aws-amplify/backend';

export const getTableCountFn = defineFunction({
  name: 'get-table-count',
  entry: './handler.ts',
  resourceGroupName: 'data',
  logging: { retention: '1 month' }
})