import { Injectable, signal, effect } from '@angular/core';
import { GraphQLFormattedError } from 'graphql';
import { fetchUserAttributes, fetchAuthSession, UserAttributeKey } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { Schema } from '../../amplify/data/resource'

const client = generateClient<Schema>()

export class UserData {

  attributes: Partial<Record<UserAttributeKey, string>> = {}
  groups: string[] = []

  // whether the user has switched on editing
  editEnabled = signal(false)

  constructor(attributes: Partial<Record<UserAttributeKey, string>> = {}, groups: string[] = []) {
    this.attributes = attributes
    this.groups = groups
    this.editEnabled.set(JSON.parse(localStorage.getItem('editEnabled') || 'false'))
  }

  getId(): string {
    return this.attributes['sub'] ?? ''
  }

  getEmail(): string {
    return this.attributes['email'] ?? ''
  }

  getName(): string {
    return this.attributes['given_name'] ?? ''
  }

  getSurname(): string {
    return this.attributes['family_name'] ?? ''
  }

  isAdmin(): boolean {
    return this.groups.includes('Admin')
  }

  isEditor(): boolean {
    return this.groups.some(group => group === 'Admin' || group === 'Editor')
  }

  isMember(): boolean {
    return this.groups.some(group => group === 'Admin' || group === 'Editor' || group === 'Member')
  }

}

@Injectable({ providedIn: 'root' })
export class UserProfileService {

  user = signal<UserData>(new UserData())

  constructor() {
    effect(() => {
      localStorage.setItem('editEnabled', JSON.stringify(this.user().editEnabled()))
    })
  }

  /**
   * To be called after the user has logged in, to fetch and cache the user attributes and groups
   * 
   * TODO: store user data in local storage to avoid fetching it on every page load?
   * 
   * @returns a Promise with the user attributes.
   */
  async logIn(): Promise<UserData> {

    if (this.user().getId())
      return this.user()

    //console.log('Fetching user attributes and auth session...')

    let attributes: Partial<Record<UserAttributeKey, string>> = {}
    let authSession: any

    [attributes, authSession] = await Promise.all([
        fetchUserAttributes(),
        fetchAuthSession()
      ]);

    const groups = authSession.tokens?.idToken?.payload['cognito:groups']

    this.user.set(new UserData(attributes, Array.isArray(groups) ? groups.map(obj => obj?.toString() || "?") : []))
    return this.user()
  }

  logOut(): void {
    this.user.set(new UserData())
  }

  async sendEmail(subject: string, message:string): Promise<{ data: any, errors?: GraphQLFormattedError[] }> {
    return client.queries.sendEmail({
      to: this.user().getEmail(),
      subject,
      message
    })
  }

}
