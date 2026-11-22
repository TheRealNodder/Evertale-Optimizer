#!/usr/bin/env python3
"""Exact-source passive Buff provenance and dependency closure (Slice A).

Pure helpers shared by build_apk_entry_folders.py (per-entry dependency digest)
and build_passive_definition_registry.py (offline provenance sidecar).

Contract: "Evertale Slice A final contract" v2 (553a820c) plus clarifications
v2.1 (3585e80b).
- Raw APK JSON is parsed here from bytes with an exact, token-preserving
  parser. Legacy float-decoded resolver objects are never used.
- Every candidate record is kept, including duplicate object keys: no
  arbitrary winner.
- Canonical content hashes: SHA-256 over compact UTF-8 JSON. Keys are sorted
  by code point FOR HASHING ONLY. Numbers are exact decimals, normalized.
- rawTokenHash: SHA-256 of the original UTF-8 byte slice of the definition
  object.
- Edges come only from typed field paths (see FIELD RULES below), never from
  coincidental ID-string matches.
- Stack-name references hash stack MEMBERSHIP and do not expand member content.
- Nothing here models game mechanics; mechanicModeled is always false.
"""
from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

PASSIVE_DEPENDENCY_VERSION = 1
FINGERPRINT_CONTRACT_VERSION = "slice-a-v2.1-bytes-edges2"
REGISTRY_SCHEMA_VERSION = 1
PRODUCER_VERSION = "2"

# --------------------------------------------------------------------------
# Exact JSON parsing
# --------------------------------------------------------------------------

_WS = b" \t\r\n"
_NUMBER_RE = re.compile(rb"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")


class ExactJSONError(ValueError):
    pass


class Node:
    """A parsed JSON value that keeps its exact source token and byte span.

    kind: obj | arr | str | num | true | false | null
    obj -> value is a list of (key, Node) pairs, in source order, duplicates kept
    arr -> value is a list of Node
    str -> value is the decoded str
    num -> value is the raw numeric token (str)
    """

    __slots__ = ("kind", "value", "start", "end")

    def __init__(self, kind: str, value: Any, start: int, end: int) -> None:
        self.kind = kind
        self.value = value
        self.start = start
        self.end = end

    # Convenience accessors -------------------------------------------------
    def get(self, key: str) -> Optional["Node"]:
        """Return a unique field; never choose a winner for duplicate keys."""
        if self.kind != "obj":
            return None
        found = None
        for k, v in self.value:
            if k == key:
                if found is not None:
                    raise ExactJSONError(f"ambiguous duplicate field {key!r} at byte {self.start}")
                found = v
        return found

    def pairs(self) -> List[Tuple[str, "Node"]]:
        return list(self.value) if self.kind == "obj" else []

    def items(self) -> List["Node"]:
        return list(self.value) if self.kind == "arr" else []

    def text(self) -> Optional[str]:
        return self.value if self.kind == "str" else None


