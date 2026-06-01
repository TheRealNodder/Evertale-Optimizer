# Python / Tool Audit and Legacy Move Plan

Generated: `1780327531`

## Counts
- pythonFiles: 38
- toolFilesScanned: 45
- activeEntrypoints: 9
- activeClosureFiles: 24

## Summary by Status
- ACTIVE_DEPENDENCY: 15
- ACTIVE_ENTRYPOINT: 9
- REFERENCED_MANUAL_OR_SUPPORT: 4
- UNREFERENCED_MANUAL_TOOL: 8
- UNREFERENCED_REVIEW: 2

## Recommended Legacy Moves
- `tools/new_structure/apply_python_legacy_move_plan.py` → `tools/legacy/tools/new_structure/apply_python_legacy_move_plan.py` — No detected references; move only after manual confirmation.
- `tools/new_structure/move_legacy_generated_entries.py` → `tools/legacy/tools/new_structure/move_legacy_generated_entries.py` — No detected references; move only after manual confirmation.

## Safe Deletes
No delete-only files found.

## Full Python File Classification
| Status | Path | Incoming refs | Reason |
|---|---|---:|---|
| REFERENCED_MANUAL_OR_SUPPORT | `tools/evertale_il2cpp_extractor/evertale_il2cpp_extractor.py` | 2 | Referenced somewhere, but not in the active Master Control closure. |
| REFERENCED_MANUAL_OR_SUPPORT | `tools/legacy/tools/new_structure/renumber_entry_files.py` | 1 | Referenced somewhere, but not in the active Master Control closure. |
| ACTIVE_ENTRYPOINT | `tools/master_control.py` | 1 | Primary runner or registered active tool. |
| UNREFERENCED_REVIEW | `tools/new_structure/apply_python_legacy_move_plan.py` | 0 | No detected references; move only after manual confirmation. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/apply_quarantine_plan.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/audit_optimizer_sources.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/audit_python_tools_and_legacy_plan.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/audit_redundant_files.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| ACTIVE_DEPENDENCY | `tools/new_structure/build_apk_entry_folders.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/build_character_image_map.py` | 2 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/build_entry_bundles.py` | 2 | Referenced by an active entrypoint/tool chain. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/build_optimizer_ability_graph.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| ACTIVE_DEPENDENCY | `tools/new_structure/build_optimizer_runtime_model.py` | 2 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/deep_dependency_audit.py` | 3 | Referenced by an active entrypoint/tool chain. |
| REFERENCED_MANUAL_OR_SUPPORT | `tools/new_structure/entry_checkpoint.py` | 1 | Referenced somewhere, but not in the active Master Control closure. Protected by NEVER_MOVE. |
| ACTIVE_DEPENDENCY | `tools/new_structure/export_quarantine_plan.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/extract_localizable_groups.py` | 1 | Referenced by an active entrypoint/tool chain. |
| REFERENCED_MANUAL_OR_SUPPORT | `tools/new_structure/extract_optimizer_knowledge.py` | 1 | Referenced somewhere, but not in the active Master Control closure. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/import_explorer_order.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/MASTER_CONTROL.py` | 1 | Primary runner or registered active tool. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/master_control_refined.py` | 1 | Primary runner or registered active tool. |
| UNREFERENCED_REVIEW | `tools/new_structure/move_legacy_generated_entries.py` | 0 | No detected references; move only after manual confirmation. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/organize_by_handle.py` | 1 | Primary runner or registered active tool. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/organize_entries_from_toolbox.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/renumber_category_from_order_list.py` | 1 | Primary runner or registered active tool. |
| UNREFERENCED_MANUAL_TOOL | `tools/new_structure/repair_ballet_active_skills.py` | 0 | Standalone utility/audit/build tool; keep until explicitly replaced. |
| ACTIVE_DEPENDENCY | `tools/new_structure/repair_character_order_tail.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/run_entry_pipeline.py` | 2 | Primary runner or registered active tool. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/run_safe_new_data_ingest.py` | 2 | Primary runner or registered active tool. |
| ACTIVE_DEPENDENCY | `tools/new_structure/run_universal_apk_builder.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/runtime_optimizer_trace.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/split_optimizer_runtime_model.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/sync_category_order_canonical.py` | 4 | Primary runner or registered active tool. |
| ACTIVE_DEPENDENCY | `tools/new_structure/sync_character_tags.py` | 2 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_ENTRYPOINT | `tools/new_structure/sync_weapon_order_canonical.py` | 1 | Primary runner or registered active tool. |
| ACTIVE_DEPENDENCY | `tools/new_structure/update_entry_bookmark.py` | 1 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/new_structure/validate_entries.py` | 2 | Referenced by an active entrypoint/tool chain. |
| ACTIVE_DEPENDENCY | `tools/scan_duo_mechanics.py` | 1 | Referenced by an active entrypoint/tool chain. |

## Rules
- Do not delete active entrypoints or active dependencies.
- Move only LEGACY_CANDIDATE or UNREFERENCED_REVIEW files after manual review.
- Keep standalone audit/build/repair tools unless their replacement is verified.
- Generated __pycache__ files can be deleted without moving to legacy.
