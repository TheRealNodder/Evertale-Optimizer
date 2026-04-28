Replace-only patch.

Changed file:
- optimizerEngine.js

Purpose:
- Derives optimizer tags from extracted active skill AI, targeting, components, passives, and descriptions at runtime.
- Adds AI-aware role tags: role_dps, role_support, role_tank, role_control.
- Adds targeting/AI behavior tags: target_all_enemies, target_multi_enemy, ai_finisher, ai_guardian_breaker, status-priority tags.
- Improves team scoring with soft role coverage penalties and AI-aware synergy bonuses.
- Keeps existing data files and layout untouched.
