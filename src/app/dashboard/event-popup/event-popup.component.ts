import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, effect, input, output, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../../../amplify/data/resource';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component';
import { PersonMarkerComponent } from '../../ui/person-marker/person-marker.component';

type Event = Schema['Event']['type']
type Person = Schema['Person']['type']

const client = generateClient<Schema>();

@Component({
  selector: 'app-event-popup',
  imports: [DatePipe, DecimalPipe, TickbarComponent, PersonMarkerComponent],
  templateUrl: './event-popup.component.html',
  styleUrl: './event-popup.component.css',
})
export class EventPopupComponent {

  event = input.required<Event>()
  closed = output<void>()

  people = signal<Person[]>([])
  personsLoading = signal(false)

  constructor() {
    effect(() => {
      const id = this.event().id
      this.loadPersons(id)
    })
  }

  private async loadPersons(eventId: string): Promise<void> {
    this.people.set([])
    this.personsLoading.set(true)
    try {
      const { data } = await client.models.Event.get(
        { id: eventId },
        { selectionSet: ['id', 'actors.person.*'] }
      )
      if (this.event().id !== eventId) return
      this.people.set(
        (data?.actors ?? []).map(a => a.person as Person).filter(p => !!p)
      )
    } catch (e) {
      console.error('Errore nel caricamento delle persone', e)
    } finally {
      if (this.event().id === eventId) this.personsLoading.set(false)
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit()
  }
}
