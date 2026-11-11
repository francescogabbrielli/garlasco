import { Component, inject, input, OnDestroy, OnInit, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PERSON_TYPES } from '../../../../amplify/data/enums';
import type { Schema } from '../../../../amplify/data/resource';

import { EscapeStack } from '../../escape-stack.service';
import { DataService } from '../../data.service';
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';

type Person = Schema['Person']['type']

@Component({
  selector: 'app-person-popup',
  imports: [ReactiveFormsModule, SplashDialogComponent],
  templateUrl: './person-popup.component.html',
  styleUrl: './person-popup.component.css',
})
export class PersonDialogComponent implements OnInit, OnDestroy {

  private escapeStack = inject(EscapeStack)
  private dataService = inject(DataService)
  private offEscape?: () => void

  @ViewChild('personSplash')
  private splash!: SplashDialogComponent

  edited = input<Person | null>()
  saved = output<Person>()
  deleted = output<string>()
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

    const p = this.edited()
    if (p) {
      this.form.patchValue({
        name: p.name,
        surname: p.surname,
        type: p.type,
        profession: p.profession || undefined,
        initials: p.initials
      })
    }
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
      const person = await this.dataService.savePerson({
        id: this.edited()?.id,
        name: name.trim(),
        surname: surname.trim(),
        type: type!,
        profession: profession.trim() || undefined,
        initials: initials?.trim() || `${name.trim()[0] ? name.trim()[0] : ''}${surname.trim().substring(0, 1)}${surname.trim().substring(1, 3).toLowerCase() + '.'}`,
      })
      await this.splash.show(`Persona ${this.edited() ? 'modificata' : 'creata'} con successo!`)
      this.saved.emit(person)
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossibile salvare la persona.')
    } finally {
      this.isSaving.set(false)
    }
  }

  onEscape(): void {
    this.close()
  }

  async deletePerson(): Promise<void> {
    const existingId = this.edited()?.id
    if (!existingId) return

    if (!window.confirm('Sei sicuro di voler eliminare questa persona? Potrebbe essere collegata ad altri eventi!'))
      return

    this.isSaving.set(true)
    this.error.set('')
    try {
      await this.dataService.deletePerson(existingId)
      await this.splash.show('Persona eliminata!')
      this.deleted.emit(existingId)
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossibile eliminare la persona.')
    } finally {
      this.isSaving.set(false)
    }
  }

  close(): void {
    this.closed.emit()
  }
  
}
