import { TestBed } from '@angular/core/testing';
import { UserData, UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);
    service.clearPreferences();
    service.user.set(new UserData());
    TestBed.tick();
  });

  it('should return the cached user and recognize user roles', async () => {
    const user = new UserData(
      { sub: 'user-123', given_name: 'Mario', family_name: 'Rossi' },
      ['Admin', 'Editor'],
    );
    service.user.set(user);

    await expect(service.logIn()).resolves.toBe(user);

    expect(user.getId()).toBe('user-123');
    expect(user.getName()).toBe('Mario');
    expect(user.getSurname()).toBe('Rossi');
    expect(user.isAdmin()).toBe(true);
    expect(user.isEditor()).toBe(true);
  });

  it('should treat Editor as editor but not admin', () => {
    const user = new UserData({ sub: 'u' }, ['Editor']);
    expect(user.isEditor()).toBe(true);
    expect(user.isAdmin()).toBe(false);
  });

  it('should clear cached user data and all preferences on logout', () => {
    let user = new UserData({ sub: 'user-123' }, ['Admin']);
    service.user.set(user);
    service.setEditEnabled(true);
    service.setPreference('theme', 'dark');
    service.setPreference('dashboardFilters', { personIds: ['person-1'] });

    service.logOut();
    user = service.user();
    TestBed.tick();

    expect(user.getId()).toBe('');
    expect(user.isAdmin()).toBe(false);
    expect(user.isEditor()).toBe(false);
    expect(user.editEnabled()).toBe(false);
    expect(service.getPreference('theme', null)).toBeNull();
    expect(service.getPreference('dashboardFilter', null)).toBeNull();
    expect(service.getPreference('editEnabled', null)).toBeNull();
  });

  it('should default editEnabled to false', () => {
    expect(new UserData().editEnabled()).toBe(false);
  });

  it('should restore editEnabled from the user preferences', () => {
    service.setPreference('editEnabled', true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);

    expect(service.user().editEnabled()).toBe(true);
  });

  it('should persist editEnabled in the user preferences', () => {
    const user = new UserData({ sub: 'u' }, ['Editor']);
    service.user.set(user);
    service.setEditEnabled(true);
    TestBed.tick();

    expect(service.getPreference('editEnabled', false)).toBe(true);
  });
});