class _Parser:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.n = len(data)
        self.duplicates: List[Tuple[int, str]] = []  # (byte offset of object, key)

    def ws(self, i: int) -> int:
        data, n = self.data, self.n
        while i < n and data[i] in _WS:
            i += 1
        return i

    def value(self, i: int) -> Tuple[Node, int]:
        i = self.ws(i)
        if i >= self.n:
            raise ExactJSONError("unexpected end of input")
        c = self.data[i]
        if c == 0x7B:  # {
            return self.obj(i)
        if c == 0x5B:  # [
            return self.arr(i)
        if c == 0x22:  # "
            s, j = self.string(i)
            return Node("str", s, i, j), j
        if self.data.startswith(b"true", i):
            return Node("true", True, i, i + 4), i + 4
        if self.data.startswith(b"false", i):
            return Node("false", False, i, i + 5), i + 5
        if self.data.startswith(b"null", i):
            return Node("null", None, i, i + 4), i + 4
        m = _NUMBER_RE.match(self.data, i)
        if m and m.end() > i:
            token = m.group(0).decode("ascii")
            return Node("num", token, i, m.end()), m.end()
        snippet = self.data[i:i + 12].decode("utf-8", "replace")
        raise ExactJSONError(f"invalid JSON value at byte {i}: {snippet!r} (NaN/Infinity and other non-JSON tokens are rejected)")

    def string(self, i: int) -> Tuple[str, int]:
        # UTF-8 never places 0x22 or 0x5C inside a multibyte sequence, so a byte scan is safe.
        data, n = self.data, self.n
        j = i + 1
        while j < n:
            b = data[j]
            if b == 0x5C:
                j += 2
                continue
            if b == 0x22:
                return json.loads(data[i:j + 1].decode("utf-8")), j + 1
            j += 1
        raise ExactJSONError(f"unterminated string at byte {i}")

    def obj(self, i: int) -> Tuple[Node, int]:
        start = i
        i = self.ws(i + 1)
        pairs: List[Tuple[str, Node]] = []
        seen: Dict[str, int] = {}
        if i < self.n and self.data[i] == 0x7D:
            return Node("obj", pairs, start, i + 1), i + 1
        while True:
            i = self.ws(i)
            if i >= self.n or self.data[i] != 0x22:
                raise ExactJSONError(f"expected object key at byte {i}")
            key, i = self.string(i)
            i = self.ws(i)
            if i >= self.n or self.data[i] != 0x3A:
                raise ExactJSONError(f"expected ':' at byte {i}")
            val, i = self.value(i + 1)
            if key in seen:
                self.duplicates.append((start, key))
            seen[key] = seen.get(key, 0) + 1
            pairs.append((key, val))
            i = self.ws(i)
            if i < self.n and self.data[i] == 0x2C:
                i += 1
                continue
            if i < self.n and self.data[i] == 0x7D:
                return Node("obj", pairs, start, i + 1), i + 1
            raise ExactJSONError(f"expected ',' or '}}' at byte {i}")

    def arr(self, i: int) -> Tuple[Node, int]:
        start = i
        i = self.ws(i + 1)
        items: List[Node] = []
        if i < self.n and self.data[i] == 0x5D:
            return Node("arr", items, start, i + 1), i + 1
        while True:
            val, i = self.value(i)
            items.append(val)
            i = self.ws(i)
            if i < self.n and self.data[i] == 0x2C:
                i += 1
                continue
            if i < self.n and self.data[i] == 0x5D:
                return Node("arr", items, start, i + 1), i + 1
            raise ExactJSONError(f"expected ',' or ']' at byte {i}")


def parse_exact(data: bytes) -> Tuple[Node, List[Tuple[int, str]], bool]:
    """Parse UTF-8 JSON bytes. Returns (root, duplicate_key_sites, had_bom)."""
    had_bom = data.startswith(b"\xef\xbb\xbf")
    offset = 3 if had_bom else 0
    parser = _Parser(data)
    root, end = parser.value(offset)
    end = parser.ws(end)
    if end != len(data):
        raise ExactJSONError(f"trailing data at byte {end}")
    return root, parser.duplicates, had_bom


# --------------------------------------------------------------------------
# Canonicalization and hashes
# --------------------------------------------------------------------------

