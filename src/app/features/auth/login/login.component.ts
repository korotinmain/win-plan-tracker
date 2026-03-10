import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  loading = signal(false);
  error = signal('');
  hidePassword = signal(true);

  readonly features = [
    {
      icon: 'calendar_month',
      title: 'Sprint Calendar',
      desc: 'Visualize every sprint, holiday and event in one place',
    },
    {
      icon: 'groups',
      title: 'Team Management',
      desc: 'Organize teams, assign roles and track performance',
    },
    {
      icon: 'insights',
      title: 'Live Insights',
      desc: 'Real-time analytics on velocity, workload and wins',
    },
  ];

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.loginWithEmail(
        this.form.value.email!,
        this.form.value.password!,
      );
    } catch (e: any) {
      this.error.set(e.message ?? 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.loginWithGoogle();
    } catch (e: any) {
      this.error.set(e.message ?? 'Google sign-in failed.');
      this.loading.set(false);
    }
  }
}
