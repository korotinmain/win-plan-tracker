# Domain Model

## 1. Purpose

This document defines the high-level domain model of WinPlan.

Its purpose is to establish clear ownership boundaries between the main scopes of the product and to prevent the system from evolving into a flat, inconsistent collection of loosely related features.

The model is based on a team-centric operational structure:

- the workspace is the administrative container,
- the team is the core operational unit,
- the user is the actor participating in team-scoped workflows.

This document should guide future product, architecture, and implementation decisions.

---

## 2. Core Principle

The **team** is the key operational unit in WinPlan.

Most day-to-day workflows and business entities must exist in a team context rather than as globally flat data.

This means that major product areas such as:

- sprint planning,
- calendar,
- vacations and days off,
- workload and capacity,
- sprint history,
- planning participants,
- team-specific permissions

must depend on the currently active team.

A user does not interact with WinPlan in isolation.  
A user interacts with WinPlan as a member of a specific team.

---

## 3. Scope Model

WinPlan should be designed around three primary levels of scope:

1. **Workspace / Organization level**
2. **Team level**
3. **User level**

A separate **membership layer** must connect users and teams.

---

## 4. Workspace / Organization Level

The workspace is the top-level container of the system.

It defines the shared product environment and acts as the administrative boundary of the application.

### Workspace responsibilities

The workspace is responsible for:

- containing users,
- containing teams,
- providing the shared environment in which teams operate,
- handling organization-level administration,
- supporting subscription and billing concerns,
- supporting workspace-wide governance where applicable.

### Typical workspace-level entities

Examples of workspace-scoped entities include:

- workspace
- subscription / billing
- global user directory
- workspace invitations
- authentication / identity linkage
- organization-wide administration
- audit metadata
- cross-team reporting (if supported in the future)

### Important boundary rule

The workspace should not directly own day-to-day delivery workflows.

The workspace is an administrative container, not the main execution context for planning and delivery.

---

## 5. Team Level

The team is the core operational unit in WinPlan.

Most practical work inside the product should happen in a team context.

This is the level where delivery planning, availability, sprint work, and coordination become meaningful.

### Team responsibilities

A team owns the main delivery context, including:

- sprint planning,
- sprint history,
- team calendar,
- vacations and days off,
- workload and capacity,
- team events,
- planning participants,
- team roles and permissions,
- delivery-related metrics.

### Typical team-level entities

Examples of team-scoped entities include:

- team
- team membership
- team role
- sprint
- sprint planning session
- planning snapshot
- planning history
- team calendar
- vacation / day off records
- team-specific holidays or planning exceptions
- capacity allocation
- workload distribution
- team settings
- team events
- sprint metrics
- delivery history

### Product expectation

Most product screens that users interact with regularly should be implicitly or explicitly team-scoped.

A user should clearly understand which team they are currently operating in.

---

## 6. User Level

A user exists within the workspace and may belong to one or multiple teams.

The user is the actor in the system, but the user should not be treated as the owner of operational planning data.

### User responsibilities

The user level is responsible for:

- personal identity,
- profile information,
- personal preferences,
- notification settings,
- personal account presence inside the workspace.

### Typical user-level entities

Examples of user-scoped entities include:

- user profile
- display name
- avatar
- contact information
- notification preferences
- personal settings
- account-level preferences

### Important rule

A user may create, view, and interact with team-owned workflows, but those workflows must remain team-owned rather than user-owned.

For example:

- a user participates in sprint planning,
- a user appears on a calendar,
- a user may submit vacation information,

but the operational meaning of those things exists within a team context.

---

## 7. Membership Layer

Users and teams must be connected through a separate membership model.

This layer is critical because the same user may belong to multiple teams and may behave differently in each one.

### Membership responsibilities

Membership should define:

- whether the user belongs to the team,
- what role the user has in that team,
- whether the user is active in that team,
- what allocation or capacity the user has in that team,
- what permissions apply in that team context.

### Why membership matters

Without a membership layer, permissions and planning logic become too global and ambiguous.

Membership allows the product to model cases where:

- the same user is an Admin in one team,
- a Manager in another team,
- and a regular member in a third team.

This is especially important for planning permissions, team visibility, and capacity calculations.

---

## 8. Boundary Model

WinPlan should follow this boundary model:

- **Workspace is the administrative boundary**
- **Team is the operational boundary**
- **User is the actor**
- **Membership connects user and team**

This rule should guide the ownership of entities and workflows throughout the system.

---

## 9. Team-Centric Operational Principle

If a piece of data affects planning, execution, delivery coordination, calendar visibility, capacity, or sprint commitment, it should most likely be team-scoped.

This is the simplest practical rule for deciding where operational data belongs.

### Examples of team-centric data

The following should be treated as team-scoped by default:

- sprint scope
- planning sessions
- planning history
- delivery commitments
- team calendar views
- workload balancing
- absences that affect planning
- team capacity
- sprint metrics

---

## 10. Active Team Context

A user may belong to multiple teams, but at any given moment the system should operate within one **active team context**.

The active team context determines:

- which calendar is shown,
- which sprints are visible,
- which planning sessions are available,
- which planning history is relevant,
- which members participate,
- which vacations matter,
- which capacity model applies,
- which permissions are active.

### Product expectation

The system should feel like:

> You are not just using WinPlan.  
> You are using WinPlan inside a specific team context.

### UX implication

The UI should clearly communicate the current team context, for example through:

- a visible active team indicator,
- a team switcher,
- team-specific navigation state,
- screens that visibly reflect the current team.

---

## 11. Calendar Ownership

Calendar functionality should be team-centric.

A calendar in WinPlan should not be treated as purely global by default.

### Team calendar should include

A team calendar may include:

