import { inject, Injectable, Signal, signal } from '@angular/core';

import { from, Subject, of, merge, BehaviorSubject } from 'rxjs';
import { map, debounceTime, switchMap, tap, catchError, exhaustMap, finalize } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { generateClient } from 'aws-amplify/data';

import { Schema } from '../../amplify/data/resource';
import { GeoService } from './geo.service';

const client = generateClient<Schema>();

type Coordinates = Schema['Coordinates']['type']
type Person = Schema['Person']['type']
type Event = Schema['Event']['type']
type EventPerson = Schema['EventPerson']['type']
type Hypothesis = Schema['Hypothesis']['type']
type HypothesisPerson = Schema['HypothesisPerson']['type']

type Filter = {
  personIds: string[]
  dateFrom: string
  dateTo: string
  geoHash: string | null
}

interface Pagination {
  events: Event
  tokens: Record<string, string | null>
  hasMore: boolean
}


@Injectable({
  providedIn: 'root',
})
export class DataService {

  geoService = inject(GeoService)

  // Segnali di stato per monitorare il caricamento e la paginazione
  readonly activeNextTokens: Signal<string | null>[] = []
  readonly hasMorePages: Signal<boolean>[] = []
  readonly eventFilterSubject = new BehaviorSubject<Filter | null>(null)
  private readonly loadMoreEventsSubject = new Subject<void>()

  // Stato esposto alla UI
  readonly isLoadingEvents = signal<boolean>(false)
  readonly hasMore = signal<boolean>(false)

  private accumulatedEvents: Event[] = []
  private personTokens: Record<string, string | null> = {}

  async getTableCount():Promise<number> { 
    const count = await client.queries.getTableCount();
    return count.data || 0;
  }

  async getPerson(id: string):Promise<Person> {
    return (await client.models.Person.get({ id })).data as Person
  }

  /** Load all persons (no pagination) */
  async loadPersons(): Promise<Person[]> {
    const people: Person[] = []
    let nextToken: string | null | undefined
    do {
      const { data, errors, nextToken: token } = await client.models.Person.list({ nextToken })
      if (errors?.length) throw new Error('Errore nel caricamento delle persone: ' + errors[0]?.message)
      people.push(...data)
      nextToken = token
    } while (nextToken)
    return people
  }

  // ──────────────────────────────────────────────────────────────
  //  Events
  // ──────────────────────────────────────────────────────────────

  // --------------------
  // Reactive methods 
  // |
  // |
  // V

  /**
   * Load filtered events and append later pages as they are requested.
   * 
   * NB: Only for reactive usage!
   */
  readonly loadEvents = toSignal(
    this.eventFilterSubject.pipe(
      debounceTime(750),
      tap(() => {
        this.isLoadingEvents.set(true);
        // Ogni volta che i filtri cambiano, AZZERIAMO la memoria per ripartire da capo
        this.accumulatedEvents = [];
        this.personTokens = {};
        this.hasMore.set(false);
      }),
      switchMap(filter => merge(
        of(false),
        this.loadMoreEventsSubject.pipe(map(() => true))
      ).pipe(
        exhaustMap(isLoadMore => {
          if (isLoadMore && !this.hasMore()) return of(this.accumulatedEvents)

          return this.fetchPage(filter, isLoadMore).pipe(
            finalize(() => this.isLoadingEvents.set(false))
          )
        })
      ))
    ),
    { initialValue: [] }
  )

  /** Setting new filters triggers automatic reloading of data gathered throught getEvents */
  setEventFilters(personIds: string[], from:Date, to:Date, viewportDisc:Coordinates | null):void {
    this.isLoadingEvents.set(true)
    this.hasMore.set(false)
    const newFilter = { 
      personIds: personIds,
      dateFrom: from.toISOString(), 
      dateTo: to.toISOString(), 
      geoHash: viewportDisc ? this.geoService.computeGeoHash(viewportDisc) : null
    }
    this.eventFilterSubject.next(newFilter)
  }

  /** Trigger loading the next page for getEvents if is available. */
  loadMoreEvents() {
    if (!this.hasMore() || this.isLoadingEvents()) return
    this.isLoadingEvents.set(true)
    this.loadMoreEventsSubject.next()
  }

