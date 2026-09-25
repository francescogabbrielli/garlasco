import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { AuthAccessService } from '../auth-access.service';
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
          provide: AuthAccessService,
          useValue: { canAccessAdmin: () => Promise.resolve(true) },
        },
        {
          provide: UserProfileService,
          useValue: {
            getUserAttributes: () =>
              Promise.resolve({ given_name: 'Mario', family_name: 'Rossi' }),
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
    const userLabel = fixture.nativeElement.querySelector('.user-label');
    const authenticator = TestBed.inject(AuthenticatorService);

    userLabel.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.logout-menuitem').click();

    expect(authenticator.signOut).toHaveBeenCalled();
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
