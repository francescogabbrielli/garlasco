import { Component, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { UserProfileService } from '../../user-profile.service';

@Component({
  selector: 'app-welcome',
  imports: [],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
})
export class WelcomeComponent {

  userService = inject(UserProfileService)
  router = inject(Router)

  constructor() {
    effect(() => {
      if (this.userService.user().isMember()) {
        this.router.navigate(['/dashboard']);
      }
    })
  }
}
