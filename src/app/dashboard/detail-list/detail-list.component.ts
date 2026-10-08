import { Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common'
import { Schema } from '../../../../amplify/data/resource';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component'

type Event = Schema['Event']['type']

@Component({
  selector: 'app-event-list',
  imports: [DatePipe, DecimalPipe, TickbarComponent],
  templateUrl: './detail-list.component.html',
  styleUrl: './detail-list.component.css',
})
export class EventListComponent {

  items = input<Event[]>([])

  facts = computed(() => this.items().map(item => item.type === "Fatto"))
  documents = computed(() => this.items().map(item => ["Sentenza", "Indagine"].includes(item.type)))
  communications = computed(() => this.items().map(item => ["Comunicazione", "Intercettazione"].includes(item.type)))
}
