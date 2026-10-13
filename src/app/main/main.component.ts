import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { UserProfileService } from '../user-profile.service';
import { EventSubmitDialogComponent } from './event-submit-dialog.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    EventSubmitDialogComponent,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {

  authenticator = inject(AuthenticatorService)
  userProfile = inject(UserProfileService)

  isSubmitDialogOpen = false;
  isUserMenuOpen = false;
  isAdminVisible = false;
  isAdmin = signal(false)
  isEditor = signal(false)
  ownerId = signal('')
  givenName = signal('')
  familyName = signal('')

  async ngOnInit(): Promise<void> {
    const user = await this.userProfile.logIn();
    this.isAdmin.set(user.isAdmin())
    this.isEditor.set(user.isEditor())
    this.ownerId.set(user.getId())
    this.givenName.set(user.getName())
    this.familyName.set(user.getSurname())
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

  openSubmitDialog(): void {
    this.isUserMenuOpen = false;
    this.isSubmitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    this.isSubmitDialogOpen = false;
    //this.closeHelpDialog();
  }

}