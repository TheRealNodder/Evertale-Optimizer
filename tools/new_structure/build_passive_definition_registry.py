#!/usr/bin/env python3
"""Write the offline passive Buff provenance sidecar (Slice A).

Output: apkfiles/entries/runtime/passive_definition_registry.json

The file is NOT registered in the runtime manifest, foundation chunks, bundles,
service-worker lists or page loads. No browser code reads it. It records exact
raw source definitions and provenance. It does NOT model mechanics:
mechanicModeled is false for every occurrence, scoped to this new payload.

Run from the repo root:
  python tools/new_structure/build_passive_definition_registry.py
  python tools/new_structure/build_passive_definition_registry.py --prior path/to/older_registry.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from passive_definition_sources import (  # noqa: E402
    BUFF_ID_FIELDS,
    CONDITION_FIELDS,
    CONDITION_KEY_MAPS,
    FINGERPRINT_CONTRACT_VERSION,
    OCCURRENCE_TABLES,
    PASSIVE_DEPENDENCY_VERSION,
    PRESENTATION_FIELDS,
    PRODUCER_VERSION,
    REGISTRY_SCHEMA_VERSION,
    STACK_FIELDS,
    STATUS_EFFECT_FIELDS,
    SUMMON_FIELDS,
    TOKEN_FIELDS,
    WEAPON_FIELDS,
    DependencyGraph,
    ExactJSONError,
    SourceSet,
    json_pointer,
    source_text,
)
from path_utils import find_repo_root, resolve_repo_path  # noqa: E402

OUTPUT_REL = "apkfiles/entries/runtime/passive_definition_registry.json"
ENTRY_CATEGORY_DIRS = {"characters": "characters", "weapons": "weapons", "bosses": "bosses"}

CANONICALIZATION = {
    "contentHash": "SHA-256 over UTF-8 compact JSON (no BOM, no insignificant whitespace); object keys sorted by Unicode code point for hashing only; arrays keep source order",
    "numbers": "exact decimal parse of the source token (no binary float); canonical base-10 notation, insignificant fractional zeros removed, -0 -> 0; 1, 1.0 and 1e0 hash equal",
    "rejected": "NaN, Infinity and other non-JSON tokens fail parsing; duplicate object keys are kept as separate candidates/pairs with diagnostics",
    "types": "bool is distinct from number; null is distinct from an absent key",
    "rawTokenHash": "SHA-256 of the original UTF-8 byte slice of the definition object (whitespace inside the object included, per accepted R1 deferral)",
    "tokenStreamHash": "SHA-256 of the compact source-order serialization with original number tokens (whitespace removed); used only to classify changes",
    "paths": "repository-relative, '/'-separated; pointers follow RFC 6901 (~0, ~1)",
}

FIELD_RULES = {
    "recordEdges": {
        "Buff->MonsterConditions": "applyConditions, hideFromPlayerCondition and behaviorOverrides[] condition fields",
        "Buff->Buff": "behaviorOverrides[].{selfBuffs,sourceBuffs,randomEnemyBuffs,randomAllyBuffs,allyBuffs,enemyBuffs,contextBuffs,allAlliesButSelfBuffs}",
        "MonsterConditions->MonsterConditions": "keys of my/enemyTeamMonsterConditionMatchesNeeded, Last/NextReplacement fields, nested and/or/not",
        "Buff->AbilityEffect(statusEffect)": "statusEffect: semantics unresolved, so it is kept in the digest conservatively",
    },
    "stackMembershipEdges": "buffStackNames, stackNamesToBlock, buffStackNamesToEffect, and behaviorOverrides[].name when the aligned behavior is RemoveBuffs; the node hashes sorted member Buff IDs only",
    "stackNamespaceAssumption": "stack = explicit stackName, else the Buff's own ID",
    "leafEdges": "behaviors[] -> BattleBehavior (content hash), monsterType/randomMonsterTypeList -> Monster|Boss identity, weapon/weaponIfWrongHand -> Weapon identity",
    "presentationEdges": "effectToShowWhenApplied, abilityEffect, selfAbilityEffect, selfDamageEffect, effectName -> AbilityEffect: recorded, NOT followed or digested",
    "tokenFields": sorted(TOKEN_FIELDS),
    "unlistedFields": "preserved raw with no edge; names listed in observedBehaviorInventory.fieldsWithoutReferenceRule (mostly scalar value fields; review new names on APK updates)",
}


def load_localization_flags(repo: Path) -> Dict[str, Dict[str, Dict[str, Any]]]:
    """category -> sourceId -> {passiveId: legacy found} from generated entries (read-only)."""
    out: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for cat, folder in ENTRY_CATEGORY_DIRS.items():
        flags: Dict[str, Dict[str, Any]] = {}
        entries_dir = repo / "apkfiles" / "entries" / folder / "entries"
        if entries_dir.is_dir():
            for path in sorted(entries_dir.glob("*.json")):
                try:
                    data = json.loads(path.read_text(encoding="utf-8-sig"))
                except Exception:
                    continue
                sid = data.get("sourceId")
                passives = ((data.get("resolved") or {}).get("passives") or {}) if isinstance(data, dict) else {}
                if isinstance(sid, str) and isinstance(passives, dict):
                    flags[sid] = {pid: bool((p or {}).get("found")) for pid, p in passives.items()}
        out[cat] = flags
    return out


def field_names(node, out: set) -> None:
    if node.kind == "obj":
        for k, v in node.pairs():
            out.add(k)
            field_names(v, out)
    elif node.kind == "arr":
        for v in node.items():
            field_names(v, out)


KNOWN_FIELD_NAMES = {
    "class", "behaviors", "behaviorOverrides", "iconSpriteName", "noIconShownOnBattleStatus", "duration", "showAsTimer",
    "isWeaponBuff", "scalor", "name", "not", "and", "or",
}


def build_registry(repo: Path, input_dir: Path, prior: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    sources = SourceSet(input_dir, repo)
    sources.ensure_valid()
    graph = DependencyGraph(sources)
    localization = load_localization_flags(repo)

    occurrences: List[Dict[str, Any]] = []
    reached: Dict[str, Dict[str, Any]] = {}
    unresolved: List[Dict[str, Any]] = []
    entry_digests: Dict[str, Dict[str, str]] = {}
    for cat in ("characters", "weapons", "bosses"):
        for row_index, row in sources.occurrence_rows.get(cat, []):
            sid = sources.row_identity(row_index, row)
            refs = sources.passive_refs(row)
            if not refs:
                if sid is not None:
                    entry_digests.setdefault(cat, {}).pop(sid, None)
                continue
            digest, closure = graph.entry_digest(refs)
            if sid is not None:
                entry_digests.setdefault(cat, {})[sid] = digest  # last row per name wins, as in the entry builder
            reached.update(closure["nodes"])
            _, root_key = OCCURRENCE_TABLES[cat]
            loc = localization.get(cat, {}).get(sid or "", {})
            for position, pid in refs:
                res = graph.resolution("Buff", pid)
                single = graph.closure([pid])
                occurrences.append({
                    "category": cat,
                    "sourceId": sid,
                    "rawPointer": json_pointer(root_key, row_index),
                    "rawField": sources.passive_field(row)[0],
                    "position": position,
                    "passiveId": pid,
                    "ref": f"Buff/{pid}",
                    "definitionResolution": res,
                    "dependencyCompleteness": single["dependencyCompleteness"],
                    "buffDefinitionFound": res != "missing",
                    "localizationFound": loc.get(pid) if pid in loc else None,
                    "mechanicModeled": False,
                    "modelingScope": "new_structured_buff_registry_payload",
                    "legacyHeuristicBehavior": "preserved",
                })
            for m in closure["missing"]:
                unresolved.append({"kind": "missing_reference", "node": m, "category": cat, "sourceId": sid})
            for a in closure["ambiguous"]:
                unresolved.append({"kind": "ambiguous_definition", "node": a, "category": cat, "sourceId": sid})

    # Definitions reached by any passive closure, with full raw source objects.
    raw_slots: Dict[str, str] = {}
    definitions: Dict[str, Dict[str, Any]] = {}
    for nid in sorted(reached):
        ns, ident = nid.split("/", 1)
        mat = reached[nid]
        group: Dict[str, Any] = {"definitionResolution": mat["resolution"]}
        if ns == "StackName":
            group["members"] = mat["members"]
            group["ambiguousMembers"] = mat["ambiguousMembers"]
        elif ns in ("Summon", "Weapon"):
            pass
        else:
            cands = []
            for cand in graph.candidates(ns, ident):
                slot = f"\u0000RAW{len(raw_slots)}\u0000"
                raw_slots[slot] = source_text(cand.node)
                cands.append({
                    "file": cand.file, "pointer": cand.pointer, "ordinal": cand.ordinal, "byteRange": cand.byte_range,
                    "canonicalContentHash": cand.canonical_content_hash(), "rawTokenHash": cand.raw_token_hash(),
                    "tokenStreamHash": cand.token_stream_hash(),
                    "source": slot,
                })
            group["candidates"] = cands
            if ns in ("Buff", "MonsterConditions"):
                group["edges"] = [
                    {"candidateOrdinal": ordinal, "fieldPointer": ptr, "targetNamespace": tns,
                     "targetId": tid, "role": role, "keyRef": key_ref}
                    for ordinal, ptr, tns, tid, role, key_ref in graph.edges_of(ns, ident)
                ]
        definitions.setdefault(ns, {})[ident] = group

    # Inventory over ALL raw Buffs (including unreferenced ones).
    behavior_counts: Dict[str, int] = {}
    signatures: Dict[str, int] = {}
    unknown_fields: set = set()
    typed_fields = set(BUFF_ID_FIELDS) | set(CONDITION_FIELDS) | set(CONDITION_KEY_MAPS) | set(STACK_FIELDS) | set(STATUS_EFFECT_FIELDS) \
        | set(PRESENTATION_FIELDS) | set(SUMMON_FIELDS) | set(WEAPON_FIELDS) | set(TOKEN_FIELDS) | KNOWN_FIELD_NAMES
    for ns in ("Buff", "MonsterConditions"):
        for ident, cands in sources.definitions.get(ns, {}).items():
            for cand in cands:
                names: set = set()
                field_names(cand.node, names)
                sig = ns + ":" + ",".join(sorted(k for k, _ in cand.node.pairs()))
                signatures[sig] = signatures.get(sig, 0) + 1
                if ns == "Buff":
                    beh = cand.node.get("behaviors")
                    if beh is not None and beh.kind == "arr":
                        for b in beh.items():
                            if b.kind == "str":
                                behavior_counts[b.value] = behavior_counts.get(b.value, 0) + 1
                for n in names:
                    if n not in typed_fields and not n[:1].isdigit():
                        unknown_fields.add(f"{ns}.{n}")

    comparison: Dict[str, Any] = {"status": "no_prior_registry"}
    if prior:
        comparison = compare_with_prior(prior, definitions, behavior_counts)

    registry = {
        "schemaVersion": REGISTRY_SCHEMA_VERSION,
        "producerVersion": PRODUCER_VERSION,
        "fingerprintContract": FINGERPRINT_CONTRACT_VERSION,
        "passiveDependencyVersion": PASSIVE_DEPENDENCY_VERSION,
        "loading": "offline provenance authority only; not in runtime manifest, foundation, bundles, service worker or page loads",
        "mechanicModeled": False,
        "modelingScope": "new_structured_buff_registry_payload",
        "sourceRoot": sources.source_root(),
        "canonicalization": CANONICALIZATION,
        "fieldRules": FIELD_RULES,
        "sourceFiles": dict(sorted(sources.files.items())),
        "sourceDiagnostics": sources.diagnostics,
        "summary": {
            "occurrences": len(occurrences),
            "occurrencesByCategory": {c: sum(1 for o in occurrences if o["category"] == c) for c in ("characters", "weapons", "bosses")},
            "entriesWithPassiveDigest": {c: len(v) for c, v in sorted(entry_digests.items())},
            "definitionsReached": {ns: len(v) for ns, v in sorted(definitions.items())},
            "dependencyCompleteness": {k: sum(1 for o in occurrences if o["dependencyCompleteness"] == k) for k in ("complete", "partial", "unresolved")},
            "definitionResolution": {k: sum(1 for o in occurrences if o["definitionResolution"] == k) for k in ("resolved", "missing", "ambiguous")},
        },
        "definitions": definitions,
        "occurrences": occurrences,
        "entryDependencyDigests": {c: dict(sorted(v.items())) for c, v in sorted(entry_digests.items())},
        "unresolved": sorted({json.dumps(u, sort_keys=True) for u in unresolved}),
        "observedBehaviorInventory": {
            "rawBuffDefinitions": sum(len(v) for v in sources.definitions.get("Buff", {}).values()),
            "behaviorNames": dict(sorted(behavior_counts.items())),
            "topLevelStructureSignatures": dict(sorted(signatures.items())),
            "fieldsWithoutReferenceRule": sorted(unknown_fields),
            "comparison": comparison,
        },
    }
    registry["unresolved"] = [json.loads(u) for u in registry["unresolved"]]
    return registry, raw_slots


def compare_with_prior(prior: Dict[str, Any], definitions: Dict[str, Any], behaviors: Dict[str, int]) -> Dict[str, Any]:
    old_defs = prior.get("definitions") or {}
    changes: Dict[str, List[Dict[str, Any]]] = {"added": [], "removed": [], "semantic": [], "token_only": [], "format_only": []}
    for ns in sorted(set(old_defs) | set(definitions)):
        old_ns, new_ns = old_defs.get(ns, {}), definitions.get(ns, {})
        for ident in sorted(set(old_ns) | set(new_ns)):
            if ident not in old_ns:
                changes["added"].append({"node": f"{ns}/{ident}"}); continue
            if ident not in new_ns:
                changes["removed"].append({"node": f"{ns}/{ident}"}); continue
            o = old_ns[ident].get("candidates") or []
            n = new_ns[ident].get("candidates") or []
            if [c.get("canonicalContentHash") for c in o] != [c.get("canonicalContentHash") for c in n] or old_ns[ident].get("members") != new_ns[ident].get("members"):
                changes["semantic"].append({"node": f"{ns}/{ident}"})
            elif [c.get("tokenStreamHash") for c in o] != [c.get("tokenStreamHash") for c in n]:
                changes["token_only"].append({"node": f"{ns}/{ident}"})
            elif [c.get("rawTokenHash") for c in o] != [c.get("rawTokenHash") for c in n]:
                changes["format_only"].append({"node": f"{ns}/{ident}"})
    old_beh = set((prior.get("observedBehaviorInventory") or {}).get("behaviorNames") or {})
    return {
        "status": "compared_with_supplied_prior",
        "priorFingerprintContract": prior.get("fingerprintContract"),
        "newBehaviorNamesUnreviewed": sorted(set(behaviors) - old_beh),
        "removedBehaviorNames": sorted(old_beh - set(behaviors)),
        "counts": {k: len(v) for k, v in changes.items()},
        "changes": changes,
    }


def render(registry: Dict[str, Any], raw_slots: Dict[str, str]) -> str:
    text = json.dumps(registry, ensure_ascii=False, indent=1, sort_keys=False)
    for slot, raw in raw_slots.items():
        text = text.replace(json.dumps(slot, ensure_ascii=False), raw, 1)
    return text + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Write the offline passive Buff provenance registry.")
    parser.add_argument("--input", default="apkfiles")
    parser.add_argument("--output", default=OUTPUT_REL)
    parser.add_argument("--prior", default=None, help="Immutable earlier registry to compare against (never overwritten).")
    args = parser.parse_args()
    repo = find_repo_root(Path(__file__).resolve())
    input_dir = resolve_repo_path(repo, args.input, "apkfiles")
    output = resolve_repo_path(repo, args.output, OUTPUT_REL)
    prior = None
    if args.prior:
        prior_path = Path(args.prior)
        if prior_path.resolve() == output.resolve():
            print("ERROR: --prior must not be the output path (the prior snapshot is never overwritten)")
            return 2
        prior = json.loads(prior_path.read_text(encoding="utf-8"))
    temporary = None
    try:
        # External sources are inspectable via an explicit alternate output, but
        # cannot replace the trusted repository sidecar rejected by validation.
        if input_dir.resolve() != (repo / "apkfiles").resolve() and output.resolve() == (repo / OUTPUT_REL).resolve():
            raise ExactJSONError("external --input requires a non-canonical --output; canonical registry cannot be replaced")
        registry, raw_slots = build_registry(repo, input_dir, prior)
        text = render(registry, raw_slots)
        output.parent.mkdir(parents=True, exist_ok=True)
        changed = not (output.exists() and output.read_text(encoding="utf-8") == text)
        if changed:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                             dir=output.parent, prefix=".passive-registry-", delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(text)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, output)
            temporary = None
    except (ExactJSONError, OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: registry generation failed; existing output preserved: {exc}", file=sys.stderr)
        return 1
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    summary = registry["summary"]
    print(json.dumps({"output": str(output), "changed": changed, "bytes": len(text.encode("utf-8")), **summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
