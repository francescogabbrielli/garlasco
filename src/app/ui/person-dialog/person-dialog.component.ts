import { Component, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { PERSON_TYPES } from '../../../../amplify/data/enums';
import type { Schema } from '../../../../amplify/data/resource';

type Person = Schema['Person']['type']

const client = generateClient<Schema>()

@Component({
  selector: 'app-person-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './person-dialog.component.html',
  styleUrl: './person-dialog.component.css',
})
export class PersonDialogComponent {

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
  })

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    const { name, surname, type, profession } = this.form.getRawValue()
    this.isSaving.set(true)
    this.error.set('')
    try {
      const { data, errors } = await client.models.Person.create({
        name: name.trim(),
        surname: surname.trim(),
        type: type!,
        profession: profession.trim() || undefined,
        initials: `${name.trim()[0] ?? ''}${surname.trim()[0] ?? ''}`.toUpperCase(),
      })
      if (!data) throw new Error(errors?.[0]?.message ?? 'Creazione non riuscita')
      this.created.emit(data)
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossibile creare la persona.')
    } finally {
      this.isSaving.set(false)
    }
  }

  close(): void {
    this.closed.emit()
  }
}
