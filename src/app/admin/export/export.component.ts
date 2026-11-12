import { Component, model, signal, ViewChild } from '@angular/core';
import { generateClient } from 'aws-amplify/data'

import type { Schema } from '../../../../amplify/data/resource'

import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';

const client = generateClient<Schema>()

type Event = Schema['Event']['type']
type Person = Schema['Person']['type']
type Hypothesis = Schema['Hypothesis']['type']

export function toHypothesisExportRecords(
  hypotheses: Hypothesis[],
  actorsByHypothesis: ReadonlyMap<string, { personId: string; role: string }[]>
) {
  return hypotheses.map(hypothesis => ({
    id: hypothesis.id,
    owner: hypothesis.owner,
    name: hypothesis.name,
    description: hypothesis.description,
    startDate: hypothesis.startDate,
    endDate: hypothesis.endDate,
    startPosition: hypothesis.startPosition,
    endPosition: hypothesis.endPosition,
    sources: hypothesis.sources,
    eventId: hypothesis.eventId,
    eventName: hypothesis.eventName,
    eventRelevance: hypothesis.eventRelevance,
    actors: actorsByHypothesis.get(hypothesis.id) ?? []
  }));
}

@Component({
  selector: 'app-export',
  imports: [SplashDialogComponent],
  templateUrl: './export.component.html',
  styleUrl: './export.component.css',
})
export class ExportComponent {

  exported = signal([false, false, false])

  isWorking = model(false)

  @ViewChild('exportSplash')
  splash!: SplashDialogComponent

  async exportPeople(): Promise<void> {
    this.isWorking.set(true);
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
      this.exported.set([true, this.exported()[1], this.exported()[2]])
      
    } catch (error) {

      console.error('Errore durante l\'esportazione delle persone:', error)
      this.splash.show('❌ Errore durante l\'esportazione delle persone.')

    } finally {
      this.isWorking.set(false);
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

  private async getHypothesisActors(): Promise<Map<string, { personId: string; role: string }[]>> {
    const actorsByHypothesis = new Map<string, { personId: string; role: string }[]>();
    let nextToken: string | null | undefined;
    do {
      const { data, errors, nextToken: token } = await client.models.HypothesisPerson.list({ nextToken });
      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join(', '));
      }
      for (const { hypothesisId, personId, role } of data) {
        const actors = actorsByHypothesis.get(hypothesisId) ?? [];
        actors.push({ personId, role });
        actorsByHypothesis.set(hypothesisId, actors);
      }
      nextToken = token;
    } while (nextToken);
    return actorsByHypothesis;
  }

  private async getHypotheses(): Promise<Hypothesis[]> {
    const hypotheses: Hypothesis[] = [];
    let nextToken: string | null | undefined;
    do {
      const { data, errors, nextToken: token } = await client.models.Hypothesis.list({ nextToken });
      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join(', '));
      }
      hypotheses.push(...data);
      nextToken = token;
    } while (nextToken);
    return hypotheses;
  }

  async exportHypotheses(): Promise<void> {
    this.isWorking.set(true);
    try {
      const actorsByHypothesis = await this.getHypothesisActors();
      const records = toHypothesisExportRecords(await this.getHypotheses(), actorsByHypothesis);

      this.download(records, 'hypotheses.json');
      this.exported.set([this.exported()[0], this.exported()[1], true]);
    } catch (error) {
      console.error('Errore durante l’esportazione delle ipotesi:', error);
      this.splash.show('❌ Errore durante l’esportazione delle ipotesi.');
    } finally {
      this.isWorking.set(false);
    }
  }

  async exportEvents(): Promise<void> {
    this.isWorking.set(true);
    try {
      const actorsByEvent = await this.getActorsByEvent()
      const records = (await this.getEvents()).map((event) => ({
        ...(event.id ? { id: event.id } : {}),
        owner: event.owner,
        name: event.name,
        type: event.type,
        description: event.description,
        startDate: event.startDate,
        startPosition: event.startPosition,
        ...(event.endDate ? { endDate: event.endDate } : {}),
        ...(event.endPosition ? { endPosition: event.endPosition } : {}),
        actors: actorsByEvent.get(event.id) ?? [],
        sources: event.sources,
        relevance: event.relevance,
        reliability: event.reliability,
      }))

      this.download(records, 'events.json')
      this.exported.set([this.exported()[0], true, this.exported()[2]])
    } catch (error) {
      console.error('Errore durante l\'esportazione degli eventi:', error)
      this.splash.show('❌ Errore durante l\'esportazione degli eventi.')
    } finally {
      this.isWorking.set(false);
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

  canDelete(): boolean {
    return !this.isWorking() && this.exported().every((value) => value)
  }

  async deleteAll(): Promise<void> {
    if (confirm('Tutto scaricato. Adesso cancelliamo i dati.')) {
      this.isWorking.set(true);
      try {
        await this.deleteAllFrom(client.models.HypothesisPerson)
        await this.deleteAllFrom(client.models.Hypothesis)
        await this.deleteAllFrom(client.models.EventPerson)
        await this.deleteAllFrom(client.models.Event)
        await this.deleteAllFrom(client.models.Person)      
        this.exported.set([false, false, false])
        this.splash.show('🎉 Cancellazione completata.')
      } catch (error) {
        console.error('Errore durante la cancellazione dei dati:', error)
        this.splash.show('❌ Errore durante la cancellazione dei dati.')
      } finally {
        this.isWorking.set(false);
      }
    }
  }

  private async deleteAllFrom(model: any): Promise<void> {
    const{ data: items } = await model.list()
      await Promise.all(
        items.map((item:any) => model.delete({ id: item.id }))
      );
  }

}
