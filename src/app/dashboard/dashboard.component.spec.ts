import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    localStorage.setItem('dashboard_filters', '{}');

    await TestBed.configureTestingModule({
      imports: [DashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.currentFilters.interval.from).toEqual(component.defaultFilters.interval.from);
  });

  it('should reset filters to their defaults', () => {
    component.handlePersonFilter(['person-1']);
    component.resetFilters();

    expect(component.currentFilters).toEqual(component.defaultFilters);
    expect(component.selectedIds()).toEqual([]);
  });
});
