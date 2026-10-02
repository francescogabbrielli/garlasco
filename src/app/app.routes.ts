import { Routes } from '@angular/router'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { UserProfileService } from './user-profile.service'

const adminAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const router = inject(Router)
	const attr = await userService.loggedIn()
	console.log('Checking admin access for user:', userService.getId(), userService.userGroups)
	return userService.isAdmin() || router.parseUrl('/')
};

export const routes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./main/main.component').then(
				({ MainComponent }) => MainComponent,
			),
		children: [
			{
				path: '',
				loadComponent: () =>
					import('./home/home.component').then(
						({ HomeComponent }) => HomeComponent,
					),
			},
			{
				path: 'admin',
				canActivate: [adminAccessGuard],
				loadComponent: () =>
					import('./admin/admin.component').then(
						({ AdminComponent }) => AdminComponent,
					),
			},
		],
	},
]
