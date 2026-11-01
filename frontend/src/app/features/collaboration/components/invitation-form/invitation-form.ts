import { Component, input, output, signal } from '@angular/core';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiDropdownComponent } from '../../../../shared/components/ui-dropdown/ui-dropdown';
import { UiFormFieldComponent } from '../../../../shared/components/ui-form-field/ui-form-field';
import { InvitationRole } from '../../models/invitation.interface';

@Component({
  selector: 'app-invitation-form',
  standalone: true,
  imports: [UiButtonComponent, UiDropdownComponent, UiFormFieldComponent],
  templateUrl: './invitation-form.html',
  styleUrl: './invitation-form.css',
})
export class InvitationFormComponent {
  readonly isSaving = input(false);
  readonly errorMessage = input('');
  readonly invited = output<{ email: string; role: InvitationRole }>();

  readonly roleOptions = [
    { label: 'Editor', value: 'EDITOR' },
    { label: 'Lector', value: 'VIEWER' },
  ];

  readonly email = signal('');
  readonly role = signal<InvitationRole>('EDITOR');
  readonly validationError = signal('');

  updateEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  updateRole(value: string): void {
    this.role.set(value as InvitationRole);
  }

  submit(): void {
    const email = this.email().trim();
    if (!email) {
      this.validationError.set('El correo es obligatorio.');
      return;
    }
    this.validationError.set('');
    this.invited.emit({ email, role: this.role() });
    this.email.set('');
  }
}
