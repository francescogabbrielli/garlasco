import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { PREFERENCE_KEY_THEME, UserData, UserProfileService } from '../user-profile.service';
import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let fixture: ComponentFixture<MainComponent>;
  let signOut: ReturnType<typeof vi.fn>;
  let systemThemeListener: ((event: MediaQueryListEvent) => void) | undefined;
  let preferences: Record<string, unknown>;

  beforeEach(async () => {
    preferences = {};
    systemThemeListener = undefined;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListener = listener;
      },
      removeEventListener: vi.fn(),
    })));
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
          useValue: {
            user: signal(userData),
            logIn: vi.fn().mockResolvedValue(userData),
            logOut: vi.fn(),
            getPreference: <T>(key: string, defaultValue: T): T =>
              key in preferences ? preferences[key] as T : defaultValue,
            setPreference: (key: string, value: unknown) => { preferences[key] = value },
            clearPreferences: (preserve: readonly string[] = []) => {
              for (const key of Object.keys(preferences)) {
                if (!preserve.includes(key)) delete preferences[key]
              }
            },
            setEditEnabled: (enabled: boolean) => userData.editEnabled.set(enabled),
          },
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
    expect(fixture.componentInstance.user().getId()).toBe('user-123');
  });

  it('shows navigation links based on the signed-in user', () => {
    expect(fixture.nativeElement.querySelector('a[aria-label="Admin"]').getAttribute('routerLink'))
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

    fixture.nativeElement.querySelector('[aria-label="Chiudi"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('toggles and persists the dark theme from the user menu', () => {
    const initialTheme = fixture.componentInstance.isDarkTheme();

    fixture.nativeElement.querySelector('.user-label').click();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('#theme_toggle_button');
    expect(button.getAttribute('role')).toBe('menuitemcheckbox');
    expect(button.getAttribute('aria-checked')).toBe(String(initialTheme));

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isDarkTheme()).toBe(!initialTheme);
    expect(document.documentElement.dataset['theme']).toBe(initialTheme ? 'light' : 'dark');
    expect(fixture.componentInstance.userProfile.getPreference(PREFERENCE_KEY_THEME, null))
      .toBe(initialTheme ? 'light' : 'dark');

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isDarkTheme()).toBe(initialTheme);
  });

  it('uses the system dark preference when no theme has been saved', () => {
    expect(fixture.componentInstance.isDarkTheme()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(fixture.componentInstance.userProfile.getPreference(PREFERENCE_KEY_THEME, null)).toBeNull();
  });

  it('follows system theme changes until the user chooses a theme', () => {
    systemThemeListener?.({ matches: false } as MediaQueryListEvent);
    expect(fixture.componentInstance.isDarkTheme()).toBe(false);
    expect(document.documentElement.dataset['theme']).toBe('light');

    fixture.componentInstance.toggleTheme();
    expect(fixture.componentInstance.isDarkTheme()).toBe(true);
    expect(fixture.componentInstance.userProfile.getPreference(PREFERENCE_KEY_THEME, null)).toBe('dark');

    systemThemeListener?.({ matches: false } as MediaQueryListEvent);
    expect(fixture.componentInstance.isDarkTheme()).toBe(true);
  });

  it('signs out after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.user-label').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#logout_button').click();

    expect(signOut).toHaveBeenCalledOnce();
  });
});
