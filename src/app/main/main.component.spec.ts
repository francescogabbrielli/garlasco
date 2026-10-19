import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { UserData, UserProfileService } from '../user-profile.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let fixture: ComponentFixture<MainComponent>;
  let signOut: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    signOut = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    const userData = new UserData(
      { sub: 'user-123', given_name: 'Mario', family_name: 'Rossi' },
      ['Admin', 'Editor'],
    );

    await TestBed.configureTestingModule({
      imports: [MainComponent],
      providers: [
        provideRouter([]),
        { provide: AuthenticatorService, useValue: { signOut } },
        {
          provide: UserProfileService,
          useValue: { user: signal(userData), logIn: vi.fn().mockResolvedValue(userData) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainComponent);
    fixture.detectChanges();
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
  });

  it('shows the signed-in user name and identifier', () => {
    expect(fixture.nativeElement.querySelector('.user-label').textContent.trim()).toBe('Mario Rossi');
    expect(fixture.componentInstance.ownerId()).toBe('user-123');
  });

  it('preloads the loading image for use throughout the app', () => {
    const preload = fixture.nativeElement.querySelector('link[rel="preload"][as="image"]');

    expect(preload.getAttribute('href')).toBe('assets/loading.gif');
  });

  it('shows navigation links based on the signed-in user', () => {
    expect(fixture.nativeElement.querySelector('.brand').getAttribute('routerLink')).toBe('/');
    expect(fixture.nativeElement.querySelector('a[aria-label="Dashboard"]').getAttribute('routerLink'))
      .toBe('/dashboard');
    expect(fixture.nativeElement.querySelector('a[aria-label="Import"]').getAttribute('routerLink'))
      .toBe('/admin');
  });

  it('toggles editing from the edit button', () => {
    const button = fixture.nativeElement.querySelector('button[aria-label="Modifica"]');

    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();
    expect(TestBed.inject(UserProfileService).user().editEnabled()).toBe(true);

    button.click();
    fixture.detectChanges();
    expect(TestBed.inject(UserProfileService).user().editEnabled()).toBe(false);
  });

  it('opens and closes the about dialog from the user menu', () => {
    fixture.nativeElement.querySelector('.user-label').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#about_button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    fixture.nativeElement.querySelector('[aria-label="Chiudi informazioni"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('signs out after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.user-label').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#logout_button').click();

    expect(signOut).toHaveBeenCalledOnce();
  });
});