  /* Gestisce la chiamata parallela su più persone a DynamoDB usando l'indice invertito (Data = Sort Key) */
  private fetchPage(filter: Filter | null, isLoadMore: boolean) {
    if (!filter || !filter.personIds || filter.personIds.length === 0) {
      return of([])
    }

    // Prepariamo le chiamate per ogni persona
    const queryPromises = filter.personIds.map((id: string) => {
      // Se stiamo caricando le pagine successive, prendiamo il rispettivo token recuperato prima
      const tokenForPerson = isLoadMore ? this.personTokens[id] : undefined

      // Se in un giro precedente questa persona aveva finito i dati (token === null), la saltiamo
      if (tokenForPerson === null) {
        return Promise.resolve({ data: [], nextToken: null, personId: id })
      }

      return (client.models.EventPerson as any).listEventPersonByPersonIdAndEventStartDate(
        { personId: id },
        {
          eventStartDate: { 
            between: [filter.dateFrom, filter.dateTo] 
          },
          filter: filter.geoHash ? {
            or: [
              { eventGeoHash: { eq: null } },
              { eventGeoHash: { beginsWith: filter.geoHash } }
            ]
          } : undefined,
          selectionSet: ['event.id', 'event.owner', 
            'event.type', 'event.name', 'event.description',
            'event.startDate', 'event.endDate', 
            'event.startPosition.*', 'event.endPosition.*',
            'event.relevance', 'event.reliability', 'event.coldCase'
          ],
          limit: 10,
          nextToken: tokenForPerson || undefined // Usiamo il token se esiste
        }
      ).then((res: any) => ({ ...res, personId: id }));
    });

    // Trasformiamo le Promise in un flusso leggibile
    return from(Promise.all(queryPromises)).pipe(
      map(results => {
        // 1. Salviamo i nuovi token ricevuti per il prossimo click
        results.forEach(res => {
          this.personTokens[res.personId] = res.nextToken || null;
        });

        // 2. Estraiamo i nuovi eventi arrivati da questo giro di chiamate
        const newEvents = results
          .flatMap(res => (res.data || [] as Event[]).map((conn: any) => conn.event as Event))
          .filter((e: Event) => e !== null)

        // 3. AGGIUNGIAMO IN CODA i nuovi eventi
        this.accumulatedEvents = [...this.accumulatedEvents, ...newEvents]
        // 4. Rimuoviamo eventuali duplicati (stesso evento per più persone) e rioridiniamo per data di inizio
          .filter((event, index, self) => self.findIndex(e => e.id === event.id) === index)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

        // 5. Controlliamo se c'è ancora almeno una persona con pagine da leggere
        const moreDataAvailable = Object.values(this.personTokens).some(token => token !== null)
        this.hasMore.set(moreDataAvailable)

        // Restituiamo la lista completa accumulata fino ad ora
        return this.accumulatedEvents
      }),
      catchError(err => {
        console.error("Errore nel caricamento:", err);
        return of(this.accumulatedEvents) // In caso di errore non rompiamo nulla, restituiamo i dati attuali
      })
    )
  }
  // |
  // |
  // V
  // END Reactive methods
  // ---------------------

  /** Load an event by id */
  async getEvent(id: string): Promise<Event> {
    const { data, errors } = await client.models.Event.get({ id })
    if (errors?.length || !data?.id) {
      throw new Error('Errore durante il caricamento dell’evento "' + id + '":' + (errors?.[0]?.message || 'Errore sconosciuto'));
    }
    return data as Event
  }
  
  /** Load all events with a cold-case marker */
  async loadColdCaseEvents(): Promise<Event[]> {
    const events: Event[] = []
    let nextToken: string | null | undefined
    do {
      const { data, errors, nextToken: token } = await client.models.Event.listEventByColdCase(
        { coldCase: "true" },
        { nextToken }
      )
      if (errors?.length) throw new Error('Errore nel caricamento dei casi freddi: ' + errors[0]?.message)
      events.push(...data.filter(event => Boolean(event.coldCase)))
      nextToken = token
    } while (nextToken)
    return events
  }

  /** Load all event actors from the lazy loading relation */
  async loadEventActors(event: Event): Promise<EventPerson[]> {
    const data: EventPerson[] = []
    let token: string | null | undefined = null
    do {
      const page = await event.actors({ nextToken: token })
      data.push(...page.data as EventPerson[])
      token = page.nextToken
    } while (token)
    return data as EventPerson[]
  }

  async saveEvent(event: any, previousEventActors:  string[], actors: {role: string, personId: string}[]): Promise<Event> {
    // create / save event
    const { data, errors } = event.id
      ? await client.models.Event.update(event)
      : await client.models.Event.create(event)
    if (errors?.length || !data?.id) {
      throw new Error('Errore durante il salvataggio dell’evento');
    }

    // refresh associated actors
    if (event.id) {
      for (const id of previousEventActors) {
        await client.models.EventPerson.delete({ id })
      }
    }
    for (const actor of actors) {
      const { errors: actorErrors } = await client.models.EventPerson.create({
        eventId: data.id,
        eventName: data.name,
        eventStartDate: data.startDate,
        eventGeoHash: data.geoHash,
        personId: actor.personId,
        role: actor.role.trim(),
      })
      if (actorErrors?.length) {
        throw new Error(`L’evento è stato creato, ma non è stato possibile associare ${actor.personId}: ${actorErrors[0].message}`)
      }
    }

    return data as Event
  }

