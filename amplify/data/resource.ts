import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const Coordinates = a.customType({
  latitude: a.float().required(),
  longitude: a.float().required(),
  radius: a.float().required(),
});

const Person = a.model({
  name: a.string().required(),
  surname: a.string().required(),
  profession: a.string(),
  initials: a.string().required(),
  events: a.hasMany('EventPerson', 'personId'),
}).authorization((allow) => [allow.publicApiKey()]);

const Event = a.model({
  owner: a.id().required(),
  name: a.string().required(),
  description: a.string().required(),
  start_date: a.datetime().required(),
  end_date: a.datetime(),
  start_position: a.ref('Coordinates').required(),
  end_position: a.ref('Coordinates'),
  center_position: a.ref('Coordinates').required(),
  geoHash: a.string().required(),
  actors: a.hasMany('EventPerson', 'eventId'),
  reliability: a.integer(),
  relevance: a.integer().required().default(0),
})
  .secondaryIndexes((index) => [
    index('geoHash').sortKeys(['start_date']).name('geoHash-startDate-index'),
  ])
  .authorization((allow) => [allow.publicApiKey()]);

const EventPerson = a.model({
  eventId: a.id().required(),
  personId: a.id().required(),
  role: a.string().required(), //transform to enum? (e.g. 'actor', 'director', 'producer', etc.)
  //role: a.string().required().enum(['actor', 'director', 'producer', 'writer', 'editor', 'cinematographer', 'composer', 'costume designer', 'production designer', 'sound designer', 'visual effects supervisor']),
  event: a.belongsTo('Event', 'eventId'),
  person: a.belongsTo('Person', 'personId'),
})
  .secondaryIndexes((index) => [
    index('personId').name('personId-index'),
  ])
  .authorization((allow) => [allow.publicApiKey()]);

const schema = a.schema({
  Coordinates,
  Person,
  Event,
  EventPerson,
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
