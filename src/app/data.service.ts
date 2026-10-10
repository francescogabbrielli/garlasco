import { inject, Injectable, Signal, signal } from '@angular/core';

import { Observable, from, Subject, of, merge, BehaviorSubject } from 'rxjs';
import { map, debounceTime, switchMap, tap, catchError, withLatestFrom, filter, scan } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../amplify/data/resource';
import { GeoService } from './geo.service';

const client = generateClient<Schema>();

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

type Filter = {
  personIds: string[]
  dateFrom: string
  dateTo: string
  geoHash: string 
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
    // I tuoi Subject esistenti e nuovi per la paginazione
  readonly filterSubject = new BehaviorSubject<Filter | null>(null)
  private readonly loadMoreSubject = new Subject<void>()

  // Stato esposto alla UI
  readonly isLoading = signal<boolean>(false)
  readonly hasMore = signal<boolean>(false)

  private accumulatedEvents: Event[] = []
  private personTokens: Record<string, string | null> = {}

  /**
   * Load async events (debounced) data as a signal (limited to 100 records)
   */
  readonly getEvents = toSignal(
    this.filterSubject.pipe(
      debounceTime(500),
      tap(() => {
        this.isLoading.set(true);
        // Ogni volta che i filtri cambiano, AZZERIAMO la memoria per ripartire da capo
        this.accumulatedEvents = [];
        this.personTokens = {};
        this.hasMore.set(false);
      }),
      // Chiamiamo la funzione di recupero (passando false perché è la prima pagina)
      switchMap(filter => this.fetchPage(filter, false)),
      tap(() => this.isLoading.set(false))
    ),
    { initialValue: [] }
  )
  
  setFilters(personIds: string[], from:Date, to:Date, viewportDisc:Coordinates):void {
    const newFilter = { 
      personIds: personIds,
      dateFrom: from.toISOString(), 
      dateTo: to.toISOString(), 
      geoHash: this.geoService.computeGeoHash(viewportDisc)
    }
    this.filterSubject.next(newFilter)
  }

  /**
   * Trigger esterno per caricare la pagina successiva
   */
  loadMore() {
    const currentFilter = this.filterSubject.value;
    if (!currentFilter) return;

    this.isLoading.set(true);
    // Chiamiamo la stessa funzione di recupero, ma dicendogli che è un "Load More" (true)
    this.fetchPage(currentFilter, true).subscribe({
      next: (events) => {
        // Aggiorna il Signal di Angular scatenando l'aggiornamento della mappa/interfaccia
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
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
          filter: { 
            eventGeoHash: { beginsWith: filter.geoHash } 
          },
          selectionSet: ['event.*'],
          limit: 20,
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

        // 3. AGGIUNGIAMO IN CODA i nuovi eventi a quelli che avevamo già in memoria
        this.accumulatedEvents = [...this.accumulatedEvents, ...newEvents]

        // 4. Rimuoviamo eventuali duplicati (stesso evento per più persone)
        const uniqueEvents = this.accumulatedEvents.filter(
          (event, index, self) => self.findIndex(e => e.id === event.id) === index
        );

        // Aggiorniamo la memoria interna definitiva
        this.accumulatedEvents = uniqueEvents

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

}