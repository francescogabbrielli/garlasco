import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';
import { generateClient } from 'aws-amplify/data';
import { of, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Schema } from '../../amplify/data/resource';

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

// Creiamo un mock per il client di Amplify Gen 2
vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(() => ({
    models: {
      DataPoint: {
        list: vi.fn()
      }
    }
  }))
}));

describe('DataService (Vitest - Centralized Debounce & toSignal)', () => {
  let service: DataService;
  let mockAmplifyClient: any;
  let dbSubject$: Subject<any>;

  beforeEach(() => {
    vi.useFakeTimers();
    dbSubject$ = new Subject();

    // Recuperiamo l'istanza mockata del client Amplify
    mockAmplifyClient = generateClient();
    // Facciamo in modo che il metodo .list() restituisca una Promise legata al nostro Subject RxJS
    mockAmplifyClient.models.DataPoint.list.mockImplementation(() => {
      return new Promise((resolve) => {
        dbSubject$.subscribe((data) => resolve(data));
      });
    });

    TestBed.configureTestingModule({
      providers: [DataService]
    });

    service = TestBed.inject(DataService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('1. Dovrebbe inizializzare visibleMarkers come un array vuoto di default', () => {
    // Il Signal deve rispondere immediatamente con il valore iniziale
    expect(service.getEvents()).toEqual([]);
    expect(service.isLoading()).toBe(false);
    expect(service.hasMorePages()).toBe(true);
  });

  it('2. Dovrebbe applicare il debounce di 300ms prima di avviare la chiamata ad Amplify', async () => {
    const timeFilter = { min: 1000, max: 5000 };
    const geoHash = 'sr63';

    // L'utente interagisce rapidamente simulando 3 variazioni di filtri
    service.setFilters(timeFilter, geoHash);
    service.setFilters(timeFilter, geoHash);
    service.setFilters({ min: 2000, max: 6000 }, 'sr64');

    // Avanziamo il tempo di 150ms: la chiamata NON deve essere ancora partita
    vi.advanceTimersByTime(150);
    expect(mockAmplifyClient.models.DataPoint.list).not.toHaveBeenCalled();

    // Avanziamo di altri 150ms (totale 300ms): scatta il debounce
    vi.advanceTimersByTime(150);
    expect(mockAmplifyClient.models.DataPoint.list).toHaveBeenCalledTimes(1);
    
    // Verifica che sia stato chiamato solo con l'ultimo filtro impostato
    expect(mockAmplifyClient.models.DataPoint.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          timestamp: { between: [2000, 6000] },
          geoHash: { beginsWith: 'sr64' }
        }
      })
    );
  });

  it('3. Dovrebbe aggiornare il Signal visibleMarkers quando Amplify risponde alla query', async () => {
    fixtureUpdateFiltersDirectly(); // Funzione helper sotto

    // Avanziamo il tempo per superare il debounce e far partire la Promise
    vi.advanceTimersByTime(300);
    expect(service.isLoading()).toBe(true);

    // Prepariamo la risposta finta del server
    const mockData: Event[] = [{ id: '1', lat: 45, lng: 9, title: 'Test', timestamp: 1000, geoHash: 'sr6' }];
    dbSubject$.next({ data: mockData, nextToken: 'token_next_page' });

    // Attendiamo la risoluzione della Promise all'interno del microtask queue di Node/Vite
    await vi.runAllTicks();
    
    // Forziamo il ciclo di rilevamento degli effetti dei Signal in Angular 19+
    TestBed.flushEffects();

    // Il Signal esposto dal servizio deve contenere i dati pronti per la Dashboard
    expect(service.isLoading()).toBe(false);
    expect(service.getEvents()).toEqual(mockData);
    expect(service.activeNextToken()).toBe('token_next_page');
    expect(service.hasMorePages()).toBe(true);
  });

  it('4. Dovrebbe caricare la pagina successiva (Infinite Scroll) tramite loadNextPage e invocare il callback', async () => {
    // Simuliamo che il servizio abbia già memorizzato i filtri precedenti
    fixtureUpdateFiltersDirectly();
    vi.advanceTimersByTime(300);
    dbSubject$.next({ data: [], nextToken: 'token_1' });
    await vi.runAllTicks();

    // Prepariamo la risposta per la pagina 2 dello scroll infinito
    const mockPage2Data = [{ id: '2', lat: 46, lng: 10, title: 'Pagina 2', timestamp: 2000, geoHash: 'sr7' }];
    mockAmplifyClient.models.DataPoint.list.mockResolvedValueOnce({
      data: mockPage2Data,
      nextToken: null // Fine dei dati
    });

    // Spia per il callback
    const callbackSpy = vi.fn();

    service.loadNextEvents(callbackSpy);
    await vi.runAllTicks();

    // Verifica che il metodo list sia stato chiamato per la seconda pagina con il nextToken corretto
    expect(mockAmplifyClient.models.DataPoint.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nextToken: 'token_1',
        limit: 100
      })
    );

    // Controlliamo che il callback sia stato invocato con i nuovi 100 elementi da unire
    expect(callbackSpy).toHaveBeenCalledWith(mockPage2Data);
    expect(service.hasMorePages()).toBe(false); // nextToken è diventato null
  });

  // Helper per ripulire il codice ripetitivo dei test
  function fixtureUpdateFiltersDirectly() {
    service.setFilters(1000, 5000, 'sr63');
  }
});
