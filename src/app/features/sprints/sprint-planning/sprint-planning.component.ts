import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { JiraService, JiraSprint, JiraSprintIssue } from '../../../core/services/jira.service';
import {
  CommitmentLevel,
  EstimateConfidence,
  PlanningService,
  PlanningSession,
  PlanningStep,
  PlanningSummary,
  TaskPlacement,
} from '../../../core/services/planning.service';
import { TeamService } from '../../../core/services/team.service';

interface PlanMember {
  uid?: string;
  name: string;
  initials: string;
}

interface TaskChecklist {
  scopeReady: boolean;
  dependenciesReady: boolean;
  ownerReady: boolean;
  unblocked: boolean;
}

interface SprintWorkflowTask extends JiraSprintIssue {
  storyPoints: number | null;
  bucket: 'backlog' | 'candidate' | 'planned';
  commitment: CommitmentLevel;
  confidence: EstimateConfidence;
  ownerIndex: number | null;
  dayStartIdx: number | null;
  dayEndIdx: number | null;
  checklist: TaskChecklist;
}

const STEPS: Array<{ id: PlanningStep; label: string; icon: string }> = [
  { id: 'review', label: 'Review', icon: 'playlist_add_check' },
  { id: 'estimate', label: 'Estimate', icon: 'calculate' },
  { id: 'plan', label: 'Plan', icon: 'calendar_view_week' },
  { id: 'review-sprint', label: 'Review', icon: 'rule' },
];

function getWorkDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finalDay = new Date(end);
  finalDay.setHours(0, 0, 0, 0);

  while (cursor <= finalDay) {
    const dow = cursor.getDay();
    if (dow > 0 && dow < 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function defaultChecklist(): TaskChecklist {
  return {
    scopeReady: true,
    dependenciesReady: true,
    ownerReady: true,
    unblocked: true,
  };
}

@Component({
  selector: 'app-sprint-planning',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './sprint-planning.component.html',
  styleUrls: ['./sprint-planning.component.scss'],
})
export class SprintPlanningComponent {
  private authService = inject(AuthService);
  private jiraService = inject(JiraService);
  private planningService = inject(PlanningService);
  private teamService = inject(TeamService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  readonly BOARD_ID = '1671';
  readonly COL_WIDTH = 124;
  readonly steps = STEPS;
  readonly spOptions = [1, 2, 3, 5, 8, 13];
  readonly confidenceOptions: EstimateConfidence[] = [
    'confident',
    'uncertain',
    'needs-split',
    'blocked',
  ];
  readonly checklistItems: Array<{ key: keyof TaskChecklist; label: string }> = [
    { key: 'scopeReady', label: 'Scope is clear' },
    { key: 'dependenciesReady', label: 'Dependencies are known' },
    { key: 'ownerReady', label: 'Owner is understood' },
    { key: 'unblocked', label: 'No blocker' },
  ];

  loading = signal(false);
  savingDraft = signal(false);
  finishing = signal(false);
  configured = signal<boolean | null>(null);
  readOnly = signal(false);
  currentStep = signal<PlanningStep>('review');
  sessionId = signal<string | null>(null);
  selectedTaskId = signal<string | null>(null);
  lastSaved = signal<Date | null>(null);
  futureSprint = signal<JiraSprint | null>(null);
  activeSprint = signal<JiraSprint | null>(null);
  members = signal<PlanMember[]>([]);
  tasks = signal<SprintWorkflowTask[]>([]);

  workDays: Date[] = [];
  backlogSearch = '';
  candidateSearch = '';

  private saveSubject = new Subject<void>();

  readonly selectedTask = computed(() => {
    const id = this.selectedTaskId();
    return this.tasks().find((task) => task.id === id) ?? null;
  });

  readonly currentStepIndex = computed(() =>
    this.steps.findIndex((step) => step.id === this.currentStep()),
  );

  readonly reviewSelectedTask = computed(() => {
    const selected = this.selectedTask();
    if (selected) return selected;
    return this.tasks()[0] ?? null;
  });

  readonly backlogTasks = computed(() =>
    this.tasks()
      .filter((task) => task.bucket === 'backlog')
      .filter((task) => this.matchesSearch(task, this.backlogSearch)),
  );

  readonly candidateTasks = computed(() =>
    this.tasks()
      .filter((task) => task.bucket === 'candidate')
      .filter((task) => this.matchesSearch(task, this.candidateSearch)),
  );

  readonly estimatedCandidateTasks = computed(() =>
    this.tasks().filter(
      (task) =>
        task.bucket === 'candidate' &&
        !!task.storyPoints &&
        task.confidence !== 'blocked',
    ),
  );

  readonly estimateQueue = computed(() =>
    this.tasks()
      .filter((task) => task.bucket === 'candidate')
      .sort((a, b) => {
        const aScore = this.estimatePriority(a);
        const bScore = this.estimatePriority(b);
        return aScore - bScore || a.id.localeCompare(b.id);
      }),
  );

  readonly estimateSelectedTask = computed(() => {
    const selected = this.selectedTask();
    if (selected?.bucket === 'candidate') return selected;
    return this.estimateQueue()[0] ?? null;
  });

  readonly plannedTasks = computed(() =>
    this.tasks().filter((task) => task.bucket === 'planned'),
  );

  readonly planSelectedTask = computed(() => {
    const selected = this.selectedTask();
    if (
      selected &&
      (selected.bucket === 'candidate' || selected.bucket === 'planned')
    ) {
      return selected;
    }
    return this.estimatedCandidateTasks()[0] ?? this.plannedTasks()[0] ?? null;
  });

  readonly summary = computed(() => this.buildSummary());

  readonly participantLoads = computed(() => {
    const participants = this.members();
    const planned = this.plannedTasks();
    const plannedSP = participants.map((member, index) => {
      const memberSP = planned
        .filter((task) => task.ownerIndex === index)
        .reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
      return { member, sp: memberSP };
    });

    const activeLoads = plannedSP.filter((item) => item.sp > 0).map((item) => item.sp);
    const average = activeLoads.length
      ? activeLoads.reduce((sum, value) => sum + value, 0) / activeLoads.length
      : 0;

    return plannedSP.map((item) => {
      const overload = average > 0 && item.sp > average * 1.25 && item.sp >= 8;
      return {
        ...item,
        overload,
        pct: average > 0 ? Math.min(100, Math.round((item.sp / average) * 100)) : 0,
      };
    });
  });

  readonly warnings = computed(() => {
    const data = this.summary();
    const warnings: string[] = [];
    if (data.candidateTasks) {
      warnings.push(
        `${data.candidateTasks} candidate task${data.candidateTasks > 1 ? 's' : ''} still not placed on the sprint board.`,
      );
    }
    if (data.missingStoryPoints) {
      warnings.push(
        `${data.missingStoryPoints} task${data.missingStoryPoints > 1 ? 's' : ''} still need story points.`,
      );
    }
    if (data.uncertainTasks) {
      warnings.push(
        `${data.uncertainTasks} task${data.uncertainTasks > 1 ? 's are' : ' is'} marked as uncertain or needing split.`,
      );
    }
    if (data.blockedTasks) {
      warnings.push(
        `${data.blockedTasks} blocked task${data.blockedTasks > 1 ? 's remain' : ' remains'} in the candidate list.`,
      );
    }
    this.participantLoads()
      .filter((item) => item.overload)
      .forEach((item) => warnings.push(`${item.member.name} looks overloaded with ${item.sp} SP.`));
    return warnings;
  });

  constructor() {
    this.saveSubject
      .pipe(debounceTime(1500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.autoSave());
  }

  async ngOnInit(): Promise<void> {
    const state = this.router.lastSuccessfulNavigation?.extras?.state as
      | {
          participants?: PlanMember[];
          sessionId?: string;
          readOnly?: boolean;
        }
      | undefined;

    if (state?.participants?.length) {
      this.members.set([...state.participants]);
    }
    if (state?.sessionId) {
      this.sessionId.set(state.sessionId);
    }
    if (state?.readOnly) {
      this.readOnly.set(true);
    }

    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { configured } = await this.jiraService.checkConfigured();
      this.configured.set(configured);
      if (!configured) return;

      const sprints = await this.jiraService.fetchSprints(this.BOARD_ID);
      const active = sprints.find((sprint) => sprint.state === 'active') ?? null;
      const future = sprints.find((sprint) => sprint.state === 'future') ?? null;
      this.activeSprint.set(active);
      this.futureSprint.set(future);

      const timelineSource = future ?? active;
      if (timelineSource?.startDate && timelineSource?.endDate) {
        this.workDays = getWorkDays(
          new Date(timelineSource.startDate),
          new Date(timelineSource.endDate),
        );
      }

      if (this.sessionId()) {
        const session = await this.planningService.getSessionById(this.sessionId()!);
        if (session) {
          this.loadFromSession(session, future);
          return;
        }
      }

      this.bootstrapFreshPlanning(future);
    } catch {
      this.configured.set(false);
      this.snackBar.open('Failed to load sprint planning workspace.', 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.loading.set(false);
    }
  }

  setStep(step: PlanningStep): void {
    this.currentStep.set(step);
    this.triggerAutoSave();
  }

  nextStep(): void {
    const index = this.steps.findIndex((step) => step.id === this.currentStep());
    if (index < this.steps.length - 1) {
      this.currentStep.set(this.steps[index + 1].id);
      this.triggerAutoSave();
    }
  }

  prevStep(): void {
    const index = this.steps.findIndex((step) => step.id === this.currentStep());
    if (index > 0) {
      this.currentStep.set(this.steps[index - 1].id);
      this.triggerAutoSave();
    }
  }

  selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  addToCandidates(taskId: string): void {
    this.updateTask(taskId, {
      bucket: 'candidate',
      ownerIndex: null,
      dayStartIdx: null,
      dayEndIdx: null,
    });
  }

  moveToBacklog(taskId: string): void {
    this.updateTask(taskId, {
      bucket: 'backlog',
      ownerIndex: null,
      dayStartIdx: null,
      dayEndIdx: null,
    });
  }

  setCommitment(taskId: string, commitment: CommitmentLevel): void {
    this.updateTask(taskId, { commitment });
  }

  toggleChecklist(taskId: string, key: keyof TaskChecklist): void {
    this.mutateTasks((tasks) =>
      tasks.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              checklist: {
                ...task.checklist,
                [key]: !task.checklist[key],
              },
            },
      ),
    );
  }

  setStoryPoints(taskId: string, points: number): void {
    this.updateTask(taskId, {
      storyPoints: points,
      confidence: 'confident',
    });

    const nextUnestimated = this.estimateQueue().find((task) => !task.storyPoints);
    if (nextUnestimated) {
      this.selectedTaskId.set(nextUnestimated.id);
    }
  }

  setConfidence(taskId: string, confidence: EstimateConfidence): void {
    this.updateTask(taskId, { confidence });
  }

  placeSelectedTask(memberIndex: number, dayIndex: number): void {
    if (this.readOnly()) return;
    const task = this.selectedTask();
    if (!task) return;

    const duration = this.taskDuration(task);
    const placement = this.resolveLanePlacement(
      task.id,
      memberIndex,
      dayIndex,
      duration,
    );
    if (!placement) {
      this.snackBar.open('No space left in that lane for this task range.', 'Dismiss', {
        duration: 3000,
      });
      return;
    }

    this.updateTask(task.id, {
      bucket: 'planned',
      ownerIndex: memberIndex,
      dayStartIdx: placement.start,
      dayEndIdx: placement.end,
    });
  }

  autoPlaceSelectedTask(): void {
    if (this.readOnly()) return;
    const task = this.selectedTask();
    if (!task) return;

    const duration = this.taskDuration(task);
    const members = this.members();
    const loadOrder = this.participantLoads()
      .map((item, index) => ({ index, sp: item.sp }))
      .sort((a, b) => a.sp - b.sp);

    for (const candidate of loadOrder) {
      for (let dayIndex = 0; dayIndex < this.workDays.length; dayIndex++) {
        const placement = this.resolveLanePlacement(
          task.id,
          candidate.index,
          dayIndex,
          duration,
        );
        if (placement) {
          this.updateTask(task.id, {
            bucket: 'planned',
            ownerIndex: candidate.index,
            dayStartIdx: placement.start,
            dayEndIdx: placement.end,
          });
          return;
        }
      }
    }

    if (!members.length) {
      this.snackBar.open('No participants selected for planning.', 'Dismiss', {
        duration: 3000,
      });
      return;
    }

    this.snackBar.open('Could not auto-place this task on the board.', 'Dismiss', {
      duration: 3000,
    });
  }

  shiftSelectedTask(delta: number): void {
    if (this.readOnly()) return;
    const task = this.selectedTask();
    if (!task || task.bucket !== 'planned' || task.ownerIndex === null) return;
    const duration = this.taskDuration(task);
    const placement = this.resolveLanePlacement(
      task.id,
      task.ownerIndex,
      (task.dayStartIdx ?? 0) + delta,
      duration,
    );
    if (!placement) return;
    this.updateTask(task.id, {
      dayStartIdx: placement.start,
      dayEndIdx: placement.end,
    });
  }

  changeSelectedDuration(delta: number): void {
    if (this.readOnly()) return;
    const task = this.selectedTask();
    if (!task || task.bucket !== 'planned' || task.ownerIndex === null) return;
    const nextDuration = Math.max(1, this.taskDuration(task) + delta);
    const placement = this.resolveLanePlacement(
      task.id,
      task.ownerIndex,
      task.dayStartIdx ?? 0,
      nextDuration,
    );
    if (!placement) return;
    this.updateTask(task.id, {
      dayStartIdx: placement.start,
      dayEndIdx: placement.end,
    });
  }

  removeFromPlan(taskId: string): void {
    this.updateTask(taskId, {
      bucket: 'candidate',
      ownerIndex: null,
      dayStartIdx: null,
      dayEndIdx: null,
    });
  }

  async saveDraft(): Promise<void> {
    if (this.savingDraft()) return;
    this.savingDraft.set(true);
    try {
      await this.saveDraftInternal();
      this.snackBar.open('Draft saved.', 'OK', { duration: 2500 });
    } catch {
      this.snackBar.open('Failed to save draft.', 'Dismiss', { duration: 3500 });
    } finally {
      this.savingDraft.set(false);
    }
  }

  async finishPlanning(): Promise<void> {
    if (this.readOnly() || this.finishing()) return;
    this.finishing.set(true);
    try {
      if (!this.sessionId()) {
        await this.saveDraftInternal();
      }
      const sessionId = this.sessionId();
      if (!sessionId) throw new Error('Missing draft session id');
      await this.planningService.completePlanning(
        sessionId,
        this.buildPlacements(),
        this.buildSummary(),
        'review-sprint',
      );
      this.snackBar.open('Sprint plan completed.', 'OK', { duration: 2800 });
      this.router.navigate(['/sprints']);
    } catch {
      this.snackBar.open('Failed to complete sprint planning.', 'Dismiss', {
        duration: 3500,
      });
    } finally {
      this.finishing.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/sprints']);
  }

  trackTask(_index: number, task: SprintWorkflowTask): string {
    return task.id;
  }

  trackMember(_index: number, member: PlanMember): string {
    return member.name;
  }

  issueTypeIcon(type: string): string {
    const map: Record<string, string> = {
      Bug: 'bug_report',
      Story: 'auto_stories',
      Epic: 'flash_on',
      Task: 'task_alt',
      Subtask: 'check_circle_outline',
    };
    return map[type] ?? 'task_alt';
  }

  statusTone(statusCategory: string): string {
    const map: Record<string, string> = {
      done: 'done',
      green: 'done',
      'in-progress': 'progress',
      yellow: 'progress',
      new: 'todo',
      'blue-gray': 'todo',
    };
    return map[statusCategory] ?? 'neutral';
  }

  canvasMinWidth(): string {
    return `${172 + this.workDays.length * this.COL_WIDTH}px`;
  }

  taskLeft(task: SprintWorkflowTask): string {
    return `${(task.dayStartIdx ?? 0) * this.COL_WIDTH}px`;
  }

  taskWidth(task: SprintWorkflowTask): string {
    return `${this.taskDuration(task) * this.COL_WIDTH - 10}px`;
  }

  laneTasks(memberIndex: number): SprintWorkflowTask[] {
    return this.plannedTasks()
      .filter((task) => task.ownerIndex === memberIndex)
      .sort((a, b) => (a.dayStartIdx ?? 0) - (b.dayStartIdx ?? 0));
  }

  dayLabel(dayIndex: number): string {
    const day = this.workDays[dayIndex];
    return day
      ? day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
      : '';
  }

  isTaskReady(task: SprintWorkflowTask): boolean {
    return Object.values(task.checklist).every(Boolean);
  }

  confidenceLabel(value: EstimateConfidence): string {
    const map: Record<EstimateConfidence, string> = {
      confident: 'Confident',
      uncertain: 'Uncertain',
      'needs-split': 'Needs split',
      blocked: 'Blocked',
    };
    return map[value];
  }

  commitmentLabel(value: CommitmentLevel): string {
    return value === 'must' ? 'Must-have' : 'Stretch';
  }

  private bootstrapFreshPlanning(futureSprint: JiraSprint | null): void {
    const issues = futureSprint?.issues ?? [];
    const tasks = issues.map((issue) => this.createTask(issue));
    this.tasks.set(tasks);

    if (!this.members().length) {
      const uniqueAssignees = Array.from(
        new Set(issues.map((issue) => issue.assignee).filter(Boolean) as string[]),
      );
      this.members.set(
        uniqueAssignees.map((name) => ({ name, initials: initials(name) })),
      );
    }

    if (tasks[0]) {
      this.selectedTaskId.set(tasks[0].id);
    }
  }

  private loadFromSession(
    session: PlanningSession,
    futureSprint: JiraSprint | null,
  ): void {
    if (!this.members().length) {
      this.members.set(
        (session.participants ?? []).map((name, index) => ({
          name,
          initials: initials(name),
          uid: session.participantIds?.[index],
        })),
      );
    }

    this.currentStep.set(session.workflowStep ?? 'review');

    const savedTasks = (session.tasks ?? []).map((task) => this.fromPlacement(task));
    const savedIds = new Set(savedTasks.map((task) => task.id));
    const freshIssues = (futureSprint?.issues ?? [])
      .filter((issue) => !savedIds.has(issue.id))
      .map((issue) => this.createTask(issue));

    const merged = [...savedTasks, ...freshIssues];
    this.tasks.set(merged);
    if (merged[0]) {
      this.selectedTaskId.set(merged[0].id);
    }
  }

  private createTask(issue: JiraSprintIssue): SprintWorkflowTask {
    return {
      ...issue,
      storyPoints: issue.storyPoints ?? null,
      bucket: 'backlog',
      commitment: 'must',
      confidence: issue.storyPoints ? 'confident' : 'uncertain',
      ownerIndex: null,
      dayStartIdx: null,
      dayEndIdx: null,
      checklist: defaultChecklist(),
    };
  }

  private fromPlacement(task: TaskPlacement): SprintWorkflowTask {
    const bucket =
      task.stageBucket ??
      (task.laneParticipantIndex >= 0 ? 'planned' : 'backlog');

    return {
      id: task.issueId,
      title: task.title,
      status: task.status,
      statusCategory: task.statusCategory,
      priority: task.priority,
      type: task.type,
      assignee: task.assigneeName,
      storyPoints: task.storyPoints || null,
      bucket,
      commitment: task.commitment ?? 'must',
      confidence:
        task.estimateConfidence ??
        (task.storyPoints ? 'confident' : 'uncertain'),
      ownerIndex:
        bucket === 'planned' && task.laneParticipantIndex >= 0
          ? task.laneParticipantIndex
          : null,
      dayStartIdx: task.dayStartIdx ?? null,
      dayEndIdx: task.dayEndIdx ?? null,
      checklist: {
        scopeReady: task.scopeReady ?? true,
        dependenciesReady: task.dependenciesReady ?? true,
        ownerReady: task.ownerReady ?? true,
        unblocked: task.unblocked ?? true,
      },
    };
  }

  private buildPlacements(): TaskPlacement[] {
    return this.tasks().map((task, orderIndex) => ({
      issueId: task.id,
      issueKey: task.id,
      title: task.title,
      assigneeName: task.assignee,
      storyPoints: task.storyPoints ?? 0,
      plannedOwnerName:
        task.ownerIndex !== null ? this.members()[task.ownerIndex]?.name ?? null : null,
      laneParticipantIndex: task.ownerIndex ?? -1,
      orderIndex,
      status: task.status,
      statusCategory: task.statusCategory,
      type: task.type,
      priority: task.priority,
      dayStartIdx: task.dayStartIdx ?? undefined,
      dayEndIdx: task.dayEndIdx ?? undefined,
      stageBucket: task.bucket,
      estimateConfidence: task.confidence,
      commitment: task.commitment,
      scopeReady: task.checklist.scopeReady,
      dependenciesReady: task.checklist.dependenciesReady,
      ownerReady: task.checklist.ownerReady,
      unblocked: task.checklist.unblocked,
    }));
  }

  private buildSummary(): PlanningSummary {
    const tasks = this.tasks();
    const planned = tasks.filter((task) => task.bucket === 'planned');
    const candidates = tasks.filter((task) => task.bucket === 'candidate');
    const participantSP: Record<string, number> = {};
    this.participantLoads().forEach((item) => {
      participantSP[item.member.name] = item.sp;
    });

    return {
      totalStoryPoints: planned.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
      plannedTasks: planned.length,
      unplannedTasks: tasks.filter((task) => task.bucket === 'backlog').length,
      missingStoryPoints: tasks.filter((task) => !task.storyPoints).length,
      overloadedCount: this.participantLoads().filter((item) => item.overload).length,
      participantSP,
      candidateTasks: candidates.length,
      estimatedTasks: tasks.filter((task) => !!task.storyPoints).length,
      uncertainTasks: tasks.filter((task) =>
        task.confidence === 'uncertain' || task.confidence === 'needs-split',
      ).length,
      blockedTasks: tasks.filter((task) => task.confidence === 'blocked').length,
      stretchTasks: tasks.filter((task) => task.commitment === 'stretch').length,
      readyTasks: tasks.filter((task) => this.isTaskReady(task)).length,
    };
  }

  private async saveDraftInternal(): Promise<void> {
    const teamId = this.authService.currentUser?.teamId?.trim();
    const payload = {
      sprintId: this.futureSprint()?.id ?? this.activeSprint()?.id ?? 0,
      sprintName:
        this.futureSprint()?.name ??
        this.activeSprint()?.name ??
        'Sprint Planning',
      teamId,
      participants: this.members().map((member) => member.name),
      participantIds: await this.resolveParticipantIds(),
      turnOrder: this.members().map((member) => member.name),
      guidedModeEnabled: false,
      workflowStep: this.currentStep(),
      tasks: this.buildPlacements(),
      summary: this.buildSummary(),
    };

    if (this.sessionId()) {
      await this.planningService.updateDraft(this.sessionId()!, {
        tasks: payload.tasks,
        summary: payload.summary,
        guidedModeEnabled: payload.guidedModeEnabled,
        turnOrderIndex: 0,
        workflowStep: payload.workflowStep,
      });
    } else {
      const id = await this.planningService.saveDraft(payload);
      this.sessionId.set(id);
    }
    this.lastSaved.set(new Date());
  }

  private triggerAutoSave(): void {
    if (this.readOnly()) return;
    this.saveSubject.next();
  }

  private async autoSave(): Promise<void> {
    if (this.readOnly()) return;
    try {
      await this.saveDraftInternal();
    } catch {
      // silent auto-save failure
    }
  }

  private matchesSearch(task: SprintWorkflowTask, query: string): boolean {
    if (!query.trim()) return true;
    const normalized = query.toLowerCase();
    return (
      task.id.toLowerCase().includes(normalized) ||
      task.title.toLowerCase().includes(normalized) ||
      (task.assignee ?? '').toLowerCase().includes(normalized)
    );
  }

  private estimatePriority(task: SprintWorkflowTask): number {
    if (!task.storyPoints) return 0;
    if (task.confidence === 'needs-split') return 1;
    if (task.confidence === 'uncertain') return 2;
    if (task.confidence === 'blocked') return 3;
    return 4;
  }

  taskDuration(task: SprintWorkflowTask): number {
    if (task.dayStartIdx !== null && task.dayEndIdx !== null) {
      return Math.max(1, task.dayEndIdx - task.dayStartIdx + 1);
    }
    if ((task.storyPoints ?? 0) >= 13) return 3;
    if ((task.storyPoints ?? 0) >= 8) return 2;
    return 1;
  }

  private resolveLanePlacement(
    taskId: string,
    memberIndex: number,
    desiredStart: number,
    duration: number,
  ): { start: number; end: number } | null {
    if (!this.workDays.length) return null;
    const maxStart = Math.max(0, this.workDays.length - duration);
    let start = Math.max(0, Math.min(maxStart, desiredStart));
    let end = start + duration - 1;

    const laneTasks = this.laneTasks(memberIndex).filter((task) => task.id !== taskId);
    const overlaps = () =>
      laneTasks.find(
        (task) =>
          (task.dayStartIdx ?? 0) <= end && (task.dayEndIdx ?? task.dayStartIdx ?? 0) >= start,
      );

    let conflict = overlaps();
    while (conflict) {
      start = (conflict.dayEndIdx ?? conflict.dayStartIdx ?? 0) + 1;
      end = start + duration - 1;
      if (end >= this.workDays.length) return null;
      conflict = overlaps();
    }

    return { start, end };
  }

  private updateTask(taskId: string, patch: Partial<SprintWorkflowTask>): void {
    this.mutateTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    );
  }

  private mutateTasks(
    mutate: (tasks: SprintWorkflowTask[]) => SprintWorkflowTask[],
  ): void {
    const next = mutate([...this.tasks()]);
    this.tasks.set(next);

    if (!next.find((task) => task.id === this.selectedTaskId())) {
      this.selectedTaskId.set(next[0]?.id ?? null);
    }

    this.triggerAutoSave();
  }

  private async resolveParticipantIds(): Promise<string[]> {
    const directIds = this.members()
      .map((member) => member.uid?.trim())
      .filter((uid): uid is string => !!uid);

    if (directIds.length === this.members().length) {
      return directIds;
    }

    const teamId = this.authService.currentUser?.teamId?.trim();
    if (!teamId) {
      return directIds;
    }

    const teamMembers = await this.teamService.getTeamMembers(teamId);
    const uidByName = new Map(
      teamMembers
        .filter((member) => member.displayName)
        .map((member) => [member.displayName, member.uid] as const),
    );

    return this.members()
      .map((member) => member.uid?.trim() || uidByName.get(member.name) || '')
      .filter((uid): uid is string => !!uid);
  }
}
