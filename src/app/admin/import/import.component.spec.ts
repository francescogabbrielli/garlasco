import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportComponent } from './import.component';

describe('ImportComponent', () => {
  let component: ImportComponent;
  let fixture: ComponentFixture<ImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept the owner id input', () => {
    fixture.componentRef.setInput('ownerId', 'user-123');
    fixture.detectChanges();

    expect(component.ownerId()).toBe('user-123');
  });

  it('should clear the JSON input', () => {
    component.jsonInput.set('[{"name":"Evento"}]');

    component.cleanInputData();

    expect(component.jsonInput()).toBe('');
  });
});
