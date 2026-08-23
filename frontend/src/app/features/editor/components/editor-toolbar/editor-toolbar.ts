import { Component, HostListener, signal } from '@angular/core';
import { LucideCheck, LucideChevronDown, LucideChevronRight, LucideShare2 } from '@lucide/angular';
import { UiBrandLogoComponent } from '../../../../shared/components/ui-brand-logo/ui-brand-logo';

type MenuId = 'archivo' | 'editar' | 'insertar' | 'vista' | 'formato' | 'ayuda';

interface EditorMenuItem {
  label: string;
  shortcut?: string;
  children?: EditorMenuItem[];
  separatorBefore?: boolean;
  section?: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [LucideCheck, LucideChevronDown, LucideChevronRight, LucideShare2, UiBrandLogoComponent],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
})
export class EditorToolbarComponent {
  readonly openMenu = signal<MenuId | null>(null);
  readonly openSubmenu = signal<string | null>(null);
  readonly isProjectMenuOpen = signal(false);
  readonly menuOrder: MenuId[] = ['archivo', 'editar', 'insertar', 'vista', 'formato', 'ayuda'];
  readonly menuLabels: Record<MenuId, string> = {
    archivo: 'Archivo',
    editar: 'Editar',
    insertar: 'Insertar',
    vista: 'Vista',
    formato: 'Formato',
    ayuda: 'Ayuda',
  };
  readonly menus: Record<MenuId, EditorMenuItem[]> = {
    archivo: [
      { label: 'Nuevo archivo' },
      { label: 'Nueva carpeta' },
      { label: 'Subir archivo' },
      { label: 'Hacer una copia' },
      { label: 'Historial de versiones', separatorBefore: true },
      { label: 'Contar palabras' },
      { label: 'Enviar', separatorBefore: true },
      {
        label: 'Descargar',
        children: [{ label: 'Opciones de descarga' }],
        separatorBefore: true,
      },
      { label: 'Configuración', separatorBefore: true },
    ],
    editar: [
      { label: 'Deshacer', shortcut: 'Ctrl + Z' },
      { label: 'Rehacer', shortcut: 'Ctrl + Y' },
      { label: 'Buscar', shortcut: 'Ctrl + F', separatorBefore: true },
      { label: 'Seleccionar todo', shortcut: 'Ctrl + A' },
    ],
    insertar: [
      {
        label: 'Matemáticas',
        children: [{ label: 'Matemática en línea' }, { label: 'Matemática en bloque' }],
      },
      { label: 'Símbolo' },
      {
        label: 'Figura',
        children: [
          { label: 'Subir desde el equipo' },
          { label: 'Desde los archivos del proyecto' },
          { label: 'Desde otro proyecto' },
          { label: 'Desde URL' },
        ],
      },
      { label: 'Tabla' },
      { label: 'Cita' },
      { label: 'Enlace' },
      { label: 'Referencia cruzada' },
      { label: 'Comentario', separatorBefore: true },
      { label: 'Resumen', separatorBefore: true },
      { label: 'Palabras clave' },
      { label: 'Título' },
    ],
    vista: [
      { label: 'Opciones de diseño', section: true },
      { label: 'Vista dividida', selected: true },
      { label: 'Solo editor' },
      { label: 'Solo PDF' },
      { label: 'Abrir PDF en una pestaña separada' },
      { label: 'Modo enfoque', shortcut: 'Ctrl + Shift + M', separatorBefore: true },
      {
        label: 'Modo de edición',
        children: [{ label: 'Edición', selected: true }, { label: 'Revisión' }],
        separatorBefore: true,
      },
      { label: 'Configuración del editor', separatorBefore: true },
      { label: 'Mostrar ruta de navegación' },
      { label: 'Mostrar pestañas del editor', selected: true },
      { label: 'Mostrar vista previa de ecuaciones', selected: true },
      { label: 'Vista previa del PDF', separatorBefore: true },
      { label: 'Modo presentación' },
      {
        label: 'Zoom del PDF',
        children: [
          { label: 'Acercar' },
          { label: 'Alejar' },
          { label: 'Ajustar al ancho' },
          { label: 'Ajustar a la altura' },
        ],
      },
    ],
    formato: [
      { label: 'Negrita', shortcut: 'Ctrl + B' },
      { label: 'Cursiva', shortcut: 'Ctrl + I' },
      { label: 'Lista con viñetas', separatorBefore: true },
      { label: 'Lista numerada' },
      { label: 'Aumentar sangría' },
      { label: 'Disminuir sangría' },
      { label: 'Estilos de párrafo', section: true, separatorBefore: true },
      { label: 'Normal' },
      { label: 'Sección' },
      { label: 'Subsección' },
      { label: 'Subsubsección' },
      { label: 'Párrafo' },
      { label: 'Subpárrafo' },
    ],
    ayuda: [{ label: 'Atajos de teclado' }, { label: 'Documentación' }, { label: 'Contacto' }],
  };
  readonly projectMenuItems: EditorMenuItem[] = [
    { label: 'Enviar' },
    { label: 'Descargar como PDF', separatorBefore: true },
    { label: 'Descargar como fuente (.zip)' },
    { label: 'Exportar como documento Word (.docx)' },
    { label: 'Exportar como Markdown (.md)' },
    { label: 'Exportar como HTML (.html)' },
    { label: 'Hacer una copia', separatorBefore: true },
    { label: 'Renombrar' },
  ];

  toggleMenu(menu: MenuId): void {
    this.openMenu.update((current) => (current === menu ? null : menu));
    this.openSubmenu.set(null);
    this.isProjectMenuOpen.set(false);
  }

  toggleProjectMenu(): void {
    this.isProjectMenuOpen.update((isOpen) => !isOpen);
    this.openMenu.set(null);
    this.openSubmenu.set(null);
  }

  toggleSubmenu(menu: MenuId, index: number): void {
    const key = `${menu}-${index}`;
    this.openSubmenu.update((current) => (current === key ? null : key));
  }

  showSubmenu(menu: MenuId, index: number): void {
    this.openSubmenu.set(`${menu}-${index}`);
  }

  hideSubmenu(): void {
    this.openSubmenu.set(null);
  }

  closeMenus(): void {
    this.openMenu.set(null);
    this.openSubmenu.set(null);
    this.isProjectMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;

    if (!target?.closest('.menu-wrapper, .project-menu-wrapper')) this.closeMenus();
  }
}
