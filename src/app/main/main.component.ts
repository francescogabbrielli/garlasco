import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {

  version = signal('0.0.0')
  lastUpdate = signal(new Date('2026-01-01').toISOString())

  authenticator = inject(AuthenticatorService)
  userProfile = inject(UserProfileService)

  isAboutDialogOpen = false
  isUserMenuOpen = false
  isAdminVisible = false
  isAdmin = signal(false)
  isEditor = signal(false)
  ownerId = signal('')
  givenName = signal('')
  familyName = signal('')

  async ngOnInit(): Promise<void> {
    const user = await this.userProfile.logIn()
    const packageJson = await import('../../../package.json')
    this.isAdmin.set(user.isAdmin())
    this.isEditor.set(user.isEditor())
    this.ownerId.set(user.getId())
    this.givenName.set(user.getName())
    this.familyName.set(user.getSurname())
    this.version.set(packageJson.version)
    this.lastUpdate.set(new Date(packageJson.lastUpdate).toLocaleDateString('it-IT'))
  }

  toggleEdit(): void {
    const editEnabled = this.userProfile.user().editEnabled
    editEnabled.update(value => !value)
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(): void {
    if (confirm('Sei sicuro di voler uscire? Tutte le operazioni non salvate andranno perse.')) {
      this.isUserMenuOpen = false;
      this.authenticator.signOut();
    }
  }

  openAboutDialog(): void {
    this.isUserMenuOpen = false
    this.isAboutDialogOpen = true
  }

  closeAboutDialog(): void {  
    this.isAboutDialogOpen = false
  }

}