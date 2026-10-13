/// <reference types="google.maps" />

import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, Mock } from 'vitest'

import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { UserProfileService } from '../user-profile.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let fixture: ComponentFixture<MainComponent>;
  let signOutSpy: Mock;

  beforeEach(async () => {
    signOutSpy = vi.fn().mockName('signOut')
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const userData = {
      isAdmin: () => true,
      isEditor: () => true,
      editEnabled: signal(false),
      getId: () => 'user-123',
      getName: () => 'Mario',
      getSurname: () => 'Rossi',
    };
    const userProfile = {
      user: signal(userData),
      logIn: vi.fn().mockName('logIn').mockResolvedValue(userData),
    };

    await TestBed.configureTestingModule({
      imports: [MainComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthenticatorService,
          useValue: {
            username: 'mario@example.com',
            user: { username: 'mario@example.com' },
            signOut: signOutSpy,
          },
        },
        {
          provide: UserProfileService,
          useValue: userProfile,
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
    expect(fixture.nativeElement.querySelector('.main-link')).not.toBeNull();
    expect(fixture.componentInstance.ownerId()).toBe('user-123');
  });

  it('should show the import link with its label', () => {
    const adminLink = fixture.nativeElement.querySelector('a[routerLink="/admin"]');

    expect(adminLink.getAttribute('aria-label')).toBe('Import');
  });

  it('should toggle editEnabled from the edit button', () => {
    const userProfile = TestBed.inject(UserProfileService) as any;
    const button = fixture.nativeElement.querySelector('button.main-link');

    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(userProfile.user().editEnabled()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(userProfile.user().editEnabled()).toBe(false);
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const userLabel = fixture.nativeElement.querySelector('.user-label');
    userLabel.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.logout-menuitem').click();

    expect(signOutSpy).toHaveBeenCalled();
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
