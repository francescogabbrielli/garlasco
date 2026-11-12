import { InjectionToken, Injectable, inject, signal } from '@angular/core';
import { generateClient, type Client } from 'aws-amplify/data';

import { EVENT_TYPES, PERSON_TYPES } from '../../../../amplify/data/enums';
import type { Schema } from '../../../../amplify/data/resource';
import { GeoService } from '../../geo.service';
import { UserProfileService } from '../../user-profile.service';

export const IMPORT_CLIENT = new InjectionToken<Client<Schema>>(
  'IMPORT_CLIENT',
  {
    providedIn: 'root',
    factory: () => generateClient<Schema>()
  }
);

type Event = Schema['Event']['type'];
type Person = Schema['Person']['type'];
type Hypothesis = Schema['Hypothesis']['type'];
type EventType = Event['type'];
type PersonType = Person['type'];
type PersonCreateInput = Parameters<Client<Schema>['models']['Person']['create']>[0];
type EventImportRecord = Omit<Event, 'actors'> & { actors?: unknown };
type HypothesisImportRecord = Omit<Hypothesis, 'actors'> & { actors?: unknown };

const eventTypes: readonly EventType[] = EVENT_TYPES;
const personTypes: readonly PersonType[] = PERSON_TYPES;

interface EventActorImport {
  personId: string;
  role: string;
}

interface PersonImportRecord {
  id?: string;
  name?: string;
  surname?: string;
  type?: PersonType;
  profession?: string | null;
  initials?: string;
  events?: unknown;
}

export type ImportKind = 'people' | 'events' | 'hypotheses';

export interface ImportProgress {
  active: boolean;
  kind: ImportKind | null;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  currentItem: string;
}

export interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  issues: string[];
}

type RecordResult = { imported: true } | { imported: false; reason: string };

const IDLE_PROGRESS: ImportProgress = {
  active: false,
  kind: null,
  total: 0,
  processed: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  currentItem: ''
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecords<T>(json: string, label: string): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`JSON ${label} non valido.`);
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (!records.every(isRecord)) {
    throw new Error(`Il JSON ${label} deve contenere uno o più oggetti.`);
  }
  return records as T[];
}

export function isValidEventActors(actors: unknown): actors is EventActorImport[] {
  return Array.isArray(actors) && actors.every((actor) => {
    if (!isRecord(actor)) return false;
    const personId = actor['personId'];
    const role = actor['role'];
    return typeof personId === 'string'
      && personId.trim().length > 0
      && typeof role === 'string'
      && role.trim().length > 0;
  });
}

export function isValidEventType(type: unknown, startPosition: unknown): type is EventType {
  return typeof type === 'string'
    && eventTypes.some((eventType) => eventType === type)
    && (type !== 'Fatto' || startPosition != null);
}

export function isValidPersonType(type: unknown): type is PersonType {
  return typeof type === 'string' && personTypes.some((personType) => personType === type);
}

