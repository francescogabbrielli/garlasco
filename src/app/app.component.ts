import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

import {
  AmplifyAuthenticatorModule,
  AuthenticatorService,
  translations,
} from '@aws-amplify/ui-angular';

import { fetchUserAttributes, UserAttributeKey } from 'aws-amplify/auth';
import { Hub, I18n } from 'aws-amplify/utils';
import { AuthAccessService } from './auth-access.service';

Amplify.configure(outputs);
I18n.putVocabularies(translations);
I18n.setLanguage('it');

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [AmplifyAuthenticatorModule, RouterOutlet]
})
export class AppComponent {

  title = 'Garlasco Home';

  signUpAttributes: ('email' | 'given_name' | 'family_name')[] = [
    'email',
    'given_name',
    'family_name',
  ];

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
      email: {
        label: 'Email',
        placeholder: 'Inserisci la tua email',
        order: 0,
      },
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
      password: {
        label: 'Password',
        placeholder: 'Inserisci la tua password',
        order: 3,
      },
      confirm_password: {
        label: 'Conferma password',
        placeholder: 'Conferma la tua password',
        order: 4,
      },
    },
  };

  userAttributes: Partial<Record<UserAttributeKey, string>> = {};

  async ngOnInit(): Promise<void> {
    await this.loadUserAttributes();
  }

  private readonly authHubListener = Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'signedIn') {
      void this.handleSignedIn();
    } else if (payload.event === 'signedOut') {
      this.userAttributes = {};
      void this.router.navigateByUrl('/');
    }
  });

  async loadUserAttributes(
    fetchAttributes: () => Promise<Partial<Record<UserAttributeKey, string>>> = fetchUserAttributes,
  ): Promise<void> {
    try {
      this.userAttributes = await fetchAttributes();
    } catch {
      this.userAttributes = {};
    }
  }

  constructor(
    public authenticator: AuthenticatorService,
    private readonly router: Router,
    private readonly authAccess: AuthAccessService,
  ) {
    Amplify.configure(outputs)
  }

  async handleSignedIn(): Promise<void> {
    await this.loadUserAttributes();

    if (this.router.url.startsWith('/admin') && !(await this.authAccess.canAccessAdmin())) {
      await this.router.navigateByUrl('/');
    }
  }
}
