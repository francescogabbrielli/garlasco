import { Component, DestroyRef, ElementRef, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common'
import { Schema } from '../../../../amplify/data/resource';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component'

type Event = Schema['Event']['type']

class EventLine {
  date: Date | null = null
  facts: Event[] = []
  documents: Event[] = []
  communications: Event[] = []
  constructor(date: Date | null = null) {
    this.date = date
  }
  isEmpty() {
    return !this.facts.length && !this.documents.length && !this.communications.length
  }
}

@Component({
  selector: 'app-event-list',
  imports: [DatePipe, TickbarComponent],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css',
})
export class EventListComponent {

  private host = inject<ElementRef<HTMLElement>>(ElementRef)

  items = input<Event[]>([])
  highlightedId = input<string | null>(null)
  hasMore = input<boolean>(false)
  scrolledToBottom = output<void>()
  eventHover = output<string | null>()
  eventClick = output<Event>()

  // accumulator shows a single line for each fact, compressing communications and documents into the same line
  displayedItems = computed(() => this.items().reduce((acc, item, i, arr) => {
    let currentLine = acc[acc.length - 1]

    if (!currentLine.date) currentLine.date = new Date(item.startDate)
    else if (currentLine.date.toDateString() !== new Date(item.startDate).toDateString()) {
      currentLine = new EventLine(new Date(item.startDate))
      acc.push(currentLine)
    }
    
    if (item.type === "Fatto") currentLine.facts.push(item)
    else if (["Sentenza", "Indagine", "Testimonianza"].includes(item.type)) currentLine.documents.push(item)
    else if (["Comunicazione", "Intercettazione"].includes(item.type)) currentLine.communications.push(item)
    if (arr.length - 1 === i && currentLine.isEmpty()) acc.splice(acc.length - 1, 1)
    
    return acc

  }, [new EventLine()] as EventLine[]))

  // On narrow screens the list is full height and an outer container/page scrolls instead:
  // detect when the end of the list reaches the bottom of the viewport.
  private onOuterScroll = (event: globalThis.Event) => {
    const list = this.host.nativeElement.querySelector('.event-list') as HTMLElement | null
    if (!list || event.target === list || list.scrollHeight > list.clientHeight + 1)
      return
    if (list.getBoundingClientRect().bottom - window.innerHeight <= 50)
      this.scrolledToBottom.emit()
  }

  constructor() {
    document.addEventListener('scroll', this.onOuterScroll, true)
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', this.onOuterScroll, true))
  }

  onListScroll(event: globalThis.Event): void {
    const list = event.target as HTMLElement | null
    if (list && list.scrollHeight - list.scrollTop - list.clientHeight <= 50) {
      this.scrolledToBottom.emit()
    }
  }

  onClick(e: globalThis.Event, event: Event): void {
    e.stopPropagation()
    this.eventClick.emit(event)
  }

}
