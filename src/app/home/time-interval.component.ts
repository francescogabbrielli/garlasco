import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-time-interval',
  standalone: true,
  template: `
    <section class="control-section" aria-labelledby="time-interval-title">
      <div class="section-heading">
        <div>
          <h3 id="time-interval-title">Intervallo temporale</h3>
          <p>Data e ora degli eventi</p>
        </div>
        @if (from || to) {
          <button class="clear-control" type="button" (click)="clear()">Azzera</button>
        }
      </div>
      <div class="time-fields">
        <label>
          <span>Da</span>
          <input class="search-control" type="datetime-local" [value]="from" (input)="fromChange.emit(valueOf($event))" />
        </label>
        <label>
          <span>A</span>
          <input class="search-control" type="datetime-local" [value]="to" [min]="from" (input)="toChange.emit(valueOf($event))" />
        </label>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .control-section { padding: 1.1rem 0; border-bottom: 1px solid #dce1e0; }
    .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .8rem; }
    h3 { margin: 0; color: #1d3332; font: 600 1rem/1.25 Georgia, 'Times New Roman', serif; }
    .section-heading p { margin: .22rem 0 0; color: #62706d; font-size: .82rem; }
    .time-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
    label { display: grid; gap: .35rem; color: #50615d; font-size: .76rem; }
    .clear-control { border: 0; padding: .2rem 0; background: transparent; color: #167c72; cursor: pointer; font: inherit; font-size: .78rem; }
    @media (max-width: 480px) { .time-fields { grid-template-columns: 1fr; } }
  `],
})
export class TimeIntervalComponent {
  @Input() from = '';
  @Input() to = '';
  @Output() fromChange = new EventEmitter<string>();
  @Output() toChange = new EventEmitter<string>();

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  clear(): void {
    this.fromChange.emit('');
    this.toChange.emit('');
  }
}