import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { UserProfileService } from '../user-profile.service';
import { HelpPopupComponent } from './help-popup/help-popup.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    HelpPopupComponent
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {

  version = signal('0.0.0')
  appAuthor = signal('')
  appTitle = signal('')
  appDescription = signal('')
  lastUpdate = signal(new Date('2026-01-01').toISOString())

  authenticator = inject(AuthenticatorService)
  userProfile = inject(UserProfileService)
  help = signal<{page: string, title: string}>({page: '', title: ''})

  isAboutDialogOpen = false
  isUserMenuOpen = false
  isAdminVisible = false
  isAdmin = signal(false)
  isEditor = signal(false)
  ownerId = signal('')
  name = signal('--- Caricamento ---')

  isLoading = signal(false)
  
  constructor() {
    effect(() => {
      const user = this.userProfile.user()
      this.isAdmin.set(user.isAdmin())
      this.isEditor.set(user.isEditor())
      this.ownerId.set(user.getId())
      this.name.set(user.getName() + ' ' + user.getSurname())
    })
  }

  ngOnInit(): void {
    import('../../../package.json').then((p) => {
      this.version.set(p.version)
      this.appAuthor.set(p.author.name)
      this.appTitle.set(p.displayName)
      this.appDescription.set(p.description)
      this.lastUpdate.set(new Date(p.lastUpdate).toLocaleDateString('it-IT'))
    })
      .then(() => this.userProfile.logIn())
      .catch((error) => {
        alert('Errore imprevisto durante il login: ' + error)
        this.logout(true)
      })
  }  

  toggleEdit(): void {
    const editEnabled = this.userProfile.user().editEnabled
    editEnabled.update(value => !value)
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(force = false): void {
    if (force || confirm('Sei sicuro di voler uscire? Tutte le operazioni non salvate andranno perse.')) {
      this.isUserMenuOpen = false
      this.userProfile.logOut()
      this.authenticator.signOut()
    }
  }

  openAboutDialog(): void {
    this.isUserMenuOpen = false
    this.isAboutDialogOpen = true
  }

  closeAboutDialog(): void {  
    this.isAboutDialogOpen = false
  }

  closeHelpPopup(): void {
    this.help.set({page: '', title: ''})
  }

  isHelpPopupOpen = computed(() => {
    const help = this.help()
    return help.page !== '' && help.title !== ''
  })

}