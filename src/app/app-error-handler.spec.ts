import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorHandler } from './app-error-handler';
import { ClientErrorService } from './client-error.service';

describe('AppErrorHandler', () => {
  it('forwards uncaught errors to the centralized client error service', () => {
    const report = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        AppErrorHandler,
        { provide: ClientErrorService, useValue: { report } }
      ]
    });

    const error = new Error('test failure');
    TestBed.inject(AppErrorHandler).handleError(error);

    expect(report).toHaveBeenCalledWith(error);
  });
});
