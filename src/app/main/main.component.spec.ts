/// <reference types="google.maps" />

import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { UserProfileService } from '../user-profile.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let fixture: ComponentFixture<MainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthenticatorService,
          useValue: {
            username: 'mario@example.com',
            user: { username: 'mario@example.com' },
            signOut: jasmine.createSpy('signOut'),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            loggedIn: () => Promise.resolve({
              sub: 'user-123',
              given_name: 'Mario',
              family_name: 'Rossi',
            }),
            isAdmin: () => true,
            loggedOut: jasmine.createSpy('loggedOut'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should display the user name from Cognito attributes', () => {
    const userLabel = fixture.nativeElement.querySelector('.user-label');

    expect(userLabel.textContent.trim()).toBe('Mario Rossi');
  });

  it('should show the admin link for administrators', () => {
    expect(fixture.nativeElement.querySelector('.admin-link')).not.toBeNull();
    expect(fixture.componentInstance.ownerId).toBe('user-123');
  });

  it('should open the user menu from the user name', () => {
    const userLabel = fixture.nativeElement.querySelector('.user-label');

    userLabel.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.submit-event-button').textContent).toContain(
      'Invia nuovo evento',
    );
    expect(fixture.nativeElement.querySelector('.logout-menuitem').textContent).toContain('Esci');
  });

  it('should render links to home and the admin console', () => {
    const homeLink = fixture.nativeElement.querySelector('.brand');
    const adminLink = fixture.nativeElement.querySelector('a[routerLink="/admin"]');

    expect(homeLink.getAttribute('href')).toBe('/');
    expect(adminLink.getAttribute('href')).toBe('/admin');
  });

  it('should sign out when the logout menu item is clicked', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const userLabel = fixture.nativeElement.querySelector('.user-label');
    const authenticator = TestBed.inject(AuthenticatorService);
    const userProfile = TestBed.inject(UserProfileService);

    userLabel.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.logout-menuitem').click();

    expect(authenticator.signOut).toHaveBeenCalled();
    expect(userProfile.logOut).toHaveBeenCalled();
  });

  it('should open and close the submit dialog', () => {
    const userLabel = fixture.nativeElement.querySelector('.user-label');

    userLabel.click();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('.submit-event-button');

    submitButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    const closeButton = fixture.nativeElement.querySelector('[aria-label="Chiudi finestra"]');
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
