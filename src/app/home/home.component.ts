import { Component } from '@angular/core';
import { EventListComponent } from './event-list.component';
import { EventSearchFilters, EMPTY_EVENT_SEARCH } from './search.models';
import { SearchMaskComponent } from './search-mask.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [EventListComponent, SearchMaskComponent],
  template: `
    <main class="main-view" aria-label="Ricerca eventi">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Archivio Garlasco</p>
          <h1>Esplora gli eventi</h1>
        </div>
        <p class="heading-note">Persone, tempi e luoghi in un'unica cronologia.</p>
      </header>
      <app-search-mask (search)="applySearch($event)" />
      <app-event-list [filters]="filters" />
    </main>
  `,
  styles: [`
    :host { display: block; }
    @media (max-width: 620px) { .page-heading { align-items: flex-start; flex-direction: column; gap: .6rem; } .heading-note { text-align: left; } h1 { font-size: 1.7rem; } }
  `],
})
export class HomeComponent {
  filters: EventSearchFilters = { ...EMPTY_EVENT_SEARCH };

  applySearch(filters: EventSearchFilters): void {
    this.filters = { ...filters, actorIds: [...filters.actorIds], area: filters.area ? { ...filters.area } : null };
  }
}