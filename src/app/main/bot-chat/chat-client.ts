import { InjectionToken } from '@angular/core';
import { generateClient, type Client } from 'aws-amplify/data';

import type { Schema } from '../../../../amplify/data/resource';

export const CHAT_CLIENT = new InjectionToken<Client<Schema>>(
  'CHAT_CLIENT',
  {
    providedIn: 'root',
    factory: () => generateClient<Schema>()
  }
)