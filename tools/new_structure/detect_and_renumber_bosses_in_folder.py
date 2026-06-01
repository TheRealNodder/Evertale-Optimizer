#!/usr/bin/env python3
"""
Folder-local boss renumber and rename tool.

Place this file inside the boss entries folder and run it there:
  apkfiles/entries/bosses/entries

Dry run:
  python detect_and_renumber_bosses_in_folder.py

Apply rename:
  python detect_and_renumber_bosses_in_folder.py --apply
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

ORDER_TEXT = r'''
LupinRegularBoss03 (Mega Lupin)
LupinRegularBoss01 (Berserk Lupin)
VictoriaRegularBoss03 (Mega Victoria)
VictoriaRegularBoss01 (Berserk Victoria)
YandereMaidBalletBoss03 (Mega Clarice)
YandereMaidBalletBoss01 (Berserk Clarice)
LudmillaBalletBoss03 (Mega Ludmilla)
LudmillaBalletBoss01 (Berserk Ludmilla)
KintaroRegularBoss03 (Mega Kintaro)
KintaroRegularBoss01 (Berserk Kintaro)
BeastRegularBoss03 (Mega Aigis)
BeastRegularBoss01 (Berserk Aigis)
BeautyRegularBoss03 (Mega Belle)
BeautyRegularBoss01 (Berserk Belle)
BeautyBeastRegularBoss03 (Mega Beauty & Beast)
BeautyBeastRegularBoss01 (Berserk Beauty & Beast)
SuperLifeMinionBoss01 (Super Shiromori)
SnowWhiteNewBoss03 (Mega Snow White)
SnowWhiteNewBoss01 (Berserk Snow White)
WashingtonRegularBoss03 (Mega Washington)
WashingtonRegularBoss01 (Berserk Washington)
ChopinRegularBoss03 (Mega Chopin)
ChopinRegularBoss01 (Berserk Chopin)
MechaSisterBandBoss03 (Mega Anya)
MechaSisterBandBoss01 (Berserk Anya)
FreyaNewBoss03 (Mega Freya)
FreyaNewBoss01 (Berserk Freya)
CalKouhaiRegularBoss03 (Mega Ruvi)
CalKouhaiRegularBoss01 (Berserk Ruvi)
ThorRegularBoss03 (Mega Thor)
ThorRegularBoss01 (Berserk Thor)
WhiteSnakeGirlBoss03 (Mega Mizuchi)
MyshaKnightBoss03 (Mega Mysha)
MyshaKnightBoss01 (Berserk Mysha)
KenshinRegularBoss03 (Mega Kenshin)
KenshinRegularBoss01 (Berserk Kenshin)
MusashiDarkBoss03 (Mega Musashi)
MusashiDarkBoss01 (Berserk Musashi)
VenusRegularBoss03 (Mega Venus)
VenusRegularBoss01 (Berserk Venus)
RizetteBraveBoss03 (Mega Rizette)
RizetteBraveBoss01 (Berserk Rizette)
ZeusRegularBoss03 (Mega Zeus)
ZeusRegularBoss01 (Berserk Zeus)
SiegfriedRegularBoss03 (Mega Siegfried)
SiegfriedRegularBoss01 (Berserk Siegfried)
ElmKouhaiRegularBoss03 (Mega Cera)
ElmKouhaiRegularBoss01 (Berserk Cera)
BahamutGirlRegularBoss03 (Mega Bahamut)
BahamutGirlRegularBoss01 (Berserk Bahamut)
AnastasiaRegularBoss03 (Mega Anastasia)
AnastasiaRegularBoss01 (Berserk Anastasia)
DonQuixoteRegularBoss03 (Mega Don Quixote)
DonQuixoteRegularBoss01 (Berserk Don Quixote)
KingArthurEvilBoss03 (Mega King Arthur)
KingArthurEvilBoss01 (Berserk King Arthur)
PeachGirlRegularBoss03 (Mega Momotaro)
PeachGirlRegularBoss01 (Berserk Momotaro)
ElminaModernBoss03 (Mega Elmina)
ElminaModernBoss01 (Berserk Elmina)
OniSchoolDarkBoss03 (Mega Hibiki)
OniSchoolDarkBoss01 (Berserk Hibiki)
PerryRegularBoss03 (Mega Perry)
PerryRegularBoss01 (Berserk Perry)
RyomaRegularBoss03 (Mega Ryoma)
RyomaRegularBoss01 (Berserk Ryoma)
MasamuneRegularBoss03 (Mega Masamune)
MasamuneRegularBoss01 (Berserk Masamune)
PinocchioRegularBoss03 (Mega Pinocchio)
PinocchioRegularBoss01 (Berserk Pinocchio)
KongmingRegularBoss03 (Mega Zhuge Liang)
KongmingRegularBoss01 (Berserk Zhuge Liang)
RizKouhaiRegularBoss03 (Mega Clare)
RizKouhaiRegularBoss01 (Berserk Clare)
SuperEarthMinionBoss01 (Super Chimori)
RolotiaDarkBoss03 (Mega Rolotia)
RolotiaDarkBoss01 (Berserk Rolotia)
ChronosRegularBoss03 (Mega Chronos)
ChronosRegularBoss01 (Berserk Chronos)
NikeRegularBoss03 (Mega Nike)
NikeRegularBoss01 (Berserk Nike)
YandereMaidDarkBoss03 (Mega Clarice)
YandereMaidDarkBoss01 (Berserk Clarice)
ElizabethRegularBoss03 (Mega Elizabeth)
ElizabethRegularBoss01 (Berserk Elizabeth)
LudmillaDarkNewBoss03 (Mega Ludmilla)
LudmillaDarkNewBoss01 (Berserk Ludmilla)
SuperAirMinionBoss01 (Super Denmori)
KirinGirlRegularBoss03 (Mega Kirin)
KirinGirlRegularBoss01 (Berserk Kirin)
KaguyahimeDarkBoss03 (Mega Kaguya)
KaguyahimeDarkBoss01 (Berserk Kaguya)
ZoroRegularBoss03 (Mega Zoro)
ZoroRegularBoss01 (Berserk Zoro)
YamatoRegularBoss03 (Mega Yamato)
YamatoRegularBoss01 (Berserk Yamato)
MechaSisterNewBoss03 (Mega Anya)
MechaSisterNewBoss01 (Berserk Anya)
HokusaiRegularBoss03 (Mega Hokusai)
HokusaiRegularBoss01 (Berserk Hokusai)
SuperFireMinionBoss01 (Super Himori)
DragonGirlRegularBoss03 (Mega Shen Long)
DragonGirlRegularBoss01 (Berserk Shen Long)
SatanRegularBoss03 (Mega Satan)
SatanRegularBoss01 (Berserk Satan)
DaVinciRegularBoss03 (Mega Da Vinci)
DaVinciRegularBoss01 (Berserk Da Vinci)
KojiroRegularBoss03 (Mega Kojiro)
KojiroRegularBoss01 (Berserk Kojiro)
GoemonRegularCloneBoss03 (Mega Shadow Double)
GoemonRegularBoss03 (Mega Goemon)
GoemonRegularBoss01 (Berserk Goemon)
GokuBrideBoss03 (Mega Sun Wukong)
GokuBrideBoss01 (Berserk Sun Wukong)
SuperWaterMinionBoss01 (Super Suimori)
MermaidRegularBoss03 (Mega Mermaid)
MermaidRegularBoss01 (Berserk Mermaid)
MurasakiRegularBoss03 (Mega Murasaki)
MurasakiRegularBoss01 (Berserk Murasaki)
SnowWhiteMaidBoss03 (Mega Snow White)
SnowWhiteMaidBoss01 (Berserk Snow White)
KingArthurRegularBoss05 (Mega King Arthur)
CrossSwordKnightDarkBoss03 (Mega Gawain)
CrossSwordKnightDarkBoss01 (Evil Gawain)
LuciferRegularBoss03 (Mega Lucifer)
LuciferRegularBoss01 (Evil Lucifer)
RoundTableKnightDarkBoss03 (Mega Lancelot)
RoundTableKnightDarkBoss01 (Evil Lancelot)
ExcaliburBossMinion01 (Super Kuromori)
ExcaliburRegularBoss03 (Mega Excalibur)
ExcaliburRegularBoss01 (Berserk Excalibur)
TristanRegularBoss03 (Mega Tristan)
TristanRegularBoss01 (Berserk Tristan)
KaguyahimeSwimsuitBoss03 (Mega Kaguya)
KaguyahimeSwimsuitBoss01 (Berserk Kaguya)
OkitaRegularBoss03 (Mega Okita)
OkitaRegularBoss01 (Berserk Okita)
HijikataRegularBoss03 (Mega Hijikata)
HijikataRegularBoss01 (Berserk Hijikata)
CleopatraDarkBoss03 (Mega Cleopatra)
CleopatraDarkBoss01 (Berserk Cleopatra)
NapoleonRegularBoss03 (Mega Napoleon)
NapoleonRegularBoss01 (Berserk Napoleon)
CthulhuGirlRegularBoss03 (Mega Cthulhu)
CthulhuGirlRegularBoss01 (Berserk Cthulhu)
CinderellaSwimsuitBoss03 (Mega Cinderella)
CinderellaSwimsuitBoss01 (Berserk Cinderella)
GenieRegularBoss03 (Mega Genie)
GenieRegularBoss01 (Berserk Genie)
FrankensteinRegularDollBoss03 (Mega Mary)
FrankensteinRegularDollBoss01 (Berserk Mary)
FrankensteinRegularBoss03 (Mega Frankenstein)
FrankensteinRegularBoss01 (Berserk Frankenstein)
KingArthurSwimsuitBoss03 (Mega King Arthur)
KingArthurSwimsuitBoss01 (Berserk King Arthur)
MusashiRegularBoss03 (Mega Musashi)
MusashiRegularBoss01 (Berserk Musashi)
LuBuRegularBoss03 (Mega Lü Bu)
LuBuRegularBoss01 (Berserk Lü Bu)
RapunzelRegularBoss03 (Mega Rapunzel)
RapunzelRegularBoss01 (Berserk Rapunzel)
IbarahimeSwimsuitBoss03 (Nightmare Beauty)
IbarahimeSwimsuitBoss01 (Berserk Sleeping Beauty)
KingArthurRegularBoss04 (Mega King Arthur)
MordredRegularBoss03 (Mega Mordred)
MordredRegularBoss01 (Berserk Mordred)
PercivalRegularBoss03 (Mega Percival)
PercivalRegularBoss01 (Berserk Percival)
LudmillaYukataBoss03 (Mega Ludmilla)
LudmillaYukataBoss01 (Berserk Ludmilla)
CerberusRegularBoss03 (Mega Cerberus)
CerberusRegularBoss01 (Berserk Cerberus)
CinderellaDarkBoss03 (Mega Cinderella )
OtohimeRegularBoss03 (Mega Otohime)
CinderellaDarkBoss01 (Berserk Cinderella)
OtohimeRegularBoss01 (Berserk Otohime)
GokuDarkBossClone03 (Mega Dark Sun Wukong)
GokuDarkBoss03 (Mega Dark Sun Wukong)
GokuDarkBoss01 (Berserk Dark Sun Wukong)
GilgameshRegularBoss03 (Mega Gilgamesh)
GilgameshRegularBoss01 (Berserk Gilgamesh)
CleopatraRegularBoss03 (Mega Cleopatra)
CleopatraRegularBoss01 (Berserk Cleopatra)
MyshaIdolGirlBoss03 (Mega Mysha)
CatIdolGirlBoss03 (Mega Mirai)
AntaresModernBoss03 (Mega Antares)
SchoolGirlWarriorBoss03 (Mega Saya)
HorseIdolGirlBoss03 (Mega Sakura)
'''

LINE_RE = re.compile(r'([A-Za-z0-9_]+)\s*\((.*?)\)')


def norm(value: Any) -> str:
    return re.sub(r'[^a-z0-9]+', '', str(value or '').lower())


def strip_prefix(stem: str) -> str:
    return re.sub(r'^\d+_', '', stem)


def read_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding='utf-8-sig', errors='replace'))
    except Exception:
        return {}


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def detect_ids(path: Path, data: Dict[str, Any]) -> List[str]:
    stem = strip_prefix(path.stem)
    internal = data.get('internal') if isinstance(data.get('internal'), dict) else {}
    raw = data.get('raw') if isinstance(data.get('raw'), dict) else {}
    vals = [stem, data.get('sourceId'), data.get('id'), data.get('family'), data.get('name'), data.get('displayName'), data.get('title'), internal.get('sourceId'), internal.get('bossId'), internal.get('name'), internal.get('displayName'), raw.get('name'), raw.get('displayName'), raw.get('id')]
    out = []
    for v in vals:
        v = str(v or '').strip()
        if v and v not in out:
            out.append(v)
    return out


def order_rows() -> List[Tuple[int, str, str]]:
    pairs = [(m.group(1).strip(), m.group(2).strip()) for m in LINE_RE.finditer(ORDER_TEXT)]
    pairs = list(reversed(pairs))
    return [(i, key, display) for i, (key, display) in enumerate(pairs, start=1)]


def build_order_map() -> Dict[str, Tuple[int, str, str]]:
    mp: Dict[str, Tuple[int, str, str]] = {}
    for num, key, display in order_rows():
        for alias in {key, strip_prefix(key)}:
            n = norm(alias)
            if n and n not in mp:
                mp[n] = (num, key, display)
    return mp


def leading_number(name: str) -> int:
    m = re.match(r'^(\d+)_', name)
    return int(m.group(1)) if m else 999999


def choose_keeper(names: List[str]) -> str:
    return sorted(names, key=lambda n: (0 if leading_number(n) != 999999 else 1, leading_number(n), len(n), n.lower()))[0]


def unique_quarantine_path(folder: Path, name: str) -> Path:
    q = folder / '_boss_duplicate_quarantine'
    q.mkdir(exist_ok=True)
    target = q / name
    if not target.exists():
        return target
    i = 1
    while True:
        candidate = q / f'{target.stem}_dup{i}{target.suffix}'
        if not candidate.exists():
            return candidate
        i += 1


def repo_root_from_entries_folder(folder: Path) -> Path | None:
    for parent in [folder, *folder.parents]:
        if (parent / 'apkfiles').exists() and (parent / 'tools').exists():
            return parent
    return None


def write_marker(folder: Path, report: Dict[str, Any]) -> None:
    repo = repo_root_from_entries_folder(folder)
    marker = folder / '_boss_detect_rename.marker.json'
    if repo:
        marker = repo / 'apkfiles' / 'entries' / '_markers' / 'boss_detect_rename.marker.json'
    marker.parent.mkdir(parents=True, exist_ok=True)
    write_json(marker, {'schemaVersion': 1, 'tool': 'detect_and_renumber_bosses_in_folder', 'category': 'bosses', 'status': 'applied' if report.get('apply') else 'blocked' if report.get('blocked') else 'dry-run', 'lastKey': 'boss_renumber', 'lastSourceId': '', 'lastHandle': None, 'lastFile': str(folder), 'processedCount': report.get('matchedCount', 0), 'totalCount': report.get('filesScanned', 0), 'updatedAt': int(time.time()), 'extra': {'missingCount': report.get('missingCount', 0), 'duplicateCount': report.get('duplicateCount', 0), 'conflictCount': report.get('conflictCount', 0), 'report': '_boss_detect_and_rename_report.json'}})


def main() -> int:
    ap = argparse.ArgumentParser(description='Detect boss handle from JSON/files and rename to authority order numbers.')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--force', action='store_true', help='Allow apply with missing matches. Conflicts still block.')
    args = ap.parse_args()
    folder = Path.cwd()
    files = sorted([p for p in folder.glob('*.json') if p.is_file() and not p.name.startswith('_') and not p.name.endswith('_report.json')])
    order_map = build_order_map()
    matched = []
    missing = []
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for path in files:
        data = read_json(path)
        ids = detect_ids(path, data)
        found = None
        for value in ids:
            found = order_map.get(norm(value))
            if found:
                break
        if not found:
            missing.append({'filename': path.name, 'detected_ids': ids})
            continue
        number, key, display = found
        target = f'{number:04d}_{key}.json'
        row = {'old': path.name, 'new': target, 'number': number, 'key': key, 'display': display, 'detected_ids': ids}
        matched.append(row)
        grouped.setdefault(target, []).append(row)
    keep_rows = []
    duplicate_rows = []
    for target, rows in grouped.items():
        keeper = choose_keeper([r['old'] for r in rows])
        for row in rows:
            if row['old'] == keeper:
                row['action'] = 'rename' if row['old'] != row['new'] else 'keep'
                keep_rows.append(row)
            else:
                row['action'] = 'quarantine_duplicate'
                duplicate_rows.append(row)
    keep_old_names = {r['old'] for r in keep_rows}
    conflicts = []
    for row in keep_rows:
        target = folder / row['new']
        if target.exists() and target.name not in keep_old_names and target.name != row['old']:
            conflicts.append({'old': row['old'], 'new': row['new'], 'existingTarget': target.name})
    blocked = bool(conflicts or (missing and not args.force))
    report = {'schemaVersion': 2, 'generatedAt': int(time.time()), 'folder': str(folder), 'apply': bool(args.apply and not blocked), 'force': args.force, 'blocked': blocked, 'filesScanned': len(files), 'matchedCount': len(matched), 'keptCount': len(keep_rows), 'duplicateCount': len(duplicate_rows), 'missingCount': len(missing), 'conflictCount': len(conflicts), 'conflicts': conflicts, 'missing': missing, 'duplicates': duplicate_rows, 'kept': keep_rows, 'matched': matched}
    write_json(folder / '_boss_detect_and_rename_report.json', report)
    with (folder / '_boss_detect_and_rename_report.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['action', 'old', 'new', 'number', 'key', 'display'])
        w.writeheader()
        for row in keep_rows + duplicate_rows:
            w.writerow({k: row.get(k, '') for k in ['action', 'old', 'new', 'number', 'key', 'display']})
    if args.apply and not blocked:
        backup_dir = folder / '_boss_rename_backup'
        backup_dir.mkdir(exist_ok=True)
        for row in duplicate_rows:
            old = folder / row['old']
            if old.exists():
                old.rename(unique_quarantine_path(folder, old.name))
        temp_moves = []
        for row in keep_rows:
            old = folder / row['old']
            new = folder / row['new']
            if not old.exists() or old.name == new.name:
                continue
            backup = backup_dir / old.name
            if not backup.exists():
                shutil.copy2(old, backup)
            tmp = old.with_name(old.name + '.boss_rename_tmp')
            if tmp.exists():
                tmp.unlink()
            old.rename(tmp)
            temp_moves.append((tmp, new))
        for tmp, new in temp_moves:
            if new.exists():
                new.rename(unique_quarantine_path(folder, new.name))
            tmp.rename(new)
    write_marker(folder, report)
    print(json.dumps({'status': 'blocked' if blocked else 'applied' if report['apply'] else 'dry-run', 'filesScanned': len(files), 'matchedCount': len(matched), 'missingCount': len(missing), 'duplicateCount': len(duplicate_rows), 'conflictCount': len(conflicts), 'report': '_boss_detect_and_rename_report.json', 'csv': '_boss_detect_and_rename_report.csv'}, indent=2))
    return 1 if blocked and args.apply else 0


if __name__ == '__main__':
    raise SystemExit(main())
