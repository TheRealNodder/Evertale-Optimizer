# Evertale Optimizer Project State

Updated: 2026-07-17  
Active implementation branch: `codex/ai-reasoning-foundation`

## Current public architecture

- V6 remains the public optimizer engine; V4 is not used as a silent fallback.
- Generated APK entry bundles are the factual authority.
- V6 uses deterministic, bounded scoring and evidence provenance rather than allowing a language model to invent mechanics.
- Story remains 5 main plus 3 back. Platoons remain 20 rows of 5 with Story exclusion and strict duplicate protection.

## AI-like reasoning foundation completed in this phase

- A generated `skillProfiles` runtime authority supplies exact active-skill TU, Spirit gain, Spirit cost, use limits, targeting, conditions, flags, components, names, descriptions, and provenance for every resolvable form.
- V6 loads the compact profile chunk as part of its required foundation and fails explicitly if it is missing.
- The resource reasoner projects an evidence-backed opening order from main-team speed and selected-plan evidence.
- The forecast reports reliable and conditional generation, planned demand, opening net, minimum required reserve, generator-before-spender timing, and high-cost conflicts.
- The team evaluator uses that forecast as a bounded scoring component and conflict penalty.
- Optimizer results include deterministic score receipts, strengths, warnings, and a sourced opening sequence.
- The existing optimizer layout is unchanged except for a collapsible `Why this team?` explanation panel.

## Validation checkpoint

- Generated skill profiles: 747 character entries / 2,691 active skills.
- Structured Spirit gain: 1,045 skills.
- Structured Spirit cost: 1,470 skills.
- Structured TU: 2,641 skills.
- Runtime identity collisions: 0.
- Suspicious generated feature evidence: 0.
- Every generated skill-profile field is compared back to its resolved raw-form authority by semantic validation.
- Profile coverage spans all six playable elements.
- Curated tags remain empty; generated feature evidence is truthfully reported as the active authority.

## Deliberate limits and next phases

- The game data does not currently establish an authoritative starting-Spirit value for this optimizer. V6 reports the minimum opening reserve required instead of assuming one.
- This is deterministic reasoning, not a full turn-by-turn battle simulator. A simulator should be added only after turn order, targeting, status overwrite, death/reinforcement, summon, and passive trigger contracts are fixture-backed.
- An optional AI provider may later compare deterministic candidates or phrase explanations, but it must remain disabled by default, advisory-only, and unable to override raw skill facts or hard constraints.
- Optional online strategy research remains a separate advisory service and is not a hidden dependency of optimization.
