import { Component, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { PERSON_TYPES } from '../../../../amplify/data/enums';
import type { Schema } from '../../../../amplify/data/resource';

import { EscapeStack } from '../../escape-stack.service';

type Person = Schema['Person']['type']

const client = generateClient<Schema>()

@Component({
  selector: 'app-person-popup',
  imports: [ReactiveFormsModule],
  templateUrl: './person-popup.component.html',
  styleUrl: './person-popup.component.css',
})
export class PersonDialogComponent implements OnInit, OnDestroy {

  private escapeStack = inject(EscapeStack)
  private offEscape?: () => void

  created = output<Person>()
  closed = output<void>()

  readonly personTypes = PERSON_TYPES
  readonly isSaving = signal(false)
  readonly error = signal('')

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    surname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<Person['type'] | null>(null, Validators.required),
    profession: new FormControl('', { nonNullable: true }),
    initials: new FormControl('', { nonNullable: false }),
  })

  ngOnInit(): void {
    this.offEscape = this.escapeStack.push(() => this.onEscape())
    Array.from(document.getElementsByTagName('input'))
      .forEach((el:HTMLInputElement) => el.hasAttribute('autofocus') && el.focus())
  }

  ngOnDestroy(): void {
    this.offEscape?.()
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.error.set('Compila tutti i campi obbligatori.')
      return
    }
    const { name, surname, type, profession, initials } = this.form.getRawValue()
    this.isSaving.set(true)
    this.error.set('')
    try {
      const { data, errors } = await client.models.Person.create({
        name: name.trim(),
        surname: surname.trim(),
        type: type!,
        profession: profession.trim() || undefined,
        initials: initials?.trim() || `${name.trim()[0] ? name.trim()[0] : ''}${surname.trim().substring(0, 1)}${surname.trim().substring(1, 3).toLowerCase() + '.'}`,
      })
      if (!data) throw new Error(errors?.[0]?.message ?? 'Creazione non riuscita')
      this.created.emit(data)
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossibile creare la persona.')
    } finally {
      this.isSaving.set(false)
    }
  }

  onEscape(): void {
    this.close()
  }

  close(): void {
    this.closed.emit()
  }
  
}
