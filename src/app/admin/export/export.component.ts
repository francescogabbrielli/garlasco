import { Component } from '@angular/core';
import { generateClient } from 'aws-amplify/data'

import type { Schema } from '../../../../amplify/data/resource'

const client = generateClient<Schema>()

type Event = Schema['Event']['type']
type Person = Schema['Person']['type']

@Component({
  selector: 'app-export',
  imports: [],
  templateUrl: './export.component.html',
  styleUrl: './export.component.css',
})
export class ExportComponent {

  async exportPeople(): Promise<void> {
    try {
      const people: Person[] = []
      let nextToken: string | null | undefined
      do {
        const { data, errors, nextToken: token } = await client.models.Person.list({ nextToken })
        if (errors?.length) {
          throw new Error(errors.map((error) => error.message).join(', '))
        }
        people.push(...data)
        nextToken = token
      } while (nextToken)

      const records = people.map((person) => ({
        id: person.id,
        name: person.name,
        surname: person.surname,
        type: person.type,
        initials: person.initials,
        ...(person.profession ? { profession: person.profession } : {}),
      }))

      this.download(records, 'people.json')
    } catch (error) {
      console.error('Errore durante l\'esportazione delle persone:', error)
      alert('Errore durante l\'esportazione delle persone.')
    }
  }

  private async getActorsByEvent():Promise<Map<string, { personId: string, role: string }[]>> {
      const actorsByEvent = new Map<string, { personId: string, role: string }[]>()
      let nextToken: string | null | undefined
      do {
        const { data, errors, nextToken: token } = await client.models.EventPerson.list({ nextToken })
        if (errors?.length) {
          throw new Error(errors.map((error) => error.message).join(', '))
        }
        for (const { eventId, personId, role } of data) {
          const actors = actorsByEvent.get(eventId) ?? []
          actors.push({ personId: personId, role: role })
          actorsByEvent.set(eventId, actors)
        }
        nextToken = token
      } while (nextToken)
      return actorsByEvent
  }

  private async getEvents(): Promise<Event[]> {
      const events: Event[] = []
      let nextToken: string | null | undefined
      do {
        const { data, errors, nextToken: token } = await client.models.Event.list({ nextToken })
        if (errors?.length) {
          throw new Error(errors.map((error) => error.message).join(', '))
        }
        events.push(...data)
        nextToken = token
      } while (nextToken)
      return events
  }

  async exportEvents(): Promise<void> {
    try {
      const actorsByEvent = await this.getActorsByEvent()
      const records = (await this.getEvents()).map((event) => ({
        ...(event.id ? { id: event.id } : {}),
        name: event.name,
        type: event.type,
        description: event.description,
        start_date: event.start_date,
        start_position: event.start_position,
        ...(event.end_date ? { end_date: event.end_date } : {}),
        ...(event.end_position ? { end_position: event.end_position } : {}),
        relevance: event.relevance,
        reliability: event.reliability,
        actors: actorsByEvent.get(event.id) ?? [],
      }))

      this.download(records, 'events.json')
    } catch (error) {
      console.error('Errore durante l\'esportazione degli eventi:', error)
      alert('Errore durante l\'esportazione degli eventi.')
    }
  }

  private download(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

}
