import { Component, inject, model, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ImportService, type ImportSummary } from './import.service';
import { ClientErrorService } from '../../client-error.service';

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly importService = inject(ImportService)
  private readonly logService = inject(ClientErrorService)

  readonly progress = this.importService.progress;
  jsonInput = signal('')
  peopleJsonInput = signal('')
  hypothesesJsonInput = signal('')
  isWorking = model(false)

  async eseguiUploadDaTextarea(): Promise<void> {
    await this.import(
      'eventi',
      this.jsonInput(),
      json => this.importService.importEvents(json),
      () => this.cleanInputData()
    )
  }

  async importaPersoneDaTextarea(): Promise<void> {
    await this.import(
      'persone',
      this.peopleJsonInput(),
      json => this.importService.importPeople(json),
      () => this.cleanPeopleInput()
    )
  }

  async importaIpotesiDaTextarea(): Promise<void> {
    await this.import(
      'ipotesi',
      this.hypothesesJsonInput(),
      json => this.importService.importHypotheses(json),
      () => this.cleanHypothesesInput()
    )
  }

  cleanInputData(): void {
    this.jsonInput.set('')
  }

  cleanPeopleInput(): void {
    this.peopleJsonInput.set('')
  }

  cleanHypothesesInput(): void {
    this.hypothesesJsonInput.set('')
  }

  private async import(
    label: string,
    json: string,
    operation: (json: string) => Promise<ImportSummary>,
    clearInput: () => void
  ): Promise<void> {
    if (!json.trim()) {
      alert(`Incolla prima il JSON ${label}.`)
      return
    }

    this.isWorking.set(true);
    try {
      const summary = await operation(json)
      console.log(this.formatSummary(label, summary))
      if (summary.failed === 0 && summary.skipped === 0) clearInput();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logService.report(`Importazione ${label} non riuscita: ${message}`);
    } finally {
      this.isWorking.set(false);
    }
  }

  private formatSummary(label: string, summary: ImportSummary): string {
    const message =
      `Importazione ${label} completata: ${summary.imported} importati, ` +
      `${summary.skipped} ignorati, ${summary.failed} non riusciti su ${summary.total}.`;
    const firstIssue = summary.issues[0];
    return firstIssue ? `${message} ${firstIssue}` : message;
  }
}
