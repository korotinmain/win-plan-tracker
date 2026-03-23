# WinPlan Sprint Planning Requirements

## 1. Purpose

WinPlan Sprint Planning must provide a structured, facilitator-led workflow for planning the next sprint.  
The feature must help teams replace chaotic planning rituals with a guided session that is transparent, repeatable, capacity-aware, and historically traceable.

The planning experience must not behave like a simple backlog screen.  
It must behave like a formal planning session with defined participants, phases, decisions, and outcomes.

---

## 2. Product Goal

The goal of Sprint Planning is to help a team produce a realistic and explicit sprint commitment by:

- reviewing all candidate sprint issues,
- involving the relevant team members,
- validating readiness and ownership,
- balancing workload against real capacity,
- capturing risks and unresolved concerns,
- and saving the planning result as a historical artifact.

---

## 3. Scope

This feature applies to planning the **next sprint only**.

The Sprint Planning workflow must:

- start from the Sprints area of the product,
- target the next sprint,
- guide the team through a structured planning flow,
- produce a final planning result,
- store that result in planning history.

This feature must not be treated as a generic board or passive issue list.

---

## 4. Core Principles

The Sprint Planning feature must follow these principles:

1. **Planning is a session, not a page**  
   The user must feel that they are entering and progressing through a formal session.

2. **Planning is facilitator-led**  
   A single facilitator controls the flow of the session.

3. **Every issue must have an outcome**  
   Each reviewed issue must leave the session with an explicit planning decision.

4. **Capacity matters as much as scope**  
   Sprint planning must account for team availability, vacations, and realistic workload.

5. **Participation must be guided**  
   The system should encourage balanced team involvement and reduce unstructured discussion.

6. **Planning must produce an artifact**  
   The result of the session must be saved and accessible later.

7. **History is part of the feature**  
   Planning outcomes must be preserved for review, comparison, and process improvement.

---

## 5. Roles and Permissions

### 5.1 Facilitator

The facilitator must always be a user with the role **Manager** or **Admin**.

Only a **Manager** or **Admin** may start a planning session.

The facilitator is responsible for guiding the session and controlling progress through the planning phases.

The facilitator must be able to:

- start planning,
- move the session to the next phase,
- move to the next issue,
- return to a previous issue when needed,
- review system warnings,
- finalize planning,
- save the final planning result.

A user who is not a Manager or Admin must not be able to act as facilitator.

### 5.2 Participant

A participant is an active planning contributor.

A participant must be able to:

- join the planning session,
- review issues,
- provide input on ownership, feasibility, and risks,
- participate in guided discussion,
- help shape the sprint scope.

A participant must not be able to start or finalize planning unless that participant is also a Manager or Admin acting as facilitator.

### 5.3 Observer

An observer may attend the session without actively controlling it.

An observer may:

- view the session,
- follow progress,
- see planning results.

An observer must not:

- start planning,
- control planning flow,
- finalize planning,
- act as facilitator.

---

## 6. Entry Point and Availability

Sprint Planning must be accessible from the **Sprints** page.

The Sprints page must show:

- the current sprint,
- the next sprint,
- planning history,
- an entry point for Sprint Planning.

The planning action must apply only to the **next sprint**.

The planning action should be available only when:

- a next sprint exists,
- the user has permission to start planning,
- planning has not already been finalized for that sprint, unless reopening is explicitly supported in the future.

If planning is already finalized for the next sprint, the primary action should no longer be “Start Planning”; the system should instead emphasize viewing the result or history.

---

## 7. Planning Session Lifecycle

Sprint Planning must behave as a session with a lifecycle.

The lifecycle should conceptually include:

1. setup,
2. preparation,
3. context review,
4. issue-by-issue review,
5. balancing,
6. final review,
7. finalization,
8. history storage.

The session must feel progressive and stateful rather than flat and static.

---

## 8. High-Level Planning Flow

The planning workflow must follow this sequence:

1. Facilitator starts planning for the next sprint
2. Facilitator selects participants
3. System performs pre-planning checks
4. Team reviews sprint context
5. Team reviews candidate issues one by one
6. System guides participation during discussion
7. Team reviews capacity and workload balance
8. Facilitator reviews final summary
9. Facilitator finalizes planning
10. System saves a planning snapshot to history

---

## 9. Phase 1 — Session Setup

### 9.1 Objective

The setup phase prepares the planning session and identifies who will participate.

### 9.2 Requirements

Before planning begins, the facilitator must be able to:

- select participants,
- define who is attending,
- include observers if needed,
- confirm that the session is for the next sprint.

The system should clearly display:

