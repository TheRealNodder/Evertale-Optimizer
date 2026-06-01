#!/usr/bin/env python3
"""
Folder-local weapon detect, renumber, rename, and duplicate quarantine tool.

Place this file inside the weapon entries folder and run it there:
  apkfiles/entries/weapons/entries

Dry run:
  python detect_renumber_and_dedupe_weapons_in_folder.py

Apply rename + duplicate quarantine:
  python detect_renumber_and_dedupe_weapons_in_folder.py --apply

What it does:
- Reads every .json weapon file in the current folder.
- Detects the full weapon handle from filename and JSON fields.
- Determines each weapon's actual order number from the embedded authority list.
- Renames files to ####_FullWeaponHandle.json.
- Detects duplicate files that resolve to the same target.
- Keeps the best duplicate and moves extras to _weapon_duplicate_quarantine on --apply.
- Writes CSV/JSON reports.
- Does not require running from repo root.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ORDER_TEXT = r'''
RibbonHammer (The Gigas Rose)
DivineBearAxe (Bear Crown Axe)
AmethystGemSpear (Dreamstone Lance)
UnchainedObsidianStaff (Dream's End)
EagleBannerGreatSword (Sword of Liberty)
ChopinPianoMace (Harmonicus)
ElectricGuitarGreatAxe (Star Rocker)
DivineSpear (Empyrean Spear)
FireDragonAxe (Infernum Wing)
ThorMace (Ragnarok Breaker)
MyshaFlowerStaff (Astral Lotus)
KenshinKatana (Himezuru Blade)
DarkOwlGreatAxe (Nether Owl Axe)
VenusSeaShellMace (Heavenly Grace)
BlueDragonSword (Hildrgreipr)
ZeusLightningGreatAxe (Celestial Wrath)
DragonSlayerSword (Balmung)
AltarKatana (Umbra Banisher)
CrystalDragonAxe (Lucent Crystal Ark)
FrostBladeGreatSword (Frost Sepulcher)
DonQuixoteSpear (Sancho Panza)
AbandonedChurchAxe (Nocturne Dirge)
MomotaroStaff (Riot of Blossoms)
ElminaFutureHammer (Crushing Bolt)
CityNightGreatSword (Astral Breaker)
BlackShipHammer (Susquehanna)
MapleLeafGreatAxe (Vermilion Tempest)
GreenHueKatana (Iron Stand Cleaver)
CircusHammer (Festival of Ruin)
TurquoiseHazeAxe (Phantom Fang)
SilverKnightSword (Radiant Silverlight)
RolotiaDarkSpear (Zulmat Spear)
ChronosGreatAxe (Time Sunderer)
NikeHammer (Silencewrought)
DarkMaidAxe (Deathmaid Cleaver)
RoyalBlueGreatSword (Azure Majesty)
LudmillaDarkHammer (Abyss Fury)
ThunderSpear (Imperial Tonitrus)
NightfallMace (Nyx Rod)
ZoroGreatSword (Nocturne Rosé)
BattleshipGreatSword (Wrathbound Blade)
BurningMechaSword (Pyro Gearblade)
HokusaiGreatAxe (North Star)
LightningDragonSword (Thunderclaw)
SatanSpear (Hellfang)
PurpleUniverseMace (Salvator Mundi)
GoldGildedKatana (Heaven's Wrath)
PipeMace (Combat Kiseru)
GokuBrideHammer (Oathkeeper)
MermaidSpear (Depthmaster)
MurasakiAxe (Akeyozakura)
SnowWhiteIceHammer (Ice Herald)
GawainDarkGreatSword (Heretic's Creed)
LuciferHellMace (Hellbound)
LancelotGoldHammer (Luminatus)
TristanHarpGreatAxe (Iseult)
CursedHolyGreatSword (Ironheart)
ApocalypseHammer (The Apocalypse)
KaguyaJewelStaff (Mt. Penglai's Prize)
HijikataGreatSword (Kanesada)
OkitaSakuraKatana (Kiku Ichimonji)
CleopatraMoonAxe (Moonbeam Labrys)
NapoleonPistolSword (Invictus)
CthulhuGreatAxe (Oblivion's Edge)
UnicornGreatSword (Peacemaker)
CinderellaFishSpear (Cocytus)
FrankensteinLightningHammer (Wrath of Arges)
GenieOrbStaff (Scheherazade Wand)
ArthurWingAxe (Aetherwing)
LuBuDragonSpear (Sky Piercer)
IceFallsKatana (Unsigned Kaneshige)
ThornCrownMace (Flame of Hope)
ScissorSword (Wingshears)
RedGemGreatAxe (Clarent)
PercivalGreatSword (Hex Vortex)
LudmillaWinterHammer (Mallet of Plenty)
GoldFlameAxe (Final Elegy)
CinderellaDarkSword (Bloody Rose)
OtohimeStaff (Tideswayer)
GokuDarkHammer (Huntiegun)
RizetteBrideAxe (Azure Rose)
GilgameshGreatSword (Holy Rulemaker)
CleopatraGreatAxe (The Ageless)
BridalWeddingStaff (Sacred Vow)
LokiGreatAxe (Risanautr)
OdinSpear (Gungnir)
WoodenMoonHammer (Moon Mallet)
CopperMirrorMace (Divine Mirror)
ParasolSpear (Parasoul)
ChainSawGreatSword (Chainsword)
KingArthurGreatSword (Caliburn)
RoundTableBrideSword (Holy Arondight)
AliceMagicalStaff (Heart Prism)
EnergyWingAxe (Angel of Greed)
FireConquererKatana (Sosan Samonji)
IceBrideSpear (Icebound Vow)
RedDragonKnightHammer (Dragonheart)
TimeClockKatana (Chronotheristes)
RaceBikeAxe (Windchaser)
IbarahimeGreatSword (Briar Rose)
CinderellaSword (Cendrillon)
AstridNewSword (Shooting Star)
ScientistStaff (O55-1A Assault Rod)
PurpleDragonMace (Drachenkeule)
RamMace (Shub-Niggurath)
HermesStaff (Caduceus)
RaceCarHammer (Full Throttle)
KirinGreatAxe (Passaddhi)
TyrfingSword (Tyrfing)
RoundTableSword (Arondight)
AztecMace (Divine Macuahuitl)
IfritMace (Demonrage)
QueenHeartMace (Queen of Hearts)
GokuSpear (Ruyi Bang)
BlackLightningStaff (Stormbringer)
SevenBranchKatana (Shichishito)
SacredBirdAxe (Axe of Zhuque)
DevilSpear (Hades's Bident)
MerlinStaff (Great Mage's Staff)
WhiteTigerGreatAxe (Axe of Baihu)
ColdNightKatana (Frostbite)
GreenDragonSpear (Spear of Qinglong)
TurtleMace (Rod of Xuanwu)
BlackCrowKatana (Kogarasumaru)
FlamingGreatSword (Flamberge)
HolyJewelKatana (Doujigiri)
BlackBladeSword (Hrunting)
RainbowGreatsword (Caladbolg)
LeviathanAxe (Leviathan)
WolfSword (Vanargand)
IndiaMonkeyMace (Hanuman's Mace)
WorldTreeStaff (Yggdrasil)
PurpleSpikeKatana (Onimaru)
MikoStaff (Yata Staff)
CrescentMoonKatana (Starshatter Blade)
DarkSorceryStaff (Dark Remnant)
BloodSpear (Areadbhar)
ChineseGreatAxe (Axe of Pangu)
ExcaliburGreatsword (Excalibur)
CloudKatana (Kusanagi)
LionMace (Heracles's Warclub)
LumberAxe (Bunyan's Axe)
HolyWingHammer (Sharur)
SnowWhiteStaff (Royal Scepter)
RidingHoodGreatAxe (Van Helsing)
DragonTridentSpear (Poseidon's Fork)
LuckyJapanHammer (Uchide no Kozuchi)
SkullExecutionerAxe (Despinox)
ThorHammer (Mjolnir)
AntaresGreatSword (Arclight Buster)
IdolStaff (Pink Sugar)
LonginusSpear (Longinus)
ChristmasHammer (Mistelzweig)
SpikeKatana (Senketsu)
RedBladeKatana (Suzaku no Tachi)
GreenWeaveKatana (Tsukuyomi)
GreenThornSpear (Velantha)
YandereSword (Fleur Fatale)
TwoProngSpear (Driftsteel Spear)
OssiaMace (Lilium Sanguis)
IkemenKatana (Murakumo)
HellGreatAxe (Bloodbane)
DarkWeaveSpear (Spear of Silence)
BlackWarHammer (Athanor)
HollowGreatSword (Aldorean)
AnchorHammer (Seastrider)
EgyptGreatAxe (Ma'at)
AztecAxe (Yaotl)
KnightGreatAxe (Hymelian Thunder)
BahamutAxe (Armageddon)
AngelWingSpear (Heaven's Gleam)
ClawStaff (Eye of Orum)
RolotiaStaff (Horologia)
MasamuneKatana (Masamune)
CrescentHammer (Zenith)
CrossSpear (Sancta Paladia)
RoseSword (Scarlet Thorn)
RizetteNewSword (Liberator)
CyrusMace (Thieves' Fortune)
DarkAstridGreatsword (Dragonfury)
MoonlightSpear (Tsukikage)
DemonKatana (Muramasa)
IceWitchStaff (Winter's Kiss)
EmeraldGreatAxe (Fortunatus)
ArabianSword (Dunedancer)
ChineseSaber (Yan Long Dao)
SantaElminaSpear (Spearmint)
SeaSerpentHammer (Depthforged)
GoldPirateSword (Aquiline Saber)
NovaBlastDragonAxe (Stormcleaver)
DarkRizetteSword (Deathbreaker)
LudmillaMace (Star of Aldyne)
NorzaSword (Nameless)
ArgaGreatsword (Pride of Roa)
SeaShellStaff (Nacre Staff)
MoonScepterStaff (Lunar Monarch)
BabyDarkDragonKatana (Bitten Blade)
BlueGoldFencingSword ()
BlueCrystalAxe (Skygem Axe)
ElminaSpear (Night's End)
SushiKnifeKatana (Yanagi Blade)
BoneBladeSword (Whalesbreath)
ThickLanceSpear (Fierte)
IslandTribeMace (Kohiwi)
SawbladeGreataxe (Adamant Axe)
DarkJewelGreatsword (Termagant)
DragonEatingGreatsword (Ridill)
EarthGreatCatMace (Scaleshatter)
DarkTridentSpear (Brutalizer)
TreeLanternStaff (Gaia Lamp)
RedWingsWand (Phoenix Wand)
AstridGreatsword (Dragonfang)
BlueSpikeOrbStaff (Storm Staff)
KeybladeStaff (Al Feras)
NagiKatana (Nagi Ichimonji)
TestGreatswordPvp04 ()
TestGreatswordPvp03 ()
TestGreatswordPvp02 ()
TestGreatswordPvp01 ()
TestSwordPvp04 ()
TestSwordPvp03 ()
TestSwordPvp02 ()
TestSwordPvp01 ()
TestSpearPvp04 ()
TestSpearPvp03 ()
TestSpearPvp02 ()
TestSpearPvp01 ()
TestStaffPvp04 ()
TestStaffPvp03 ()
TestStaffPvp02 ()
TestStaffPvp01 ()
TestHammerPvp04 ()
TestHammerPvp03 ()
TestHammerPvp02 ()
TestHammerPvp01 ()
TestMacePvp04 ()
TestMacePvp03 ()
TestMacePvp02 ()
TestMacePvp01 ()
TestKatanaPvp04 ()
TestKatanaPvp03 ()
TestKatanaPvp02 ()
TestKatanaPvp01 ()
TestGreataxePvp04 ()
TestGreataxePvp03 ()
TestGreataxePvp02 ()
TestGreataxePvp01 ()
TestAxePvp04 ()
TestAxePvp03 ()
TestAxePvp02 ()
TestAxePvp01 ()
GreenSpikesMace (Mace of Avarci)
AirDragonHammer (Cloudbreaker Maul)
TinyRedSword (Evening Star)
FinnSword (First Light)
TestSword ()
TestStaffRanged ()
TestStaffMelee ()
TestSpearSpecialTemp ()
TestSpearNormalTemp ()
TestSpear ()
TestMace ()
TestKatana ()
TestHammer ()
TestGreatSword ()
TestGreatAxe ()
TestAxe ()
Druke01Axe ()
Luther01Sword ()
Eternal02GreatSword ()
Eternal01GreatSword (Hero's End)
Norza01GreatSword (Obsidian Storm)
Gyurelle01Sword (Wraithblade)
Mibone01Mace (Crimson Lily)
RockBladeSpear (Eruheart)
KnivesHandleKatana (Ibuki)
JewelWingedGreataxe (Luwing)
GoldDragonGreatsword (Wyrmbane)
GoldDemonMace (Dio Scepter)
FairyWand (Lyfwand)
EtchedAxe (Dweoraix)
DarkRuneSword (Runeblade)
BlueSpikesHammer (Krustalslayer)
SpikeLavaBallMace (Lava Mace)
SpikeGoldBallMace (Gold Orb)
RedSpikesAxe (Crimson Edge)
RedGemSword (Trirubellite)
RedCarnivalHammer (Rhodestrike)
RedBlackGreataxe (Haldrax)
PurpleNaginataSpear (Vensha Spear)
GoldSwirlPearlWand (Pearl Rod)
GoldSpikesSpear (King's Pike)
GoldLavaGreatsword (Magma Blade)
GoldBladeKatana (Ether Sirocco)
BlueSkullGreataxe (Bella Morte)
BlueIceGreatsword (The Glacier)
BlueGoldJaggedSword (Ozarklia)
BlueEdgyAxe (Ocean Edge)
BlackAndBlueHammer (The Bruiser)
LightningWand (Levinbolt)
BlueSteelKatana (Kryo Katana)
ShiningBlueGreatsword (Cobalt Greatsword)
RedRocketHammer (Forge Crash)
RedBrownGreataxe (Woodcutter)
IceStaff (Ice Staff)
GoldSpikeMace (Golden Claw)
GoldSpikeGreatsword (Electrumus)
GoldFencerSword (Thunder Edge)
GoldenHatchetAxe (Heirloom Axe)
FireKatana (Torch Edge)
DarkSpear (Dark Lance)
DarkJaggedAxe (Obsidian Axe)
ClawBlueSpear (Azure Claw)
ChozoHeadWand (Rake Staff)
BigRockHammer (The Boulder)
FireMace (Scarlet Mace)
GlowingBlueMace (Gelid Mace)
TwirlyDecoSword (Serpens Sword)
SimpleGoldKatana (Noble Katana)
GoldGreataxe (Golden Greataxe)
TreeGreatsword (Knight Greatsword)
ExecutionerAxe (Vile Axe)
RedEdgySpear (Pitch Spear)
IronMaidenSword (Noble Sword)
BlueHammer (Spiked Hammer)
BlueGemStaff (Sapphire Staff)
BasicKatana (Keen Katana)
DogPersonGreataxe (Baltu Axe)
TwoBladeGreataxe (Labryn Greataxe)
SteelLanceSpear (Yanti Spear)
SteelKatana (Bikki Katana)
SteelHammer (Sarru Hammer)
FlameSword (Flame Sword)
StickAxe (Steel Axe)
ShamanStaff (Shaman Staff)
BerserkerGreataxe (Battle Axe)
PriestMace (Steel Mace)
LongSword (Steel Sword)
IronSpear (Steel Spear)
ClaymoreGreatsword (Steel Greatsword)
BusterSword (Iron Greatsword)
SoldierAxe (Iron Hand Axe)
IronHammer (Iron Hammer)
BladedMace (Iron Mace)
WoodenStaff ()
SpikeBallMace ()
IronSword ()
IronGreatsword ()
IronGreatAxe ()
IronAxe ()
DefaultSpear ()
DefaultKatana ()
BasicHammer ()
'''

LINE_RE = re.compile(r'([A-Za-z0-9_]+)\s*\((.*?)\)')


def norm(value: Any) -> str:
    return re.sub(r'[^a-z0-9]+', '', str(value or '').lower())


def strip_prefix(stem: str) -> str:
    return re.sub(r'^\d+_', '', stem)


def strip_trailing_digits(value: str) -> str:
    return re.sub(r'\d+$', '', str(value or ''))


def aliases(value: Any) -> List[str]:
    raw = str(value or '').strip()
    if not raw:
        return []
    vals = {raw, strip_prefix(raw), strip_trailing_digits(raw), strip_trailing_digits(strip_prefix(raw))}
    vals.update({v.replace('Greataxe', 'GreatAxe') for v in list(vals)})
    vals.update({v.replace('GreatAxe', 'Greataxe') for v in list(vals)})
    if not re.search(r'\d+$', raw):
        vals.add(raw + '01')
    return [norm(v) for v in vals if norm(v)]


def read_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding='utf-8-sig', errors='replace'))
    except Exception:
        return {}


def sha1(path: Path) -> str:
    h = hashlib.sha1()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def detect_ids(path: Path, data: Dict[str, Any]) -> List[str]:
    stem = strip_prefix(path.stem)
    internal = data.get('internal') if isinstance(data.get('internal'), dict) else {}
    raw = data.get('raw') if isinstance(data.get('raw'), dict) else {}
    vals = [
        stem,
        data.get('sourceId'), data.get('id'), data.get('family'), data.get('name'), data.get('displayName'), data.get('title'),
        internal.get('sourceId'), internal.get('weaponId'), internal.get('name'), internal.get('displayName'),
        raw.get('name'), raw.get('displayName'), raw.get('id'),
    ]
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
        for a in aliases(key):
            if a and a not in mp:
                mp[a] = (num, key, display)
    return mp


def leading_number(name: str) -> int:
    m = re.match(r'^(\d+)_', name)
    return int(m.group(1)) if m else 999999


def choose_keeper(paths: List[Path]) -> Path:
    return sorted(paths, key=lambda p: (
        0 if leading_number(p.name) != 999999 else 1,
        leading_number(p.name),
        len(p.name),
        p.name.lower(),
    ))[0]


def unique_quarantine_path(folder: Path, name: str) -> Path:
    q = folder / '_weapon_duplicate_quarantine'
    q.mkdir(exist_ok=True)
    target = q / name
    if not target.exists():
        return target
    stem, suffix = target.stem, target.suffix
    i = 1
    while True:
        candidate = q / f'{stem}_dup{i}{suffix}'
        if not candidate.exists():
            return candidate
        i += 1


def main() -> int:
    ap = argparse.ArgumentParser(description='Detect weapon handle from JSON/files, rename to authority order, and quarantine duplicates.')
    ap.add_argument('--apply', action='store_true', help='Actually rename files and quarantine duplicates. Default is dry-run only.')
    args = ap.parse_args()

    folder = Path.cwd()
    files = sorted([p for p in folder.glob('*.json') if p.is_file() and not p.name.startswith('_')])
    order_map = build_order_map()

    candidates = []
    missing = []
    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for path in files:
        data = read_json(path)
        ids = detect_ids(path, data)
        found = None
        for value in ids:
            for a in aliases(value):
                found = order_map.get(a)
                if found:
                    break
            if found:
                break
        if not found:
            missing.append({'filename': path.name, 'detected_ids': ids})
            continue
        number, key, display = found
        target = f'{number:04d}_{key}.json'
        row = {
            'old': path.name,
            'new': target,
            'number': number,
            'key': key,
            'display': display,
            'sha1': sha1(path),
            'detected_ids': ids,
        }
        candidates.append(row)
        grouped.setdefault(target, []).append(row)

    keep_rows = []
    duplicate_rows = []
    for target, rows in grouped.items():
        paths = [folder / r['old'] for r in rows]
        keeper_path = choose_keeper(paths)
        for row in rows:
            if row['old'] == keeper_path.name:
                row['action'] = 'rename' if row['old'] != row['new'] else 'keep'
                keep_rows.append(row)
            else:
                row['action'] = 'quarantine_duplicate'
                duplicate_rows.append(row)

    report = {
        'schemaVersion': 1,
        'generatedAt': int(time.time()),
        'folder': str(folder),
        'apply': args.apply,
        'filesScanned': len(files),
        'matchedCount': len(candidates),
        'uniqueTargetCount': len(grouped),
        'duplicateCount': len(duplicate_rows),
        'missingCount': len(missing),
        'missing': missing,
        'duplicates': duplicate_rows,
        'kept': keep_rows,
        'allMatched': candidates,
    }

    Path('_weapon_detect_renumber_dedupe_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with Path('_weapon_detect_renumber_dedupe_report.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['action', 'old', 'new', 'number', 'key', 'display', 'sha1'])
        w.writeheader()
        for row in keep_rows + duplicate_rows:
            w.writerow({k: row.get(k, '') for k in ['action', 'old', 'new', 'number', 'key', 'display', 'sha1']})

    if args.apply:
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
            tmp = old.with_name(old.name + '.weapon_rename_tmp')
            if tmp.exists():
                tmp.unlink()
            old.rename(tmp)
            temp_moves.append((tmp, new))
        for tmp, new in temp_moves:
            if new.exists():
                new.rename(unique_quarantine_path(folder, new.name))
            tmp.rename(new)

    print(json.dumps({
        'status': 'applied' if args.apply else 'dry-run',
        'filesScanned': len(files),
        'matchedCount': len(candidates),
        'uniqueTargetCount': len(grouped),
        'duplicateCount': len(duplicate_rows),
        'missingCount': len(missing),
        'report': '_weapon_detect_renumber_dedupe_report.json',
        'csv': '_weapon_detect_renumber_dedupe_report.csv',
        'duplicateQuarantine': '_weapon_duplicate_quarantine',
    }, indent=2))
    if missing:
        print('WARNING: Some weapon files were not matched. Review the report before applying.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
