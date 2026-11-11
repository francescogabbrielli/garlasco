import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisComponent } from './analysis.component';
import { signal } from '@angular/core';
import { MainComponent } from '../main/main.component';
import { DataService } from '../data.service';

describe('AnalysisComponent', () => {
  let component: AnalysisComponent;
  let fixture: ComponentFixture<AnalysisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisComponent],
      providers: [
        { provide: MainComponent, useValue: { help: signal(null) } },
        {
          provide: DataService,
          useValue: {
            loadPersons: async () => [],
            loadColdCaseEvents: async () => [],
          },
        },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
