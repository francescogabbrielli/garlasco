import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainComponent } from '../../main/main.component';
import { DataService } from '../../data.service';

import { EventPopupComponent } from './event-popup.component';
import { UserData, UserProfileService } from '../../user-profile.service';

vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      Event: { get: vi.fn().mockResolvedValue({ data: { actors: [] } }) },
      Person: { list: vi.fn().mockResolvedValue({ data: [] }) },
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
  startDate: '2026-01-01T10:00:00.000Z',
  endDate: null,
  startPosition: { latitude: 45, longitude: 9, radius: 10 },
  endPosition: null,
  relevance: 2,
  reliability: 3,
};

describe('EventPopupComponent', () => {
  let fixture: ComponentFixture<EventPopupComponent>;

  function create(groups: string[], editEnabled = false, sub = 'u1') {
    const user = new UserData({ sub }, groups);
    user.editEnabled.set(editEnabled);
    TestBed.overrideProvider(UserProfileService, { useValue: { user: () => user } });
    fixture = TestBed.createComponent(EventPopupComponent);
    fixture.componentRef.setInput('event', EVENT);
    fixture.componentRef.setInput('people', []);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    await TestBed.configureTestingModule({
      imports: [EventPopupComponent],
      providers: [
        { provide: MainComponent, useValue: { isLoading: signal(false) } },
        {
          provide: DataService,
          useValue: {
            getEvent: async () => ({ ...EVENT, sources: [] }),
            loadEventActors: async () => [],
          },
        },
      ]
    }).compileComponents();
  });

  it('should show read-only details to non editors', () => {
    create([]);
    expect(fixture.nativeElement.querySelector('dl.event-fields')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-event-mask')).toBeNull();
  });

  it('should allow an event owner to edit when editing is enabled', async () => {
    create(['Member'], true);
    await fixture.whenStable();
    expect(fixture.componentInstance.isEditor()).toBe(true);
    //expect(fixture.nativeElement.querySelector('app-event-mask')).not.toBeNull();
  });

  it('should show read-only details to editors who did not enable editing', () => {
    create(['Editor']);
    expect(fixture.nativeElement.querySelector('app-event-mask')).toBeNull();
  });

  it('should show read-only details to members are editing another user\'s event', () => {
    create(['Member'], true, 'u2');
    expect(fixture.componentInstance.isEditor()).toBe(false);
    //expect(fixture.nativeElement.querySelector('app-event-mask')).not.toBeNull();
  });

  it('should allow editing to editors editing another user\'s event', () => {
    create(['Editor'], true, 'u2');
    expect(fixture.componentInstance.isEditor()).toBe(true);
    //expect(fixture.nativeElement.querySelector('app-event-mask')).not.toBeNull();
  });

  it('should emit closed on escape', () => {
    create([]);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.onEscape();
    expect(closed).toHaveBeenCalled();
  });
});
