import { Injectable } from '@angular/core';
import { fetchUserAttributes, UserAttributeKey } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  async getUserAttributes(): Promise<Partial<Record<UserAttributeKey, string>>> {
    try {
      return await fetchUserAttributes();
    } catch {
      return {};
    }
  }
}
