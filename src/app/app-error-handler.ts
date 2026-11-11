import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ClientErrorService } from './client-error.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly clientErrorService = inject(ClientErrorService);

  handleError(error: unknown): void {
    this.clientErrorService.report(error);
  }
}
