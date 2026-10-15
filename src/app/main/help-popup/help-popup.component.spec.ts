import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { HelpPopupComponent } from './help-popup.component';

describe('HelpPopupComponent', () => {
  let component: HelpPopupComponent;
  let fixture: ComponentFixture<HelpPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpPopupComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HelpPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