- sprint dates,
- planning-related events,
- team events,
- holidays relevant to the team,
- vacations and absences,
- availability signals,
- operational scheduling context.

### Why this matters

A calendar only becomes meaningful for delivery when it reflects the team’s actual working context.

A global calendar view may exist later, but the default operational calendar should be team-scoped.

---

## 12. Sprint Ownership

Sprints must belong to a team.

A sprint only makes operational sense in relation to:

- one team,
- that team’s members,
- that team’s delivery scope,
- that team’s capacity,
- that team’s planning process.

### Rule

Sprint planning, sprint history, and sprint commitment must never be modeled as detached from team ownership.

---

## 13. Sprint Planning Ownership

Sprint Planning is a team-owned workflow.

It must always happen inside a team boundary.

### Sprint Planning depends on:

- team members,
- team capacity,
- team roles and permissions,
- the team’s next sprint,
- the team’s delivery context,
- the team’s calendar and availability.

### Why this matters

Without team ownership, planning loses clarity around:

- who participates,
- what capacity is relevant,
- which sprint is being discussed,
- who has permission to facilitate,
- where the result belongs.

Sprint Planning must therefore be treated as a team-scoped operational ritual.

---

## 14. Vacation and Availability Model

Vacation and availability information may originate from a user, but its operational meaning is team-related.

### Important principle

Absence matters because it changes team capacity and planning realism.

That means vacation data should be interpreted in team context, especially when used for:

- sprint planning,
- workload balancing,
- calendar visibility,
- team availability.

### Practical interpretation

Even if a user exists globally, their operational absence matters most within the teams where they actively participate.

---

## 15. Capacity and Workload Model

Capacity should not be treated as a purely global property of a user.

Instead, capacity should be understood as:

> user capacity within a team for a given sprint or timeframe

### Why this matters

The same person may:

- belong to multiple teams,
- have different allocation levels in different teams,
- contribute differently depending on sprint, role, or workload split.

### Product implication

Capacity and workload must be modeled in a way that allows team-specific interpretation.

This makes sprint planning more realistic and prevents incorrect assumptions about availability.

---

## 16. Permissions Model

Permissions should primarily be evaluated in team context.

A user may have a global identity, but operational permissions should usually come from team membership and team role.

### Examples

A user may be:

- Admin in Team A
- Manager in Team B
- Member in Team C

This means permission checks for operational actions such as:

- starting sprint planning,
- managing team calendar,
- reviewing team workload,
- managing team participants

must be based on role in the current team, not only on global identity.

---

## 17. Ownership Rules by Entity Type

### Workspace-level entities

These belong to the workspace as a whole and are not tied to one specific team.

Examples:

- workspace
- subscription / billing
- global user directory
- workspace invitation
- authentication / identity linkage
- organization administration
- audit layer
- future cross-team reporting

### Team-level entities

These belong to a specific team and must be isolated within that team context.

Examples:

- team
- team membership
- team role
- sprint
- sprint planning session
- planning snapshot
- planning history
- team calendar
- vacations / days off
- capacity allocation
- workload distribution
- team events
- team settings
- team-specific permissions
- sprint metrics
- delivery history

### User-level entities

These describe the individual user independently of a specific team workflow.

Examples:

- user profile
- display name
- avatar
- contact information
- personal settings
- notification preferences

---

## 18. Recommended Modeling Rule

When introducing a new feature or entity, the first question should be:

> Is this administrative or operational?

### Guidance

- If it is administrative, it probably belongs to the workspace level.
- If it is delivery-related or operational, it probably belongs to the team level.
- If it describes a person independently from team workflows, it probably belongs to the user level.

This rule should be used as a default architectural heuristic.

---

## 19. Examples

### Example 1 — Sprint Planning

Sprint Planning belongs to the team level because:

- it is performed by a team,
- it depends on team members,
- it depends on team capacity,
- it produces a team-specific sprint commitment.

### Example 2 — Vacation

Vacation may be entered by a user, but its operational meaning is team-level because:

- it affects team capacity,
- it affects team calendar,
- it affects sprint planning.

### Example 3 — Permissions

Permissions should not be treated as purely global.

They should mostly be evaluated through team membership and team role because the same user may have different operational authority in different teams.

---

## 20. Product Design Implications

The domain model must influence product design and UX.

### UX expectations

The UI should make team context obvious and stable.

Users should always be able to understand:

- which team they are currently in,
- whether the data they see is team-scoped,
- whether a workflow belongs to the current team.

### Design guidance

Avoid interfaces that appear globally scoped when the underlying data is actually team-scoped.

The product should visually reinforce the active team context through navigation, headers, selectors, and team-bound workflow entry points.

---

## 21. Anti-Patterns to Avoid

The following patterns should be avoided:

### 21.1 Flat global operational data

Do not store or present operational planning data as if it belongs to the entire workspace by default.

### 21.2 Global permissions for team operations

Do not rely only on global user status for team actions.  
Use team role and membership context.

### 21.3 User-owned sprint data

Do not model sprint planning, sprint commitments, or workload as if they are owned by individual users.

### 21.4 Hidden team context

Do not let users lose track of which team they are operating in.

---

## 22. Summary

WinPlan should be built on a team-centric domain model.

At a high level:

- the workspace is the administrative container,
- the team is the core operational unit,
- the user is the actor,
- membership connects the user to the team context.

Most delivery workflows and operational entities must be team-scoped, including sprint planning, calendar, vacations, capacity, workload, and sprint history.

This model makes the product:

- cleaner,
- easier to reason about,
- more scalable,
- more aligned with real team operations.

---

## 23. Quick Heuristic

If a piece of data affects sprint execution, planning, calendar, workload, availability, or delivery coordination, it should most likely be team-scoped.
