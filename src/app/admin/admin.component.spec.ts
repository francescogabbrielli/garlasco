import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProfileService } from '../user-profile.service';
import { AdminComponent } from './admin.component';
import { ImportComponent } from './import/import.component';

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        {
          provide: UserProfileService,
          useValue: {
            getId: () => 'admin-123',
            isLoggedIn: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
  });

  it('should create the admin dashboard for a logged-in user', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Dashboard Amministrativa');
  });

  it('should render the import component', () => {
    const importComponent = fixture.debugElement.query(By.directive(ImportComponent))
      .componentInstance as ImportComponent;

    expect(importComponent).toBeTruthy();
  });
});
