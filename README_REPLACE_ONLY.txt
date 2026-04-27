Evertale Optimizer replace-only package

Replace only these files in the GitHub repo. This package intentionally does not include unchanged repo files.

Includes:
- data/characters.json
- data/character_actives.json
- data/character_passives.json
- data/character_tags.json
- data/weapons.json
- data/accessories.json
- data/bosses.json
- data-loader.js
- optimizer.js
- optimizer-hook.js
- optimizerEngine.js

Notes:
- Data files are the final extracted-data replacements.
- Optimizer files are included so the split data and optimizer logic remain aligned.
- Existing image URLs in the data files are preserved from the current project data layer.
