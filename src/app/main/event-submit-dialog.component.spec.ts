import { TestBed } from '@angular/core/testing'
import { describe, expect, it, vi } from 'vitest'

import { EventSubmitDialogComponent } from './event-submit-dialog.component'

const people = [
  { id: '2', name: 'Anna', surname: 'Rossi' },
  { id: '1', name: 'Luca', surname: 'Bianchi' },
]

async function setup(list: () => Promise<unknown>) {
  await TestBed.configureTestingModule({ imports: [EventSubmitDialogComponent] }).compileComponents()
  const fixture = TestBed.createComponent(EventSubmitDialogComponent)
  vi.spyOn(fixture.componentInstance, 'createClient').mockReturnValue(
    { models: { Person: { list } } } as never,
  )
  return fixture
}

describe('EventSubmitDialogComponent', () => {
  it('loads people sorted by surname', async () => {
    const fixture = await setup(async () => ({ data: [...people], errors: undefined }))
    await fixture.componentInstance.ngOnInit()
    expect(fixture.componentInstance.people().map(p => p.surname)).toEqual(['Bianchi', 'Rossi'])
    expect(fixture.componentInstance.peopleLoading()).toBe(false)
  })

  it('reports load errors', async () => {
    const fixture = await setup(async () => { throw new Error('boom') })
    await fixture.componentInstance.ngOnInit()
    expect(fixture.componentInstance.peopleLoadError()).toContain('boom')
  })

  it('emits closed', async () => {
    const fixture = await setup(async () => ({ data: [] }))
    const spy = vi.fn()
    fixture.componentInstance.closed.subscribe(spy)
    fixture.componentInstance.closeDialog()
    expect(spy).toHaveBeenCalled()
  })
})
