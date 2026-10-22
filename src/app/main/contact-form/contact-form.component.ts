import { Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Schema } from '../../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import { UserData } from '../../user-profile.service';

const client = generateClient<Schema>();

type EmailResponse = Schema['EmailResponse']['type']

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.css',
})
export class ContactFormComponent {

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
    if (!user)
      return

    if (this.contactForm.invalid) {
      this.sendError.set('Completa tutti i campi obbligatori prima di inviare il form.')
      return
    }

    this.sendError.set('')
    this.isSending.set(true)

    try {

      const { data, errors } = await client.queries.sendEmail({
        to: user.getEmail(),
        replyTo: "francescogabbrielli@gmail.com",
        subject: this.contactForm.value.reason ?? 'Errore: motivo vuoto',
        message: this.contactForm.value.message ?? 'Errore: messaggio vuoto'
      })

      this.sendError.set('')
      this.sent.emit()

      console.log('Email sent successfully:', data)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l’invio del form'
      console.error('Error sending email:', error)
      this.sendError.set(message)
    } finally {
      this.isSending.set(false)
    }    
  }

}
