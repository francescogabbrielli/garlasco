import { Component, EventEmitter, Output } from '@angular/core';
import { ActorSelectionComponent } from './actor-selection.component';
import { AreaMapComponent } from './area-map.component';
import { EventSearchFilters, EMPTY_EVENT_SEARCH, SearchArea } from './search.models';
import { TimeIntervalComponent } from './time-interval.component';

@Component({
  selector: 'app-search-mask',
  standalone: true,
  imports: [ActorSelectionComponent, AreaMapComponent, TimeIntervalComponent],
  template: `
    <section class="search-mask" aria-labelledby="search-title">
      <div class="mask-heading">
        <div>
          <p class="eyebrow">Filtri</p>
          <h2 id="search-title">Affina la ricerca</h2>
        </div>
        <button class="reset-button" type="button" (click)="reset()">Reimposta</button>
      </div>
      <div class="filter-layout">
        <div class="filter-stack">
          <app-actor-selection
            [selectedIds]="draft.actorIds"
            (selectedIdsChange)="draft.actorIds = $event"
          />
          <app-time-interval
            [from]="draft.from"
            [to]="draft.to"
            (fromChange)="draft.from = $event"
            (toChange)="draft.to = $event"
          />
        </div>
        <app-area-map [area]="draft.area" (areaChange)="setArea($event)" />
      </div>
      <div class="search-actions">
        <span>{{ summary }}</span>
        <button class="search-button" type="button" (click)="submit()">
          <span aria-hidden="true">⌕</span>
          Cerca eventi
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .search-mask { padding: 1.35rem 1.5rem 1rem; border: 1px solid #d5ddda; border-top: 3px solid #167c72; border-radius: 5px; background: #fbfcfa; box-shadow: 0 5px 18px rgba(25, 49, 44, .05); }
    .mask-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .eyebrow { color: #167c72; font-size: .72rem; letter-spacing: .08em }
    h2 { margin: 0; color: #1d3332; font: 500 1.35rem/1.2 Georgia, 'Times New Roman', serif; }
    .reset-button { border: 0; padding: .35rem 0; background: transparent; color: #62706d; cursor: pointer; font: inherit; font-size: .8rem; }
    .reset-button:hover { color: #167c72; }
    .filter-layout { display: grid; grid-template-columns: minmax(16rem, .9fr) minmax(20rem, 1.1fr); gap: 1.5rem; }
    .filter-stack { min-width: 0; }
    .search-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1rem; padding-top: .9rem; border-top: 1px solid #dce1e0; }
    .search-actions > span { color: #62706d; font-size: .78rem; }
    .search-button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.6rem; padding: .5rem 1rem; border: 1px solid #145f58; border-radius: 4px; background: #167c72; color: #fff; cursor: pointer; font: inherit; font-size: .85rem; font-weight: 650; }
    .search-button:hover { background: #105e57; }
    .search-button span { font-size: 1.25rem; line-height: .8; }
    @media (max-width: 760px) { .filter-layout { grid-template-columns: 1fr; gap: 0; } }
    @media (max-width: 480px) { .search-mask { padding: 1rem; } .search-actions { align-items: stretch; flex-direction: column; } }
  `],
})
export class SearchMaskComponent {
  @Output() search = new EventEmitter<EventSearchFilters>();
  draft: EventSearchFilters = { ...EMPTY_EVENT_SEARCH };

  get summary(): string {
    const parts: string[] = [];
    if (this.draft.actorIds.length) parts.push(`${this.draft.actorIds.length} persone`);
    if (this.draft.from || this.draft.to) parts.push('intervallo temporale');
    if (this.draft.area) parts.push(`raggio ${this.draft.area.radiusMeters.toLocaleString('it-IT')} m`);
    return parts.length ? `Filtri attivi: ${parts.join(' · ')}` : 'Nessun filtro selezionato';
  }

  setArea(area: SearchArea | null): void {
    this.draft.area = area;
  }

  reset(): void {
    this.draft = { ...EMPTY_EVENT_SEARCH };
  }

  submit(): void {
    this.search.emit({ ...this.draft, actorIds: [...this.draft.actorIds], area: this.draft.area ? { ...this.draft.area } : null });
  }
}