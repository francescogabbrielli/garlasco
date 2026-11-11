import { Component, computed, effect, inject, input, model, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import type { Schema } from '../../../../amplify/data/resource';
import { DataService } from '../../data.service';
import { MapPickerComponent } from '../../ui/map-picker/map-picker.component';
import { PersonDialogComponent } from '../../forms/person-popup/person-popup.component';
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';

import { CaseMaskComponent, PersonCaseEvent } from '../../forms/case-mask/case-mask.component';

type Hypothesis = Schema['Hypothesis']['type']
type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

@Component({
  selector: 'app-hypothesis-mask',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MapPickerComponent, PersonDialogComponent, SplashDialogComponent],
  templateUrl: './hypothesis-mask.component.html',
  styleUrls: ['./hypothesis-mask.component.css', '../../forms/case-mask/case-mask.component.css'],
})
export class HypothesisMaskComponent extends CaseMaskComponent {

  private dataService = inject(DataService)

  people = input<Person[]>([])
  hypothesis = input<Hypothesis | null>(null)
  eventId = input<string | null>(null)

  saved = output<PersonCaseEvent>()
  deleted = output<string>()
  modified = output<boolean>()

  submitError = model('')

  @ViewChild('hypothesisSplash')
  private splash!: SplashDialogComponent

  private loadedActorsIds = [] as string[]
  readonly allPeople = computed(() => {
    const base = this.people()
    const saved = this.savedPeople()
    const deleted = new Set(this.deletedPeopleIds())
    const savedMap = new Map(saved.map(p => [p.id, p]))
    return [
      ...base.filter(p => !deleted.has(p.id)).map(p => savedMap.get(p.id) || p),
      ...saved.filter(p => !base.some(b => b.id === p.id)),
    ]
  })

  override getForm(): FormGroup {
    return this.form
  }

  override setError(message: string): void {
    this.submitError.set(message)
  }
  
  override showSplash(message: string): void {
    this.splash.show(message)
  }

  override maskModified(): void {
    this.modified.emit(true)
  }

  readonly isSaving = signal(false)

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    start: new FormGroup({
      date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      latitude: new FormControl<string | null>(null),
      longitude: new FormControl<string | null>(null),
      radius: new FormControl<string | null>(null),
    }),
    end: new FormGroup({
      date: new FormControl('', { nonNullable: false }),
      latitude: new FormControl<string | null>(null),
      longitude: new FormControl<string | null>(null),
      radius: new FormControl<string | null>(null),
    }),
  })

  constructor() {
    super()
    effect(() => {
      // re-run once the people list is available so actor names can be resolved
      if (this.people().length === 0) return
      this.load()
    })
  }

  async load(): Promise<void> {
    const h = this.hypothesis()
    if (h) {
      this.form.patchValue({
        name: h.name,
        description: h.description,
        start: h.startPosition ? {
          date: this.dateToLocalInput(h.startDate),
          latitude: this.COORDS_FORMAT.format(h.startPosition.latitude),
          longitude: this.COORDS_FORMAT.format(h.startPosition.longitude),
          radius: String(h.startPosition.radius),
        } : undefined,
        end: h.endPosition ? {
          date: this.dateToLocalInput(h.endDate),
          latitude: this.COORDS_FORMAT.format(h.endPosition.latitude),
          longitude: this.COORDS_FORMAT.format(h.endPosition.longitude),
          radius: String(h.endPosition.radius),
        } : undefined,
      })
      this.sources.set(h.sources ? [...h.sources] : [])
      this.loadActors(h)
    }
  }

  private async loadActors(hypothesis: Hypothesis): Promise<void> {
    try {
      const actors = await this.dataService.loadHypothesisActors(hypothesis)
      this.loadedActorsIds = actors.map(a => a.id)
      this.selectedActors.set(
        actors.map(a => ({
          rowId: this.actorStatus.nextRowId++,
          personId: a.personId,
          personQuery: this.personName(a.personId),
          role: a.role,
        })),
      )
    } catch {
      // silently fail
    }
  }

  // ── Submit ──
  async submit(): Promise<void> {

    super.checkForm()

    const start = this.form.controls.start.getRawValue()
    const end = this.form.controls.end.getRawValue()

    if (!start.latitude) {
      this.setError('Seleziona la posizione di partenza.')
      return
    }

    const payload = {
      ...(this.hypothesis()?.id ? { id: this.hypothesis()!.id } : {}),
      ...(this.eventId() ? { eventId: this.eventId() } : {}),
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
      startDate: new Date(this.form.controls.start.controls.date.value).toISOString(),
      endDate: this.form.controls.end.controls.date.value ? new Date(this.form.controls.end.controls.date.value).toISOString() : null,
      startPosition: start.latitude ? {
        latitude: Number(start.latitude),
        longitude: Number(start.longitude),
        radius: Number(start.radius),
      } : null,
      endPosition: end.latitude ? {
        latitude: Number(end.latitude),
        longitude: Number(end.longitude),
        radius: Number(end.radius),
      } : null,
      sources: this.sources().filter(s => s.trim()),
    }

    this.isSaving.set(true)
    try {
      const saved = await this.dataService.saveHypothesis(payload, this.loadedActorsIds, this.selectedActors())
      this.loadedActorsIds = []
      await this.splash.show(`Ipotesi ${this.hypothesis()?.id ? 'modificata' : 'creata'} con successo!`)
      this.saved.emit({
        personSaved: this.savedPeople(),
        personDeleted: this.deletedPeopleIds(),
      })
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Errore durante il salvataggio dell’ipotesi.')
    } finally {
      this.isSaving.set(false)
    }
  }

  async deleteHypothesis(): Promise<void> {
    const id = this.hypothesis()?.id
    if (!id) return
    if (!confirm('Sei sicuro di voler eliminare questa ipotesi?')) return

    this.isSaving.set(true)
    try {
      await this.dataService.deleteHypothesis(id, this.loadedActorsIds)
      await this.splash.show('Ipotesi eliminata!')
      this.deleted.emit(id)
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Errore durante l’eliminazione.')
    } finally {
      this.isSaving.set(false)
    }
  }

  async submitForPublication(): Promise<void> {
    const id = this.hypothesis()?.id
    if (!id) return
    try {
      await this.dataService.submitPublicationRequest(id)
      await this.splash.show('Richiesta di pubblicazione inviata!')
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Errore durante l’invio della richiesta.')
    }
  }

}
