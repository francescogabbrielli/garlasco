import { a } from '@aws-amplify/backend';
import { EVENT_TYPES, PERSON_TYPES } from './enums';

export const Coordinates = a.customType({
  latitude: a.float().required(),
  longitude: a.float().required(),
  radius: a.float().required(),
});

export const EventType = a.enum(EVENT_TYPES);

export const PersonType = a.enum(PERSON_TYPES);

export const Person = a.model({
  name: a.string().required(),
  surname: a.string().required(),
  type: a.ref('PersonType').required(),
  profession: a.string(),
  initials: a.string().required(),
  events: a.hasMany('EventPerson', 'personId'),
})
  .authorization((allow) => [allow.authenticated()]);


export const Event = a.model({
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
  sources: a.string().required().array(),
  relatesTo: a.hasMany('EventRelated', 'relatesToId'),
  relatedBy: a.hasMany('EventRelated', 'relatedById'),
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
