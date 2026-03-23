# Team Entry and Initial Team Access Requirements

## 1. Purpose

This document defines the requirements for how a user enters WinPlan after login when team context has not yet been established.

The purpose of this flow is to ensure that users do not enter the product without a clear team context, because WinPlan is built around team-scoped operational workflows such as sprint planning, calendar, workload, and vacations.

The system must guide the user into one of the following outcomes:

- join an existing team,
- create a new team,
- or explicitly choose a team if multiple teams are available.

---

## 2. Core Principle

WinPlan must not treat the initial post-login experience as a generic dashboard access flow.

WinPlan must treat the initial post-login experience as a **team access flow**.

If the user does not yet have an active team context, the system must determine the correct team-entry path before allowing normal product usage.

---

## 3. Team Context Rule

A user must operate inside a team context.

This means:

- calendars are team-scoped,
- sprints are team-scoped,
- sprint planning is team-scoped,
- workload and capacity are team-scoped,
- vacations and days off are team-scoped.

Because of this, the system must establish the user’s active team before showing a normal operational dashboard.

---

## 4. Post-Login Routing Requirement

After login, the system must evaluate the user’s team state and route the user accordingly.

The routing decision must be based on:

- whether the user has pending invitations,
- whether the user belongs to any teams,
- whether the user belongs to exactly one team,
- whether the user belongs to multiple teams.

The system must not default to an empty generic dashboard when team context is missing.

---

## 5. Supported Entry Cases

The initial routing flow must support the following cases:

1. user has a pending invitation,
2. user has no teams and no invitations,
3. user belongs to exactly one team,
4. user belongs to multiple teams.

Each case must lead the user toward a clear active team context.

---

## 6. Case 1 — Pending Invitation

### 6.1 Condition

If the user has one or more pending team invitations, the system must present the invitation flow.

### 6.2 Required Behavior

The system must show the pending invitation information in a clear and reviewable way.

For each pending invitation, the user must be able to:

- view the team name,
- understand the invited role if applicable,
- accept the invitation,
- decline the invitation.

### 6.3 After Acceptance

If the user accepts an invitation:

- the user must become a member of that team,
- the accepted team must become the active team,
- the user must be redirected to that team’s dashboard or team-scoped landing area.

### 6.4 After Decline

If the user declines an invitation:

- the invitation must no longer appear as pending,
- the system must reevaluate whether the user has any other team-entry path available.

### 6.5 Multiple Invitations

If the user has multiple pending invitations, the system must allow the user to review and act on each one.

The system must not silently choose one invitation on the user’s behalf.

---

## 7. Case 2 — No Teams and No Invitations

### 7.1 Condition

If the user does not belong to any team and has no pending invitations, the system must not redirect the user to a normal empty dashboard.

### 7.2 Required Behavior

The system must show a team onboarding entry screen.

This screen must explain that WinPlan operates through team context and that the user must either:

- join an existing team,
- or create a new team.

### 7.3 Required Actions

The user must be able to choose between:

- joining an existing team,
- creating a new team.

### 7.4 Product Expectation

This flow must establish the mental model that WinPlan is organized around teams and that operational features only make sense after team context is created or selected.

---

## 8. Join Existing Team Requirement

### 8.1 Purpose

The system must support a path for a user to join an already existing team.

### 8.2 Supported Join Mechanisms

The product may support one or more controlled join mechanisms, such as:

- invitation acceptance,
- invite link,
- invite code,
- other explicit team access flows defined by the product.

### 8.3 Constraints

Joining a team must not be an uncontrolled open action.

A user must only be able to join a team through an allowed access mechanism defined by the system.

### 8.4 After Successful Join

After successfully joining a team:

- the team must become the user’s active team,
- the user must be redirected into that team context,
- normal product usage may begin inside that team scope.

---

## 9. Create New Team Requirement

### 9.1 Purpose

The system must support creation of a new team for users who are not joining an existing one.

### 9.2 Availability

If allowed by product rules, the user must be able to create a new team from the team onboarding flow.

### 9.3 Outcome

After creating a new team:

- the new team must become the active team,
- the creator must receive an elevated role in that team,
- the user must be redirected to that team’s dashboard or team-scoped landing area.

### 9.4 Role Rule

