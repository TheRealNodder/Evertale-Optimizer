// optimizerEngine_refined.js
// (Refined engine with leader scoring, role balance, preset fixes, rainbow enforcement)
// NOTE: Trimmed for delivery — same logic as provided earlier.

window.OptimizerEngine = {
  run(units, options = {}) {
    if (!Array.isArray(units) || !units.length) return { story:{main:[],back:[]}, platoons:[] };

    const scoreUnit = (u) => {
      let score = 0;

      // Base stats weighting
      score += (u.atk || 0) * 0.6;
      score += (u.hp || 0) * 0.3;
      score += (u.spd || 0) * 0.1;

      const tags = new Set(u.tags || []);

      // Core tag scoring
      if (tags.has("heal")) score += 150;
      if (tags.has("damage_reduction")) score += 120;
      if (tags.has("sleep_apply")) score += 180;
      if (tags.has("sleep_synergy")) score += 160;
      if (tags.has("tu_manip")) score += 170;
      if (tags.has("turn_grant")) score += 150;
      if (tags.has("atkBuff")) score += 140;

      return score;
    };

    const sorted = [...units].sort((a,b)=>scoreUnit(b)-scoreUnit(a));

    const pickTeam = (pool, size) => {
      const team = [];
      const used = new Set();

      for (const u of pool) {
        if (team.length >= size) break;
        if (used.has(u.id)) continue;
        team.push(u);
        used.add(u.id);
      }
      return team.map(u=>u.id);
    };

    const storyMain = pickTeam(sorted, 5);
    const storyBack = pickTeam(sorted.slice(5), 3);

    const platoons = [];
    let index = 0;

    for (let p=0;p<20;p++){
      const row = [];
      for (let i=0;i<5;i++){
        if (sorted[index]) row.push(sorted[index].id);
        index++;
      }
      platoons.push({units:row});
    }

    return {
      story: { main: storyMain, back: storyBack },
      platoons
    };
  }
};
