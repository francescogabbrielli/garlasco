import { a } from '@aws-amplify/backend';
import { EVENT_TYPES, PERSON_TYPES, REQUEST_STATUS } from './enums';
import { createBotEventFn } from '../functions/create-bot-event/resource';

export const Coordinates = a.customType({
  latitude: a.float().required(),
  longitude: a.float().required(),
  radius: a.float().required(),
});

export const EventType = a.enum(EVENT_TYPES);
export const PersonType = a.enum(PERSON_TYPES);
export const RequestStatus = a.enum(REQUEST_STATUS);

const memberPermissions = (allow: any) => [
  allow.groups(['Member', 'Editor', 'Admin'])
]

const caseFields = (modelName:string, idName:string) => ({
  name: a.string().required(),
  description: a.string().required(),
  startDate: a.datetime().required(),
  endDate: a.datetime(),
  startPosition: a.ref('Coordinates'),
  endPosition: a.ref('Coordinates'),
  geoHash: a.string(),
  actors: a.hasMany(modelName + 'Person', idName),
  sources: a.string().required().array()
})

export const Person = a.model({
  name: a.string().required(),
  surname: a.string().required(),
  type: a.ref('PersonType').required(),
  profession: a.string(),
  initials: a.string().required(),
  events: a.hasMany('EventPerson', 'personId'),
  hypotheses: a.hasMany('HypothesisPerson', 'personId'),
  publishedHypotheses: a.hasMany('HypothesisPublishedPerson', 'personId'),
})
  .authorization(memberPermissions);

export const Event = a.model({
  owner: a.id().required(), //Cognito ID or Bot ID
  type: a.ref('EventType').required(),
  ...caseFields('Event', 'eventId'),

  reliability: a.integer(),
  relevance: a.integer().default(0),

  //linked events
  relatesTo: a.hasMany('EventRelated', 'relatesToId'),
  relatedBy: a.hasMany('EventRelated', 'relatedById'),
  
  //hypotheses
  hypothesis: a.hasMany('Hypothesis', 'eventId'),
  coldCase: a.string(),
})
  .authorization(memberPermissions)
  .secondaryIndexes(index => [
    index('coldCase')
  ])

export const EventRelated = a.model({
  relatesToId: a.id().required(),
  relatedById: a.id().required(),
  relationship: a.string().required(),
  relatesTo: a.belongsTo('Event', 'relatesToId'),
  relatedBy: a.belongsTo('Event', 'relatedById'),

  sourceName: a.string().required(),
  targetName: a.string().required(),

})
  .authorization(memberPermissions)
  
export const EventPerson = a.model({
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
  .authorization(memberPermissions)


//----------------------- HYPOTHESIS MODELS -------------------------

const hypothesisPersonFields = (modelName: string) => ({
  hypothesisId: a.id().required(),
  personId: a.id().required(),
  role: a.string().required(),

  hypothesis: a.belongsTo(modelName, 'hypothesisId'),
  person: a.belongsTo('Person', 'personId'),

  hypothesisName: a.string(),
})

const protectedOwner = () => ({
  owner: a.string().authorization(allow => [
    allow.owner().to(['read', 'create']),
    allow.group('Admin')
  ])
})

const hypothesisPermissions = (allow: any) =>
  [
    allow.owner(),
    allow.group('Admin'),
  ]

const hypothesisPublishedPermissions = (allow: any) =>
  [
    allow.guest().to(['read']),
    allow.group('Admin'),
  ]

export const Hypothesis = a.model({
  ...protectedOwner(),
  ...caseFields('Hypothesis', 'hypothesisId'),
  
  publicationRequest: a.hasOne('PublicationRequest', 'hypothesisId'),
  published: a.hasOne('HypothesisPublished', 'originalId'),

  eventId: a.id(),
  event: a.belongsTo('Event', 'eventId'),
  eventName: a.string(),
  eventRelevance: a.integer()
})
  .authorization(hypothesisPermissions)
  .secondaryIndexes((index) => [
    index('eventId').sortKeys(['eventRelevance'])
  ])

export const HypothesisPerson = a.model(
  {
    ...protectedOwner(),
    ...hypothesisPersonFields('Hypothesis')
  })
    .authorization(hypothesisPermissions)

export const HypothesisPublished = a.model({
  ...caseFields('HypothesisPublished', 'hypothesisId'),
  originalId: a.id().required(),
  original: a.belongsTo('Hypothesis', 'originalId'),

  // utility fields
  createdBy: a.string().required(), // descriptive string of the original owner
  eventName: a.string().required(), // name of the event
})
  .authorization(hypothesisPublishedPermissions)

export const HypothesisPublishedPerson = a.model(
  {...hypothesisPersonFields('HypothesisPublished')})
    .authorization(hypothesisPublishedPermissions)

export const PublicationRequest = a.model({
  ...protectedOwner(),
  hypothesisId: a.id().required(),
  hypothesis: a.belongsTo('Hypothesis', 'hypothesisId'),
  status: a.ref('RequestStatus').authorization((allow) => [
    allow.owner().to(['read']),
    allow.group('Admin'),
    //allow.resource('submitPublicationRequest')),
  ]),
  remarks: a.string().authorization((allow) => [
    allow.owner().to(['read']),
    allow.group('Admin'),
    //allow.resource('submitPublicationRequest'))
  ]),
})
  .authorization((allow) => [
    allow.owner().to(['read', 'create']),
    allow.group('Admin'),
  ])
