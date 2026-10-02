import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();
type PersonRecord = Schema['Person']['type'];

@Component({
  selector: 'app-actor-selection',
  standalone: true,
  template: `
    <section class="control-section" aria-labelledby="actor-selection-title">
      <div class="section-heading">
        <div>
          <h3 id="actor-selection-title">Persone</h3>
          <p>Seleziona una o più persone</p>
        </div>
        @if (selectedIds.length) {
          <button class="clear-control" type="button" (click)="clear()">Azzera</button>
        }
      </div>
      @if (loading) {
        <p class="control-message" aria-live="polite">Caricamento persone…</p>
      } @else if (error) {
        <p class="control-message control-error" role="status">{{ error }}</p>
      } @else if (people.length) {
        <div class="actor-list" role="group" aria-label="Filtra per persona">
          @for (person of people; track person.id) {
            <button
              class="actor-option"
              [class.selected]="selectedIds.includes(person.id)"
              type="button"
              [attr.aria-pressed]="selectedIds.includes(person.id)"
              [attr.aria-label]="person.name + ' ' + person.surname"
              [attr.aria-describedby]="'actor-tooltip-' + person.id"
              (click)="toggle(person.id)"
            >
              <span class="initials" aria-hidden="true">{{ person.initials }}</span>
              <span class="actor-tooltip" [id]="'actor-tooltip-' + person.id" role="tooltip">
                {{ person.name }} {{ person.surname }}
              </span>
            </button>
          }
        </div>
      } @else {
        <p class="control-message">Nessuna persona disponibile.</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .control-section { padding: 1.1rem 0; border-bottom: 1px solid #dce1e0; }
    .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .8rem; }
    h3 { margin: 0; color: #1d3332; font: 600 1rem/1.25 Georgia, 'Times New Roman', serif; }
    .section-heading p, .control-message { margin: .22rem 0 0; color: #62706d; font-size: .82rem; }
    .actor-list { display: flex; flex-wrap: wrap; gap: .55rem; }
    .actor-option { position: relative; display: grid; width: 2.5rem; height: 2.5rem; flex: 0 0 2.5rem; padding: 0; place-items: center; border: 1px solid #d2dad7; border-radius: 50%; background: #fff; color: #263a38; cursor: pointer; font: inherit; transition: background .15s, border-color .15s, color .15s; }
    .actor-option:hover { border-color: #167c72; }
    .actor-option.selected { border-color: #167c72; background: #e3f3ed; color: #145c54; }
    .initials { display: grid; width: 100%; height: 100%; place-items: center; border-radius: 50%; background: #e9eee8; color: #35524b; font-size: .72rem; font-weight: 700; }
    .selected .initials { background: #167c72; color: #fff; }
    .actor-tooltip { position: absolute; bottom: calc(100% + .5rem); left: 50%; z-index: 3; width: max-content; max-width: min(16rem, 70vw); padding: .4rem .6rem; transform: translate(-50%, .2rem); border-radius: 4px; background: #203633; color: #fff; font-size: .75rem; line-height: 1.3; opacity: 0; pointer-events: none; visibility: hidden; transition: opacity .12s, transform .12s, visibility .12s; }
    .actor-option:hover .actor-tooltip, .actor-option:focus-visible .actor-tooltip { transform: translate(-50%, 0); opacity: 1; visibility: visible; }
    .clear-control { border: 0; padding: .2rem 0; background: transparent; color: #167c72; cursor: pointer; font: inherit; font-size: .78rem; }
    .control-error { color: #a33c32; }
  `],
})
export class ActorSelectionComponent implements OnInit {
  @Input() selectedIds: string[] = [];
  @Output() selectedIdsChange = new EventEmitter<string[]>();

  people: PersonRecord[] = [];
  loading = true;
  error = '';

  async ngOnInit(): Promise<void> {
    try {
      const response = await client.models.Person.list();
      this.people = response.data ?? [];
    } catch {
      this.error = 'Impossibile caricare le persone.';
    } finally {
      this.loading = false;
    }
  }

  toggle(personId: string): void {
    this.selectedIdsChange.emit(
      this.selectedIds.includes(personId)
        ? this.selectedIds.filter((id) => id !== personId)
        : [...this.selectedIds, personId],
    );
  }

  clear(): void {
    this.selectedIdsChange.emit([]);
  }
}