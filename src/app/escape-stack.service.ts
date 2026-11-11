import { Injectable } from '@angular/core'

/**
 * Single source of truth for ESC handling across stacked popups.
 *
 * Previously every popup registered its own `@HostListener('document:keydown.escape')`,
 * i.e. a separate listener on the shared `document` element. One ESC keydown made ALL
 * of them fire (in registration order: shell first, inner popups last), so closing the
 * innermost popup also closed every parent.
 *
 * With this service each popup pushes its handler when it opens and pops it when it
 * closes. On ESC only the topmost (last opened) handler runs, so inner popups win and
 * parents stay open.
 */
@Injectable({ providedIn: 'root' })
export class EscapeStack {
  private readonly stack: Array<() => void> = []

  constructor() {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.stack.at(-1)?.()
    })
  }

  /**
   * Register an ESC handler for the active popup.
   * @returns an unsubscribe function to call when the popup closes.
   */
  push(handler: () => void): () => void {
    this.stack.push(handler)
    return () => {
      const i = this.stack.lastIndexOf(handler)
      if (i !== -1) this.stack.splice(i, 1)
    }
  }

  isEmpty(): boolean {
    return this.stack.length === 0
  }

  toString(): string {
    return "" + this.stack
  }
}
