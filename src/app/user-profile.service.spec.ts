import { TestBed } from '@angular/core/testing';
import { UserData, UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);
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

  it('should clear cached user data and editEnabled on logout', () => {
    const user = new UserData({ sub: 'user-123' }, ['Admin']);
    user.editEnabled.set(true);
    service.user.set(user);

    service.logOut();

    expect(user.getId()).toBe('');
    expect(user.isAdmin()).toBe(false);
    expect(user.isEditor()).toBe(false);
    expect(user.editEnabled()).toBe(false);
  });

  it('should default editEnabled to false', () => {
    expect(new UserData().editEnabled()).toBe(false);
  });

  it('should restore editEnabled from localStorage', () => {
    localStorage.setItem('editEnabled', 'true');
    expect(new UserData().editEnabled()).toBe(true);
  });

  it('should persist editEnabled to localStorage', () => {
    const user = new UserData({ sub: 'u' }, ['Editor']);
    service.user.set(user);
    user.editEnabled.set(true);
    TestBed.tick();

    expect(localStorage.getItem('editEnabled')).toBe('true');
  });
});
