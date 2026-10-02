/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);
  });

  it('should return cached attributes and recognize user roles', async () => {
    const attributes = { sub: 'user-123', given_name: 'Mario' };
    service.userAttributes = attributes;
    service.userGroups = ['Admin', 'Editor'];
    service.logged = true;

    await expectAsync(service.loggedIn()).toBeResolvedTo(attributes);

    expect(service.getId()).toBe('user-123');
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.isAdmin()).toBeTrue();
    expect(service.isEditor()).toBeTrue();
  });

  it('should clear cached user data on logout', () => {
    service.userAttributes = { sub: 'user-123' };
    service.userGroups = ['Admin'];
    service.logged = true;

    service.loggedOut();

    expect(service.getId()).toBe('');
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.isAdmin()).toBeFalse();
    expect(service.isEditor()).toBeFalse();
  });
});
