import { Routes } from '@angular/router'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { UserProfileService } from './user-profile.service'
import { HomeComponent } from './main/home/home.component';

const adminAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const router = inject(Router)
	const user = await userService.logIn()
	return user.isAdmin() || router.parseUrl('/')
};

const memberAccessGuard = async () => {
	const userService = inject(UserProfileService)
	const router = inject(Router)
	const user = await userService.logIn()
	return user.isMember() || router.parseUrl('/')
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
					import('./main/home/home.component').then(
						({ HomeComponent }) => HomeComponent
					)
			},
			{
				path: 'welcome',
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
				path: 'analysis',
				canActivate: [memberAccessGuard],
				loadComponent: () =>
					import('./analysis/analysis.component').then(
						({ AnalysisComponent }) => AnalysisComponent
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
		canActivate: [
		() => {
			// Forces the browser to load the raw asset file directly
			window.location.href = '/assets/landing.html';
			return false; // Blocks Angular from trying to resolve a component
		}
		],
		// A dummy component is syntactically required by the compiler, but will never load
		component: class DummyComponent {} 
	},
]
