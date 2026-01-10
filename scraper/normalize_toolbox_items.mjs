// --- Load toolbox.items.json safely (supports both [] and {items: []}) ---
const raw = JSON.parse(fs.readFileSync(IN_ITEMS, "utf8"));
const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : []);

console.log(`[normalize_toolbox_items] items loaded: ${arr.length}`);

// IMPORTANT: do NOT fail the workflow if Toolbox returned nothing.
// Just skip and keep the last good catalog files.
if (arr.length < 50) {
  console.warn(
    `[normalize_toolbox_items] toolbox.items.json too small (${arr.length}). ` +
    `Skipping normalize and leaving existing outputs unchanged.`
  );
  process.exit(0);
}