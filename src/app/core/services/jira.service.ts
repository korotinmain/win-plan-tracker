import { inject, Injectable } from '@angular/core';
import { httpsCallable, Functions } from '@angular/fire/functions';

export interface JiraTask {
  id: string;
  title: string;
  status: string;
  statusCategory: string;
  priority: string;
  type: string;
  project: string;
  updated: string | null;
}

export interface JiraSprintIssue {
  id: string;
  title: string;
  status: string;
  statusCategory: string;
  priority: string;
  type: string;
  assignee: string | null;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  issues: JiraSprintIssue[];
  stats: { total: number; done: number };
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private functions = inject(Functions);

  async checkConfigured(): Promise<{
    configured: boolean;
    domain: string | null;
  }> {
    const fn = httpsCallable<
      null,
      { configured: boolean; domain: string | null }
    >(this.functions, 'checkJiraConfig');
    const result = await fn(null);
    return result.data;
  }

  async fetchTasks(): Promise<JiraTask[]> {
    const fn = httpsCallable<null, { tasks: JiraTask[] }>(
      this.functions,
      'getJiraTasks',
    );
    const result = await fn(null);
    return result.data.tasks ?? [];
  }

  async fetchSprints(boardId: string): Promise<JiraSprint[]> {
    const fn = httpsCallable<{ boardId: string }, { sprints: JiraSprint[] }>(
      this.functions,
      'getJiraSprints',
    );
    const result = await fn({ boardId });
    return result.data.sprints ?? [];
  }
}
