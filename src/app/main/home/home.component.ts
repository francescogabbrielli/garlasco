import { Component, effect, inject } from '@angular/core';
import { UserProfileService } from '../../user-profile.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  userService = inject(UserProfileService)
  router = inject(Router)

  constructor() {
    effect(() => {
      const user =this.userService.user()
      if (!user.getId()) return;
      if (user.isMember()) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/welcome']);
      }
    })
  }

}
