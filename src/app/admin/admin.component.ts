import { Component, inject } from '@angular/core';
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
      <app-import></app-import>
      <hr/>
      <app-export></app-export>
    </main>`
})
export class AdminComponent {


}