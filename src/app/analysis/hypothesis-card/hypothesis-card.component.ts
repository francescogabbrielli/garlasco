import { Component, inject, input, OnInit, computed, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataService } from '../../data.service';
import type { Schema } from '../../../../amplify/data/resource';

type Hypothesis = Schema['Hypothesis']['type']
type HypothesisPerson = Schema['HypothesisPerson']['type']
type Person = Schema['Person']['type']

@Component({
  selector: 'app-hypothesis-card',
  imports: [DatePipe],
  templateUrl: './hypothesis-card.component.html',
  styleUrl: './hypothesis-card.component.css',
})
export class HypothesisCardComponent implements OnInit {

  private dataService = inject(DataService)

  hypothesis = input.required<Hypothesis>()
  people = input.required<Person[]>()
  selected = input(false)
  clicked = output<void>()
  
  readonly loadedActors = signal<HypothesisPerson[]>([])
  readonly actors = computed(() => this.people().filter(p => this.loadedActors().some(a => a.personId === p.id)))

  ngOnInit(): void {
    this.loadActors()
  }

  private async loadActors(): Promise<void> {
    try {
      this.loadedActors.set(
        await this.dataService.loadHypothesisActors(this.hypothesis()))
    } catch (e) {
      console.error('Errore nel caricmento degli attori', e)
    }
  }

}
