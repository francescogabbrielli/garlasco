import { Routes } from '@angular/router'
import { inject } from '@angular/core'
import { UserProfileService } from './user-profile.service'

const adminAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const user = await userService.logIn()
	return user.isAdmin()
};

const memberAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const user = await userService.logIn()
	return user.isMember()
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
					import('./main/welcome/welcome.component').then(
						({ WelcomeComponent }) => WelcomeComponent
					)
			},
			{
				path: 'dashboard',
				canActivate: [memberAccessGuard],
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
	{
		path: 'privacy-policy',
		loadComponent: () =>
			import('./privacy-policy/privacy-policy.component').then(
				({ PrivacyPolicyComponent }) => PrivacyPolicyComponent
			)
	},
	{
		path: '**',
		redirectTo: 'assets/landing.html',
	},
]
