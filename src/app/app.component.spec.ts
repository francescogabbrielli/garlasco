import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import * as Auth from 'aws-amplify/auth';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
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
    const app = new AppComponent({} as AuthenticatorService);

    await app.ngOnInit();

    expect(app.userAttributes).toEqual({
      given_name: 'Mario',
      family_name: 'Rossi',
    });
  });

  it('should keep attributes empty for a logged-out user', async () => {
    spyOn(Auth, 'fetchUserAttributes').and.rejectWith(new Error('Not signed in'));
    const app = new AppComponent({} as AuthenticatorService);

    await app.ngOnInit();

    expect(app.userAttributes).toEqual({});
  });
});
