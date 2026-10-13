import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, effect, inject, input, output, signal, untracked } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../../../amplify/data/resource';
import { UserProfileService } from '../../user-profile.service';
import { EventMaskComponent } from '../../ui/event-mask/event-mask.component';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component';
import { PersonMarkerComponent } from '../../ui/person-marker/person-marker.component';

type Event = Schema['Event']['type']
type Person = Schema['Person']['type']

const client = generateClient<Schema>();

@Component({
  selector: 'app-event-popup',
  imports: [DatePipe, DecimalPipe, TickbarComponent, PersonMarkerComponent, EventMaskComponent],
  templateUrl: './event-popup.component.html',
  styleUrl: './event-popup.component.css',
})
export class EventPopupComponent {

  private userService = inject(UserProfileService)

  event = input.required<Event>()
  closed = output<void>()
  help = false

  isEditor = () => this.userService.user().isEditor() && this.userService.user().editEnabled()
  allPeople = signal<Person[]>([])

  people = signal<Person[]>([])
  personsLoading = signal(false)

  constructor() {
    effect(() => {
      if (this.isEditor() && this.allPeople().length === 0) untracked(() => this.loadAllPeople())
    })
    effect(() => {
      const id = this.event().id
      this.loadPersons(id)
    })
  }

  private async loadAllPeople(): Promise<void> {
    try {
      const { data } = await client.models.Person.list()
      this.allPeople.set(data.sort((a, b) =>
        `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)))
    } catch (e) {
      console.error('Errore nel caricamento delle persone', e)
    }
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
