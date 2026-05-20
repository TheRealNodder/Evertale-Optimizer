# Evertale IL2CPP Runtime Extractor

This utility extracts the two files needed to recover Evertale runtime formulas:

- libil2cpp.so
- global-metadata.dat

Supports:
- APK
- XAPK
- APKM
- ZIP
- extracted folders

Usage:

```bat
python evertale_il2cpp_extractor.py "Evertale.xapk"
```

Optional Il2CppDumper integration:

```bat
python evertale_il2cpp_extractor.py "Evertale.xapk" --dumper "C:\Tools\Il2CppDumper\Il2CppDumper.exe"
```

Targets searched after dumping:
- MonsterInstance.Power
- Monster.CalculateStat
- MonsterInstance.CalculateStatAprox
- TotalPowerRarityScalor
- CalculateAwakeningTotal
- CalculateMonsterPassiveValue
- Buff.FlatBonusForStat
- Buff.ScalorBonusForStat
- WeaponInstance.Power
