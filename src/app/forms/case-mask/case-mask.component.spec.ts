import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { CaseMaskComponent } from './case-mask.component';

@Component({ template: '' })
class TestCaseMaskComponent extends CaseMaskComponent {
  private readonly form = new FormGroup({});

  protected override allPeople() {
    return [];
  }

  protected override getForm(): FormGroup {
    return this.form;
  }

  protected override maskModified(): void {}
  protected override showSplash(): void {}
  protected override setError(): void {}
}

describe('CaseMaskComponent', () => {
  let component: TestCaseMaskComponent;
  let fixture: ComponentFixture<TestCaseMaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestCaseMaskComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestCaseMaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('prevents Enter from submitting non-submit controls', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input.dispatchEvent(event);

    component.onKeyDown(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('allows Enter in textareas', () => {
    const textarea = document.createElement('textarea');
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    textarea.dispatchEvent(event);

    component.onKeyDown(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
