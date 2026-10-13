import { Component, computed, input } from '@angular/core';

import { Schema } from '../../../../amplify/data/resource';

type Person = Schema['Person']['type']

@Component({
  selector: 'app-person-marker',
  templateUrl: './person-marker.component.html',
  styleUrl: './person-marker.component.css',
})
export class PersonMarkerComponent {
  person = input.required<Person>()
  selected = input(false)
  // Show the full name in a tooltip on hover
  tooltip = input(true)

  protected fullName = computed(() => `${this.person().name} ${this.person().surname}`)
}
