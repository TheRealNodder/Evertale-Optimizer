export async function loadCategory(category) {
  const base = 'apkfiles/entries';
  const indexUrl = `${base}/${category}/index.json`;

  try {
    const indexRes = await fetch(indexUrl);
    const index = await indexRes.json();

    const results = [];

    for (const entry of index.entries) {
      try {
        const res = await fetch(`${base}/${entry.file}`);
        const data = await res.json();
        results.push(data);
      } catch (e) {
        console.warn('Skipping broken entry:', entry.file);
      }
    }

    return results;
  } catch (e) {
    console.error('Failed to load category:', category);
    return [];
  }
}

export async function loadAllData() {
  return {
    characters: await loadCategory('characters'),
    weapons: await loadCategory('weapons'),
    accessories: await loadCategory('accessories'),
    bosses: await loadCategory('bosses')
  };
}
