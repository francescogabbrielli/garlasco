/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);
  });

  it('should return the cached user and recognize user roles', async () => {
    const attributes = {
      sub: 'user-123',
      given_name: 'Mario',
      family_name: 'Rossi',
    };
    service.user.attributes = attributes;
    service.user.groups = ['Admin', 'Editor'];
    service.loggedIn = true;

    await expectAsync(service.logIn()).toBeResolvedTo(service.user);

    expect(service.user.getId()).toBe('user-123');
    expect(service.user.getName()).toBe('Mario');
    expect(service.user.getSurname()).toBe('Rossi');
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.user.isAdmin()).toBeTrue();
    expect(service.user.isEditor()).toBeTrue();
  });

  it('should clear cached user data on logout', () => {
    service.user.attributes = { sub: 'user-123' };
    service.user.groups = ['Admin'];
    service.loggedIn = true;

    service.logOut();

    expect(service.user.getId()).toBe('');
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.user.isAdmin()).toBeFalse();
    expect(service.user.isEditor()).toBeFalse();
  });
});
