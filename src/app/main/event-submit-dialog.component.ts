import { Component, OnInit, inject, output, signal } from '@angular/core'
import { generateClient } from 'aws-amplify/data'

import type { Schema } from '../../../amplify/data/resource'
import { EventMaskComponent } from '../ui/event-mask/event-mask.component'

type PersonRecord = Schema['Person']['type']

@Component({
  selector: 'app-event-submit-dialog',
  imports: [EventMaskComponent],
  templateUrl: './event-submit-dialog.component.html',
})
export class EventSubmitDialogComponent implements OnInit {

  closed = output<void>()

  readonly people = signal<PersonRecord[]>([])
  readonly peopleLoading = signal(true)
  readonly peopleLoadError = signal('')
  readonly isHelpDialogOpen = signal(false)

  public createClient(): ReturnType<typeof generateClient<Schema>> {
    return generateClient<Schema>()
  }

  async ngOnInit(): Promise<void> {
    try {
      const { data, errors } = await this.createClient().models.Person.list()
      if (errors?.length) {
        throw new Error(errors[0].message)
      }
      this.people.set((data ?? []).sort((a, b) =>
        a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name),
      ))
    } catch (error) {
      this.peopleLoadError.set(error instanceof Error
        ? `Impossibile caricare le persone: ${error.message}`
        : 'Impossibile caricare le persone.')
    } finally {
      this.peopleLoading.set(false)
    }
  }

  closeDialog(): void {
    this.closed.emit()
  }
}
