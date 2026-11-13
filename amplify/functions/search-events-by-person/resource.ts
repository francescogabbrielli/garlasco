import { defineFunction } from '@aws-amplify/backend';

export const searchEventsByPersonFn = defineFunction({
  name: 'search-events-by-person',
  entry: './handler.ts',
  resourceGroupName: 'data',
  logging: { retention: '1 month' }
});
