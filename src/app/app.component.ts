import { Component } from '@angular/core';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

Amplify.configure(outputs);

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [AmplifyAuthenticatorModule]
})
export class AppComponent {

  title = 'Garlasco Home';

  constructor(public authenticator: AuthenticatorService) {
    Amplify.configure(outputs);
  }
}
