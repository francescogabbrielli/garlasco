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
});
