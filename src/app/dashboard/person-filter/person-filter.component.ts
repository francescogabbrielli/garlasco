import { Component, input, output } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>()

type Person = Schema['Person']['type']

@Component({
  selector: 'app-person-filter',
  imports: [],
  templateUrl: './person-filter.component.html',
  styleUrl: './person-filter.component.css',
})
export class PersonFilterComponent {
  selectedIds = input<string[]>([])
  selectionChange = output<string[]>()

  people: Person[] = []
  loading = true
  error = ''

  async ngOnInit(): Promise<void> {
    try {
      const response = await client.models.Person.list()
      this.people = response.data ?? []
    } catch {
      this.error = 'Impossibile caricare le persone.'
    } finally {
      this.loading = false
    }
  }

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
