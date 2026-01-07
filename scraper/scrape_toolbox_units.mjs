// scraper/scrape_toolbox_units.mjs
// Text-based parser for https://evertaletoolbox2.runasp.net/Viewer
// (Viewer is not a real <table>, so we parse the rendered text blocks)

import fs from "node:fs";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_PATH = path.join(process.cwd(), "..", "data", "units.json");

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripToLines(html) {
  // Turn HTML into text lines we can scan
  let t = html;

  // Convert <br> and </p>/<li> etc into line breaks
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, "\n");

  // Remove remaining tags
  t = t.replace(/<[^>]*>/g, "\n");

  t = decodeHtmlEntities(t);

  // Normalize and split
  const lines = t
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines;
}

function isNumberLike(s) {
  return /^[0-9][0-9,]*$/.test(s);
}

function toInt(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeLeaderName(s) {
  // Examples: "Light HP Up", "Storm ATK & HP Up", "Fire Attack Up"
  // Keep it permissive; the next line is usually the description sentence.
  return (
    s.length >= 3 &&
    s.length <= 40 &&
    /Up|ATK|HP|SPD|Speed|Attack|Def|Resist/i.test(s) &&
    !s.endsWith(".")
  );
}

function looksLikeSentence(s) {
  return s.length >= 15 && /[.!?]$/.test(s);
}

function parseUnitsFromViewer(lines) {
  // Find where the CHARACTER list begins (after headers)
  const startIdx = lines.findIndex((x) => x === "Name");
  if (startIdx === -1) throw new Error("Could not find Viewer header 'Name'.");

  // Stop before weapon list begins (Viewer page includes weapons after character section)
  const weaponIdx = lines.findIndex((x) => x === "Weapon:");
  const endIdx = weaponIdx !== -1 ? weaponIdx : lines.length;

  const slice = lines.slice(start
