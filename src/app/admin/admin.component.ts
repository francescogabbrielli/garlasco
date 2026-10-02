import { Component, inject } from '@angular/core';
import { ImportComponent } from './import/import.component';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ImportComponent],
  template: `
    <main class="main-view" aria-label="Dashboard Amministrativa">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Dashboard Amministrativa (temporanea)</p>
          <h1>Importazione JSON</h1>
        </div>
        <p class="heading-note">Carica separatamente gli eventi e le persone nel database.</p>
      </header>    
      <app-import></app-import>
    </main>`
})
export class AdminComponent {


}