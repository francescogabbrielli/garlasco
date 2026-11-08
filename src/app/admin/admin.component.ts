import { Component, signal } from '@angular/core';
import { ImportComponent } from './import/import.component';
import { ExportComponent } from './export/export.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ImportComponent, ExportComponent],
  template: `
    <main class="main-view" aria-label="Dashboard Amministrativa">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Dashboard Amministrativa (temporanea)</p>
        </div>
        <p class="heading-note">Carica separatamente gli eventi e le persone da/verso ill database.</p>
      </header>    
      <app-import [(isWorking)]=isWorking></app-import>
      <hr/>
      <app-export [(isWorking)]=isWorking></app-export>
    </main>`
})
export class AdminComponent {

  isWorking = signal(false)

}