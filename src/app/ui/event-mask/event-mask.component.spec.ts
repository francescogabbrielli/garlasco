import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventMaskComponent } from './event-mask.component';

describe('EventMaskComponent', () => {
  let component: EventMaskComponent;
  let fixture: ComponentFixture<EventMaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventMaskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventMaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the map picker for the requested target', () => {
    component.requestPosition('end');
    fixture.detectChanges();

    expect(component.pickerTarget()).toBe('end');
    expect(fixture.nativeElement.querySelector('app-map-picker')).not.toBeNull();
  });

  it('should write the picked position into the target group and close the picker', () => {
    component.requestPosition('start');
    component.onPositionPicked({ latitude: 45, longitude: 9, radius: 120 });

    expect(component.eventForm.controls.start.getRawValue()).toMatchObject({
      latitude: 45,
      longitude: 9,
      radius: 120,
    });
    expect(component.pickerTarget()).toBeNull();
  });

  it('should close the picker without changing the form', () => {
    component.requestPosition('end');
    component.closePicker();

    expect(component.pickerTarget()).toBeNull();
    expect(component.eventForm.controls.end.getRawValue().latitude).toBeNull();
  });

  it('should provide the current position as initial position of the picker', () => {
    expect(component.pickerInitialPosition()).toBeNull();

    component.eventForm.controls.start.patchValue({ latitude: 44, longitude: 8, radius: 50 });
    component.requestPosition('start');

    expect(component.pickerInitialPosition()).toEqual({ latitude: 44, longitude: 8, radius: 50 });
  });
});
