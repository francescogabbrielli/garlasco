import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-analysis',
  imports: [HypothesisListComponent, HypothesisMaskComponent],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css',
})
export class AnalysisComponent implements OnInit {

  private readonly PEOPLE_SORTER = (a: Person, b: Person) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name)

  userService = inject(UserProfileService)
  dataService = inject(DataService)
  escapeStack = inject(EscapeStack)
  main = inject(MainComponent)

  people = signal<Person[]>([])

  isEditing = computed(() => this.userService.user().editEnabled())

  selectedHypothesis = signal<Hypothesis | null>(null)

  readonly popupStatus = {
    open: signal(false),
    touched: signal(false),
    error: signal('')
  }

  isPopupOpen = signal(false)
  popupMaskTouched = signal(false)
  popupError = signal('')

  private offEscape?: () => void

  async ngOnInit(): Promise<void> {
    this.loadPeople()
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
  updatePeople(event: PersonCaseEvent) {
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
  }

  createNewHypothesis() {
    this.openPopup()
  }

  openPopup() {
    this.offEscape = this.escapeStack.push(() => this.closePopup())
    this.isPopupOpen.set(true)
  }

  closePopup() {
    this.offEscape?.()
    this.isPopupOpen.set(false)
  }

}
