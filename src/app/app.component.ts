import { Component, inject } from '@angular/core'
import { Router, RouterOutlet } from '@angular/router'
import { Amplify } from 'aws-amplify'
import outputs from '../../amplify_outputs.json'

import {
  AmplifyAuthenticatorModule,
  translations,
} from '@aws-amplify/ui-angular'

import { Hub, I18n } from 'aws-amplify/utils'

import { UserProfileService } from './user-profile.service'

Amplify.configure(outputs)
I18n.putVocabularies(translations)
I18n.setLanguage('it')

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [AmplifyAuthenticatorModule, RouterOutlet]
})
export class AppComponent {

  userService: UserProfileService = inject(UserProfileService)

  router: Router = inject(Router)

  title = 'Garlasco Home'

  signUpAttributes: ('email' | 'given_name' | 'family_name')[] = [
    'email',
    'given_name',
    'family_name',
  ]

  formFields = {
    signIn: {
      username: {
        label: 'Email',
        placeholder: 'Inserisci la tua email',
      },
      password: {
        label: 'Password',
        placeholder: 'Inserisci la tua password',
      },
    },
    signUp: {
      given_name: {
        label: 'Nome',
        placeholder: 'Inserisci il tuo nome',
        order: 1,
      },
      family_name: {
        label: 'Cognome',
        placeholder: 'Inserisci il tuo cognome',
        order: 2,
      },
      email: {
        label: 'Email',
        placeholder: 'Inserisci la tua email',
        order: 3,
      },
      password: {
        label: 'Password',
        placeholder: 'Inserisci la tua password',
        order: 4,
      },
      confirm_password: {
        label: 'Conferma password',
        placeholder: 'Conferma la tua password',
        order: 5,
      }
    },
  }

  private readonly authHubListener = Hub.listen('auth', async ({ payload }) => {
    if (payload.event === 'signedIn') {
      const user = await this.userService.logIn()
      if (this.router.url.startsWith('/admin') && !user.isAdmin()) {
        await this.router.navigateByUrl('/')
      }
    } else if (payload.event === 'signedOut') {
      this.userService.logOut()
    }
  })

  constructor() {
    Amplify.configure(outputs)
  }

  // Controlla se la rotta attuale è pubblica
  isPublicRoute(): boolean {
    return this.router.url.includes('privacy-policy');
  }
}
