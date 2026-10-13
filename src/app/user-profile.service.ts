import { computed, effect, Injectable, signal } from '@angular/core'
import { fetchUserAttributes, fetchAuthSession, UserAttributeKey } from 'aws-amplify/auth'

export class UserData {
  attributes: Partial<Record<UserAttributeKey, string>> = {}
  groups: string[] = []
  // whether the user has switched on editing (only meaningful for editors)
  editEnabled = signal(false)

  constructor(attributes: Partial<Record<UserAttributeKey, string>> = {}, groups: string[] = []) {
    this.attributes = attributes
    this.groups = groups
    this.editEnabled.set(JSON.parse(localStorage.getItem('editEnabled') || 'false'))
  }

  clear() {
    this.attributes = {}
    this.groups = []
    this.editEnabled.set(false)
  }

  getId(): string {
    return this.attributes['sub'] ?? ''
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
   * TODO: store user data in local storage to avoid fetching it on every page load
   * 
   * @returns a Promise with the user attributes.
   */
  async logIn(): Promise<UserData> {

    if (this.isLoggedIn()) {
      return this.user()
    }
    
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
    this.user().clear()
  }

  isLoggedIn(): boolean {
    return this.user().getId() !== ''
  }

}
