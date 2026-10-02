import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { AuthAccessService } from './auth-access.service';
import * as Auth from 'aws-amplify/auth';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthAccessService, useValue: { canAccessAdmin: () => Promise.resolve(false) } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should load attributes for a logged-in user', async () => {
    spyOn(Auth, 'fetchUserAttributes').and.resolveTo({
      given_name: 'Mario',
      family_name: 'Rossi',
    });
    const app = new AppComponent(
      {} as AuthenticatorService,
      { url: '/' } as Router,
      { canAccessAdmin: () => Promise.resolve(false) } as AuthAccessService,
    );

    await app.ngOnInit();

    expect(app.userAttributes).toEqual({
      given_name: 'Mario',
      family_name: 'Rossi',
    });
  });

  it('should keep attributes empty for a logged-out user', async () => {
    spyOn(Auth, 'fetchUserAttributes').and.rejectWith(new Error('Not signed in'));
    const app = new AppComponent(
      {} as AuthenticatorService,
      { url: '/' } as Router,
      { canAccessAdmin: () => Promise.resolve(false) } as AuthAccessService,
    );

    await app.ngOnInit();

    expect(app.userAttributes).toEqual({});
  });

  it('should return a non-admin user to home when signing in on the admin route', async () => {
    spyOn(Auth, 'fetchUserAttributes').and.resolveTo({});
    const router = { url: '/admin', navigateByUrl: jasmine.createSpy().and.resolveTo(true) };
    const app = new AppComponent(
      {} as AuthenticatorService,
      router as unknown as Router,
      { canAccessAdmin: () => Promise.resolve(false) } as AuthAccessService,
    );

    await app.handleSignedIn();

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');
  });

  it('should keep an admin user on the admin route after signing in', async () => {
    spyOn(Auth, 'fetchUserAttributes').and.resolveTo({});
    const router = { url: '/admin', navigateByUrl: jasmine.createSpy().and.resolveTo(true) };
    const app = new AppComponent(
      {} as AuthenticatorService,
      router as unknown as Router,
      { canAccessAdmin: () => Promise.resolve(true) } as AuthAccessService,
    );

    await app.handleSignedIn();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
