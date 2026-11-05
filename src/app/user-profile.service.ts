import { Injectable, signal, effect } from '@angular/core';
import { GraphQLFormattedError } from 'graphql';
import { fetchUserAttributes, fetchAuthSession, UserAttributeKey } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { Schema } from '../../amplify/data/resource'

const client = generateClient<Schema>()
const USER_PREFERENCES_STORAGE_KEY = 'garlasco.userPrefs'

export const PREFERENCE_KEY_THEME = 'theme'
export const PREFERENCE_KEY_DASHBOARD_FILTERS = 'dashboardFilters'
export const PREFERENCE_KEY_EDIT_ENABLED = 'editEnabled'

const PREFERENCE_KEYS = [
  PREFERENCE_KEY_DASHBOARD_FILTERS,
  PREFERENCE_KEY_EDIT_ENABLED,
  PREFERENCE_KEY_THEME,
  'personFilter.selectedTypes'
] as const

type UserPreferences = Record<string, unknown>

export class UserData {

  attributes: Partial<Record<UserAttributeKey, string>> = {}
  groups: string[] = []

  // whether the user has switched on editing
  editEnabled = signal(false)

  constructor(
    attributes: Partial<Record<UserAttributeKey, string>> = {},
    groups: string[] = [],
    editEnabled = false
  ) {
    this.attributes = attributes
    this.groups = groups
    this.editEnabled.set(editEnabled)
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

  user = signal<UserData>(new UserData({}, [], this.getPreference(PREFERENCE_KEY_EDIT_ENABLED, false)))

  constructor() {
    effect(() => {
      const editEnabled = this.user().editEnabled()
      this.setPreference(PREFERENCE_KEY_EDIT_ENABLED, editEnabled)
    })
  }

  getPreference<T>(key: string, defaultValue: T): T {
    const preferences = this.readPreferences()
    return Object.hasOwn(preferences, key) ? preferences[key] as T : defaultValue
  }

  setPreference<T>(key: string, value: T): void {
    const preferences = this.readPreferences()
    preferences[key] = value
    this.writePreferences(preferences)
  }

  clearPreferences(preserve: readonly string[] = []): void {
    const preferences = this.readPreferences()
    const retained = Object.fromEntries(
      Object.entries(preferences).filter(([key]) => preserve.includes(key))
    )
    this.writePreferences(retained)
  }

  setEditEnabled(enabled: boolean): void {
    this.user().editEnabled.set(enabled)
  }

  private readPreferences(): UserPreferences {
    const serialized = localStorage.getItem(USER_PREFERENCES_STORAGE_KEY)
    let preferences: UserPreferences = Object.create(null)

    if (serialized !== null) {
      const parsed: unknown = JSON.parse(serialized)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Invalid user preferences stored in ${USER_PREFERENCES_STORAGE_KEY}`)
      }
      preferences = Object.assign(Object.create(null), parsed) as UserPreferences
    }

    let migratedLegacyPreference = false
    for (const key of PREFERENCE_KEYS) {
      const legacyValue = localStorage.getItem(key)
      if (legacyValue === null) continue

      if (!Object.hasOwn(preferences, key)) {
        preferences[key] = key === PREFERENCE_KEY_THEME ? legacyValue : JSON.parse(legacyValue)
      }
      migratedLegacyPreference = true
    }

    if (migratedLegacyPreference) {
      this.writePreferences(preferences)
      for (const key of PREFERENCE_KEYS) {
        localStorage.removeItem(key)
      }
    }

    return preferences
  }

  private writePreferences(preferences: UserPreferences): void {
    if (Object.keys(preferences).length === 0) {
      localStorage.removeItem(USER_PREFERENCES_STORAGE_KEY)
      return
    }
    localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
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

    this.user.set(new UserData(
      attributes,
      Array.isArray(groups) ? groups.map(obj => obj?.toString() || "?") : [],
      this.getPreference(PREFERENCE_KEY_EDIT_ENABLED, false)
    ))
    return this.user()
  }

  logOut(): void {
    this.user.set(new UserData())
    this.clearPreferences()
  }

  async sendMeEmail(subject: string, message:string, operation: string | undefined = undefined): Promise<{ data: any, errors?: GraphQLFormattedError[] }> {
    return client.queries.sendEmail({
      to: `${this.user().getName()} ${this.user().getSurname()} <${this.user().getEmail()}>`,
      subject,
      message,
      operation
    })
  }

  async sendAdminEmail(subject: string, message:string): Promise<{ data: any, errors?: GraphQLFormattedError[] }> {
    return client.queries.sendEmail({
      replyTo: `${this.user().getName()} ${this.user().getSurname()} <${this.user().getEmail()}>`,
      subject,
      message
    })
  }

}
