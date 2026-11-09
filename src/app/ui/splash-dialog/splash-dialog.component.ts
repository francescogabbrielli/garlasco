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
  private settleShow?: { resolve: () => void; reject: (reason?: unknown) => void }

  async show(text: string | null = null): Promise<void> {
    this.message.set(text || this.defaultMessage())
    this.dialog.nativeElement.showModal()
    const duration = this.durationSeconds()
    return new Promise<void>((resolve, reject) => {
      this.settleShow = { resolve, reject }
      if (Number.isFinite(duration) && duration > 0) {
        this.closeTimer = setTimeout(() => this.close(true), duration * 1000)
      }
    })
  }

  ngOnDestroy(): void {
    if (this.closeTimer !== undefined) clearTimeout(this.closeTimer)
  }

  onCancel(event: Event): void {
    event.preventDefault()
    this.dismiss()
  }

  dismiss(): void {
    this.close(false)
  }

  private close(automatically: boolean): void {
    if (!this.dialog.nativeElement.open) return
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer)
      this.closeTimer = undefined
    }
    this.dialog.nativeElement.close()
    this.closed.emit()
    const settleShow = this.settleShow
    this.settleShow = undefined
    settleShow?.resolve()
  }

}