export function toPersonCreateInput(
  person: PersonImportRecord & { type: PersonType },
): PersonCreateInput {
  return {
    ...(person.id ? { id: person.id } : {}),
    name: person.name!,
    surname: person.surname!,
    type: person.type,
    initials: person.initials!,
    ...(person.profession ? { profession: person.profession } : {}),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly client = inject(IMPORT_CLIENT);
  private readonly userProfile = inject(UserProfileService);
  private readonly geoService = inject(GeoService);

  readonly progress = signal<ImportProgress>(IDLE_PROGRESS);

  async importPeople(json: string): Promise<ImportSummary> {
    const records = parseRecords<PersonImportRecord>(json, 'persone');
    return this.run('people', records, async (person) => {
      if (
        typeof person.name !== 'string' || !person.name.trim()
        || typeof person.surname !== 'string' || !person.surname.trim()
        || typeof person.initials !== 'string' || !person.initials.trim()
        || !isValidPersonType(person.type)
        || (person.id !== undefined && typeof person.id !== 'string')
      ) {
        return { imported: false, reason: 'campi obbligatori o tipologia non validi' };
      }

      const { data, errors } = await this.client.models.Person.create(
        toPersonCreateInput({ ...person, type: person.type })
      );
      if (errors?.length || !data?.id) {
        throw new Error(errors?.map(error => error.message).join(', ') || 'nessun dato restituito');
      }
      return { imported: true };
    });
  }

  async importEvents(json: string): Promise<ImportSummary> {
    const records = parseRecords<EventImportRecord>(json, 'eventi');
    let ownerId: string | undefined;

    return this.run('events', records, async (event) => {
      if (
        typeof event.name !== 'string' || !event.name.trim()
        || typeof event.startDate !== 'string' || !event.startDate
        || !isValidEventType(event.type, event.startPosition)
        || !Array.isArray(event.sources)
        || !event.sources.every(source => typeof source === 'string')
      ) {
        return { imported: false, reason: 'campi obbligatori o tipo evento non validi' };
      }

      if (event.actors !== undefined && !isValidEventActors(event.actors)) {
        return { imported: false, reason: 'formato actors non valido' };
      }

      const actors = event.actors ?? [];
      const actorPeople = await Promise.all(actors.map(async ({ personId }) => {
        const { data, errors } = await this.client.models.Person.get({ id: personId });
        if (errors?.length) throw new Error(errors.map(error => error.message).join(', '));
        return data;
      }));
      if (actorPeople.some(person => !person)) {
        return { imported: false, reason: 'una o più persone associate non esistono' };
      }

      ownerId ??= (await this.userProfile.logIn()).getId();
      const { data: createdEvent, errors: eventErrors } = await this.client.models.Event.create({
        ...(event.id ? { id: event.id } : {}),
        owner: event.owner || ownerId,
        type: event.type,
        name: event.name,
        description: event.description,
        startDate: event.startDate,
        startPosition: event.startPosition,
        endDate: event.endDate,
        endPosition: event.endPosition,
        geoHash: this.geoService.computeGeoHash(
          this.geoService.computeCenterPosition(event.startPosition, event.endPosition)
        ),
        sources: event.sources,
        relevance: event.relevance || 0,
        reliability: event.reliability || 0,
        coldCase: event.coldCase ? 'true' : null
      });

      if (eventErrors?.length || !createdEvent?.id) {
        throw new Error(eventErrors?.map(error => error.message).join(', ') || 'nessun evento restituito');
      }

      for (const { personId, role } of actors) {
        const { errors } = await this.client.models.EventPerson.create({
          eventId: createdEvent.id,
          eventName: createdEvent.name,
          eventStartDate: createdEvent.startDate,
          eventGeoHash: createdEvent.geoHash,
          personId,
          role
        });
        if (errors?.length) {
          throw new Error(`Impossibile associare la persona ${personId}: ${errors.map(error => error.message).join(', ')}`);
        }
      }

      return { imported: true };
    });
  }

  async importHypotheses(json: string): Promise<ImportSummary> {
    const records = parseRecords<HypothesisImportRecord>(json, 'ipotesi');
    return this.run('hypotheses', records, async (hypothesis) => {
      if (
        typeof hypothesis.owner !== 'string' || !hypothesis.owner.trim()
        || typeof hypothesis.name !== 'string' || !hypothesis.name.trim()
        || typeof hypothesis.description !== 'string'
        || typeof hypothesis.startDate !== 'string' || !hypothesis.startDate
        || !Array.isArray(hypothesis.sources)
        || !hypothesis.sources.every(source => typeof source === 'string')
      ) {
        return { imported: false, reason: 'campi obbligatori non validi (owner, nome, descrizione, data, fonti)' };
      }

      if (hypothesis.actors !== undefined && !isValidEventActors(hypothesis.actors)) {
        return { imported: false, reason: 'formato actors non valido' };
      }

      if (hypothesis.eventId) {
        const { data, errors } = await this.client.models.Event.get({ id: hypothesis.eventId });
        if (errors?.length) throw new Error(errors.map(error => error.message).join(', '));
        if (!data) return { imported: false, reason: `evento ${hypothesis.eventId} non trovato` };
      }

      const actors = hypothesis.actors ?? [];
      const actorPeople = await Promise.all(actors.map(async ({ personId }) => {
        const { data, errors } = await this.client.models.Person.get({ id: personId });
        if (errors?.length) throw new Error(errors.map(error => error.message).join(', '));
        return data;
      }));
      if (actorPeople.some(person => !person)) {
        return { imported: false, reason: 'una o più persone associate non esistono' };
      }

      const { data: createdHypothesis, errors: hypothesisErrors } =
        await this.client.models.Hypothesis.create({
          ...(hypothesis.id ? { id: hypothesis.id } : {}),
          owner: hypothesis.owner,
          name: hypothesis.name,
          description: hypothesis.description,
          startDate: hypothesis.startDate,
          endDate: hypothesis.endDate,
          startPosition: hypothesis.startPosition,
          endPosition: hypothesis.endPosition,
          sources: hypothesis.sources,
          eventId: hypothesis.eventId,
          eventName: hypothesis.eventName,
          eventRelevance: hypothesis.eventRelevance
        });

      if (hypothesisErrors?.length || !createdHypothesis?.id) {
        throw new Error(hypothesisErrors?.map(error => error.message).join(', ') || 'nessuna ipotesi restituita');
      }

      for (const { personId, role } of actors) {
        const { errors } = await this.client.models.HypothesisPerson.create({
          hypothesisId: createdHypothesis.id,
          hypothesisName: createdHypothesis.name,
          personId,
          role
        });
        if (errors?.length) {
          throw new Error(`Impossibile associare la persona ${personId}: ${errors.map(error => error.message).join(', ')}`);
        }
      }

      return { imported: true };
    });
  }

  private async run<T>(
    kind: ImportKind,
    records: T[],
    importRecord: (record: T) => Promise<RecordResult>
  ): Promise<ImportSummary> {
    if (this.progress().active) throw new Error('Un’importazione è già in corso.');

    const summary: ImportSummary = {
      total: records.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      issues: []
    };

    this.progress.set({
      active: true,
      kind,
      total: records.length,
      processed: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      currentItem: ''
    });

    try {
      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        const itemName = this.getItemName(record, index);
        this.progress.update(progress => ({ ...progress, currentItem: itemName }));

        try {
          const result = await importRecord(record);
          if (result.imported) {
            summary.imported++;
          } else {
            summary.skipped++;
            summary.issues.push(`${itemName}: ${result.reason}`);
          }
        } catch (error) {
          summary.failed++;
          summary.issues.push(`${itemName}: ${errorMessage(error)}`);
        }

        this.progress.set({
          ...this.progress(),
          processed: index + 1,
          imported: summary.imported,
          skipped: summary.skipped,
          failed: summary.failed
        });
      }
      return summary;
    } finally {
      this.progress.set({ ...this.progress(), active: false, currentItem: '' });
    }
  }

  private getItemName(record: unknown, index: number): string {
    if (!isRecord(record)) return `record ${index + 1}`;
    const name = record['name'];
    return typeof name === 'string' && name.trim() ? name : `record ${index + 1}`;
  }
}
