export interface SprintCeremonyConfig {
  sprintLengthWeeks: number; // 1 or 2
  planningDow: number; // day-of-week 1=Mon…5=Fri
  planningWeek: number; // 1..sprintLengthWeeks
  refinementDow: number;
  refinementWeek: number;
  sprintReviewDow: number;
  sprintReviewWeek: number;
}

export const DEFAULT_CEREMONY_CONFIG: SprintCeremonyConfig = {
  sprintLengthWeeks: 2,
  planningDow: 1,
  planningWeek: 1,
  refinementDow: 1,
  refinementWeek: 2,
  sprintReviewDow: 5,
  sprintReviewWeek: 2,
};

export interface Team {
  id: string;
  name: string;
  icon: string;
  managerId: string;
  memberIds: string[];
  createdAt: Date;
  holidayCountryCode?: string;
  ceremonyConfig?: SprintCeremonyConfig;
}
