import { Routes } from '@angular/router';
import { ProjectListComponent } from './features/projects/pages/project-list/project-list';
import { ComingSoonComponent } from './features/system/pages/coming-soon/coming-soon';
import { AppLayoutComponent } from './layouts/app-layout/app-layout';
export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ProjectListComponent,
      },
      {
        path: 'shared',
        data: { title: 'Compartidos conmigo', description: 'Aquí podrás consultar los proyectos que otras personas compartan contigo.' },
        component: ComingSoonComponent,
      },
      {
        path: 'templates',
        data: { title: 'Plantillas', description: 'Aquí encontrarás plantillas para empezar tus documentos LaTeX más rápido.' },
        component: ComingSoonComponent,
      },
      {
        path: 'trash',
        data: { title: 'Papelera', description: 'Aquí podrás recuperar o eliminar definitivamente tus proyectos.' },
        component: ComingSoonComponent,
      },
      {
        path: 'settings',
        data: { title: 'Configuración', description: 'Aquí podrás personalizar tu cuenta y tu experiencia de edición.' },
        component: ComingSoonComponent,
      },
    ],
  },
];
