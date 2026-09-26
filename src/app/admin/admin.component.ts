import { Component } from '@angular/core';
import { ImportComponent } from './import/import.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ImportComponent],
  template: `
    <main aria-label="Dashboard amministrativo">
      <h1>Dashboard Amministrativa (temporanea)</h1>
      <app-import></app-import>
    </main>`
})
export class AdminComponent {}