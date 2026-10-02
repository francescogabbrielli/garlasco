/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { UserProfileService } from './user-profile.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AuthenticatorService, useValue: {} },
        { provide: UserProfileService, useValue: { loggedOut: jasmine.createSpy('loggedOut') } },
      ],
    }).compileComponents();
  });

  it('should configure the Italian sign-up fields', () => {
    const app = TestBed.runInInjectionContext(
      () => new AppComponent(TestBed.inject(AuthenticatorService)),
    );

    expect(app.title).toBe('Garlasco Home');
    expect(app.signUpAttributes).toEqual(['email', 'given_name', 'family_name']);
    expect(app.formFields.signUp.given_name.label).toBe('Nome');
  });
});
