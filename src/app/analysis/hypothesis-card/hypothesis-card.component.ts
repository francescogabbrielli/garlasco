import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataService, type HypothesisActor } from '../../data.service';
import type { Schema } from '../../../../amplify/data/resource';

type Hypothesis = Schema['Hypothesis']['type']
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
  people = input<Person[]>([])
  selected = input(false)
  clicked = output<void>()

  readonly actors = signal<HypothesisActor[]>([])
  readonly loading = signal(true)

  ngOnInit(): void {
    this.loadActors()
  }

  private async loadActors(): Promise<void> {
    const id = this.hypothesis().id
    if (!id) {
      this.loading.set(false)
      return
    }
    try {
      // this.actors.set(await this.hypothesis.actors())
    } catch {
      // silently fail — actors just won't show
    } finally {
      this.loading.set(false)
    }
  }

  actorLabel(actor: HypothesisActor): string {
    const person = this.people().find(p => p.id === actor.personId)
    if (!person) return actor.personId
    return `${person.name} ${person.surname}`
  }

}
