import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common'
import { Schema } from '../../../../amplify/data/resource';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component'

type Event = Schema['Event']['type']

class EventLine {
  fact?: Event
  documents: Event[]
  communications: Event[]
  constructor() {
    this.documents = []
    this.communications = []
  }
  isEmpty() {
    return !this.fact && !this.documents.length && !this.communications.length
  }
}

@Component({
  selector: 'app-event-list',
  imports: [DatePipe, TickbarComponent],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css',
})
export class EventListComponent {

  items = input<Event[]>([])
  highlightedId = input<string | null>(null)
  scrolledToBottom = output<void>()
  eventHover = output<string | null>()
  eventClick = output<Event>()

  // accumulator shows a single line for each fact, compressing communications and documents into the same line
  displayedItems = computed(() => this.items().reduce((acc, item, i, arr) => {
    const currentLine = acc[acc.length - 1]
    
    if (item.type === "Fatto") {
      currentLine.fact = item
      acc.push(new EventLine())
    }
    else if (["Sentenza", "Indagine"].includes(item.type)) currentLine.documents.push(item)
    else if (["Comunicazione", "Intercettazione"].includes(item.type)) currentLine.communications.push(item)
    if (arr.length - 1 === i && currentLine.isEmpty()) acc.splice(acc.length - 1, 1)
    
    return acc

  }, [new EventLine()] as EventLine[]))

  onListScroll(event: globalThis.Event): void {
    const list = event.target as HTMLElement | null
    if (list && list.scrollHeight - list.scrollTop - list.clientHeight <= 50) {
      console.log('Scrolled to bottom!')
      this.scrolledToBottom.emit()
    }
  }
}
