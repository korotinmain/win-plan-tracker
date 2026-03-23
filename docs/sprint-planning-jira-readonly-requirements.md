# Sprint Planning and Jira Read-Only Integration Requirements

## 1. Purpose

This document defines the product requirements for how WinPlan Sprint Planning must work when Jira is used as the source of issue data and WinPlan has read-only access to Jira.

The purpose of this model is to allow teams to run structured sprint planning in WinPlan, preserve planning history, and define planning-specific decisions without turning WinPlan into a Jira editing tool.

WinPlan must support planning as a dedicated workflow layer on top of Jira while keeping Jira as the official system of record for issue data and story points.

---

## 2. Core Integration Principle

Jira must remain the source of truth for issue data and official story point values.

WinPlan must act as a planning layer on top of Jira.

WinPlan must be allowed to:

- read issue data from Jira,
- use Jira issue data during sprint planning,
- store planning-specific artifacts and decisions inside WinPlan.

WinPlan must not:

- modify Jira issues,
- write story points back to Jira,
- update issue fields in Jira,
- change sprint assignment in Jira,
- act as a Jira write interface.

Any official issue updates required after planning must be performed manually in Jira.

---

## 3. Responsibility Model

### 3.1 Jira Responsibilities

Jira is responsible for:

- issue identity,
- issue title,
- issue description,
- assignee,
- status,
- priority,
- official story points,
- current sprint assignment,
- current operational issue state.

### 3.2 WinPlan Responsibilities

WinPlan is responsible for:

- planning sessions,
- planning participants,
- planning decisions,
- planning-specific story point values used during planning,
- sprint planning history,
- planning snapshots,
- planning notes and risks,
- capacity-aware sprint commitment context,
- post-planning review of manual Jira updates.

### 3.3 Product Rule

WinPlan must not attempt to replace Jira as the issue management system.

WinPlan must add planning structure, planning traceability, and planning history on top of Jira data.

---

## 4. Sprint Planning Scope

Sprint Planning in WinPlan must continue to work as a structured planning session for the next sprint.

The planning workflow must support:

- reviewing Jira issues,
- discussing scope,
- assigning planning decisions,
- defining story points during planning,
- reviewing workload and capacity,
- finalizing a planning result,
- preserving the result historically.

The fact that Jira is read-only must not prevent WinPlan from supporting story point discussion and planning decisions inside the planning session.

---

## 5. Issue Data Input

WinPlan must read issue data from Jira and use it as the planning input.

For each issue used during planning, WinPlan should be able to access Jira values such as:

- issue key,
- title,
- description if needed,
- assignee,
- status,
- priority,
- existing Jira story points,
- sprint linkage or sprint relevance where available.

This Jira data must be treated as input data, not as editable state inside WinPlan.

---

## 6. Story Point Model

### 6.1 General Rule

Story points must remain officially owned by Jira.

However, WinPlan must still support story point definition during planning.

### 6.2 Dual-Value Requirement

During planning, WinPlan must distinguish between:

- **Jira story points** — the official current value read from Jira,
- **planned story points** — the value defined or agreed during the WinPlan planning session.

### 6.3 Product Meaning

Planned story points are planning outputs created during the session.

They must be treated as WinPlan planning data, not as a Jira update.

### 6.4 No Automatic Sync

If a team defines or changes story points during planning, WinPlan must store those values inside the planning session and planning snapshot only.

WinPlan must not automatically write those values back to Jira.

### 6.5 Historical Capture

The planning snapshot must preserve both:

- the Jira story point value as seen at planning time,
- the planned story point value agreed during the session.

This is required to preserve traceability between Jira input and planning output.

---

## 7. Planning Decisions per Issue

For each issue reviewed during planning, WinPlan must store planning-specific outcomes.

These outcomes may include:

- confirmed for sprint,
- deferred,
- risky,
- needs clarification,
- reassigned for planning purposes,
- candidate for splitting,
- planned story points,
- notes and rationale.

These decisions must belong to the planning layer and must not be treated as Jira field changes.

---

## 8. Planning Session Requirements

A Sprint Planning session must support the following:

1. read issues from Jira,
2. show Jira issue data to participants,
3. allow the team to discuss each issue,
4. allow the team to define planned story points,
5. allow the team to make issue-level planning decisions,
6. calculate planning totals using planned story points,
7. review capacity and workload,
8. finalize the session,
9. save an immutable planning snapshot.

The planning process must remain useful and complete even though Jira is not updated directly.

---

## 9. Capacity and Totals

When a team defines planned story points during planning, WinPlan must use those planned story points for planning calculations.

