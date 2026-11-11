import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HypothesisMaskComponent } from './hypothesis-mask.component';

describe('HypothesisMaskComponent', () => {
  let fixture: ComponentFixture<HypothesisMaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HypothesisMaskComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HypothesisMaskComponent);
    fixture.componentRef.setInput('event', {
      id: 'event-1',
      name: 'Evento',
      relevance: 0,
    });
    fixture.componentRef.setInput('people', []);
    fixture.detectChanges();
  });

  it('creates with its required event and people inputs', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.form.controls.name.value).toBe('');
  });
});