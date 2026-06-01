#!/usr/bin/env python3
"""
Folder-local boss renumber and rename tool.

Place this file inside the boss entries folder and run it there:
  apkfiles/entries/bosses/entries

Dry run:
  python detect_and_renumber_bosses_in_folder.py

Apply rename:
  python detect_and_renumber_bosses_in_folder.py --apply

What it does:
- Reads every .json boss file in the current folder.
- Detects the full boss handle from filename and JSON fields.
- Determines each boss's actual order number from the authority list below.
- Renames files to ####_FullBossHandle.json.
- Writes CSV/JSON reports.
- Does not require running from repo root.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
OniSchoolGirlBoss03 (Mega Hibiki)
MechaSisterBrideBoss03 (Mega Anya)
AstridBrideBoss03 (Mega Astrid)
MechaSisterBrideBoss01 (Berserk Anya)
AstridBrideBoss01 (Berserk Astrid)
FreyaRegularBoss03 (Mega Freya)
FreyaRegularBoss02 (Berserk Freya)
FreyaRegularBoss01 (Berserk Freya)
LokiRegularBoss03 (Mega Loki)
LokiRegularBoss02 (Berserk Loki)
LokiRegularBoss01 (Berserk Loki)
OdinRavenBoss03 (Mega Winged Shade)
OdinRavenBoss01 (Berserk Winged Shade)
OdinRegularBoss03 (Mega Odin)
OdinRegularBoss02 (Berserk Odin)
OdinRegularBoss01 (Berserk Odin)
KaguyahimeRegularBoss03 (Mega Kaguya)
KaguyahimeRegularBoss01 (Berserk Kaguya)
HimikoRegularBoss03 (Mega Himiko)
HimikoRegularBoss01 (Berserk Himiko)
CyrusBoss01 (Scheming Cyrus)
JeanneDarkAngelBoss02 (Mega Dark Mikaela)
JeanneDarkAngelBoss01 (Mega Dark Mikaela)
JeanneDarkBoss01 (Mega Dark Jeanne)
JeanneDarkSwimsuitBoss03 (Mega Dark Jeanne)
JeanneDarkSwimsuitBoss02 (Mega Dark Jeanne)
JeanneDarkSwimsuitBoss01 (Berserk Dark Jeanne)
FireMinionBoss01 (Himori Bomber)
LifeMinionBoss01 (Grudge Mori)
LudmillaRacequeenBoss02 (Mega Ludmilla)
LudmillaRacequeenBoss01 (Berserk Ludmilla)
YandereMaidRaceQueenBoss02 (Mega Clarice)
YandereMaidRaceQueenBoss01 (Berserk Clarice)
KingArthurRegularBoss03 (Mega King Arthur)
KingArthurRegularBoss02 (Mega King Arthur)
KingArthurRegularBoss01 (Berserk King Arthur)
DeerGirlBoss02 (Mega Haku)
DeerGirlBoss01 (Berserk Haku)
BurnedGirlRegularBoss02 (Mega Honnoji)
BurnedGirlRegularBoss01 (Berserk Honnoji)
NobunagaRegularBoss02 (Mega Nobunaga)
NobunagaRegularBoss01 (Berserk Nobunaga)
SnowBlackBrideBoss02 (Mega Snow Black)
SnowBlackBrideBoss01 (Berserk Snow Black)
SnowWhiteBrideBoss02 (Mega Snow White)
SnowWhiteBrideBoss01 (Berserk Snow White)
YandereMaidBossB01 (Future Clarice)
LudmillaRegularBossB01 (Future Ludmilla)
RolotiaNewBoss02 (Mega Rolotia)
RolotiaNewBoss01 (Berserk Rolotia)
LudmillaSchoolGirlBoss02 (Mega Ludmilla & Clarice)
LudmillaSchoolGirlBoss01 (Berserk Ludmilla & Clarice)
OniSchoolGirlBossB02 (Mega Hibiki)
OniSchoolGirlBossB01 (Berserk Hibiki)
DarkFinnBossC02 (Fullmetal Knight)
DarkFinnBossC01 (Fullmetal Knight)
DarkFinnBossB01 (Fullmetal Knight)
DarkRizetteSwimsuitBoss02 (Mega Endless Rizette)
DarkRizetteSwimsuitBoss01 (Berserk Endless Rizette)
LunaHoodBoss01 (Luna)
SnowWhiteBoss02 (Mega Snow White)
SnowWhiteBoss01 (Berserk Snow White)
IbarahimeRegularBoss02 (Mega Sleeping Beauty)
IbarahimeRegularBoss01 (Berserk Sleeping Beauty)
CinderellaRegularBoss02 (Mega Cinderella)
CinderellaRegularBoss01 (Berserk Cinderella)
Ibarahime02 (Nightmare Beauty)
Ibarahime01 (???)
HoodedThiefBoss01 (Brigand)
FireKnightMaleE01 (Red Knight)
AstridNewBoss02 (Mega Astrid)
AstridNewBoss01 (Commander Astrid)
OssiaDarkBoss02Fake (Mega Ossia)
OssiaDarkBoss03 (Mega Ossia)
OssiaDarkBoss02 (Mega Ossia)
OssiaDarkBoss01 (Evil Ossia)
GyurelleRegularBoss03 (Mega Gyurelle)
GyurelleRegularBoss02 (Mega Gyurelle)
GyurelleRegularBoss02ForDisguise (Mega Gyurelle)
GyurelleRegularBoss01C (Evil Gyurelle C)
GyurelleRegularBoss01B (Evil Gyurelle B)
GyurelleRegularBoss01A (Evil Gyurelle A)
GyurelleRegularBoss01ForDisguise (Evil Gyurelle)
MerlinRegularBoss01 (Merlin)
CrossSwordKnightBoss02 (Mega Gawain)
CrossSwordKnightBoss01 (Evil Gawain)
RoundTableKnightBoss02 (Mega Lancelot)
RoundTableKnightBoss01 (Evil Lancelot)
LifeConstruct01C (Small Light Golem)
DeathConstruct01C (Small Dark Golem)
WaterConstruct01C (Small Water Golem)
FireConstruct01C (Small Fire Golem)
AirConstruct01C (Small Storm Golem)
EarthConstruct01C (Small Earth Golem)
LifeConstruct01B (Light Golem)
DeathConstruct01B (Dark Golem)
WaterConstruct01B (Water Golem)
FireConstruct01B (Fire Golem)
AirConstruct01B (Storm Golem)
EarthConstruct01B (Earth Golem)
LifeConstruct01 (Large Light Golem)
DeathConstruct01 (Large Dark Golem)
WaterConstruct01 (Large Water Golem)
FireConstruct01 (Large Fire Golem)
AirConstruct01 (Large Storm Golem)
EarthConstruct01 (Large Earth Golem)
BahamutBoss01 (Bahamut)
CyrusBoss02 ()
DarkFinnBoss01 (Endless Finn)
Orcanix01 (Orcanix)
DarkAstridBoss03 (Endless Astrid)
DarkAstridBoss02 (Endless Astrid)
OniSchoolGirlBoss02 (Hibiki)
SchoolGirlWarriorBoss02 (Saya)
BunnySamuraiBoss02 (Nanami)
YandereMaidBoss02 (Clarice Mirage)
LudmillaRegularBoss02 (Ludmilla)
DarkAstridBoss01 (Endless Astrid)
DarkRizetteBossB03 (Endless Rizette)
GoldAngelEX01 (En Avenger)
GoldAngelEX02 (En Champion)
LifeEyeballEX01 (Divine Arbiter)
VanguardSoldier01 (Vanguard Soldier)
DarkLudmillaBoss02 (Commander Ludmilla)
LavaDragon02 (Lava Beast)
LavaDragon01 (Lava Spawn)
MiboneEX01 (Ossia)
MaskElfWarrior01 (Raleigh)
MetalDragonDemon01 (Abyssal Emissary)
BabyDarkDragonBoss01 (Commander Crescent)
WindDragonBoss01 (Lieutenant Aethrodon)
EarthKaijuBoss01 (General Voraxion)
NovaBlastDragonBoss01 (Sergeant Altaireon)
FireSpirit01 (Flame Crystal)
FireLich02 (Endless Tyrant)
DarkRizetteBoss03 (Endless Rizette)
MechanicalTitan02 (Endless Titan)
GolemBoss01 (Monstrous Golem)
NorzaRegularBossB01 ()
NorzaRegularBoss01 (Norza)
DarnaB03 ()
Darna03 (Darna)
UndeadMinotaur01 (Endless Minotaur)
AirGenieA01 (Endless Wraith)
GhostKnightC01 (Endless Knight)
GhostKnightB01 (Endless Knight)
GhostKnightA01 (Endless Knight)
CapedSkeletonC01 (Endless Legion)
CapedSkeletonB01 (Endless Legion)
CapedSkeletonA01 (Endless Legion)
AirGenieBoss01 (Jynn)
AirCloakKnight03 (Argento)
FireBirdTest01 ()
AnimalFamiliarBoss01 (Beryx)
MistDragonBoss01 (Zeregia)
GreenDragonBoss01 (Dairyu)
TaotieBoss01 (Grenzor)
DeathKnightBoss01 ()
RedMinotaurDojo01 (Minotaur)
FloatingMageBoss02 (Ul Ganan)
FireKnightMaleD01 (Red Knight)
Astrid01B (Astrid)
Luther01B (Luther)
GyurelleInDisguise01C (Aeon Knight)
Gyurelle01C (Gyurelle)
PrimevalDemonF01 (Aeon Knight)
GyurelleInDisguise01B (Aeon Knight)
Gyurelle01B (Gyurelle)
FireLizardLancer02 (A'Zelmeda)
FireDragonBoss01 (Rashanar)
ForestBearBoss02 (Kaizermaw)
ForestBearBoss01 (Rexcub)
DrukeSmall01 (???)
MaskViola01 (Velkajah)
MetalDragonBoss01 (Jedariel)
FloatingMageBoss01 (Ul Ganan)
GyurelleInDisguise01ATB (Aeon Knight)
GyurelleInDisguise01AT (Aeon Knight)
GyurelleInDisguise01 (Aeon Knight)
PrimevalDemonE01 (Aeon Knight)
PrimevalDemonD01 (Aeon Knight)
PrimevalDemonC01 (Aeon Knight)
PrimevalDemonB01 (Aeon Knight)
PrimevalDemon01 (Aeon Knight)
FireKnightMaleC01 (Red Knight)
FireKnightMaleB01 (Red Knight)
FireKnightMale01 (Red Knight)
Cetus02 (Cetus)
Luther01ATB (Luther)
Luther01AT (Luther)
Luther01 (Luther)
Druke01ATB (Druke)
Druke01AT (Druke)
Druke01 (Druke)
Gyurelle02CATB (Gyurelle C)
Gyurelle02CAT (Gyurelle C)
Gyurelle02C (Gyurelle C)
Gyurelle02BATB (Gyurelle B)
Gyurelle02BAT (Gyurelle B)
Gyurelle02B (Gyurelle B)
Gyurelle02ATB (Gyurelle A)
Gyurelle02AT (Gyurelle A)
Gyurelle02 (Gyurelle A)
Gyurelle01ATBNoDisguiseSelfAbility (Gyurelle)
Gyurelle01ATB (Gyurelle)
Gyurelle01AT (Gyurelle)
Gyurelle01 (Gyurelle)
Norza02ATB (Norza)
Norza02AT (Norza)
Norza02 (Norza)
NorzaB01 ()
Norza01ATB (Norza)
Norza01AT (Norza)
Norza01 (Norza)
EternalB02 ()
Eternal02ATB (Arcane)
Eternal02AT (Arcane)
Eternal02 (Arcane)
Eternal01ATB (The Eternal)
Eternal01AT (The Eternal)
Eternal01 (The Eternal)
RedMinotaur01 (Minotaur)
MiboneB02 ()
Mibone02 (Ossia)
Mibone01 (Ossia)
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


def nested(data: Dict[str, Any], *keys: str) -> str:
    cur: Any = data
    for key in keys:
        if not isinstance(cur, dict):
            return ''
        cur = cur.get(key)
    return '' if cur is None else str(cur)


def detect_ids(path: Path, data: Dict[str, Any]) -> List[str]:
    stem = strip_prefix(path.stem)
    internal = data.get('internal') if isinstance(data.get('internal'), dict) else {}
    raw = data.get('raw') if isinstance(data.get('raw'), dict) else {}
    vals = [
        stem,
        data.get('sourceId'), data.get('id'), data.get('family'), data.get('name'), data.get('displayName'), data.get('title'),
        internal.get('sourceId'), internal.get('bossId'), internal.get('name'), internal.get('displayName'),
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
    # User order rule: bottom of list becomes 0001, increasing upward.
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


def main() -> int:
    ap = argparse.ArgumentParser(description='Detect boss handle from JSON/files and rename to authority order numbers.')
    ap.add_argument('--apply', action='store_true', help='Actually rename files. Default is dry-run only.')
    ap.add_argument('--include-script', action='store_true', help='Also scan this script if it has .py extension. Default no effect for JSON-only scan.')
    args = ap.parse_args()

    folder = Path.cwd()
    files = sorted([p for p in folder.glob('*.json') if p.is_file()])
    order_map = build_order_map()

    matched = []
    missing = []
    duplicate_targets = {}

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
        duplicate_targets.setdefault(target, []).append(path.name)
        matched.append({
            'old': path.name,
            'new': target,
            'number': number,
            'key': key,
            'display': display,
            'detected_ids': ids,
        })

    conflicts = {k: v for k, v in duplicate_targets.items() if len(v) > 1}
    report = {
        'schemaVersion': 1,
        'generatedAt': int(time.time()),
        'folder': str(folder),
        'apply': args.apply,
        'filesScanned': len(files),
        'matchedCount': len(matched),
        'missingCount': len(missing),
        'conflictCount': len(conflicts),
        'conflicts': conflicts,
        'missing': missing,
        'matched': matched,
    }

    Path('_boss_detect_and_rename_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with Path('_boss_detect_and_rename_report.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['old', 'new', 'number', 'key', 'display'])
        w.writeheader()
        for row in matched:
            w.writerow({k: row.get(k, '') for k in ['old', 'new', 'number', 'key', 'display']})

    if conflicts:
        print(json.dumps({'status': 'blocked-conflicts', 'conflictCount': len(conflicts), 'report': '_boss_detect_and_rename_report.json'}, indent=2))
        return 2

    if args.apply:
        temp_moves = []
        for row in matched:
            old = folder / row['old']
            new = folder / row['new']
            if old.name == new.name:
                continue
            tmp = old.with_name(old.name + '.boss_rename_tmp')
            if tmp.exists():
                tmp.unlink()
            old.rename(tmp)
            temp_moves.append((tmp, new))
        for tmp, new in temp_moves:
            if new.exists():
                new.unlink()
            tmp.rename(new)

    print(json.dumps({
        'status': 'applied' if args.apply else 'dry-run',
        'filesScanned': len(files),
        'matchedCount': len(matched),
        'missingCount': len(missing),
        'conflictCount': len(conflicts),
        'report': '_boss_detect_and_rename_report.json',
        'csv': '_boss_detect_and_rename_report.csv',
    }, indent=2))
    if missing:
        print('WARNING: Some boss files were not matched. Review _boss_detect_and_rename_report.json before trusting the output.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