def canonical_number(token: str) -> str:
    try:
        d = Decimal(token)
    except InvalidOperation as exc:  # pragma: no cover - the parser already validated the token
        raise ExactJSONError(f"invalid number token {token!r}") from exc
    if not d.is_finite():
        raise ExactJSONError(f"non-finite number {token!r}")
    if d.is_zero():
        return "0"
    text = format(d, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def canonical_text(node: Node) -> str:
    """Compact canonical JSON used ONLY for hashing (keys sorted by code point)."""
    k = node.kind
    if k == "obj":
        ordered = sorted(enumerate(node.value), key=lambda item: (item[1][0], item[0]))
        return "{" + ",".join(json.dumps(key, ensure_ascii=False) + ":" + canonical_text(v) for _, (key, v) in ordered) + "}"
    if k == "arr":
        return "[" + ",".join(canonical_text(v) for v in node.value) + "]"
    if k == "str":
        return json.dumps(node.value, ensure_ascii=False)
    if k == "num":
        return canonical_number(node.value)
    return {"true": "true", "false": "false", "null": "null"}[k]


def source_text(node: Node) -> str:
    """Compact source-order serialization with ORIGINAL numeric tokens (token stream)."""
    k = node.kind
    if k == "obj":
        return "{" + ",".join(json.dumps(key, ensure_ascii=False) + ":" + source_text(v) for key, v in node.value) + "}"
    if k == "arr":
        return "[" + ",".join(source_text(v) for v in node.value) + "]"
    if k == "str":
        return json.dumps(node.value, ensure_ascii=False)
    if k == "num":
        return node.value
    return {"true": "true", "false": "false", "null": "null"}[k]


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_pointer(*parts: Any) -> str:
    out = []
    for part in parts:
        s = str(part).replace("~", "~0").replace("/", "~1")
        out.append(s)
    return "/" + "/".join(out)


def ordered_passive_keys(keys: Iterable[str]) -> List[str]:
    """Match legacy ordered_values; mixed numeric/text keys have no valid order.

    The legacy extractor raises TypeError for a mixed map. Reject that shape
    explicitly rather than silently using source order or inventing a new one.
    """
    keys = list(keys)
    if len({key.isdigit() for key in keys}) > 1:
        raise ExactJSONError("mixed numeric/text passive keys are unsupported by legacy ordered_values")
    return sorted(keys, key=lambda key: int(key) if key.isdigit() else key)


def find_source_file(input_dir: Path, fname: str) -> Optional[Path]:
    direct = input_dir / fname
    if direct.is_file():
        return direct
    return next((p for p in sorted(input_dir.rglob(fname)) if p.is_file() and "entries" not in p.parts), None)


# --------------------------------------------------------------------------
# Source tables
# --------------------------------------------------------------------------

DEFINITION_TABLES = {
    # namespace: (file name, root key)
    "Buff": ("Buff.json", "Buff"),
    "MonsterConditions": ("MonsterConditions.json", "MonsterConditions"),
    "AttackScalor": ("AttackScalor.json", "AttackScalor"),
    "BattleBehavior": ("BattleBehavior.json", "BattleBehavior"),
    "AbilityEffect": ("AbilityEffect.json", "AbilityEffect"),
}

OCCURRENCE_TABLES = {
    # category: (file name, root key, namespace for summon/identity leaves)
    "characters": ("Monster.json", "Monster"),
    "weapons": ("Weapon.json", "Weapon"),
    "bosses": ("Boss.json", "Monster"),
}

IDENTITY_TABLES = {
    "Monster": ("Monster.json", "Monster"),
    "Boss": ("Boss.json", "Monster"),
    "Weapon": ("Weapon.json", "Weapon"),
}


class Candidate:
    __slots__ = ("namespace", "source_id", "file", "pointer", "ordinal", "node", "raw")

    def __init__(self, namespace: str, source_id: str, file: str, pointer: str, ordinal: int, node: Node, raw: bytes) -> None:
        self.namespace = namespace
        self.source_id = source_id
        self.file = file
        self.pointer = pointer
        self.ordinal = ordinal
        self.node = node
        self.raw = raw

    @property
    def byte_range(self) -> List[int]:
        return [self.node.start, self.node.end]

    def raw_token_hash(self) -> str:
        return sha256_bytes(self.raw[self.node.start:self.node.end])

    def canonical_content_hash(self) -> str:
        return sha256_text(canonical_text(self.node))

    def token_stream_hash(self) -> str:
        return sha256_text(source_text(self.node))


class SourceSet:
    """Exact raw APK tables loaded once."""

    def __init__(self, input_dir: Path, repo_root: Optional[Path] = None) -> None:
        self.input_dir = Path(input_dir)
        self.repo_root = Path(repo_root) if repo_root else None
        self.files: Dict[str, Dict[str, Any]] = {}
        self.diagnostics: List[Dict[str, Any]] = []
        self.definitions: Dict[str, Dict[str, List[Candidate]]] = {}
        self.identities: Dict[str, set] = {}
        self.occurrence_rows: Dict[str, List[Tuple[Any, Node]]] = {}
        self._roots: Dict[str, Tuple[Node, bytes, str]] = {}
        for ns, (fname, root_key) in DEFINITION_TABLES.items():
            self.definitions[ns] = self._load_definition_table(ns, fname, root_key)
        for cat, (fname, root_key) in OCCURRENCE_TABLES.items():
            self.occurrence_rows[cat] = self._load_rows(fname, root_key)
        for ns, (fname, root_key) in IDENTITY_TABLES.items():
            names = set()
            for key, row in self._load_rows(fname, root_key):
                name = self.row_identity(key, row)
                if name is not None:
                    names.add(name)
            self.identities[ns] = names
        self._stack_members: Optional[Dict[str, List[str]]] = None
        self._stack_ambiguities: Dict[str, List[str]] = {}

    def ensure_valid(self) -> None:
        """Fatal source failures cannot produce usable dependency fingerprints."""
        fatal = [d for d in self.diagnostics if d["kind"] in
                 ("source_parse_error", "missing_source_file", "missing_root_key", "ambiguous_record_fields")]
        if fatal:
            raise ExactJSONError("fatal source diagnostics: " + json.dumps(fatal, ensure_ascii=False))

    # -- file loading --------------------------------------------------------
    def rel(self, path: Path) -> str:
        """Repository-relative path; sources outside the repository are labeled external/ (never absolute)."""
        if self.repo_root:
            try:
                return path.resolve().relative_to(self.repo_root.resolve()).as_posix()
            except ValueError:
                pass
        try:
            return "external/" + path.resolve().relative_to(self.input_dir.resolve()).as_posix()
        except ValueError:
            return "external/" + path.name

    def source_root(self) -> str:
        """'apkfiles' when reading the repository's own raw folder, otherwise 'external'."""
        if self.repo_root:
            try:
                if self.input_dir.resolve() == (self.repo_root / "apkfiles").resolve():
                    return "apkfiles"
            except OSError:
                pass
        return "external"

    def _find(self, fname: str) -> Optional[Path]:
        return find_source_file(self.input_dir, fname)

    def _root(self, fname: str) -> Optional[Tuple[Node, bytes, str]]:
        if fname in self._roots:
            return self._roots[fname]
        path = self._find(fname)
        if path is None:
            self.diagnostics.append({"kind": "missing_source_file", "file": fname})
            self._roots[fname] = None  # type: ignore[assignment]
            return None
        data = path.read_bytes()
        rel = self.rel(path)
        try:
            root, dups, bom = parse_exact(data)
        except (ExactJSONError, UnicodeError, json.JSONDecodeError) as exc:
            self.diagnostics.append({"kind": "source_parse_error", "file": rel, "error": str(exc)})
            self._roots[fname] = None  # type: ignore[assignment]
            return None
        self.files[rel] = {"sha256": sha256_bytes(data), "bytes": len(data), "utf8Bom": bom, "duplicateObjectKeys": len(dups)}
        for offset, key in dups:
            self.diagnostics.append({"kind": "duplicate_object_key", "file": rel, "objectByteOffset": offset, "key": key})
        self._roots[fname] = (root, data, rel)
        return self._roots[fname]

    def _load_definition_table(self, ns: str, fname: str, root_key: str) -> Dict[str, List[Candidate]]:
        out: Dict[str, List[Candidate]] = {}
        loaded = self._root(fname)
        if not loaded:
            return out
        root, data, rel = loaded
        table = root.get(root_key)
        if table is None or table.kind != "obj":
            self.diagnostics.append({"kind": "missing_root_key", "file": rel, "rootKey": root_key})
            return out
        for key, node in table.pairs():
            # Duplicate definition IDs are retained as candidates. Duplicate fields
            # INSIDE a candidate have no unique value, even if no accessor reads them.
            duplicate_fields = [d["key"] for d in self.diagnostics
                                if d["kind"] == "duplicate_object_key" and d["file"] == rel
                                and node.start <= d["objectByteOffset"] < node.end]
            if duplicate_fields:
                self.diagnostics.append({"kind": "ambiguous_record_fields", "file": rel,
                                         "pointer": json_pointer(root_key, key), "keys": duplicate_fields})
            group = out.setdefault(key, [])
            group.append(Candidate(ns, key, rel, json_pointer(root_key, key), len(group), node, data))
        return out

    def _load_rows(self, fname: str, root_key: str) -> List[Tuple[Any, Node]]:
        loaded = self._root(fname)
        if not loaded:
            return []
        root, _, rel = loaded
        table = root.get(root_key)
        if table is None or table.kind not in ("arr", "obj"):
            self.diagnostics.append({"kind": "missing_root_key", "file": rel, "rootKey": root_key})
            return []
        if table.kind == "arr":
            return [(i, row) for i, row in enumerate(table.items()) if row.kind == "obj"]
        if table.kind == "obj":
            return [(key, row) for key, row in table.pairs() if row.kind == "obj"]
        return []

    # -- stack namespace -----------------------------------------------------
    def stack_members(self) -> Dict[str, List[str]]:
        """Stack name -> member Buff IDs.

        Rule (recorded as an explicit assumption): a Buff's stack is its explicit
        stackName, or its own ID when stackName is absent. Supported by source
        self-references such as Charged3Icon -> stack Charged3Icon.
        """
        if self._stack_members is None:
            members: Dict[str, set] = {}
            ambiguous: Dict[str, set] = {}
            for buff_id, cands in self.definitions.get("Buff", {}).items():
                names = set()
                for cand in cands:
                    sn = cand.node.get("stackName")
                    name = sn.value if (sn is not None and sn.kind == "str" and sn.value) else buff_id
                    members.setdefault(name, set()).add(buff_id)
                    names.add(name)
                if len(names) > 1:
                    for name in names:
                        ambiguous.setdefault(name, set()).add(buff_id)
            self._stack_members = {k: sorted(v) for k, v in members.items()}
            self._stack_ambiguities = {k: sorted(v) for k, v in ambiguous.items()}
        return self._stack_members

    def stack_ambiguities(self) -> Dict[str, List[str]]:
        self.stack_members()
        return self._stack_ambiguities

    @staticmethod
    def row_identity(key: Any, row: Node) -> Optional[str]:
        name = row.get("name")
        return name.value if name is not None and name.kind == "str" else key if isinstance(key, str) else None

    @staticmethod
    def passive_field(row: Node) -> Tuple[Optional[str], Optional[Node]]:
        # Match the existing extractor's presence-based fallback, including empty/null.
        for key in ("passives", "passiveSkills"):
            value = row.get(key)
            if value is not None:
                return key, value
        return None, None

    # -- passive occurrences -------------------------------------------------
    def passive_refs(self, row: Node) -> List[Tuple[str, str]]:
        """Ordered (position, passiveId) pairs, using the legacy ordered_values order."""
        _, field = self.passive_field(row)
        if field is None:
            return []
        if field.kind == "obj":
            pairs = field.pairs()
            # Duplicate fields must not be collapsed by a dict conversion.
            if len({k for k, _ in pairs}) != len(pairs):
                raise ExactJSONError("ambiguous duplicate passive position")
            values = dict(pairs)
            return [(k, values[k].value) for k in ordered_passive_keys(values) if values[k].kind == "str"]
        if field.kind == "arr":
            return [(str(i), v.value) for i, v in enumerate(field.items()) if v.kind == "str"]
        return []


# --------------------------------------------------------------------------
# FIELD RULES (verified on raw APK data; see the passive dependency field rules note)
# --------------------------------------------------------------------------

BUFF_ID_FIELDS = frozenset({"selfBuffs", "sourceBuffs", "randomEnemyBuffs", "randomAllyBuffs", "allyBuffs", "enemyBuffs", "contextBuffs", "allAlliesButSelfBuffs"})
CONDITION_FIELDS = frozenset({
    "applyConditions", "hideFromPlayerCondition", "conditions", "spreadCondition", "targetCondition", "attackerCondition",
    "attackerConditions", "activateCondition", "activeMonsterConditions", "deadMonsterConditions", "nextMonsterConditions",
    "conditionToCheckToShowIcon", "randomTargetingExcludeCondition", "triggerCondition", "sourceCondition",
    "myTeamLastReplacementMonsterCondition", "myTeamNextReplacementMonsterCondition",
})
CONDITION_KEY_MAPS = frozenset({"myTeamMonsterConditionMatchesNeeded", "enemyTeamMonsterConditionMatchesNeeded"})
STACK_FIELDS = frozenset({"buffStackNames", "stackNamesToBlock", "buffStackNamesToEffect"})
STATUS_EFFECT_FIELDS = frozenset({"statusEffect"})  # unresolved semantics: kept IN the digest (conservative)
PRESENTATION_FIELDS = frozenset({"effectToShowWhenApplied", "abilityEffect", "selfAbilityEffect", "selfDamageEffect", "effectName"})
SUMMON_FIELDS = frozenset({"monsterType", "randomMonsterTypeList"})
WEAPON_FIELDS = frozenset({"weapon", "weaponIfWrongHand"})
TOKEN_FIELDS = frozenset({
    "cancelFromDamageTypes", "extraDamageFlag", "damageType", "cancelFromDamageFlags", "blockDeathFromDamageFlags", "flags",
    "monsterTags", "abilityConfigFlag", "abilityFlagsToIgnore", "abilityFlags", "stackName", "tags",
})
REMOVE_BUFFS_BEHAVIOR = "RemoveBuffs"

EDGE_ROLE_RECORD = "record"
EDGE_ROLE_STACK = "stack_membership"
EDGE_ROLE_LEAF = "leaf"
EDGE_ROLE_PRESENTATION = "presentation"


def _strings(node: Node) -> List[Tuple[str, str]]:
    """(relative pointer suffix, string) for a field value that is a string or list of strings."""
    if node.kind == "str":
        return [("", node.value)]
    if node.kind == "arr":
        return [(f"/{i}", v.value) for i, v in enumerate(node.items()) if v.kind == "str"]
    return []


def typed_edges(namespace: str, node: Node) -> List[Tuple[str, str, str, str, bool]]:
    """Edges (real JSON Pointer, target namespace/ID, role, keyRef)."""
    edges: List[Tuple[str, str, str, str, bool]] = []
    behaviors: List[str] = []
    if namespace == "Buff":
        b = node.get("behaviors")
        if b is not None:
            for suffix, name in _strings(b):
                behaviors.append(name)
                edges.append(("/behaviors" + suffix, "BattleBehavior", name, EDGE_ROLE_LEAF, False))

    def walk(n: Node, path: str, override_behavior: Optional[str]) -> None:
        if n.kind == "obj":
            for key, val in n.pairs():
                p = path + json_pointer(key)
                if key in CONDITION_KEY_MAPS and val.kind == "obj":
                    for ckey, _ in val.pairs():
                        edges.append((p + json_pointer(ckey), "MonsterConditions", ckey, EDGE_ROLE_RECORD, True))
                    continue
                if key == "behaviors" and namespace == "Buff" and path == "":
                    continue
                if key in BUFF_ID_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "Buff", target, EDGE_ROLE_RECORD, False))
                    continue
                if key in CONDITION_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "MonsterConditions", target, EDGE_ROLE_RECORD, False))
                    continue
                if key in STACK_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "StackName", target, EDGE_ROLE_STACK, False))
                    continue
                if key == "name" and override_behavior == REMOVE_BUFFS_BEHAVIOR and val.kind == "str":
                    edges.append((p, "StackName", val.value, EDGE_ROLE_STACK, False))
                    continue
                if key in STATUS_EFFECT_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "AbilityEffect", target, EDGE_ROLE_RECORD, False))
                    continue
                if key in PRESENTATION_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "AbilityEffect", target, EDGE_ROLE_PRESENTATION, False))
                    continue
                if key in SUMMON_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "Summon", target, EDGE_ROLE_LEAF, False))
                    continue
                if key in WEAPON_FIELDS:
                    for suffix, target in _strings(val):
                        edges.append((p + suffix, "Weapon", target, EDGE_ROLE_LEAF, False))
                    continue
                if key == "behaviorOverrides" and val.kind == "arr" and namespace == "Buff" and path == "":
                    overrides = val.items()
                    for i, ov in enumerate(overrides):
                        beh = None
                        if len(behaviors) == len(overrides):
                            beh = behaviors[i]
                        elif len(behaviors) == 1:
                            beh = behaviors[0]
                        walk(ov, p + f"/{i}", beh)
                    continue
                if key in TOKEN_FIELDS:
                    continue
                walk(val, p, None)
        elif n.kind == "arr":
            for i, v in enumerate(n.items()):
                walk(v, path + f"/{i}", None)

    walk(node, "", None)
    return edges


