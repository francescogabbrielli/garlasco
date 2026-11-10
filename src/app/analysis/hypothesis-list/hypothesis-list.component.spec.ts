import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HypothesisListComponent } from './hypothesis-list.component';

describe('HypothesisListComponent', () => {
  let component: HypothesisListComponent;
  let fixture: ComponentFixture<HypothesisListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HypothesisListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HypothesisListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
