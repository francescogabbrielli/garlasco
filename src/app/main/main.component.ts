import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';
import { AuthAccessService } from '../auth-access.service';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './main.component.html',
  //styleUrl: './main.component.css',
})
export class MainComponent {
  isSubmitDialogOpen = false;
  isUserMenuOpen = false;
  isAdminVisible = false;
  private givenName = '';
  private familyName = '';

  constructor(
    public readonly authenticator: AuthenticatorService,
    private readonly authAccess: AuthAccessService,
    private readonly userProfile: UserProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const [canAccessAdmin, attributes] = await Promise.all([
      this.authAccess.canAccessAdmin(),
      this.userProfile.getUserAttributes(),
    ]);

    this.isAdminVisible = canAccessAdmin;
    this.givenName = attributes['given_name'] ?? '';
    this.familyName = attributes['family_name'] ?? '';
  }

  get loggedUser(): string {
    return `${this.givenName} ${this.familyName}`.trim() || 'Utente';
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(): void {
    this.isUserMenuOpen = false;
    void this.authenticator.signOut();
  }

  openSubmitDialog(): void {
    this.isSubmitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    this.isSubmitDialogOpen = false;
  }
}