import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { encode } from 'ngeohash';

import type { Schema } from '../../../amplify/data/resource';

export type EventSubmitPayload = {
  owner: string;
  name: string;
  description: string;
  start_date: string;
  end_date?: string | null;
  start_position: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  end_position?: {
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
  reliability?: number;
  relevance?: number;
};

export type EventPositionSelection = {
  target: 'start' | 'end';
  latitude: number;
  longitude: number;
  radius: number;
};

@Component({
  selector: 'app-event-submit-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-submit-dialog.component.html',
})
export class EventSubmitDialogComponent implements OnChanges {
  @Input() ownerId = '';
  @Input() isAdmin = false;
  @Input() positionSelection: EventPositionSelection | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() positionRequested = new EventEmitter<'start' | 'end'>();

  readonly isSaving = signal(false);
  readonly submitError = signal('');
  readonly reliabilityOptions = [
    { value: 1, label: '1 - Voci / rumors' },
    { value: 2, label: '2 - Alcune fonti' },
    { value: 3, label: '3 - Contestato da alcune fonti' },
    { value: 4, label: '4 - Affidabile' },
  ];
  readonly relevanceOptions = [
    { value: 1, label: '1 - Marginale' },
    { value: 2, label: '2 - Vagamente collegato' },
    { value: 3, label: '3 - Fortemente collegato' },
    { value: 4, label: '4 - Rilevante' },
  ];

  readonly eventForm = new FormGroup({
    owner: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reliability: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    relevance: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    start_position: new FormGroup({
      start_date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      latitude: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
      longitude: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
      radius: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    }),
    end_position: new FormGroup({
      end_date: new FormControl('', { nonNullable: true }),
      latitude: new FormControl(0, { nonNullable: true }),
      longitude: new FormControl(0, { nonNullable: true }),
      radius: new FormControl(0, { nonNullable: true }),
    }),
  });

  public createClient(): ReturnType<typeof generateClient<Schema>> {
    return generateClient<Schema>();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.ownerId) {
      this.eventForm.controls.owner.setValue(this.ownerId, { emitEvent: false });
    }

    const selection = changes['positionSelection']?.currentValue as EventPositionSelection | null;
    if (selection) {
      const position = selection.target === 'start'
        ? this.eventForm.controls.start_position
        : this.eventForm.controls.end_position;
      position.patchValue({
        latitude: selection.latitude,
        longitude: selection.longitude,
        radius: selection.radius,
      });
    }
  }

  isDateInputInvalid(fieldName: 'start_date' | 'end_date'): boolean {
    const target = this.eventForm.controls.start_position.controls.start_date;
    if (fieldName === 'end_date') {
      return false;
    }
    return target.invalid && (target.touched || target.dirty);
  }

  async submitEvent(): Promise<void> {
    this.eventForm.markAllAsTouched();
    this.submitError.set('');

    if (this.eventForm.invalid) {
      this.submitError.set(
        this.isAdmin && (
          this.eventForm.controls.reliability.invalid
          || this.eventForm.controls.relevance.invalid
        )
          ? 'Per attendibilità e rilevanza scegli un valore da 1 a 4.'
          : 'Completa tutti i campi obbligatori prima di salvare l’evento.',
      );
      return;
    }

    const startPosition = this.eventForm.controls.start_position.getRawValue();
    const endPosition = this.eventForm.controls.end_position.getRawValue();

    const payload: EventSubmitPayload = {
      owner: this.eventForm.controls.owner.value,
      name: this.eventForm.controls.name.value.trim(),
      description: this.eventForm.controls.description.value.trim(),
      start_date: startPosition.start_date,
      end_date: endPosition.end_date || null,
      start_position: {
        latitude: Number(startPosition.latitude),
        longitude: Number(startPosition.longitude),
        radius: Number(startPosition.radius ?? 0),
      },
      end_position: endPosition.end_date
        ? {
            latitude: Number(endPosition.latitude ?? startPosition.latitude),
            longitude: Number(endPosition.longitude ?? startPosition.longitude),
            radius: Number(endPosition.radius ?? 0),
          }
        : null,
      reliability: this.isAdmin ? this.eventForm.controls.reliability.value : 0,
      relevance: this.isAdmin ? this.eventForm.controls.relevance.value : 0,
    };

    const normalizedRelevance = payload.relevance ?? 0;

    this.isSaving.set(true);

    try {
      const client = this.createClient();
      const { data, errors } = await client.models.Event.create({
        owner: payload.owner,
        name: payload.name,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date ?? undefined,
        start_position: payload.start_position,
        end_position: payload.end_position ?? undefined,
        center_position: payload.start_position,
        geoHash: this.buildGeoHash(payload.start_position.latitude, payload.start_position.longitude),
        reliability: payload.reliability ?? 0,
        relevance: normalizedRelevance,
      });

      if (errors?.length || !data?.id) {
        const message = errors?.[0]?.message ?? 'Errore durante il salvataggio dell’evento.';
        this.submitError.set(message);
        return;
      }

      this.closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il salvataggio dell’evento.';
      this.submitError.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  closeDialog(): void {
    this.closed.emit();
  }

  requestPosition(target: 'start' | 'end'): void {
    this.positionRequested.emit(target);
  }

  private buildGeoHash(latitude: number, longitude: number): string {
    return encode(latitude, longitude, 6);
  }
}
