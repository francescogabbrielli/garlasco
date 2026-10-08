import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { DatePipe, DecimalPipe } from '@angular/common'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import { EventSearchFilters } from './search.models'
import { GeoService } from '../geo.service'

import { TickbarComponent } from '../ui/tickbar/tickbar.component'

const client = generateClient<Schema>();
type EventRecord = Schema['Event']['type'];
type PersonRecord = Schema['Person']['type'];

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TickbarComponent],
  template: `
    <section class="results" aria-labelledby="results-title" aria-live="polite">
      <div class="results-heading">
        <div>
          <p class="eyebrow">Cronologia</p>
          <h2 id="results-title">Eventi <span>{{ filteredEvents.length }}</span></h2>
        </div>
        @if (!loading && !error) {
          <p class="sort-note">Dal più recente al meno recente</p>
        }
      </div>
      @if (loading) {
        <p class="state-message">Caricamento eventi…</p>
      } @else if (error) {
        <div class="state-message error-state" role="alert">
          <p>{{ error }}</p>
          <button type="button" (click)="loadEvents()">Riprova</button>
        </div>
      } @else if (!filteredEvents.length) {
        <div class="state-message empty-state">
          <span aria-hidden="true">⌕</span>
          <p>Nessun evento corrisponde ai filtri selezionati.</p>
        </div>
      } @else {
        <ol class="event-list">
          @for (event of filteredEvents; track event.id) {
            <li class="event-item">
              <time class="event-time" [attr.datetime]="event.start_date">
                <span>{{ event.start_date | date:'dd' }}</span>
                <span>{{ event.start_date | date:'MMM yyyy':'':'it' }}</span>
                <span>{{ event.start_date | date:'HH:mm' }}</span>
              </time>
              <article class="event-content">
                <div class="event-title-line">
                  <h3>{{ event.name }}</h3>
                  <span class="reliability">Rilevanza
                    <app-tickbar [level]="event.relevance"></app-tickbar>
                  </span>
                </div>
                <p>{{ event.description }}</p>
                @if (actorNames(event.id).length) {
                  <div class="event-actors" aria-label="Persone associate">
                    @for (name of actorNames(event.id); track name) {
                      <span>{{ name }}</span>
                    }
                  </div>
                }
                @if (event.start_position) {
                  <p class="event-location">
                    <span aria-hidden="true">⌖</span>
                    {{ event.start_position.latitude | number:'1.3-3':'it' }}, {{ event.start_position.longitude | number:'1.3-3':'it' }}
                  </p>
                }
              </article>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin-top: 2.2rem; }
    .results-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: .8rem; }
    .eyebrow { margin: 0 0 .25rem; color: #167c72; font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h2 { margin: 0; color: #1d3332; font: 500 1.45rem/1.2 Georgia, 'Times New Roman', serif; }
    h2 span { display: inline-block; min-width: 1.6rem; margin-left: .35rem; padding: .12rem .35rem; border-radius: 1rem; background: #e3f3ed; color: #145c54; font: 600 .72rem/1.2 Arial, sans-serif; text-align: center; vertical-align: .18rem; }
    .sort-note { margin: 0; color: #71807c; font-size: .76rem; }
    .state-message { display: flex; align-items: center; justify-content: center; gap: .7rem; min-height: 7rem; margin: 0; border-top: 1px solid #d5ddda; color: #687773; font-size: .9rem; }
    .empty-state { flex-direction: column; }
    .empty-state span { color: #167c72; font-size: 1.5rem; }
    .empty-state p { margin: 0; }
    .error-state { justify-content: space-between; color: #a33c32; }
    .error-state p { margin: 0; }
    .error-state button { border: 1px solid #a33c32; border-radius: 4px; padding: .45rem .7rem; background: #fff; color: #a33c32; cursor: pointer; }
    .event-list { margin: 0; padding: 0; border: 0; border-top: 1px solid #cbd5d2; border-radius: 0; background: transparent; list-style: none; }
    .event-item { display: grid; grid-template-columns: 5.4rem minmax(0, 1fr); gap: 1.15rem; padding: 1.15rem 0; border-bottom: 1px solid #dce1e0; background: transparent; }
    .event-time { display: flex; flex-direction: column; align-items: flex-start; gap: .12rem; padding-top: .15rem; color: #167c72; font-variant-numeric: tabular-nums; }
    .event-time span:first-child { font: 500 1.5rem/1 Georgia, 'Times New Roman', serif; }
    .event-time span:nth-child(2) { color: #50615d; font-size: .72rem; text-transform: uppercase; }
    .event-time span:last-child { color: #71807c; font-size: .72rem; }
    .event-content { min-width: 0; }
    .event-title-line { display: flex; align-items: baseline; justify-content: space-between; gap: .8rem; }
    .event-content h3 { margin: 0; color: #203633; font: 600 1rem/1.35 Georgia, 'Times New Roman', serif; }
    .event-content > p { max-width: 68rem; margin: .4rem 0 0; color: #566560; font-size: .85rem; line-height: 1.5; }
    .reliability { flex: none; color: #75827e; font-size: .68rem; }
    .event-actors { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .6rem; }
    .event-actors span { padding: .2rem .5rem; border-radius: 2rem; background: #edf2ef; color: #3f5e55; font-size: .68rem; }
    .event-content > .event-location { margin-top: .55rem; color: #77847f; font-size: .72rem; font-variant-numeric: tabular-nums; }
    .event-location span { margin-right: .2rem; color: #167c72; }
    @media (max-width: 520px) { .results-heading { align-items: flex-start; flex-direction: column; } .event-item { grid-template-columns: 3.5rem minmax(0, 1fr); gap: .65rem; } .event-title-line { align-items: flex-start; flex-direction: column; gap: .25rem; } .event-content > p { font-size: .8rem; } }
  `],
})
export class EventListComponent implements OnInit, OnChanges {

