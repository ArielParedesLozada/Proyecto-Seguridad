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
        data: { projectView: 'all' },
        component: ProjectListComponent,
      },
      {
        path: 'my-projects',
        data: { projectView: 'mine' },
        component: ProjectListComponent,
      },
      {
        path: 'shared',
        data: { projectView: 'shared' },
        component: ProjectListComponent,
      },
      {
        path: 'archived',
        data: { projectView: 'archived' },
        component: ProjectListComponent,
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
