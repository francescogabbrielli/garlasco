import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthAccessService } from './auth-access.service';

const adminAccessGuard = async () => {
	const authAccess = inject(AuthAccessService);
	const router = inject(Router);

	return (await authAccess.canAccessAdmin()) ? true : router.parseUrl('/');
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
];
