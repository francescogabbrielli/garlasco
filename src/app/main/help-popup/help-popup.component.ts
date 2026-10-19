import { Component, effect, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-help-popup',
  imports: [],
  templateUrl: './help-popup.component.html',
  styleUrl: './help-popup.component.css',
})
export class HelpPopupComponent {

  private http = inject(HttpClient)
  
  page = input.required<string>()
  title = input.required<string>()
  content = signal<string>('')

  isLoading = signal(false)

  close = output<void>()

  constructor() {
    effect((onCleanup) => {
      const page = this.page()
      if (!page) {
        this.content.set('')
        return
      }

      this.isLoading.set(true)
      const sub = this.http
        .get(`assets/help/${page}.txt`, { responseType: 'text' })
        .subscribe({
          next: html => {
            this.content.set(html)
            this.isLoading.set(false)
          },
          error: () => {
            this.content.set('<p>Help not available.</p>')
            this.isLoading.set(false)
          }
        })
      onCleanup(() => sub.unsubscribe())
    })
  }
}
