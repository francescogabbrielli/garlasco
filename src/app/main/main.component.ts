import { Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { DataService } from '../data.service';
import { EscapeStack } from '../escape-stack.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { PREFERENCE_KEY_THEME, UserProfileService } from '../user-profile.service';
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
export class MainComponent implements OnDestroy {

  private readonly escapeStack = inject(EscapeStack)
  private readonly dataService = inject(DataService)

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
  private readonly systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  private readonly savedTheme = this.userProfile.getPreference<string | null>(PREFERENCE_KEY_THEME, null)
  private hasManualTheme = this.savedTheme === 'dark' || this.savedTheme === 'light'
  isDarkTheme = signal(this.hasManualTheme ? this.savedTheme === 'dark' : this.systemThemeQuery.matches)

  botChatOpened = signal(false)
  tableCount = signal(0)

  constructor() {
    this.applyTheme(this.isDarkTheme())
    this.systemThemeQuery.addEventListener('change', this.onSystemThemeChange)
  }

  ngOnDestroy(): void {
    this.systemThemeQuery.removeEventListener('change', this.onSystemThemeChange)
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
      .then(() => this.dataService.getTableCount())
      .then(count => this.tableCount.set(count))
      // Additional initialization if needed
      .catch((error) => {
        alert('Errore imprevisto durante il login: ' + error)
        this.logout(true)
      })
  }  

  toggleEdit(): void {
    this.userProfile.setEditEnabled(!this.userProfile.user().editEnabled())
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  toggleTheme(): void {
    this.isDarkTheme.update(isDark => !isDark)
    this.hasManualTheme = true
    this.applyTheme(this.isDarkTheme())
    this.userProfile.setPreference(PREFERENCE_KEY_THEME, this.isDarkTheme() ? 'dark' : 'light')
  }

  private readonly onSystemThemeChange = (event: MediaQueryListEvent): void => {
    if (!this.hasManualTheme) {
      this.isDarkTheme.set(event.matches)
      this.applyTheme(event.matches)
    }
  }

  private applyTheme(isDark: boolean): void {
    document.documentElement.dataset['theme'] = isDark ? 'dark' : 'light'
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
      this.botChatOpened.set(false)
    }
  }

}
