import { Injectable } from '@angular/core';
import {
  format,
  getISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  eachDayOfInterval,
  isWeekend,
} from 'date-fns';

export interface SprintInfo {
  sprintNumber: number;
  percent: number;
  elapsed: number;
  total: number;
  remaining: number;
  startDate: string;
  endDate: string;
  startRaw: Date;
  endRaw: Date;
}

@Injectable({ providedIn: 'root' })
export class SprintService {
  /**
   * Resolves sprint boundaries and progress for the given date (defaults to now).
   * Each sprint = 2 ISO weeks. Week 1-2 = sprint 1, 3-4 = sprint 2, etc.
   */
  getSprintInfo(now = new Date()): SprintInfo {
    const isoWeek = getISOWeek(now);
    const sprintNumber = Math.ceil(isoWeek / 2);
    const isSecondHalf = isoWeek % 2 === 0;
    const sprintStart = isSecondHalf
      ? startOfISOWeek(addWeeks(now, -1))
      : startOfISOWeek(now);
    const sprintEnd = endOfISOWeek(addWeeks(sprintStart, 1));

    const allDays = eachDayOfInterval({ start: sprintStart, end: sprintEnd });
    const workDays = allDays.filter((d) => !isWeekend(d));

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsedDays = workDays.filter((d) => {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dd <= today;
    });

    const percent = workDays.length
      ? Math.min(100, Math.round((elapsedDays.length / workDays.length) * 100))
      : 0;

    return {
      sprintNumber,
      percent,
      elapsed: elapsedDays.length,
      total: workDays.length,
      remaining: workDays.length - elapsedDays.length,
      startDate: format(sprintStart, 'MMM d'),
      endDate: format(sprintEnd, 'MMM d'),
      startRaw: sprintStart,
      endRaw: sprintEnd,
    };
  }
}
