import { Injectable } from '@angular/core'
import { fetchUserAttributes, fetchAuthSession, UserAttributeKey } from 'aws-amplify/auth'

@Injectable({ providedIn: 'root' })
export class UserProfileService {

  userAttributes: Partial<Record<UserAttributeKey, string>> = {}

  userGroups: string[] = []

  logged:boolean = false

  /**
   * To be called after the user has logged in, to fetch and cache the user attributes and groups
   * 
   * @returns a Promise with the user attributes.
   */
  async loggedIn(): Promise<Partial<Record<UserAttributeKey, string>>> {

    if (this.logged) {
      return this.userAttributes
    }
    
    let authSession: any

    [this.userAttributes, authSession] = await Promise.all([
        fetchUserAttributes(),
        fetchAuthSession()
      ]);

    const groups = authSession.tokens?.idToken?.payload['cognito:groups']
    this.userGroups = Array.isArray(groups) ? groups.map(obj => obj?.toString() || "?") : []

    this.logged = true

    return this.userAttributes;
  }

  loggedOut(): void {
    this.logged = false
    this.userAttributes = {}
    this.userGroups = []
  }

  getId(): string {
    return this.userAttributes['sub'] ?? ''
  }

  getName(): string {
    return this.userAttributes['given_name'] ?? ''
  }

  getSurname(): string {
    return this.userAttributes['family_name'] ?? ''
  }

  isLoggedIn(): boolean {
    return this.logged
  }

  isAdmin(): boolean {
    return this.userGroups.includes('Admin')
  }

  isEditor(): boolean {
    return this.userGroups.some(group => group === 'Admin' || group === 'Editor')
  }

}
