import { Component, input, output } from '@angular/core';

import { PersonMarkerComponent } from '../../ui/person-marker/person-marker.component';
import { Schema } from '../../../../amplify/data/resource';

type Person = Schema['Person']['type']

@Component({
  selector: 'app-person-filter',
  imports: [PersonMarkerComponent],
  templateUrl: './person-filter.component.html',
  styleUrl: './person-filter.component.css',
})
export class PersonFilterComponent {
  people = input<Person[]>([])
  loading = input(false)
  error = input('')
  selectedIds = input<string[]>([])
  selectionChange = output<string[]>()

  toggle(personId: string): void {
    this.selectionChange.emit(
      this.selectedIds().includes(personId)
        ? this.selectedIds().filter((id) => id !== personId)
        : [...this.selectedIds(), personId],
    )
  }

  clear(): void {
    this.selectionChange.emit([])
  }
}
