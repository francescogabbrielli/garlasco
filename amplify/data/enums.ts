export const EVENT_TYPES = [
  'Fatto',
  'Indagine',
  'Comunicazione',
  'Testimonianza',
  'Intercettazione',
  'Sentenza'
] as const;

export const PERSON_TYPES = [
  'Protagonista',
  'Comparsa',
  'Autorita',
  'Avvocato',
  'Testimone',
  'Cronista',
] as const;

export const REQUEST_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const;