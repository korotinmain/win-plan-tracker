import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
  CdkDragDrop,
  CdkDragPreview,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  JiraService,
  JiraSprint,
  JiraSprintIssue,
} from '../../../core/services/jira.service';
import { PlanningService } from '../../../core/services/planning.service';

export interface PlanMember {
  name: string;
  initials: string;
}

function getWorkDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (cur <= endDate) {
    const d = cur.getDay();
    if (d > 0 && d < 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function nameInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

@Component({
  selector: 'app-sprint-planning',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    CdkDragPreview,
  ],
  templateUrl: './sprint-planning.component.html',
  styleUrls: ['./sprint-planning.component.scss'],
})
export class SprintPlanningComponent implements OnInit {
  private jiraService = inject(JiraService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private planningService = inject(PlanningService);

  readonly BOARD_ID = '1671';
  readonly SP_OPTIONS = [1, 2, 3, 5, 8, 13];

  // ── Participants passed from member-select dialog ──────────────────────────
  private selectedParticipants: PlanMember[] | null = null;

  // ── Session save state ────────────────────────────────────────────────────
  savingSession = signal(false);
  sessionSaved = signal(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  loading = signal(false);
  configured = signal<boolean | null>(null);
  configuredDomain = signal<string | null>(null);

  // ── Sprint data ───────────────────────────────────────────────────────────
  activeSprint = signal<JiraSprint | null>(null);
  futureSprint = signal<JiraSprint | null>(null);

  // ── CDK mutable arrays ────────────────────────────────────────────────────
  backlogIssues: JiraSprintIssue[] = []; // issues from the next sprint
  memberIssues: JiraSprintIssue[][] = [];
  members: PlanMember[] = [];

  // ── Filters ───────────────────────────────────────────────────────────────
  backlogSearch = '';
  backlogTypeFilter = 'all';

  // ── Turn management ───────────────────────────────────────────────────────
  turnIndex = signal(0);

  // ── Sprint timeline ───────────────────────────────────────────────────────
  workDays: Date[] = [];
  week1Days: Date[] = [];
  week2Days: Date[] = [];
  daysLeft = 0;

  // ── Estimation ────────────────────────────────────────────────────────────
  estimatingId = signal<string | null>(null);
  storyPoints: Record<string, number> = {};

  // ── Capacity drawer ───────────────────────────────────────────────────────
  capacityDrawerOpen = signal(false);

  // ── Computed getters ──────────────────────────────────────────────────────

  get currentTurnMember(): PlanMember | null {
    return this.members[this.turnIndex()] ?? null;
  }

  get currentTurnFirstName(): string {
    return this.currentTurnMember?.name.split(' ')[0] ?? '—';
  }

  get sprintProgress(): number {
    const s = this.activeSprint();
    if (!s?.stats.total) return 0;
    return Math.round((s.stats.done / s.stats.total) * 100);
  }

  get totalSP(): number {
    return Object.values(this.storyPoints).reduce((a, b) => a + b, 0);
  }

  get sprintTotalIssues(): number {
    return this.memberIssues.reduce((a, arr) => a + arr.length, 0);
  }

  get capacities(): Array<{
    name: string;
    initials: string;
    pct: number;
    level: 'safe' | 'warn' | 'over';
  }> {
    const counts = this.memberIssues.map((arr) => arr.length);
    const max = Math.max(...counts, 1);
    return this.members.map((m, i) => {
      const raw = Math.round((counts[i] / max) * 82) + 12;
      const pct = Math.min(raw, 98);
      return {
        name: m.name,
        initials: m.initials,
        pct,
        level: (pct > 74 ? 'over' : pct > 52 ? 'warn' : 'safe') as
          | 'safe'
          | 'warn'
          | 'over',
      };
    });
  }

  get overloadedMember(): string | null {
    return this.capacities.find((c) => c.level === 'over')?.name ?? null;
  }

  matchesBacklogFilter(issue: JiraSprintIssue): boolean {
    const q = this.backlogSearch.toLowerCase();
    const t = this.backlogTypeFilter;
    return (
      (!q ||
        issue.title.toLowerCase().includes(q) ||
        issue.id.toLowerCase().includes(q)) &&
      (t === 'all' || issue.type.toLowerCase() === t)
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    // Read participants forwarded from the member-select dialog
    const state = this.router.lastSuccessfulNavigation?.extras?.state as
      | { participants?: PlanMember[] }
      | undefined;
    this.selectedParticipants = state?.participants ?? null;
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { configured, domain } = await this.jiraService.checkConfigured();
      this.configured.set(configured);
      this.configuredDomain.set(domain ?? null);
      if (!configured) return;

      const sprints = await this.jiraService.fetchSprints(this.BOARD_ID);
      const active = sprints.find((s) => s.state === 'active') ?? null;
      const future = sprints.find((s) => s.state === 'future') ?? null;

      this.activeSprint.set(active);
      this.futureSprint.set(future);

      // Sprint work days
      if (active?.startDate && active?.endDate) {
        const start = new Date(active.startDate);
        const end = new Date(active.endDate);
        this.workDays = getWorkDays(start, end);
        this.week1Days = this.workDays.slice(0, 5);
        this.week2Days = this.workDays.slice(5, 10);
        this.daysLeft = getWorkDays(new Date(), end).length;
      }

      // Build member rows from active sprint
      const memberMap = new Map<string, JiraSprintIssue[]>();
      for (const issue of active?.issues ?? []) {
        const name = issue.assignee ?? 'Unassigned';
        if (!memberMap.has(name)) memberMap.set(name, []);
        memberMap.get(name)!.push(issue);
      }
      this.members = Array.from(memberMap.keys()).map((name) => ({
        name,
        initials: nameInitials(name),
      }));
      this.memberIssues = Array.from(memberMap.values()).map((arr) => [...arr]);

      // Next sprint issues auto-populate the planning column
      this.backlogIssues = [...(future?.issues ?? [])];
    } catch {
      this.configured.set(false);
      this.snackBar.open('Failed to load sprint data', 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.loading.set(false);
    }
  }

  toggleCapacityDrawer(): void {
    this.capacityDrawerOpen.update((v) => !v);
  }

  // ── Drop handlers ─────────────────────────────────────────────────────────

  onDropBacklog(event: CdkDragDrop<JiraSprintIssue[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
  }

  onDropMember(event: CdkDragDrop<JiraSprintIssue[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const dropped = event.container.data[event.currentIndex];
      if (dropped && this.storyPoints[dropped.id] === undefined) {
        this.estimatingId.set(dropped.id);
      }
    }
  }

  // ── Estimation ────────────────────────────────────────────────────────────

  setEstimation(issueId: string, sp: number): void {
    this.storyPoints[issueId] = sp;
    this.estimatingId.set(null);
  }

  dismissEstimation(): void {
    this.estimatingId.set(null);
  }

  // ── Turn ──────────────────────────────────────────────────────────────────

  advanceTurn(): void {
    if (!this.members.length) return;
    this.turnIndex.update((i) => (i + 1) % this.members.length);
  }

  // ── Icon helpers ──────────────────────────────────────────────────────────

  priorityIcon(priority: string): string {
    const map: Record<string, string> = {
      Highest: 'keyboard_double_arrow_up',
      High: 'keyboard_arrow_up',
      Medium: 'drag_handle',
      Low: 'keyboard_arrow_down',
      Lowest: 'keyboard_double_arrow_down',
    };
    return map[priority] ?? 'drag_handle';
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      Bug: 'bug_report',
      Story: 'auto_stories',
      Epic: 'flash_on',
      Task: 'task_alt',
      Subtask: 'check_circle_outline',
    };
    return map[type] ?? 'task_alt';
  }

  statusChipClass(sc: string): string {
    const map: Record<string, string> = {
      done: 'sc-done',
      green: 'sc-done',
      'in-progress': 'sc-prog',
      yellow: 'sc-prog',
      new: 'sc-todo',
      'blue-gray': 'sc-todo',
    };
    return map[sc] ?? 'sc-def';
  }
}