  async deleteEvent(id: string, eventActors: string[]): Promise<void> {
    const { errors } = await client.models.Event.delete({ id })
    if (errors?.length) {
      console.error('Error deleting Event', errors)
      throw new Error(errors[0]?.message || 'Errore sconosciuto durante l’eliminazione dell’evento');
    }
    //TODO: gestire eventuali errori durante l'eliminazione degli attori associati all'evento
    for (const id of eventActors) {
      await client.models.EventPerson.delete({ id })
    }
  }

  async savePerson(person: { id?: string; name: string; surname: string; type: Person['type']; profession?: string; initials: string }): Promise<Person> {
    const { data, errors } = person.id
      ? await client.models.Person.update({ ...person, id: person.id })
      : await client.models.Person.create(person)
    if (errors?.length || !data?.id) {
      throw new Error(errors?.[0]?.message ?? 'Errore durante il salvataggio della persona')
    }
    return data as Person
  }

  async deletePerson(id: string): Promise<void> {
    const { errors } = await client.models.Person.delete({ id })
    if (errors?.length) {
      throw new Error(errors[0]?.message || 'Errore sconosciuto durante l’eliminazione della persona')
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  Hypotheses
  // ──────────────────────────────────────────────────────────────

  /** Load an hypthesis by id */
  async getHypothesis(id: string): Promise<Hypothesis> {
    const { data, errors } = await client.models.Hypothesis.get({ id })
    if (errors?.length || !data?.id) {
      throw new Error('Errore durante il caricamento dell’ipotesi "' + id + '": '+ (errors?.[0]?.message || 'Errore sconosciuto'));
    }
    return data as Hypothesis
  }

  async loadHypotheses(eventId: string): Promise<Hypothesis[]> {
    const hypotheses: Hypothesis[] = []
    let nextToken: string | null | undefined
    do {
      const { data, errors, nextToken: token } = await client.models.Hypothesis.listHypothesisByEventIdAndEventRelevance(
        { eventId: eventId },
        { 
          sortDirection: "DESC",
          nextToken 
        }
      )
      if (errors?.length) throw new Error('Errore nel caricamento delle ipotesi: ' + errors[0]?.message)
      hypotheses.push(...data)
      nextToken = token
    } while (nextToken)
    return hypotheses
  }

  async loadHypothesisActors(hypothesis: Hypothesis): Promise<HypothesisPerson[]> {
    const data: HypothesisPerson[] = []
    let token: string | null | undefined = null
    do {
      const page = await hypothesis.actors({ nextToken: token })
      data.push(...page.data as HypothesisPerson[])
      token = page.nextToken
    } while (token)
    return data as HypothesisPerson[]
  }

  async saveHypothesis(hypothesis: any, previousActorsIds: string[], actors: {role: string, personId: string}[]): Promise<Hypothesis> {
    const { data, errors } = hypothesis.id
      ? await client.models.Hypothesis.update(hypothesis as any)
      : await client.models.Hypothesis.create(hypothesis as any)
    if (errors?.length || !data?.id) {
      throw new Error('Errore durante il salvataggio dell’ipotesi')
    }

    // refresh associated actors
    if (hypothesis.id) {
      for (const id of previousActorsIds) {
        await client.models.HypothesisPerson.delete({ id })
      }
    }
    for (const actor of actors) {
      const { errors: actorErrors } = await client.models.HypothesisPerson.create({
        hypothesisId: data.id,
        hypothesisName: data.name,
        personId: actor.personId,
        role: actor.role.trim(),
      })
      if (actorErrors?.length) {
        throw new Error(`L’ipotesi è stata salvata, ma non è stato possibile associare ${actor.personId}: ${actorErrors[0].message}`)
      }
    }

    return data as Hypothesis
  }

  async deleteHypothesis(id: string, actorIds: string[]): Promise<void> {
    const { errors } = await client.models.Hypothesis.delete({ id })
    if (errors?.length) {
      throw new Error(errors[0]?.message || 'Errore durante l’eliminazione dell’ipotesi')
    }
    for (const id of actorIds) {
      await client.models.HypothesisPerson.delete({ id })
    }
  }

  async submitPublicationRequest(hypothesisId: string): Promise<void> {
    const { errors } = await client.models.PublicationRequest.create({ hypothesisId } as any)
    if (errors?.length) {
      throw new Error('Errore durante l’invio della richiesta di pubblicazione: ' + errors[0]?.message)
    }
  }

}