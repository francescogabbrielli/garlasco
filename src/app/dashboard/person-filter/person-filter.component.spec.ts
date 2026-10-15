import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Schema } from '../../../../amplify/data/resource';
import { PersonFilterComponent } from './person-filter.component';
import { vi } from 'vitest';

type Person = Schema['Person']['type'];

function person(id: string, type: string): Person {
  return {
    id,
    name: id,
    surname: 'Test',
    type,
    initials: id.slice(0, 2),
    profession: null
  } as Person;
}

describe('PersonFilterComponent', () => {
  let component: PersonFilterComponent;
  let fixture: ComponentFixture<PersonFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonFilterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only protagonists and witnesses', () => {
    fixture.componentRef.setInput('people', [
      person('lead', 'Protagonista'),
      person('witness', 'Testimone'),
      person('reporter', 'Cronista')
    ]);
    fixture.detectChanges();

    expect(component.filteredPeople().map(item => item.id)).toEqual(['lead', 'witness']);
  });

  it('adds or removes a selected person and clears the selection', () => {
    fixture.componentRef.setInput('selectedIds', ['lead']);
    const selectionChange = vi.fn();
    component.selectionChange.subscribe(selectionChange);

    component.toggle('witness');
    component.toggle('lead');
    component.clear();

    expect(selectionChange.mock.calls).toEqual([[['lead', 'witness']], [[]], [[]]]);
  });
});
