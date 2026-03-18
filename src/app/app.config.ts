import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
// Initialize Firebase eagerly before Angular bootstraps
import './firebase';
import { provideEchartsCore } from 'ngx-echarts';
import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { provideFunctions } from '@angular/fire/functions';
import { firebaseApp } from './firebase';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import { getFunctions } from '@firebase/functions';
import { functions } from './firebase';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideAnimations(),
    provideHttpClient(withFetch()),
    provideEchartsCore({ echarts: () => import('echarts') }),
    provideFirebaseApp(() => firebaseApp),
    provideAuth(() => getAuth(firebaseApp)),
    provideFirestore(() => getFirestore(firebaseApp)),
    provideFunctions(() => functions),
  ],
};
