import { Component, inject, input, model, OnInit, signal } from '@angular/core';
import { DataService } from '../../data.service';

import { Schema } from '../../../../amplify/data/resource';
import { Hypothesis } from '../../../../amplify/data/models';
import { HypothesisCardComponent } from '../hypothesis-card/hypothesis-card.component';

type Hypothesis = Schema['Hypothesis']['type']
type Person = Schema['Person']['type']

@Component({
  selector: 'app-hypothesis-list',
  imports: [HypothesisCardComponent],
  templateUrl: './hypothesis-list.component.html',
  styleUrl: './hypothesis-list.component.css',
})
export class HypothesisListComponent implements OnInit {

  dataService = inject(DataService)

  people = input.required<Person[]>()
  selectedItem = model<Hypothesis | null>(null)

  list = signal<Hypothesis[]>([])

  async ngOnInit(): Promise<void> {
    this.list.set(await this.dataService.loadHypotheses())
  }

}