  mapsService = inject(GeoService) // TODO: replace direct map calculations

  @Input() filters: EventSearchFilters = { actorIds: [], from: '', to: '', area: null };

  events: EventRecord[] = [];
  filteredEvents: EventRecord[] = [];
  loading = true;
  error = '';
  private eventActors = new Map<string, Set<string>>();
  private people = new Map<string, string>();

  ngOnInit(): void {
    void this.loadEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !this.loading) this.applyFilters();
  }

  async loadEvents(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const [events, people, links] = await Promise.all([
        client.models.Event.list(),
        client.models.Person.list(),
        client.models.EventPerson.list(),
      ]);
      this.events = events.data ?? [];
      this.people = new Map((people.data ?? []).map((person: PersonRecord) => [person.id, `${person.name} ${person.surname}`]));
      this.eventActors.clear();
      for (const link of links.data ?? []) {
        if (!link.eventId || !link.personId) continue;
        const personIds = this.eventActors.get(link.eventId) ?? new Set<string>();
        personIds.add(link.personId);
        this.eventActors.set(link.eventId, personIds);
      }
      this.applyFilters();
    } catch {
      this.error = 'Non è stato possibile caricare gli eventi. Riprova.';
    } finally {
      this.loading = false;
    }
  }

  actorNames(eventId: string): string[] {
    return [...(this.eventActors.get(eventId) ?? [])]
      .map((personId) => this.people.get(personId))
      .filter((name): name is string => Boolean(name));
  }

  private applyFilters(): void {
    const from = this.filters.from ? new Date(this.filters.from).getTime() : Number.NEGATIVE_INFINITY;
    const to = this.filters.to ? new Date(this.filters.to).getTime() + 60_000 : Number.POSITIVE_INFINITY;
    const actorIds = new Set(this.filters.actorIds);

    this.filteredEvents = this.events
      .filter((event) => {
        const eventTime = new Date(event.start_date).getTime();
        if (eventTime < from || eventTime > to) return false;
        if (actorIds.size) {
          const linkedActors = this.eventActors.get(event.id) ?? new Set<string>();
          if (![...actorIds].some((actorId) => linkedActors.has(actorId))) return false;
        }
        if (this.filters.area) {
          const position = event.start_position;
          if (!position) return false;
          const distance = this.distanceInMeters(
            this.filters.area.latitude,
            this.filters.area.longitude,
            position.latitude,
            position.longitude,
          );
          if (distance > this.filters.area.radiusMeters + (position.radius ?? 0)) return false;
        }
        return true;
      })
      .sort((first, second) => new Date(second.start_date).getTime() - new Date(first.start_date).getTime());
  }

  private distanceInMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = radians(latitude2 - latitude1);
    const longitudeDelta = radians(longitude2 - longitude1);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }
}