- the sprint being planned,
- key sprint identifiers,
- the list of selected participants,
- the facilitator identity.

### 9.3 Permission Rule

The session must not start unless the user initiating it is a **Manager** or **Admin**.

---

## 10. Phase 2 — Pre-Planning Readiness Check

### 10.1 Objective

Before the team starts discussing issues, the system must validate whether planning is ready to begin.

### 10.2 Readiness Checks

The system should evaluate and surface issues such as:

- issues without estimates,
- issues without assignees,
- issues with known blockers,
- issues with unresolved dependencies,
- suspiciously large issues,
- carryover from the current sprint,
- known vacations or absences,
- obvious overload risks,
- incomplete preparation that may reduce planning quality.

### 10.3 Behavior

The system must present readiness warnings clearly before the session begins.

The system should help the facilitator understand whether the sprint is ready for planning.

The product may allow planning to proceed with warnings, but critical issues should be highly visible.

### 10.4 Expected Outcome

The facilitator should enter the planning session with a clear understanding of sprint readiness and known risks.

---

## 11. Phase 3 — Sprint Context Review

### 11.1 Objective

Before discussing individual issues, the team must see a shared view of sprint context.

### 11.2 Context Information

The planning session should display:

- sprint name or identifier,
- sprint dates,
- sprint goal,
- current candidate scope,
- previous sprint velocity or equivalent delivery signal,
- total team capacity,
- vacations, holidays, and absences,
- carryover work from the current sprint,
- obvious high-level risks.

### 11.3 Product Intent

This phase must create shared situational awareness before detailed issue discussion begins.

The purpose is to help the team plan with realistic context rather than isolated issue-level thinking.

---

## 12. Phase 4 — Issue-by-Issue Review

### 12.1 Objective

The core of Sprint Planning must be a guided review of candidate sprint issues one by one.

The feature must not rely only on a passive list where all issues are discussed in an unstructured way.

### 12.2 Review Model

For each issue, the team should be able to evaluate:

- whether the issue is understood,
- whether the owner is appropriate,
- whether the estimate is realistic,
- whether dependencies are known,
- whether the issue is ready to be included in the sprint,
- whether the issue introduces notable risk.

### 12.3 Required Issue Outcome

Every issue reviewed during the session must end with an explicit planning outcome.

Possible conceptual outcomes include:

- confirmed for sprint,
- reassigned,
- risky but accepted,
- needs clarification,
- deferred from sprint,
- candidate for splitting.

The exact labels may evolve, but the concept of explicit outcome is mandatory.

### 12.4 Product Requirement

The system must make it clear which issues:

- have already been reviewed,
- are still pending review,
- were deferred,
- remain risky,
- require further clarification.

### 12.5 Expected Value

The team must leave planning with decisions, not just discussion.

---

## 13. Guided Participation

### 13.1 Objective

The system should improve team participation quality by gently structuring discussion.

### 13.2 Intent

The feature should reduce common planning problems such as:

- domination by one or two voices,
- passive participation,
- lack of ownership,
- silent disagreement,
- chaotic discussion order.

### 13.3 Requirement

During issue review, the system should indicate who is currently expected to contribute or confirm input.

It should also make it visible:

- who has already responded,
- who is still expected to weigh in,
- where team input is still incomplete.

### 13.4 Constraint

This participation model should feel like facilitation, not hard enforcement.

The system should guide the discussion rather than over-constrain it.

### 13.5 Product Differentiator

Guided participation is a key differentiator of WinPlan and should help the product feel more structured than whiteboard-based planning and more human-centered than a simple issue tracker.

---

## 14. Facilitated Session Control

### 14.1 Objective

The planning flow must be clearly controlled by the facilitator.

### 14.2 Requirements

The facilitator must be able to:

- begin the session,
- progress through phases,
- move between issues,
- review readiness and risk indicators,
- control when the session enters balancing,
- control when the session enters final review,
- finalize the session.

### 14.3 Permission Rule

Only the facilitator, who must be a Manager or Admin, may control session progression.

Participants and observers must not control the session flow.

### 14.4 UX Expectation

The system should support the facilitator with visible progress, warnings, and next-step clarity.

The product must not make the facilitator manage the process blindly.

---

## 15. Phase 5 — Workload Balancing

### 15.1 Objective

After issue review, the team must evaluate whether the planned sprint is realistic from a workload and capacity perspective.

### 15.2 What Must Be Considered

The balancing phase should help the team review:

- points or workload per person,
- available capacity per person,
- overloaded team members,
- underloaded team members,
- unassigned issues,
- risky issues,
- concentration of critical work,
- overall sprint scope versus team capacity,
- scope compared to previous delivery patterns.

