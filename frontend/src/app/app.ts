import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { UiCardComponent } from './shared/components/ui-card/ui-card';

@Component({ selector: 'app-root', standalone: true, imports: [Button, RouterLink, RouterOutlet, UiCardComponent], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly isDark = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly navigation = [
    { label: 'Inicio', icon: '⌂', route: '/', active: true }, { label: 'Usuarios', icon: '◉', route: '/usuarios', active: false }, { label: 'Reportes', icon: '▤', route: '/reportes', active: false }, { label: 'Configuración', icon: '⚙', route: '/configuracion', active: false },
  ];
  protected readonly metrics = [
    { label: 'Usuarios activos', value: '1,284', change: '+12.5% este mes', icon: '◉', tone: 'blue', negative: false }, { label: 'Acciones pendientes', value: '24', change: '8 requieren atención', icon: '✓', tone: 'amber', negative: false }, { label: 'Reportes generados', value: '86', change: '+8.2% este mes', icon: '▤', tone: 'violet', negative: false }, { label: 'Alertas de seguridad', value: '3', change: 'Revisar hoy', icon: '!', tone: 'red', negative: true },
  ];
  protected readonly activities = [
    { initials: 'AM', title: 'Ana Martínez actualizó un reporte', detail: 'Reporte de accesos · Agosto 2026', time: 'Hace 12 min', tone: 'blue' }, { initials: 'CR', title: 'Carlos Rivera añadió un usuario', detail: 'Nuevo integrante en el equipo de soporte', time: 'Hace 1 h', tone: 'violet' }, { initials: 'LS', title: 'Lucía Sánchez resolvió una alerta', detail: 'Intento de acceso identificado y bloqueado', time: 'Hace 3 h', tone: 'green' },
  ];
  constructor() { this.setTheme(this.document.defaultView?.localStorage?.getItem('theme') === 'dark'); }
  protected toggleTheme(): void { this.setTheme(!this.isDark()); }
  protected toggleSidebar(): void { this.sidebarCollapsed.update(value => !value); }
  private setTheme(dark: boolean): void { this.isDark.set(dark); this.document.documentElement.classList.toggle('app-dark', dark); this.document.defaultView?.localStorage?.setItem('theme', dark ? 'dark' : 'light'); }
}
