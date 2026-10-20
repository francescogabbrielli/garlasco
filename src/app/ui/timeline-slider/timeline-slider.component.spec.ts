import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineSliderComponent } from './timeline-slider.component';

describe('TimelineSliderComponent', () => {
  let fixture: ComponentFixture<TimelineSliderComponent>;
  let component: TimelineSliderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineSliderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineSliderComponent);
    fixture.componentRef.setInput('initialFrom', new Date(2024, 0, 5));
    fixture.componentRef.setInput('initialTo', new Date(2024, 0, 20));
    fixture.componentRef.setInput('initialMin', new Date(2024, 0, 1));
    fixture.componentRef.setInput('initialMax', new Date(2024, 1, 1));
    fixture.componentRef.setInput('minimum', new Date(2024, 0, 1));
    fixture.componentRef.setInput('maximum', new Date(2024, 1, 1));
    fixture.componentRef.setInput('active', true)
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and displays the selected interval', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.current-time-range').textContent).toContain(' — ');
  });

  it('preserves valid zero-valued date inputs', () => {
    const zeroFixture = TestBed.createComponent(TimelineSliderComponent);
    const zeroComponent = zeroFixture.componentInstance;
    zeroFixture.componentRef.setInput('initialFrom', new Date(0));
    zeroFixture.componentRef.setInput('initialTo', new Date(0));
    zeroFixture.componentRef.setInput('initialMin', new Date(0));
    zeroFixture.componentRef.setInput('initialMax', new Date(2 * zeroComponent.ONE_DAY));
    zeroFixture.componentRef.setInput('minimum', new Date(-2 * zeroComponent.ONE_DAY));
    zeroFixture.componentRef.setInput('maximum', new Date(2 * zeroComponent.ONE_DAY));
    zeroFixture.componentRef.setInput('active', true);
    zeroFixture.detectChanges();

    expect(zeroComponent.minTimestamp).toBe(0);
    expect(zeroComponent.maxTimestamp).toBe(0);
    expect(zeroComponent.currentAbsoluteMin).toBe(0);
    expect(zeroComponent.currentAbsoluteMax).toBe(2 * zeroComponent.ONE_DAY);
  });

  it('keeps Ctrl+wheel zoom within the available date range', () => {
    const minimum = new Date(2024, 0, 1);
    const maximum = new Date(2024, 0, 10);
    fixture.componentRef.setInput('minimum', minimum);
    fixture.componentRef.setInput('maximum', maximum);
    component.currentAbsoluteMin = minimum.getTime();
    component.currentAbsoluteMax = new Date(2024, 0, 6).getTime();
    const preventDefault = vi.fn();

    component.onWheel({ ctrlKey: true, deltaY: 1, preventDefault } as unknown as WheelEvent);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(component.currentAbsoluteMin).toBeGreaterThanOrEqual(minimum.getTime());
    expect(component.currentAbsoluteMax).toBeLessThanOrEqual(maximum.getTime());
  });

  it('generates valid daily ticks and marks Sundays', () => {
    component.currentAbsoluteMin = new Date(2024, 0, 1).getTime();
    component.currentAbsoluteMax = new Date(2024, 0, 8).getTime();

    component.generateTimeline();

    expect(component.timelineTicks.some(tick => tick.type === 'sunday')).toBe(true);
    expect(component.timelineTicks.every(tick => Number.isFinite(tick.positionPercent))).toBe(true);
  });

  it('returns no ticks for an empty visible range', () => {
    component.currentAbsoluteMin = new Date(2024, 0, 1).getTime();
    component.currentAbsoluteMax = component.currentAbsoluteMin;

    component.generateTimeline();

    expect(component.timelineTicks).toEqual([]);
  });

  it('emits the selected and visible ranges after a slider change', () => {
    const emitted = vi.fn();
    component.rangeChange.subscribe(emitted);

    component.minTimestamp += component.ONE_HOUR;
    component.onSliderChange();

    expect(emitted).toHaveBeenCalledOnce();
    expect(emitted).toHaveBeenCalledWith({
      from: new Date(component.minTimestamp),
      to: new Date(component.maxTimestamp),
      min: new Date(component.currentAbsoluteMin),
      max: new Date(component.currentAbsoluteMax)
    });
  });
});
