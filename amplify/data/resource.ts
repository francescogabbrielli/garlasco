import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { 
  Coordinates, EventType, PersonType, Person, Event, EventPerson, EventRelated,
  Hypothesis, HypothesisPerson, HypothesisPublished, HypothesisPublishedPerson, PublicationRequest, RequestStatus 
} from './models';
import { generateEventFn } from '../functions/generate-event/resource';
import { sendEmailFn } from '../functions/send-email/resource';
import { searchWebFn } from '../functions/search-web/resource';
import { analyst, detective, researcher } from './bots-defs';
import { getTableCountFn } from '../functions/get-table-count/resource';
import { listUsersFn } from '../functions/list-users/resource';
import { updateUserGroupsFn } from '../functions/update-user-groups/resource';

// AI generation can't return required AWSDateTime fields, so dates are ISO 8601 strings
const GeneratedEvent = a.customType({
  type: a.ref('EventType').required(),
  name: a.string().required(),
  description: a.string().required(),
  start_date: a.string().required(),
  start_position: a.ref('Coordinates'),
  sources: a.string().required().array(),
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
      to: a.string(),
      replyTo: a.string(),
      subject: a.string().required(),
      message: a.string().required(),
      operation: a.string()
    })
    .returns(a.ref('EmailResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(sendEmailFn))

const WebSearchResult = a.customType({
    title: a.string().required(),
    url: a.string().required(),
    content: a.string().required()
  })

const WebSearchResponse = a.customType({
    query: a.string().required(),
    results: a.ref('WebSearchResult').array().required()
  })

const searchWeb = a.query()
    .arguments({
      query: a.string().required(),
      maxResults: a.integer()
    })
    .returns(a.ref('WebSearchResponse'))
    .handler(a.handler.function(searchWebFn))
    .authorization(allow => allow.authenticated())

const getTableCount = a.query()
  .returns(a.integer())
  .handler(a.handler.function(getTableCountFn))
  .authorization(allow => allow.authenticated())

// ---- Cognito user management (Admin only) ----

const CognitoUser = a.customType({
  username: a.string().required(),
  sub: a.string(),
  email: a.string(),
  givenName: a.string(),
  familyName: a.string(),
  status: a.string(),
  enabled: a.boolean(),
  groups: a.string().array(),
})

const listUsers = a.query()
  .returns(a.ref('CognitoUser').array())
  .handler(a.handler.function(listUsersFn))
  .authorization((allow) => allow.group('Admin'))

const updateUserGroups = a.mutation()
  .arguments({
    name: a.string().required(),
    surname: a.string().required(),
    email: a.string().required(),
    username: a.string().required(),
    group: a.string().required(),
    action: a.string().required(),
  })
  .returns(a.boolean())
  .handler(a.handler.function(updateUserGroupsFn))
  .authorization((allow) => allow.group('Admin'))

const schema = a.schema({
  
  Coordinates,
  EventType,
  PersonType,
  Person,
  Event,
  EventPerson,
  EventRelated,

  Hypothesis,
  HypothesisPerson,
  HypothesisPublished,
  HypothesisPublishedPerson,
  PublicationRequest,
  RequestStatus,

  getTableCount,

  CognitoUser,
  listUsers,
  updateUserGroups,
  
  GeneratedEvent,
  generateEvent,

  EmailResponse,
  sendEmail,
  
  WebSearchResult,
  WebSearchResponse,
  searchWeb,

  analyst,
  researcher,
  detective
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
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
