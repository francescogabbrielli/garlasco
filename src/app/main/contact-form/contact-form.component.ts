import { Component, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserProfileService, UserData } from '../../user-profile.service';
import { EscapeStack } from '../../escape-stack.service';

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.css',
})
export class ContactFormComponent implements OnInit, OnDestroy {

  private readonly userService = inject(UserProfileService)

  private readonly escapeStack = inject(EscapeStack)

  user = input<UserData>()

  close = output<void>()

  isSending = signal(false)
  sendError = signal('')
  sent = output<void>()

  readonly reasons = ['Richiesta informazioni', 'Richiesta accesso', 'Segnalazione problema', 'Altro']

  readonly contactForm = new FormGroup({
      reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      message: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  })

  async submitEvent(): Promise<void> {

    const user = this.user()
    if (!user || this.userService.user().getId() !== user.getId()) {
      this.sendError.set('Utente non autorizzato a inviare il form!')
      return
    }

    if (this.contactForm.invalid) {
      this.sendError.set('Completa tutti i campi obbligatori prima di inviare il form.')
      return
    }

    this.sendError.set('')
    this.isSending.set(true)

    try {

      const formValues = this.contactForm.getRawValue()
      const { data, errors } = await this.userService.sendAdminEmail(formValues.reason, formValues.message)

      if (!data || errors?.[0]) {
        // DEBUG: console.error('Error sending email:', errors)
        const message = errors?.[0]?.message ?? 'Errore durante l’invio del form (nessun dettaglio disponibile)'
        throw new Error(message)
      }

      this.sent.emit()
      // DEBUG: console.log('Email sent successfully:', data)

    } catch (error) {

      const message = 'Errore server durante l’invio del form [' + (error instanceof Error ? error.message : 'errore sconosciuto') + ']'
      this.sendError.set(message)
      // DEBUG: console.error('Error caught in submitEvent:', error)

    } finally {
      this.isSending.set(false)
    }
  }

  private offEscape?: () => void

  ngOnInit(): void {
    this.offEscape = this.escapeStack.push(() => this.close.emit())
  }

  ngOnDestroy(): void {
    this.offEscape?.()
  }

}
