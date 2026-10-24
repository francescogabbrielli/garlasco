import { Component, computed, input, OnInit, output, signal } from '@angular/core';

import { PersonMarkerComponent } from '../../ui/person-marker/person-marker.component';
import { Schema } from '../../../../amplify/data/resource';

import { PERSON_TYPES } from '../../../../amplify/data/enums';

type Person = Schema['Person']['type']

@Component({
  selector: 'app-person-filter',
  imports: [PersonMarkerComponent],
  templateUrl: './person-filter.component.html',
  styleUrl: './person-filter.component.css',
})
export class PersonFilterComponent implements OnInit {
  people = input<Person[]>([])
  loading = input(false)
  error = input('')
  selectedIds = input<string[]>([])
  selectionChange = output<string[]>()

  personTypes = PERSON_TYPES
  selectedTypes = signal<number[]>([])
  showTypes = signal(false)
  filteredPeople = computed(() => this.people().filter(person => this.selectedTypes().includes(this.personTypes.indexOf(person.type))))
  selectedPeople = computed(() => this.people().filter(p => this.selectedIds().includes(p.id)))

  ngOnInit(): void {
    this.selectedTypes.set(JSON.parse(localStorage.getItem('personFilter.selectedTypes') || '[0, 4]'))
  }

  toggle(personId: string): void {
    this.selectionChange.emit(
      this.selectedIds().includes(personId)
        ? this.selectedIds().filter((id) => id !== personId)
        : [...this.selectedIds(), personId],
    )
  }

  selectType(index: number): void {
    this.selectedTypes.set(
      this.selectedTypes().includes(index)
        ? this.selectedTypes().filter(i => i !== index)
        : [...this.selectedTypes(), index]
    )
    localStorage.setItem('personFilter.selectedTypes', JSON.stringify(this.selectedTypes()))
  }

  clear(): void {
    this.selectionChange.emit([])
  }

}