### 15.3 Required Outcome

The balancing phase must help the team consciously decide whether the sprint is realistic.

The team should be able to adjust the plan before final commitment.

### 15.4 Product Intent

The system must reinforce the idea that sprint planning is not only about issue selection, but also about execution realism.

---

## 16. Phase 6 — Final Review

### 16.1 Objective

Before finalization, the facilitator and team must see a clear summary of the resulting sprint plan.

### 16.2 Final Summary Should Include

The final review should show:

- committed issues,
- deferred issues,
- risky issues,
- unresolved concerns,
- workload distribution,
- overall sprint load,
- relationship to capacity,
- any important warnings still present.

### 16.3 Product Requirement

The final review must create a clear “commitment moment”.

The outcome of planning must feel explicit, not ambiguous.

---

## 17. Phase 7 — Finalization

### 17.1 Objective

The facilitator must be able to formally complete the planning session.

### 17.2 Permission Rule

Only the facilitator, who must be a Manager or Admin, may finalize planning.

### 17.3 Finalization Result

When planning is finalized:

- the sprint plan must be considered committed,
- the planning result must be saved,
- the session must transition into a historical artifact,
- the main planning action for that sprint should no longer be presented as a fresh start.

### 17.4 Product Intent

Finalization must mark the end of planning as a formal team decision.

---

## 18. Planning Snapshot

### 18.1 Requirement

The result of a finalized planning session must be saved as a planning snapshot.

### 18.2 Snapshot Purpose

The snapshot must preserve the agreed planning result, including:

- the sprint being planned,
- reviewed issue outcomes,
- chosen sprint scope,
- workload distribution,
- known risks,
- unresolved items if any,
- session context.

### 18.3 Product Intent

The planning snapshot is the primary artifact produced by Sprint Planning.

It must serve as a stable point of reference after the session ends.

---

## 19. Planning History

### 19.1 Requirement

The product must include a Planning History area.

### 19.2 Purpose

Planning History must allow users to review previous planning outcomes.

It should help teams understand:

- what was planned,
- what was considered risky,
- what was deferred,
- who participated,
- when the planning happened,
- how planning quality evolves over time.

### 19.3 Product Value

Planning History is not optional metadata.  
It is part of the core value of the feature because it enables reflection, transparency, and process learning.

---

## 20. Relationship Between Planning and Sprint Commitment

Sprint Planning must produce more than a rearranged issue list.

The final product of planning must feel like an explicit sprint commitment supported by:

- reviewed scope,
- visible ownership,
- realistic capacity consideration,
- acknowledged risks,
- saved historical context.

The feature must help teams say:
“We know what we committed to and why.”

---

## 21. Non-Goals for the Initial Version

The initial version of Sprint Planning does not need to include:

- AI recommendations,
- advanced dependency intelligence,
- automatic issue splitting,
- complex voting mechanics,
- predictive delivery scoring,
- deep external integrations.

These may be future enhancements, but they must not distract from the core planning ritual.

---

## 22. MVP Requirements

The MVP must include:

- planning entry from the Sprints page,
- support for next sprint planning,
- role-based access control,
- facilitator restricted to Manager or Admin,
- only Manager or Admin allowed to start planning,
- participant selection,
- readiness checks,
- sprint context review,
- issue-by-issue guided review,
- guided participation indicators,
- balancing phase,
- final review,
- facilitator-driven finalization,
- planning snapshot,
- planning history.

The MVP must focus on process clarity and planning discipline rather than automation complexity.

---

## 23. UX Expectations

The user experience should feel:

- structured,
- premium,
- enterprise-ready,
- calm,
- intentional,
- guided rather than chaotic.

The feature should not feel like a playful workshop board.

The design should communicate that Sprint Planning is a serious coordination ritual for delivery teams.

---

## 24. Success Criteria

Sprint Planning can be considered successful if teams are able to:

- start planning only through the right roles,
- conduct planning in a guided and repeatable way,
- review all candidate issues systematically,
- involve the relevant people,
- evaluate the sprint against real capacity,
- finalize a clear sprint commitment,
- review the outcome later through planning history.

---

## 25. Summary Statement

WinPlan Sprint Planning must be a structured, facilitator-led, session-based workflow for planning the next sprint.

The facilitator must always be a **Manager** or **Admin**, and only a **Manager** or **Admin** may start planning.

The system must guide the team through readiness checks, sprint context, issue-by-issue review, guided participation, workload balancing, final commitment, and historical storage of the planning result.

The final outcome must be not just an updated sprint backlog, but a clear, realistic, and reviewable sprint commitment.
