import { Component, inject, OnInit, OnDestroy } from '@angular/core'
import { AuthenticatorService } from '@aws-amplify/ui-angular'
import { Router, RouterOutlet } from '@angular/router'
import { Amplify } from 'aws-amplify'
import outputs from '../../amplify_outputs.json'

import { AmplifyAuthenticatorModule, translations } from '@aws-amplify/ui-angular'

import { I18n } from 'aws-amplify/utils'

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
export class AppComponent  implements OnInit, OnDestroy {
  
  userService: UserProfileService = inject(UserProfileService)
  authenticatorService: AuthenticatorService = inject(AuthenticatorService)

  router: Router = inject(Router)

  private authSubscription!: any
  authError: string = ''

  title = 'Garlasco Home'

  signUpAttributes: ('email' | 'given_name' | 'family_name')[] = [
    'email',
    'given_name',
    'family_name'
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
        order: 1
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

  constructor() {
    Amplify.configure(outputs)
  }

  // Controlla se la rotta attuale è pubblica
  isPublicRoute(): boolean {
    return this.router.url.includes('privacy-policy');
  }

  ngOnInit() {
    this.authSubscription = this.authenticatorService.subscribe(context => {
      if (context.error && !context.error.toLowerCase().includes('password')) {
        this.authError = context.error
        localStorage.clear()
        setTimeout(() => window.location.reload(), 1000)
      }
    })
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }
}

// TODO? Per una maggiore customizzazione: <amplify-authenticator [authServices]="authServices">

// public authServices = {
//   handleSignUp: async (formData: any) => {
//     // 1. Inizializzazione sicura degli oggetti
//     if (!formData.options) formData.options = {};
//     if (!formData.options.userAttributes) formData.options.userAttributes = {};

//     const attributes = formData.options.userAttributes;
//     this.validationErrors = {};

//     // 2. Validazione campo CUSTOM (Privacy)
//     if (!attributes['custom:privacyAccepted']) {
//       this.validationErrors['custom:privacyAccepted'] = 'Questo campo è obbligatorio per procedere.';
//     }

//     // 3. Validazione campi STANDARD (es. Given Name e Family Name)
//     // Nota: I campi compilati dall'utente nel form nativo si trovano sotto 'attributes'
//     if (!attributes['given_name'] || attributes['given_name'].trim() === '') {
//       this.validationErrors['given_name'] = 'Il nome è obbligatorio.';
//     }

//     if (!attributes['family_name'] || attributes['family_name'].trim() === '') {
//       this.validationErrors['family_name'] = 'Il cognome è obbligatorio.';
//     }

//     // 4. Se ci sono errori, blocca l'invio e mostrali a schermo
//     if (Object.keys(this.validationErrors).length > 0) {
//       return {
//         validationErrors: this.validationErrors
//       };
//     }

//     // 5. Se tutto è valido, imposta il flag del booleano e procedi
//     attributes['custom:privacyAccepted'] = 'true';
//     return formData;
//   }
// };
