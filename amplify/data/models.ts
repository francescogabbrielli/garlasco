import { a } from '@aws-amplify/backend';
import { EVENT_TYPES, PERSON_TYPES, REQUEST_STATUS } from './enums';

export const Coordinates = a.customType({
  latitude: a.float().required(),
  longitude: a.float().required(),
  radius: a.float().required(),
});

export const EventType = a.enum(EVENT_TYPES);
export const PersonType = a.enum(PERSON_TYPES);
export const RequestStatus = a.enum(REQUEST_STATUS);

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
  .authorization((allow) => [allow.authenticated()]);

export const Event = a.model({
  owner: a.id().required(), //Cognito ID
  type: a.ref('EventType').required(),
  name: a.string().required(),
  description: a.string().required(),
  start_date: a.datetime().required(),
  end_date: a.datetime(),
  start_position: a.ref('Coordinates'),
  end_position: a.ref('Coordinates'),
  geoHash: a.string(),
  actors: a.hasMany('EventPerson', 'eventId'),
  reliability: a.integer(),
  relevance: a.integer().required().default(0),
  sources: a.string().required().array(),

  //linked events
  relatesTo: a.hasMany('EventRelated', 'relatesToId'),
  relatedBy: a.hasMany('EventRelated', 'relatedById'),
  
  //hypotheses
  hypothesis: a.hasMany('Hypothesis', 'eventId')
})
  .authorization((allow) => [allow.authenticated()]);

export const EventRelated = a.model({
  relatesToId: a.id().required(),
  relatedById: a.id().required(),
  relationship: a.string().required(),
  relatesTo: a.belongsTo('Event', 'relatesToId'),
  relatedBy: a.belongsTo('Event', 'relatedById'),

  sourceName: a.string().required(),
  targetName: a.string().required(),

})
  .authorization((allow) => [allow.authenticated()]);
  
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
  .authorization((allow) => [allow.authenticated()]);


//----------------------- HYPOTHESIS MODELS -------------------------

const hypothesisFields = (modelName: string) => ({
  name: a.string().required(),
  description: a.string().required(),
  startDate: a.datetime().required(),
  endDate: a.datetime(),
  startPosition: a.ref('Coordinates').required(),
  endPosition: a.ref('Coordinates'),
  actors: a.hasMany(modelName + 'Person', 'hypothesisId'),
  sources: a.string().required().array(),
})

const hypothesisPersonFields = (modelName: string) => ({
  hypothesisId: a.id().required(),
  personId: a.id().required(),
  role: a.string().required(),

  hypothesis: a.belongsTo(modelName, 'hypothesisId'),
  person: a.belongsTo('Person', 'personId'),

  hypothesisTitle: a.string(),
})

const hypothesisPermissions = (allow: any) =>
  [
    allow.authenticated().to(['read']),
    allow.owner(),
    allow.group('Admin'),
  ]

const hypothesisPublishedPermissions = (allow: any) =>
  [
    allow.guest().to(['read']),
    allow.group('Admin'),
  ]


export const Hypothesis = a.model({
  ...hypothesisFields('Hypothesis'),
  
  publicationRequest: a.hasOne('PublicationRequest', 'hypothesisId'),
  published: a.hasOne('HypothesisPublished', 'originalId'),

  eventId: a.id(),
  event: a.belongsTo('Event', 'eventId'),
}).authorization(hypothesisPermissions)

export const HypothesisPerson = a.model(
  {...hypothesisPersonFields('Hypothesis')})
    .authorization(hypothesisPermissions)

export const HypothesisPublished = a.model({
  ...hypothesisFields('HypothesisPublished'),
  originalId: a.id().required(),
  original: a.belongsTo('Hypothesis', 'originalId')
})
  .authorization(hypothesisPublishedPermissions)

export const HypothesisPublishedPerson = a.model(
  {...hypothesisPersonFields('HypothesisPublished')})
    .authorization(hypothesisPublishedPermissions)

export const PublicationRequest = a.model({
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
    allow.owner().to(['read', 'create', 'update']),
    allow.group('Admin'),
  ])
