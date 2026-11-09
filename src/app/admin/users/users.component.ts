import { Component, inject, signal, OnInit } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

type CognitoUser = Schema['CognitoUser']['type'];

@Component({
  selector: 'app-users',
  imports: [],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {

  readonly groups = ['Admin', 'Editor', 'Member'] as const

  readonly users = signal<CognitoUser[]>([])
  readonly isLoading = signal(false)
  readonly error = signal('')
  /** username being updated, to show a spinner on its row */
  readonly updating = signal<string | null>(null)

  async ngOnInit(): Promise<void> {
    await this.loadUsers()
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true)
    this.error.set('')
    try {
      const { data, errors } = await client.queries.listUsers()
      if (errors?.length) throw new Error(errors[0]?.message ?? 'Errore sconosciuto')
      this.users.set((data as CognitoUser[]) ?? [])
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossibile caricare gli utenti.')
    } finally {
      this.isLoading.set(false)
    }
  }

  hasGroup(user: CognitoUser, group: string): boolean {
    return (user.groups ?? []).includes(group)
  }

  async toggleGroup(user: CognitoUser, group: string): Promise<void> {

    if (group === 'Admin') {
      alert("Non possibile per il momento!")
      return
    }

    const isMember = this.hasGroup(user, group)
    const action = isMember ? 'remove' : 'add'

    this.updating.set(user.username)
    try {
      const { errors } = await client.mutations.updateUserGroups({
        name: user.givenName!,
        surname: user.familyName!,
        email: user.email!,
        username: user.username,
        group,
        action,
      })
      if (errors?.length) throw new Error(errors[0]?.message ?? 'Errore sconosciuto')

      // Optimistically update the local list
      this.users.update(list =>
        list.map(u =>
          u.username === user.username
            ? {
                ...u,
                groups: isMember
                  ? (u.groups ?? []).filter(g => g !== group)
                  : [...(u.groups ?? []), group],
              }
            : u,
        ),
      )
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : `Impossibile ${action === 'add' ? 'aggiungere' : 'rimuovere'} il gruppo.`)
    } finally {
      this.updating.set(null)
    }
  }

}
