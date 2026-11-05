import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainComponent } from '../main/main.component';
import { UserProfileService } from '../user-profile.service';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: MainComponent, useValue: { help: signal(null), isLoading: signal(false) } }]
    })
    .compileComponents();

    TestBed.inject(UserProfileService).setPreference('dashboard_filters', {});
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