The creator of a new team must receive a team role that allows initial team setup and management.

The exact role label may be defined elsewhere, but it must support initial team administration and operational setup.

---

## 10. Case 3 — User Belongs to Exactly One Team

### 10.1 Condition

If the user belongs to exactly one team, the system should automatically open that team context.

### 10.2 Required Behavior

In this case:

- the single available team must become the active team,
- the user must be redirected directly to that team’s dashboard or team-scoped landing area.

### 10.3 Product Intent

This flow should minimize friction when team choice is unambiguous.

---

## 11. Case 4 — User Belongs to Multiple Teams

### 11.1 Condition

If the user belongs to multiple teams, the system must not automatically choose one team and redirect silently.

### 11.2 Required Behavior

The system must show a **team picker**.

### 11.3 Team Picker Purpose

The team picker must make the active team context explicit before the user enters the workspace.

This is required because different teams may have different:

- calendars,
- sprints,
- planning history,
- workload data,
- roles and permissions,
- operational context.

### 11.4 Team Picker Capabilities

The user must be able to:

- view all teams they belong to,
- understand which teams are available to enter,
- choose one team to activate,
- enter the selected team context.

### 11.5 Selection Result

After the user selects a team:

- the chosen team must become the active team,
- the user must be redirected to that team’s dashboard or team-scoped landing area.

### 11.6 Explicit Selection Principle

When multiple teams exist, the system must require explicit team selection rather than silently restoring or guessing the working context for the user during this initial routing flow.

---

## 12. Active Team Requirement

The system must maintain a concept of an active team.

The active team determines which operational data the user sees, including:

- sprint data,
- planning sessions,
- planning history,
- team calendar,
- vacations and absences,
- workload and capacity,
- team-specific permissions.

The system must not allow the user to enter normal operational workflows without an active team context.

---

## 13. Team Context Visibility Principle

The product must make team context explicit.

Users should be able to understand which team they are about to enter or are currently operating in.

This is especially important when:

- joining a team,
- choosing a team,
- creating a team,
- switching from one team context to another.

The system must not make team context ambiguous.

---

## 14. Empty Dashboard Restriction

The system must not show a normal empty dashboard to a user who has no team context.

A user without team membership or active team selection must instead be routed into the appropriate team-entry flow.

This is required because an empty dashboard without team context would be misleading and would not reflect the core structure of the product.

---

## 15. Team Onboarding Requirement

If the user has no team context, the system must provide a team onboarding experience instead of a standard operational dashboard.

This onboarding experience must:

- explain that WinPlan works through teams,
- make the next action clear,
- direct the user toward joining or creating a team.

The goal of this onboarding is to establish the correct product mental model from the first interaction.

---

## 16. Team Picker Requirement

If the user belongs to multiple teams, the system must provide a dedicated team picker flow.

The team picker must exist as a distinct selection step, not as an implicit background decision.

The purpose of this requirement is to ensure that the user consciously selects the correct operational context before entering the product.

---

## 17. Role and Membership Implications

The team-entry flow must respect team membership and role assignment.

This means:

- a user may belong to multiple teams,
- a user may have different roles in different teams,
- access to operational workflows must depend on the selected team context.

The entry flow must preserve this model by always routing the user into a specific team rather than into a flat global workspace view.

---

## 18. Required Outcomes

After completing the post-login team-entry flow, the user must end in exactly one of the following valid states:

- active team established through invitation acceptance,
- active team established through successful join,
- active team established through team creation,
- active team established through explicit team picker selection.

The system must not leave the user in a team-less operational state.

---

## 19. Non-Goals

This requirement set does not define:

- visual design,
- UI layout,
- implementation details,
- backend data model,
- invitation transport mechanics,
- final wording of onboarding copy.

It only defines product behavior and routing expectations.

---

## 20. Summary

WinPlan must treat the first post-login experience as a team access flow rather than a generic dashboard flow.

The system must route the user based on their team state:

- pending invitation,
- no teams,
- exactly one team,
- multiple teams.

If no team context exists, the user must be guided to join or create a team.
If one team exists, that team may be opened directly.
If multiple teams exist, the user must explicitly choose a team through a team picker.

This ensures that all operational workflows in WinPlan begin with a clear and intentional team context.
