import { Injectable } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class AuthAccessService {
  async canAccessAdmin(): Promise<boolean> {
    try {
      const groups = (await fetchAuthSession()).tokens?.idToken?.payload['cognito:groups'];

      return Array.isArray(groups) && groups.some((group) => group === 'Admin' || group === 'Editor');
    } catch {
      return false;
    }
  }
}
