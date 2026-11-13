import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Schema } from '../../../amplify/data/resource';

import { UserProfileService } from '../user-profile.service';
import { DataService } from '../data.service';
import { EscapeStack } from '../escape-stack.service';

import { MainComponent } from '../main/main.component';
import { PersonCaseEvent } from '../forms/case-mask/case-mask.component';

import { HypothesisMaskComponent } from './hypothesis-mask/hypothesis-mask.component';
import { HypothesisListComponent } from './hypothesis-list/hypothesis-list.component';

type Hypothesis = Schema['Hypothesis']['type']
type Person = Schema['Person']['type']
type Event = Schema['Event']['type']

@Component({
  selector: 'app-analysis',
  imports: [HypothesisListComponent, HypothesisMaskComponent],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css',
})
export class AnalysisComponent implements OnInit, OnDestroy {

  private readonly PEOPLE_SORTER = (a: Person, b: Person) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name)

  userService = inject(UserProfileService)
  dataService = inject(DataService)
  escapeStack = inject(EscapeStack)
  main = inject(MainComponent)

  people = signal<Person[]>([])
  coldCases = signal<Event[]>([])
  selectedEvent = signal<Event | null>(null)

  isEditing = computed(() => this.userService.user().editEnabled())

  selectedHypothesis = signal<Hypothesis | null>(null)

  readonly popupStatus = {
    open: signal(false),
    touched: signal(false),
    error: signal(''),
    toggle: (visible: boolean) => {
      this.popupStatus.touched.set(false)
      this.popupStatus.error.set('')
      this.popupStatus.open.set(visible)
    }
  }

  private offEscape?: () => void

  async ngOnInit(): Promise<void> {
    this.loadPeople()
    this.loadColdCases()
  }

  private async loadColdCases(): Promise<void> {
    try {
      const events = await this.dataService.loadColdCaseEvents()
      this.coldCases.set(events)
      this.selectedEvent.set(events[0] ?? null)
    } catch (e) {
      console.error('Impossibile caricare i casi freddi.', e)
    }
  }

  selectEvent(event: globalThis.Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return
    const target = event.target as HTMLSelectElement
    const selectedEvent = this.coldCases().find(item => item.id === target?.value) ?? null
    this.selectedEvent.set(selectedEvent)
  }

  private async loadPeople(): Promise<void> {
    try {
      const peps = await this.dataService.loadPersons()
      this.people.set(peps.sort(this.PEOPLE_SORTER) ?? [])
    } catch (e) {
      console.error('Impossibile caricare le persone.', e)
    }
  }  

  /** Refresh person's list if a person has been created, updated, or deleted */
  update(event: PersonCaseEvent) {
    this.popupStatus.touched.set(false)
    if (event && event.personSaved.length) {
      this.people.update((list: Person[]) => {
        const savedMap = new Map(event.personSaved.map(p => [p.id, p]))
        return [
          ...list.map(p => savedMap.get(p.id) || p),
          ...event.personSaved.filter(p => !list.some(b => b.id === p.id)),
        ].sort(this.PEOPLE_SORTER)
      })
    }
    if (event && event.personDeleted?.length) {
      this.people.update((list: Person[]) => list.filter(p => !event.personDeleted.includes(p.id)))
    }
    this.loadColdCases()
  }

  createNewHypothesis() {
    this.openPopup()
  }

  openPopup(edit: Hypothesis | null = null) {
    if (this.popupStatus.open())
      return
    if (edit)
      this.selectedHypothesis.set(edit)
    if (this.isEditing()) {
      this.offEscape = this.escapeStack.push(() => this.closePopup())
      console.log("OPEN", this.escapeStack.toString())
      this.popupStatus.toggle(true)
    }
  }

  closePopup() {
    if (!this.popupStatus.touched() || confirm('Sei sicuro di voler chiudere? Potrebbero esserci modifiche non salvate.')) {
      this.offEscape?.()
      this.popupStatus.toggle(false)
    }
  }

  ngOnDestroy() {
    this.offEscape?.()
  }

}
