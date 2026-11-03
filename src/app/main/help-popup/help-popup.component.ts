import { Component, effect, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

import { EscapeStack } from '../../escape-stack.service';

@Component({
  selector: 'app-help-popup',
  imports: [],
  templateUrl: './help-popup.component.html',
  styleUrl: './help-popup.component.css',
})
export class HelpPopupComponent implements OnInit, OnDestroy {

  private http = inject(HttpClient)
  private escapeStack = inject(EscapeStack)
  private domSanitizer = inject(DomSanitizer)
  private offEscape?: () => void

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
            this.content.set(this.domSanitizer.bypassSecurityTrustHtml(html) as string)
            this.isLoading.set(false)
          },
          error: (err) => {
            this.content.set(`<p>Aiuto non disponibile (${err.message}).</p>`)
            this.isLoading.set(false)
          }
        })
      onCleanup(() => sub.unsubscribe())
    })
  }

  ngOnInit(): void {
    this.offEscape = this.escapeStack.push(() => this.close.emit())
  }

  ngOnDestroy(): void {
    this.offEscape?.()
  }
}
