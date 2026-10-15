import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimelineSliderComponent } from './timeline-slider.component';

describe('TimelineSliderComponent', () => {
  let component: TimelineSliderComponent;
  let fixture: ComponentFixture<TimelineSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimelineSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
