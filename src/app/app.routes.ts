import { Routes } from '@angular/router'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { UserProfileService } from './user-profile.service'

const adminAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const router = inject(Router)
	const user = await userService.logIn()
	return user.isAdmin() || router.parseUrl('/')
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
				redirectTo: 'dashboard',
				pathMatch: 'full',
			},
			{
				path: 'dashboard',
				loadComponent: () =>
					import('./dashboard/dashboard.component').then(
						({ DashboardComponent }) => DashboardComponent
					)
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
