import { Component, inject, signal} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { generateClient } from 'aws-amplify/data'

import { EVENT_TYPES, PERSON_TYPES } from '../../../../amplify/data/enums'
import type { Schema } from '../../../../amplify/data/resource'

import { UserProfileService } from '../../user-profile.service'
import { GeoService } from '../../geo.service'

const client = generateClient<Schema>()

interface EventActorImport {
  personId: string
  role: string
}

type EventImportRecord = Omit<Schema['Event']['type'], 'actors'> & {
  actors?: unknown
};

type EventType = Schema['Event']['type']['type']
const eventTypes: readonly EventType[] = EVENT_TYPES
type PersonType = Schema['Person']['type']['type']
const personTypes: readonly PersonType[] = PERSON_TYPES

interface PersonImportRecord {
  id?: string;
  name?: string;
  surname?: string;
  type?: PersonType;
  profession?: string | null;
  initials?: string;
  events?: unknown;
}

type PersonCreateInput = Parameters<typeof client.models.Person.create>[0];

export function isValidEventActors(actors: unknown): actors is EventActorImport[] {
  return Array.isArray(actors) && actors.every((actor) =>
    typeof actor === 'object'
    && actor !== null
    && 'personId' in actor
    && typeof actor.personId === 'string'
    && actor.personId.trim().length > 0
    && 'role' in actor
    && typeof actor.role === 'string'
    && actor.role.trim().length > 0,
  );
}

export function isValidEventType(type: unknown): type is EventType {
  return typeof type === 'string' && eventTypes.some((eventType) => eventType === type);
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

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {

  userProfile = inject(UserProfileService)
  mapsService = inject(GeoService)

  jsonInput = signal<string>('');
  peopleJsonInput = signal<string>('');
  isLoading = signal<boolean>(false);

  async eseguiUploadDaTextarea() {
    const rawText = this.jsonInput().trim();
    
    if (!rawText) {
      alert("⚠️ L'area di testo è vuota. Incolla prima un JSON valido.")
      return
    }

    let dataset: EventImportRecord[];
    
    // 1. Validazione sintattica del JSON inserito
    try {
      const parsing = JSON.parse(rawText);
      dataset = (Array.isArray(parsing) ? parsing : [parsing]) as EventImportRecord[];
    } catch (e) {
      alert("❌ Errore di sintassi nel JSON. Verifica che le virgolette e le virgole siano corrette.");
      console.error(e);
      return;
    }

    this.isLoading.set(true);
    console.log(`Avvio importazione di ${dataset.length} elementi da textarea...`);

    let contatoreSuccessi = 0;

    try {
      for (const event of dataset) {
        // Valida la presenza dei campi minimi prima dell'invio
        if (!event.name || !event.start_date || !event.start_position || !isValidEventType(event.type)) {
          console.warn("Elemento saltato per mancanza di campi obbligatori:", event);
          continue;
        }

        if (event.actors !== undefined && !isValidEventActors(event.actors)) {
          console.warn('Evento ignorato: actors deve essere una lista di oggetti { personId, role }.', event);
          continue;
        }

        const actors = event.actors ?? [];
        const actorPeople = await Promise.all(actors.map(async ({ personId }) => {
          const { data, errors } = await client.models.Person.get({ id: personId });
          if (errors?.length) {
            throw new Error(`Impossibile verificare la persona ${personId}: ${errors.map((error) => error.message).join(', ')}`);
          }
          return data;
        }));

        if (actorPeople.some((person) => !person)) {
          console.warn('Evento ignorato: uno o più personId in actors non corrispondono a persone esistenti.', event);
          continue;
        }

        const ownerId = (await this.userProfile.logIn()).getId()

        // AWS Amplify inserisce automaticamente l'ID univoco mancante
        const { data: createdEvent, errors: eventErrors } = await client.models.Event.create({
          owner: ownerId,
          type: event.type,
          name: event.name,
          description: event.description,
          start_date: event.start_date,
          start_position: event.start_position,
          //center_position: this.mapsService.computeCenterPosition(event.start_position, event.end_position),
          end_position: event.end_position,
          geoHash: this.mapsService.computeGeoHash(
            this.mapsService.computeCenterPosition(
              event.start_position, event.end_position)),
          relevance: event.relevance || 0,
          reliability: event.reliability || 0
        });

        if (eventErrors?.length || !createdEvent?.id) {
          console.error('Errore durante la creazione dell’evento:', event, eventErrors);
          continue;
        }

        for (const { personId, role } of actors) {
          const { errors } = await client.models.EventPerson.create({
            eventId: createdEvent.id,
            eventName: createdEvent.name,
            eventStartDate: createdEvent.start_date,
            eventGeoHash: createdEvent.geoHash,
            personId,
            role,
          });

          if (errors?.length) {
            throw new Error(`Impossibile associare la persona ${personId} all’evento ${createdEvent.id}: ${errors.map((error) => error.message).join(', ')}`);
          }
        }
        
        console.log("Creato", createdEvent)

        contatoreSuccessi++;
      }
      
      alert(`🎉 Importazione completata! Caricati con successo ${contatoreSuccessi} su ${dataset.length} eventi.`);
      this.cleanInputData();
    } catch (errore) {
      console.error("Errore durante l'invio a DynamoDB:", errore);
      alert("Ops! Si è verificato un errore di comunicazione con AWS. Controlla la console degli sviluppatori.");
    } finally {
      this.isLoading.set(false);
    }
  }

  cleanInputData() {
    this.jsonInput.set('');
  }

  async importaPersoneDaTextarea(): Promise<void> {
    const rawText = this.peopleJsonInput().trim();

    if (!rawText) {
      alert('Incolla prima il JSON delle persone.');
      return;
    }

    let dataset: PersonImportRecord[];
    try {
      const parsing: unknown = JSON.parse(rawText);
      dataset = (Array.isArray(parsing) ? parsing : [parsing]) as PersonImportRecord[];
    } catch (error) {
      alert('JSON delle persone non valido.');
      console.error(error);
      return;
    }

    this.isLoading.set(true);
    let importedCount = 0;

    try {
      for (const person of dataset) {
        const type = person.type;
        if (!person.name || !person.surname || !person.initials || !isValidPersonType(type)) {
          console.warn('Persona ignorata: nome, cognome, iniziali e tipologia valida sono obbligatori.', person);
          continue;
        }

        const { errors } = await client.models.Person.create(toPersonCreateInput({ ...person, type }));

        if (errors?.length) {
          console.error('Errore durante la creazione della persona:', person, errors);
          continue;
        }

        importedCount++;
      }

      alert(`Importate ${importedCount} persone su ${dataset.length}.`);
      this.cleanPeopleInput();
    } catch (error) {
      console.error('Errore durante l’importazione delle persone:', error);
      alert('Impossibile importare le persone. Controlla la console degli sviluppatori.');
    } finally {
      this.isLoading.set(false);
    }
  }

  cleanPeopleInput(): void {
    this.peopleJsonInput.set('');
  }

}
