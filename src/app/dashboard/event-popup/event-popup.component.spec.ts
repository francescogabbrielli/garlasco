import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventPopupComponent } from './event-popup.component';
import { UserData, UserProfileService } from '../../user-profile.service';

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    models: {
      Event: { get: vi.fn().mockResolvedValue({ data: { actors: [] } }) },
      Person: { list: vi.fn().mockResolvedValue({ data: [] }) },
      EventPerson: { list: vi.fn().mockResolvedValue({ data: [] }) },
    },
  }),
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      EventPerson: { list: vi.fn().mockResolvedValue({ data: [] }) },
    },
  }),
}));

const EVENT = {
  id: 'e1',
  type: 'Fatto',
  name: 'Evento di prova',
  description: 'Descrizione',
  owner: 'u1',
  start_date: '2026-01-01T10:00:00.000Z',
  end_date: null,
  start_position: { latitude: 45, longitude: 9, radius: 10 },
  end_position: null,
  relevance: 2,
  reliability: 3,
};

describe('EventPopupComponent', () => {
  let fixture: ComponentFixture<EventPopupComponent>;

  function create(groups: string[], editEnabled = false) {
    const user = new UserData({ sub: 'u1' }, groups);
    user.editEnabled.set(editEnabled);
    TestBed.overrideProvider(UserProfileService, { useValue: { user: () => user } });
    fixture = TestBed.createComponent(EventPopupComponent);
    fixture.componentRef.setInput('event', EVENT);
    fixture.componentRef.setInput('people', []);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EventPopupComponent] }).compileComponents();
  });

  it('should show read-only details to non editors', () => {
    create([]);

    expect(fixture.nativeElement.querySelector('dl.event-fields')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-event-mask')).toBeNull();
  });

  it('should allow an event owner to edit when editing is enabled', () => {
    create(['Editor'], true);

    expect(fixture.componentInstance.isEditor()).toBe(true);
  });

  it('should show read-only details to editors who did not enable editing', () => {
    create(['Editor']);

    expect(fixture.nativeElement.querySelector('app-event-mask')).toBeNull();
  });

  it('should emit closed on escape', () => {
    create([]);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    fixture.componentInstance.onEscape();

    expect(closed).toHaveBeenCalled();
  });
});
