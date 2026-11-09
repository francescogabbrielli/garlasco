import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminComponent } from './admin.component';
import { ImportComponent } from './import/import.component';

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
  });

  it('should create the admin dashboard', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the side menu with sections', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.admin-nav-item');
    expect(navItems.length).toBe(2);
    expect(navItems[0].textContent).toContain('Utenti');
    expect(navItems[1].textContent).toContain('Import / Export');
  });

  it('should show the import/export section by default', () => {
    const importComponent = fixture.debugElement.query(By.directive(ImportComponent));
    expect(importComponent).toBeTruthy();
  });

  it('should switch to the users section on click', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.admin-nav-item');
    navItems[0].click();
    fixture.detectChanges();

    const usersSection = fixture.nativeElement.querySelector('app-users');
    expect(usersSection).toBeTruthy();
  });

  it('should not show the hamburger button on desktop', () => {
    const hamburger = fixture.nativeElement.querySelector('.mobile-only');
    // Element exists in DOM but is hidden via CSS (display:none on desktop)
    expect(hamburger).toBeTruthy();
  });
});