This means that planning totals, sprint scope calculations, and workload balancing must be based on the planning values defined during the session rather than only on Jira values.

This is required because Jira values may be missing, incomplete, or outdated at the moment of planning.

---

## 10. Planning Snapshot Requirements

### 10.1 Snapshot Purpose

When planning is finalized, WinPlan must save an immutable planning snapshot.

### 10.2 Snapshot Content

The planning snapshot must preserve the planning result as it existed at the time of finalization.

For each planned issue, the snapshot should include:

- Jira issue key,
- issue title,
- assignee at planning time if relevant,
- Jira story points at planning time,
- planned story points,
- planning decision,
- planning notes if applicable,
- risk markers if applicable.

### 10.3 Sprint-Level Snapshot Content

The snapshot should also preserve:

- sprint identity,
- planning date,
- participants,
- facilitator,
- total planned story points,
- total planned issues,
- deferred issues,
- risky issues,
- capacity context,
- planning summary information.

### 10.4 Immutability Rule

The planning snapshot must remain historically stable even if Jira issue data changes later.

The snapshot must represent the planning result at the moment the session was finalized.

---

## 11. Planning History Requirements

WinPlan must provide a Sprint Planning History view.

Planning History must allow users to review previously finalized planning snapshots.

For each historical planning result, the system should preserve visibility into:

- what was planned,
- what story points were used during planning,
- what Jira story points existed at the time,
- what was deferred,
- what risks were identified,
- who participated,
- when the planning happened.

Planning History must serve as the historical memory of sprint planning.

Jira alone cannot provide this planning history because Jira reflects current issue state rather than planning-session context.

---

## 12. Post-Planning Jira Update Review

### 12.1 Purpose

Because WinPlan does not write to Jira, the system must provide a clear post-planning review step to help users manually update Jira after planning.

### 12.2 Requirement

After the planning session is finalized, WinPlan must provide a post-planning review of issues where story points require manual Jira action.

### 12.3 Review Content

This review must identify issues such as:

- issues with no Jira story points,
- issues where planned story points differ from Jira story points,
- issues that require manual Jira update,
- issues where Jira already matches the planning result.

### 12.4 Value Comparison

The review must clearly distinguish between:

- current Jira story points,
- planned story points from the WinPlan session.

### 12.5 Product Role

This review is not a Jira editing screen.

It is a manual follow-up checklist that helps the team transfer agreed estimates into Jira.

---

## 13. Manual Jira Update Rule

The team must update Jira manually after planning when official story point changes are needed.

WinPlan must not hide this responsibility or imply that Jira was already updated.

If planned story points differ from Jira story points, the product must make that difference clear.

The planning process must support estimation in WinPlan while maintaining Jira as the official record of story points.

---

## 14. User Expectation Rule

The system must make the separation between planning values and Jira values understandable.

Users should be able to understand:

- what value currently exists in Jira,
- what value was agreed during planning,
- what still needs to be updated manually in Jira.

The product must avoid creating false assumptions that planned values are already official Jira values.

---

## 15. Current Sprint and Planning History on the Sprints Page

The `/sprints` area must include:

- the current sprint view,
- sprint planning history,
- access to planning results,
- visibility into total planned story points.

The history section must allow users to inspect what was planned in previous sessions, including the story point totals used at planning time.

This history must reflect planning snapshots stored by WinPlan rather than live Jira state only.

---

## 16. Handling Jira Changes After Planning

Jira issues may change after a planning session is finalized.

For example:

- official story points may be updated manually in Jira,
- assignees may change,
- issue status may change,
- sprint assignments may change.

WinPlan must not retroactively rewrite historical planning snapshots when Jira changes later.

Historical planning records must remain tied to the planning moment.

If the product later wants to surface differences between current Jira state and historical planning state, that may be supported as an additional view, but it must not mutate historical records.

---

## 17. Non-Goals

This requirement set does not define:

- Jira write-back behavior,
- automatic Jira synchronization,
- UI design,
- technical implementation details,
- API integration details,
- permission model for Jira credentials.

This requirement set is focused only on product behavior and ownership boundaries.

---

## 18. Summary

WinPlan must support a full sprint planning workflow while Jira remains read-only.

Jira must remain the official source of issue data and story points.

WinPlan must read issue data from Jira, allow the team to define planning-specific story point values during the session, store planning decisions and immutable planning snapshots, and provide a post-planning review that helps the team manually update Jira afterward.

This model allows WinPlan to deliver structured planning, planning history, and capacity-aware sprint commitment without becoming a Jira editing tool.
