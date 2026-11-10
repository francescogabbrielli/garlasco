import { Component, inject, OnInit, signal } from '@angular/core';
import { DataService } from '../../data.service';

import { Schema } from '../../../../amplify/data/resource';
import { Hypothesis } from '../../../../amplify/data/models';

type Hypothesis = Schema['Hypothesis']['type']

@Component({
  selector: 'app-hypothesis-list',
  imports: [],
  templateUrl: './hypothesis-list.component.html',
  styleUrl: './hypothesis-list.component.css',
})
export class HypothesisListComponent implements OnInit {

  dataService = inject(DataService)

  list = signal<Hypothesis[]>([])

  async ngOnInit(): Promise<void> {
    this.list.set(await this.dataService.loadHypotheses())
  }

}
