import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { EscapeStack } from '../escape-stack.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { UserProfileService } from '../user-profile.service';
import { HelpPopupComponent } from './help-popup/help-popup.component';
import { ContactFormComponent } from './contact-form/contact-form.component';
import { BotChatComponent } from './bot-chat/bot-chat.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    HelpPopupComponent,
    ContactFormComponent,
    BotChatComponent
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {

  escapeStack = inject(EscapeStack)

  version = signal('0.0.0')
  appAuthor = signal('')
  appTitle = signal('')
  appDescription = signal('')
  lastUpdate = signal(new Date('2026-01-01').toISOString())

  authenticator = inject(AuthenticatorService)
  userProfile = inject(UserProfileService)

  isAboutDialogOpen = false
  isUserMenuOpen = false
  isAdminVisible = false

  help = signal<{page: string, title: string}>({page: '', title: ''})
  contacts = signal(false)

  user = computed(() => this.userProfile.user())
  isLoading = signal(false)

  botChatOpened = signal(false)
  
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

  openContactForm(): void {
    this.isUserMenuOpen = false
    this.contacts.set(true)
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.escapeStack.isEmpty()) {
      this.closeAboutDialog()
      this.isUserMenuOpen = false   
    } else {
      console.log(this.escapeStack)
    }
  }

}
