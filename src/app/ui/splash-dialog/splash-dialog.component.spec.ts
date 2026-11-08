import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SplashDialogComponent } from './splash-dialog.component';

describe('SplashDialogComponent', () => {
  let fixture: ComponentFixture<SplashDialogComponent>;
  let originalShowModal: PropertyDescriptor | undefined;
  let originalClose: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });

    await TestBed.configureTestingModule({
      imports: [SplashDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SplashDialogComponent);
    fixture.componentRef.setInput('message', 'Email inviata!');
  });

  afterEach(() => {
    if (originalShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    }

    if (originalClose) {
      Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
    }
    vi.useRealTimers();
  });

  it('opens the dialog and closes it after the configured duration', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('durationSeconds', 2);
    const closedSpy = vi.spyOn(fixture.componentInstance.closed, 'emit');

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);

    vi.advanceTimersByTime(1999);
    expect(closedSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(closedSpy).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
  });

  it('keeps the dialog open without a timer when duration is zero and shows the optional close button', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('durationSeconds', 0);
    fixture.componentRef.setInput('showCloseButton', true);
    fixture.detectChanges();

    vi.advanceTimersByTime(10_000);
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);

    fixture.nativeElement.querySelector('button').click();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
  });
});
