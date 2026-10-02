/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { UserProfileService } from './user-profile.service';
import { Router } from '@angular/router';
import { Hub } from 'aws-amplify/utils';

describe('AppComponent', () => {
  let userService: jasmine.SpyObj<UserProfileService>;
  let router: { url: string; navigateByUrl: jasmine.Spy };
  let authListener:
    | ((event: { payload: { event: string } }) => Promise<void>)
    | undefined;

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserProfileService>(
      'UserProfileService',
      ['loggedIn', 'loggedOut', 'isAdmin'],
    );
    userService.loggedIn.and.returnValue(Promise.resolve({}));
    router = {
      url: '/',
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
    };

    spyOn(Hub, 'listen').and.callFake(
      (_channel: string, listener: (...args: any[]) => any) => {
        authListener = listener as unknown as NonNullable<typeof authListener>;
        return () => {};
      },
    );

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AuthenticatorService, useValue: {} },
        { provide: UserProfileService, useValue: userService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  async function emitAuthEvent(event: 'signedIn' | 'signedOut'): Promise<void> {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(authListener).toBeDefined();
    await authListener!({ payload: { event } });
  }

  it('should configure the Italian sign-up fields', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.title).toBe('Garlasco Home');
    expect(app.signUpAttributes).toEqual(['email', 'given_name', 'family_name']);
    expect(app.formFields.signUp.given_name.label).toBe('Nome');
  });

  it('loads the signed-in user and redirects non-admins away from the admin area', async () => {
    router.url = '/admin';
    userService.isAdmin.and.returnValue(false);

    await emitAuthEvent('signedIn');

    expect(userService.loggedIn).toHaveBeenCalled();
    expect(userService.isAdmin).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('does not redirect admins away from the admin area', async () => {
    router.url = '/admin';
    userService.isAdmin.and.returnValue(true);

    await emitAuthEvent('signedIn');

    expect(userService.loggedIn).toHaveBeenCalled();
    expect(userService.isAdmin).toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not check admin access when signing in outside the admin area', async () => {
    router.url = '/';
    userService.isAdmin.and.returnValue(false);

    await emitAuthEvent('signedIn');

    expect(userService.loggedIn).toHaveBeenCalled();
    expect(userService.isAdmin).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('clears cached user state after sign-out', async () => {
    await emitAuthEvent('signedOut');

    expect(userService.loggedOut).toHaveBeenCalled();
    expect(userService.loggedIn).not.toHaveBeenCalled();
  });
});
