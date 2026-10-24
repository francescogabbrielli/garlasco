import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { EVENT_TYPES, PERSON_TYPES } from './enums';
import { generateEventFn } from '../functions/generate-event/resource';
import { sendEmailFn } from '../functions/send-email/resource';

const Coordinates = a.customType({
  latitude: a.float().required(),
  longitude: a.float().required(),
  radius: a.float().required(),
});

const EventType = a.enum(EVENT_TYPES);

const PersonType = a.enum(PERSON_TYPES);

const Person = a.model({
  name: a.string().required(),
  surname: a.string().required(),
  type: a.ref('PersonType').required(),
  profession: a.string(),
  initials: a.string().required(),
  events: a.hasMany('EventPerson', 'personId'),
})
  .authorization((allow) => [allow.publicApiKey()]);


const Event = a.model({
  owner: a.id().required(), //Cognito ID
  type: a.ref('EventType').required(),
  name: a.string().required(),
  description: a.string().required(),
  start_date: a.datetime().required(),
  end_date: a.datetime(),
  start_position: a.ref('Coordinates').required(),
  end_position: a.ref('Coordinates'),
  geoHash: a.string().required(),
  actors: a.hasMany('EventPerson', 'eventId'),
  reliability: a.integer(),
  relevance: a.integer().required().default(0),
  sources: a.string().array(),
  relatesTo: a.hasMany('EventRelated', 'relatesToId'),
  relatedBy: a.hasMany('EventRelated', 'relatedById'),
})
  .authorization((allow) => [allow.publicApiKey()]);

const EventRelated = a.model({
  relatesToId: a.id().required(),
  relatedById: a.id().required(),
  relationship: a.string().required(),
  relatesTo: a.belongsTo('Event', 'relatesToId'),
  relatedBy: a.belongsTo('Event', 'relatedById'),

  sourceName: a.string().required(),
  targetName: a.string().required(),

})
  .authorization((allow) => [allow.publicApiKey()]);
  
const EventPerson = a.model({
  eventId: a.id().required(),
  personId: a.id().required(),
  role: a.string().required(), //transform to enum? (e.g. 'actor', 'director', 'producer', etc.)
  
  event: a.belongsTo('Event', 'eventId'),
  person: a.belongsTo('Person', 'personId'),

  eventName: a.string(),
  eventStartDate: a.datetime(),
  eventGeoHash: a.string()

})
  .secondaryIndexes((index) => [
    index('personId').sortKeys(['eventStartDate']).name('personIdStartDate-index')
  ])
  .authorization((allow) => [allow.publicApiKey()]);

// AI generation can't return required AWSDateTime fields, so dates are ISO 8601 strings
const GeneratedEvent = a.customType({
  type: a.ref('EventType').required(),
  name: a.string().required(),
  description: a.string().required(),
  start_date: a.string().required(),
  start_position: a.ref('Coordinates').required(),
})

const generateEvent = a.query()
  .arguments({
    description: a.string().required(),
  })
  .returns(a.ref('GeneratedEvent'))
  .handler(a.handler.function(generateEventFn))
  .authorization((allow) => allow.authenticated())

const EmailResponse = a.customType({
  success: a.boolean(),
  message: a.string(),
})

const sendEmail = a
    .query()
    .arguments({
      to: a.string().required(),
      replyTo: a.string(),
      subject: a.string().required(),
      message: a.string().required(),
    })
    .returns(a.ref('EmailResponse'))
    .authorization((allow) => [allow.authenticated()]) // O allow.guest() se consentito
    .handler(a.handler.function(sendEmailFn))

const schema = a.schema({
  
  Coordinates,
  EventType,
  PersonType,
  Person,
  Event,
  EventPerson,
  EventRelated,
  
  GeneratedEvent,
  generateEvent,

  EmailResponse,
  sendEmail
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
