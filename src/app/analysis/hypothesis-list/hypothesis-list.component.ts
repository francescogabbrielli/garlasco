import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { DataService } from '../../data.service';

import { Schema } from '../../../../amplify/data/resource';
import { Hypothesis } from '../../../../amplify/data/models';
import { HypothesisCardComponent } from '../hypothesis-card/hypothesis-card.component';

type Hypothesis = Schema['Hypothesis']['type']
type Event = Schema['Event']['type']
type Person = Schema['Person']['type']

@Component({
  selector: 'app-hypothesis-list',
  imports: [HypothesisCardComponent],
  templateUrl: './hypothesis-list.component.html',
  styleUrl: './hypothesis-list.component.css',
})
export class HypothesisListComponent {

  dataService = inject(DataService)

  event = input.required<Event>()
  people = input.required<Person[]>()
  selected = output<Hypothesis>()
  selectedItem = model<Hypothesis | null>(null)

  list = signal<Hypothesis[]>([])

  private loadVersion = 0

  constructor() {
    effect(() => {
      const eventId = this.event()?.id
      const version = ++this.loadVersion
      if (!eventId) {
        this.list.set([])
        return
      }

      this.dataService.loadHypotheses(eventId).then(hypotheses => {
        if (version === this.loadVersion) this.list.set(hypotheses)
      }).catch(error => {
        if (version === this.loadVersion) {
          console.error('Impossibile caricare le ipotesi per il caso selezionato.', error)
        }
      })
    })
  }

}
