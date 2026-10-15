import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TickbarComponent } from './tickbar.component';

describe('TickbarComponent', () => {
  let component: TickbarComponent;
  let fixture: ComponentFixture<TickbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TickbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TickbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the empty state for a zero level', () => {
    fixture.componentRef.setInput('level', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tick-bar-container').getAttribute('data-status')).toBe('empty');
    expect(fixture.nativeElement.querySelector('.error-x')).not.toBeNull();
  });

  it('highlights the number of ticks matching the level', () => {
    fixture.componentRef.setInput('level', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tick-bar-container').getAttribute('data-status')).toBe('healthy');
    expect(fixture.nativeElement.querySelectorAll('.tick.active')).toHaveLength(3);
  });
});
