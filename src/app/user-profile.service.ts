import { Injectable } from '@angular/core'
import { fetchUserAttributes, fetchAuthSession, UserAttributeKey } from 'aws-amplify/auth'

export class UserData {
  attributes: Partial<Record<UserAttributeKey, string>> = {}
  groups: string[] = []

  clear() {
    this.attributes = {}
    this.groups = []
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

  user: UserData = new UserData()

  loggedIn:boolean = false

  /**
   * To be called after the user has logged in, to fetch and cache the user attributes and groups
   * 
   * @returns a Promise with the user attributes.
   */
  async logIn(): Promise<UserData> {

    if (this.loggedIn) {
      return this.user
    }
    
    let authSession: any

    [this.user.attributes, authSession] = await Promise.all([
        fetchUserAttributes(),
        fetchAuthSession()
      ]);

    console.log("User logged in", this.user.attributes)

    const groups = authSession.tokens?.idToken?.payload['cognito:groups']
    this.user.groups = Array.isArray(groups) ? groups.map(obj => obj?.toString() || "?") : []

    this.loggedIn = true

    return this.user;
  }

  logOut(): void {
    console.log("User logged out, clearing cached attributes and groups")
    this.user.clear()
    this.loggedIn = false
  }

  isLoggedIn(): boolean {
    return this.loggedIn
  }

}
