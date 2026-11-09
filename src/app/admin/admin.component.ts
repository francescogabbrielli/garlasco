import { Component, inject, signal } from '@angular/core';
import { ImportComponent } from './import/import.component';
import { ExportComponent } from './export/export.component';
import { UsersComponent } from './users/users.component';
import { MainComponent } from '../main/main.component';
import { HypothesisListComponent } from '../analysis/hypothesis-list/hypothesis-list.component';

type AdminSection = 'users' | 'data'

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ImportComponent, ExportComponent, UsersComponent, HypothesisListComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {

  mainComponent = inject(MainComponent)

  readonly sections: { id: AdminSection; label: string; icon: string }[] = [
    { id: 'data', label: 'Import / Export', icon: '⇄' },
    { id: 'users', label: 'Utenti', icon: '👤' },
  ]

  activeSection = signal<AdminSection>('data')
  menuOpen = signal(false)
  isWorking = signal(false)

  selectSection(section: AdminSection): void {
    this.activeSection.set(section)
    this.menuOpen.set(false)
  }

}
