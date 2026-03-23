import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shared/components/shell/shell.component';

export const routes: Routes = [
  // Auth routes (public — redirect to dashboard if already logged in)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },

  // Protected routes wrapped in shell layout
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-grid/calendar-grid.component').then(
            (m) => m.CalendarGridComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'sprints',
        loadComponent: () =>
          import('./features/jira/jira.component').then((m) => m.JiraComponent),
      },
      {
        path: 'sprints/planning',
        loadComponent: () =>
          import('./features/sprints/planning-session/planning-session.component').then(
            (m) => m.PlanningSessionComponent,
          ),
      },
      {
        path: 'sprints/planning/:sessionId',
        loadComponent: () =>
          import('./features/sprints/planning-session/planning-session.component').then(
            (m) => m.PlanningSessionComponent,
          ),
      },
      {
        path: 'teams',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/teams/teams/teams.component').then(
            (m) => m.TeamsComponent,
          ),
      },
      {
        path: 'teams/:id/settings',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/teams/team-settings/team-settings.component').then(
            (m) => m.TeamSettingsComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Default fallback
  { path: '**', redirectTo: '/login' },
];
