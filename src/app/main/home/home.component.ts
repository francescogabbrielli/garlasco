import { Component, effect, inject, OnInit } from '@angular/core';
import { UserProfileService } from '../../user-profile.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  userService = inject(UserProfileService)
  router = inject(Router)

  async ngOnInit() {
    const user = await this.userService.logIn()
    if (user.isMember()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/welcome']);
    }
  }

}
