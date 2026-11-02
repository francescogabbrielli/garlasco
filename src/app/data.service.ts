import { inject, Injectable, Signal, signal } from '@angular/core';

import { from, Subject, of, merge, BehaviorSubject } from 'rxjs';
import { map, debounceTime, switchMap, tap, catchError, exhaustMap, finalize } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { generateClient } from 'aws-amplify/data';

import { Schema } from '../../amplify/data/resource';
import { GeoService } from './geo.service';

const client = generateClient<Schema>();

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

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

export type SelectedActor = { 
  rowId: number;
  personId: string;
  personQuery: string;
  role: string
}

@Injectable({
  providedIn: 'root',
})
export class DataService {

  geoService = inject(GeoService)

  // Segnali di stato per monitorare il caricamento e la paginazione
  readonly activeNextTokens: Signal<string | null>[] = []
  readonly hasMorePages: Signal<boolean>[] = []
  readonly filterSubject = new BehaviorSubject<Filter | null>(null)
  private readonly loadMoreSubject = new Subject<void>()

  // Stato esposto alla UI
  readonly isLoading = signal<boolean>(false)
  readonly hasMore = signal<boolean>(false)

  private accumulatedEvents: Event[] = []
  private personTokens: Record<string, string | null> = {}

  /**
   * Load filtered events and append later pages as they are requested.
   */
  readonly getEvents = toSignal(
    this.filterSubject.pipe(
      debounceTime(750),
      tap(() => {
        this.isLoading.set(true);
        // Ogni volta che i filtri cambiano, AZZERIAMO la memoria per ripartire da capo
        this.accumulatedEvents = [];
        this.personTokens = {};
        this.hasMore.set(false);
      }),
      switchMap(filter => merge(
        of(false),
        this.loadMoreSubject.pipe(map(() => true))
      ).pipe(
        exhaustMap(isLoadMore => {
          if (isLoadMore && !this.hasMore()) return of(this.accumulatedEvents)

          return this.fetchPage(filter, isLoadMore).pipe(
            finalize(() => this.isLoading.set(false))
          )
        })
      ))
    ),
    { initialValue: [] }
  )
  
  setFilters(personIds: string[], from:Date, to:Date, viewportDisc:Coordinates | null):void {
    this.isLoading.set(true)
    this.hasMore.set(false)
    const newFilter = { 
      personIds: personIds,
      dateFrom: from.toISOString(), 
      dateTo: to.toISOString(), 
      geoHash: viewportDisc ? this.geoService.computeGeoHash(viewportDisc) : null
    }
    this.filterSubject.next(newFilter)
  }

  /** Trigger loading the next page when one is available. */
  loadMore() {
    if (!this.hasMore() || this.isLoading()) return
    this.isLoading.set(true)
    this.loadMoreSubject.next()
  }

  /**
   * Gestisce la chiamata parallela a DynamoDB usando l'indice invertito (Data = Sort Key)
   */
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
            eventGeoHash: { beginsWith: filter.geoHash } 
          } : undefined,
          selectionSet: ['event.id', 'event.owner', 
            'event.type', 'event.name', 'event.description',
            'event.start_date', 'event.end_date', 
            'event.start_position.*', 'event.end_position.*',
            'event.relevance', 'event.reliability'
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
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

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

  async loadEvent(id: string): Promise<Event> {
    const { data, errors } = await client.models.Event.get({ id })
    if (errors?.length || !data?.id) {
      throw new Error('Errore durante il caricamento dell’evento: '+ (errors?.[0]?.message || 'Errore sconosciuto'));
    }
    return data as Event
  }

  async saveEvent(event: any, previousEventActors:  string[], actors: SelectedActor[]): Promise<Event> {
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
        eventStartDate: data.start_date,
        eventGeoHash: data.geoHash,
        personId: actor.personId,
        role: actor.role.trim(),
      })
      if (actorErrors?.length) {
        throw new Error(`L’evento è stato creato, ma non è stato possibile associare ${actor.personQuery}: ${actorErrors[0].message}`)
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

}