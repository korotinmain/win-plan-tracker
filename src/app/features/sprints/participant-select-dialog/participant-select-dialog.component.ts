import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface PlanMemberOption {
  uid?: string;
  name: string;
  initials: string;
}

export interface ParticipantSelectDialogData {
  members: PlanMemberOption[];
  sprintName: string;
}

function memberKey(member: PlanMemberOption, index: number): string {
  return member.uid?.trim() || `${index}:${member.name}`;
}

const AV_COLORS = [
  { bg: '#eef2ff', text: '#4f46e5' },
  { bg: '#f0fdf4', text: '#16a34a' },
  { bg: '#fefce8', text: '#ca8a04' },
  { bg: '#fdf2f8', text: '#be185d' },
  { bg: '#f5f3ff', text: '#7c3aed' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#ecfeff', text: '#0e7490' },
  { bg: '#fef9c3', text: '#854d0e' },
];

@Component({
  selector: 'app-participant-select-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './participant-select-dialog.component.html',
  styleUrls: ['./participant-select-dialog.component.scss'],
})
export class ParticipantSelectDialogComponent {
  private dialogRef = inject(MatDialogRef<ParticipantSelectDialogComponent>);
  readonly data: ParticipantSelectDialogData = inject(MAT_DIALOG_DATA);

  selected = signal<Set<string>>(
    new Set(this.data.members.map((member, index) => memberKey(member, index))),
  );

  isSelected(member: PlanMemberOption, index: number): boolean {
    return this.selected().has(memberKey(member, index));
  }

  toggle(member: PlanMemberOption, index: number): void {
    const key = memberKey(member, index);
    const s = new Set(this.selected());
    s.has(key) ? s.delete(key) : s.add(key);
    this.selected.set(s);
  }

  selectAll(): void {
    this.selected.set(
      new Set(this.data.members.map((member, index) => memberKey(member, index))),
    );
  }

  clearAll(): void {
    this.selected.set(new Set());
  }

  avColor(index: number): { bg: string; text: string } {
    return AV_COLORS[index % AV_COLORS.length];
  }

  get selectedCount(): number {
    return this.selected().size;
  }

  get selectedMembers(): PlanMemberOption[] {
    return this.data.members.filter((member, index) =>
      this.selected().has(memberKey(member, index)),
    );
  }

  confirm(): void {
    this.dialogRef.close(this.selectedMembers);
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
