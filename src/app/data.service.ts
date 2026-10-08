import { inject, Injectable, signal } from '@angular/core';

import { Observable, from, Subject, of } from 'rxjs';
import { map, debounceTime, switchMap, tap, catchError } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../amplify/data/resource';
import { GeoService } from './geo.service';

const client = generateClient<Schema>();

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

type Filter = {
  dateFrom: string
  dateTo: string
  geoHash: string 
}

@Injectable({
  providedIn: 'root',
})
export class DataService {

  mapsService = inject(GeoService)

  private filterSubject = new Subject<Filter>()

  // Segnali di stato per monitorare il caricamento e la paginazione
  readonly isLoading = signal<boolean>(false);
  readonly activeNextToken = signal<string | null>(null);
  readonly hasMorePages = signal<boolean>(true);

  private lastFilter!: Filter

  /**
   * Load async events (debounced) data as a signal (limited to 100 records)
   */
  readonly getEvents = toSignal(
    this.filterSubject.pipe(
      debounceTime(500),
      tap(() => this.isLoading.set(true)),
      switchMap(filter => this.fetchFirstPage(filter)),
      tap(() => this.isLoading.set(false))
    ),
    { initialValue: [] } // Valore iniziale per evitare il tipo 'undefined' nei componenti
  )
  
  setFilters(from:Date, to:Date, viewportDisc:Coordinates):void {
    const newFilter = { 
      dateFrom: from.toISOString(), 
      dateTo: to.toISOString(), 
      geoHash: this.mapsService.computeGeoHash(viewportDisc)
    }
    this.lastFilter = {...newFilter}
    this.filterSubject.next(newFilter)
  }

  /**
   * Query iniziale per la prima pagina da 100 elementi (cancellabile via switchMap)
   */
  private fetchFirstPage(filter: Filter): Observable<Event[]> {

    const promise = client.models.Event.list({
      limit: 100,
      filter: {
        start_date: { between: [filter.dateFrom, filter.dateTo] },
        geoHash: { beginsWith: filter.geoHash },
        //type: { eq: EVENT_TYPES[0] } //solo fatti? (TODO per ottimizzazione)
      }
    })

    return from(promise).pipe(
      map(res => {
        this.activeNextToken.set(res.nextToken || null)
        this.hasMorePages.set(res.nextToken !== null)
        return (res.data as Event[]) || []
      }),
      catchError((err) => {
        console.error(err)
        this.hasMorePages.set(false)
        return of([])
      })
    )

  }

  /**
   * Carica la pagina successiva per lo scroll infinito.
   * Poiché si tratta di un accodamento, usiamo una Promise/Observable "one-shot"
   * senza passare dal flusso principale di switchMap.
   */
  loadNextEvents(updateCallback: (newItems: Event[]) => void): void {

    if (this.isLoading() || !this.hasMorePages()) return

    this.isLoading.set(true)

    const promise = client.models.Event.list({
      limit: 100,
      nextToken: this.activeNextToken(),
      filter: {
        start_date: { between: [this.lastFilter.dateFrom, this.lastFilter.dateTo] },
        geoHash: { beginsWith: this.lastFilter.geoHash },
        //type: { eq: EVENT_TYPES[0] } //solo fatti? (TODO per ottimizzazione)
      }
    });

    from(promise).subscribe({
      next: (res) => {
        this.activeNextToken.set(res.nextToken || null)
        this.hasMorePages.set(res.nextToken !== null)
        this.isLoading.set(false)
        
        // Passiamo i nuovi 100 elementi al callback per unirli allo stato
        updateCallback((res.data as Event[]) || [])
      },
      error: () => this.isLoading.set(false)
    });
  }
  
}