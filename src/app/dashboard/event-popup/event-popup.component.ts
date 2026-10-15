import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../../../amplify/data/resource';
import { UserProfileService } from '../../user-profile.service';
import { EventMaskComponent } from '../event-mask/event-mask.component';
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

  readonly submitError = signal('')

  event = input.required<Event>()
  closed = output<void>()
  saved = output<void>()
  help = false
  maskTouched = false

  isEditor = computed(() => {
    const edit = this.userService.user().editEnabled()
    const isOwner = this.userService.user().isEditor() && this.userService.user().getId() === this.event().owner
    const isNew = !this.event().id
    return edit && (isOwner || isNew)
  })
  
  people = input.required<Person[]>()

  actors = signal<Person[]>([])
  personsLoading = signal(false)

  constructor() {
    effect(() => {
      const id = this.event().id
      this.loadPersons(id)
    })
  }

  private async loadPersons(eventId: string): Promise<void> {
    this.actors.set([])
    this.personsLoading.set(true)
    try {
      const { data } = await client.models.Event.get(
        { id: eventId },
        { selectionSet: ['id', 'actors.person.*'] }
      )
      if (this.event().id !== eventId) return
      this.actors.set(
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
    this.close()
  }

  close() {
    //TODO: maskTouched is not the best option, put another one
    if (!this.maskTouched || confirm('Sei sicuro di voler chiudere? Potrebbero esserci modifiche non salvate.'))
      this.closed.emit()
  }

}