# --------------------------------------------------------------------------
# Dependency closure
# --------------------------------------------------------------------------

RECURSIVE_NAMESPACES = ("Buff", "MonsterConditions")


class DependencyGraph:
    """Closure over typed edges. Hubs are bounded by stack-membership nodes."""

    def __init__(self, sources: SourceSet) -> None:
        self.s = sources
        self._edges: Dict[str, List[Tuple[str, str, str, str, str, bool]]] = {}
        self._node_material: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def node_id(ns: str, ident: str) -> str:
        return f"{ns}/{ident}"

    def candidates(self, ns: str, ident: str) -> List[Candidate]:
        return self.s.definitions.get(ns, {}).get(ident, [])

    def edges_of(self, ns: str, ident: str) -> List[Tuple[str, str, str, str, str, bool]]:
        """(candidateOrdinal, real fieldPointer, targetNs, targetId, role, keyRef)."""
        nid = self.node_id(ns, ident)
        if nid not in self._edges:
            out = []
            if ns in RECURSIVE_NAMESPACES:
                for cand in self.candidates(ns, ident):
                    for ptr, tns, tid, role, key_ref in typed_edges(ns, cand.node):
                        out.append((str(cand.ordinal), ptr, tns, tid, role, key_ref))
            self._edges[nid] = out
        return self._edges[nid]

    def resolution(self, ns: str, ident: str) -> str:
        if ns == "StackName":
            if ident in getattr(self.s, "stack_ambiguities", lambda: {})():
                return "ambiguous"
            return "resolved" if ident in self.s.stack_members() else "missing"
        if ns in ("Summon",):
            return "resolved" if (ident in self.s.identities.get("Monster", set()) or ident in self.s.identities.get("Boss", set())) else "missing"
        if ns == "Weapon":
            return "resolved" if ident in self.s.identities.get("Weapon", set()) else "missing"
        cands = self.candidates(ns, ident)
        if not cands:
            return "missing"
        return "ambiguous" if len(cands) > 1 else "resolved"

    def node_material(self, ns: str, ident: str) -> Dict[str, Any]:
        nid = self.node_id(ns, ident)
        if nid in self._node_material:
            return self._node_material[nid]
        res = self.resolution(ns, ident)
        if ns == "StackName":
            mat: Dict[str, Any] = {"resolution": res, "members": self.s.stack_members().get(ident, []),
                                   "ambiguousMembers": getattr(self.s, "stack_ambiguities", lambda: {})().get(ident, [])}
        elif ns in ("Summon", "Weapon"):
            mat = {"resolution": res}
        else:
            mat = {
                "resolution": res,
                "candidates": [
                    {"file": c.file, "pointer": c.pointer, "ordinal": c.ordinal,
                     "canonicalContentHash": c.canonical_content_hash(), "rawTokenHash": c.raw_token_hash()}
                    for c in self.candidates(ns, ident)
                ],
            }
        self._node_material[nid] = mat
        return mat

    def closure(self, root_ids: Sequence[str]) -> Dict[str, Any]:
        """Closure from root Buff IDs. Presentation edges are recorded but not followed or digested."""
        nodes: Dict[str, Dict[str, Any]] = {}
        edges: List[Dict[str, Any]] = []
        presentation: List[Dict[str, Any]] = []
        stack = [("Buff", r) for r in root_ids]
        seen = set()
        while stack:
            ns, ident = stack.pop()
            nid = self.node_id(ns, ident)
            if nid in seen:
                continue
            seen.add(nid)
            nodes[nid] = self.node_material(ns, ident)
            if ns not in RECURSIVE_NAMESPACES:
                continue
            for ordinal, ptr, tns, tid, role, key_ref in self.edges_of(ns, ident):
                target = self.node_id(tns, tid)
                edge = {"from": nid, "candidateOrdinal": ordinal, "fieldPointer": ptr,
                        "to": target, "role": role, "keyRef": key_ref}
                if role == EDGE_ROLE_PRESENTATION:
                    presentation.append(edge)
                    continue
                edges.append(edge)
                if tns in RECURSIVE_NAMESPACES:
                    stack.append((tns, tid))
                elif target not in seen:
                    seen.add(target)
                    nodes[target] = self.node_material(tns, tid)
        edge_order = lambda e: (e["from"], e["candidateOrdinal"], e["fieldPointer"], e["to"], e["role"], e["keyRef"])
        edges.sort(key=edge_order)
        presentation.sort(key=edge_order)
        missing = sorted(n for n, m in nodes.items() if m["resolution"] == "missing")
        ambiguous = sorted(n for n, m in nodes.items() if m["resolution"] == "ambiguous")
        if ambiguous:
            completeness = "unresolved"
        elif missing:
            completeness = "partial"
        else:
            completeness = "complete"
        return {"nodes": dict(sorted(nodes.items())), "edges": edges, "presentationEdges": presentation,
                "missing": missing, "ambiguous": ambiguous, "dependencyCompleteness": completeness}

    def entry_digest(self, passive_refs: Sequence[Tuple[str, str]]) -> Tuple[str, Dict[str, Any]]:
        self.s.ensure_valid()
        closure = self.closure([pid for _, pid in passive_refs])
        material = {
            "contract": FINGERPRINT_CONTRACT_VERSION,
            "passiveDependencyVersion": PASSIVE_DEPENDENCY_VERSION,
            "roots": [{"position": pos, "ref": self.node_id("Buff", pid)} for pos, pid in passive_refs],
            "nodes": closure["nodes"],
            "edges": closure["edges"],
        }
        digest = sha256_text(json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return digest, closure


# --------------------------------------------------------------------------
# Entry-builder integration
# --------------------------------------------------------------------------

_CACHE: Dict[str, Tuple[SourceSet, DependencyGraph]] = {}


def _source_stamp(input_dir: Path) -> Tuple[Any, ...]:
    """Hash the actual discovered files, including same-size/restored-mtime edits."""
    stamp = []
    for fname in sorted({f for f, _ in DEFINITION_TABLES.values()} | {f for f, _ in OCCURRENCE_TABLES.values()}):
        p = find_source_file(Path(input_dir), fname)
        stamp.append((fname, str(p.resolve()), sha256_bytes(p.read_bytes())) if p else (fname, None, None))
    return tuple(stamp)


def load_sources(input_dir: Path, repo_root: Optional[Path] = None) -> Tuple[SourceSet, DependencyGraph]:
    key = str(Path(input_dir).resolve()) + "|" + repr(_source_stamp(input_dir)) + "|" + str(repo_root)
    if key not in _CACHE:
        for stale in [k for k in _CACHE if k.split("|", 1)[0] == str(Path(input_dir).resolve())]:
            del _CACHE[stale]
        sources = SourceSet(Path(input_dir), repo_root)
        _CACHE[key] = (sources, DependencyGraph(sources))
    return _CACHE[key]


def clear_cache() -> None:
    _CACHE.clear()


def passive_dependency_digests(input_dir: Path, category: str, repo_root: Optional[Path] = None) -> Dict[str, str]:
    """internalId -> passive dependency digest, only for rows with own passive refs.

    Mirrors the entry builder's by_id mapping (last row with a given name wins);
    the registry keeps every occurrence separately.
    """
    if category not in OCCURRENCE_TABLES:
        return {}
    sources, graph = load_sources(input_dir, repo_root)
    sources.ensure_valid()
    out: Dict[str, str] = {}
    for key, row in sources.occurrence_rows.get(category, []):
        name = sources.row_identity(key, row)
        if name is None:
            continue
        refs = sources.passive_refs(row)
        if not refs:
            out.pop(name, None)
            continue
        out[name] = graph.entry_digest(refs)[0]
    return out
