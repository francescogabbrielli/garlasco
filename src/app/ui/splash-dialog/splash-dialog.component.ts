import { Component, ElementRef, OnDestroy, input, output, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'app-splash-dialog',
  templateUrl: './splash-dialog.component.html',
  styleUrl: './splash-dialog.component.css',
})
export class SplashDialogComponent implements OnDestroy {

  @ViewChild('dialog', { static: true })
  private dialog!: ElementRef<HTMLDialogElement>

  defaultMessage = input.required<string>()
  durationSeconds = input(2)
  showCloseButton = input(false)
  closed = output<void>()

  message = signal<string | null>(null)

  private closeTimer?: ReturnType<typeof setTimeout>

  show(text: string | null = null): void {
    this.message.set(text || this.defaultMessage())
    this.dialog.nativeElement.showModal()
    const duration = this.durationSeconds()
    if (Number.isFinite(duration) && duration > 0) {
      this.closeTimer = setTimeout(() => this.dismiss(), duration * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.closeTimer !== undefined) clearTimeout(this.closeTimer)
  }

  onCancel(event: Event): void {
    event.preventDefault()
    this.dismiss()
  }

  dismiss(): void {
    if (!this.dialog.nativeElement.open) return
    this.dialog.nativeElement.close()
    this.closed.emit()
  }

}
