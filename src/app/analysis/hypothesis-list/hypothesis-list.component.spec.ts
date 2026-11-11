import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataService } from '../../data.service';

import { HypothesisListComponent } from './hypothesis-list.component';

describe('HypothesisListComponent', () => {
  let component: HypothesisListComponent;
  let fixture: ComponentFixture<HypothesisListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HypothesisListComponent],
      providers: [{
        provide: DataService,
        useValue: { loadHypotheses: async () => [] },
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HypothesisListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('event', { id: 'event-1', name: 'Evento' });
    fixture.componentRef.setInput('people', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
