/* roster-profile-ui.js
   Roster card pop-down editor, advanced toggle, account/fellowship controls, export/import.
*/
(function (global) {
  "use strict";

  const Store = global.EvertaleRosterProfiles;
  if (!Store) {
    console.warn("[roster-profile-ui] EvertaleRosterProfiles not loaded.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  function injectProfileStyles() {
    if ($("rosterProfileAdvancedStyle")) return;
    const style = document.createElement("style");
    style.id = "rosterProfileAdvancedStyle";
    style.textContent = `
      body:not(.roster-advanced-on) .profileAdvancedOnly{display:none!important;}
      body.roster-advanced-on .profileAdvancedOnly{display:block!important;}
      body:not(.roster-advanced-on) .rosterProfilePanel .profileGrid{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))!important;}
      .rosterProfilePanel{border-radius:18px!important;border:1px solid rgba(255,255,255,.12)!important;background:rgba(5,9,20,.42)!important;padding:12px!important;margin-top:10px!important;}
      .rosterProfilePanelHead{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-bottom:10px!important;}
      .profileGrid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))!important;gap:10px!important;}
      .profileField,.profileCheck{display:flex!important;flex-direction:column!important;gap:5px!important;min-width:0!important;}
      .profileCheck{justify-content:center!important;min-height:40px!important;}
      .profilePreview{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin-top:10px!important;color:var(--muted,#b7c0d8)!important;}
      .profilePreview span{border:1px solid rgba(255,255,255,.10)!important;background:rgba(255,255,255,.055)!important;border-radius:999px!important;padding:5px 8px!important;font-size:12px!important;}
    `;
    document.head.appendChild(style);
  }

  function isAdvancedOn() {
    return document.body.classList.contains("roster-advanced-on");
  }

  function syncAdvancedFields() {
    const on = isAdvancedOn();
    document.querySelectorAll(".profileAdvancedOnly .profileInput").forEach(input => {
      input.disabled = !on;
      input.setAttribute("aria-disabled", String(!on));
    });
  }

  function ensureAccountPanel() {
    injectProfileStyles();
    if ($("rosterProfileAccountPanel")) return;

    const status = $("statusText");
    const panel = document.createElement("section");
    panel.id = "rosterProfileAccountPanel";
    panel.className = "panel rosterAccountPanel";
    panel.innerHTML = `
      <div class="rosterProfileHeader">
        <div>
          <div class="panelTitle">Roster Progression</div>
          <div class="muted">Saved locally in this browser. Raw APK files stay read-only.</div>
        </div>
        <div class="rosterProfileActions">
          <button id="rosterAdvancedToggle" class="btn" type="button">Advanced: Off</button>
          <button id="rosterExportProfiles" class="btn" type="button">Export Backup</button>
          <button id="rosterImportProfilesBtn" class="btn" type="button">Import Backup</button>
          <input id="rosterImportProfilesFile" type="file" accept=".json,.txt,application/json,text/plain" hidden>
        </div>
      </div>

      <div class="rosterAccountGrid">
        <label class="profileField profileAdvancedOnly">
          <span>Player Level</span>
          <input id="profilePlayerLevel" class="input" type="number" min="1" max="300" step="1">
        </label>
        <label class="profileCheck">
          <input id="profileFellowshipEnabled" type="checkbox">
          <span>Enable Fellowship Buffs</span>
        </label>
        <label class="profileField">
          <span>Fellowship HP</span>
          <input id="profileFellowshipHp" class="input" type="number" min="0" max="999999" step="1">
        </label>
        <label class="profileField">
          <span>Fellowship ATK</span>
          <input id="profileFellowshipAtk" class="input" type="number" min="0" max="999999" step="1">
        </label>
      </div>

      <div class="rosterDisclaimer">
        Simple mode keeps fellowship and ownership controls visible. Advanced mode opens level, boost, and ascension editing.
      </div>
    `;

    if (status && status.parentElement) status.parentElement.insertBefore(panel, status);

    const advanced = localStorage.getItem("evertale_roster_advanced_v1") === "1";
    document.body.classList.toggle("roster-advanced-on", advanced);
    syncAdvancedButton();

    const account = Store.getAccount();
    $("profilePlayerLevel").value = account.playerLevel;
    $("profileFellowshipEnabled").checked = !!account.fellowshipEnabled;
    $("profileFellowshipHp").value = account.fellowshipHp;
    $("profileFellowshipAtk").value = account.fellowshipAtk;

    ["profilePlayerLevel","profileFellowshipEnabled","profileFellowshipHp","profileFellowshipAtk"].forEach(id => {
      const node = $(id);
      if (!node) return;
      node.addEventListener("input", saveAccountFromUi);
      node.addEventListener("change", saveAccountFromUi);
    });

    $("rosterAdvancedToggle")?.addEventListener("click", () => {
      const next = !document.body.classList.contains("roster-advanced-on");
      document.body.classList.toggle("roster-advanced-on", next);
      localStorage.setItem("evertale_roster_advanced_v1", next ? "1" : "0");
      syncAdvancedButton();
      syncAdvancedFields();
    });

    $("rosterExportProfiles")?.addEventListener("click", exportProfiles);
    $("rosterImportProfilesBtn")?.addEventListener("click", () => $("rosterImportProfilesFile")?.click());
    $("rosterImportProfilesFile")?.addEventListener("change", importProfiles);
    syncAdvancedFields();
  }

  function syncAdvancedButton() {
    const btn = $("rosterAdvancedToggle");
    if (!btn) return;
    const on = document.body.classList.contains("roster-advanced-on");
    btn.textContent = `Advanced: ${on ? "On" : "Off"}`;
    btn.setAttribute("aria-pressed", String(on));
  }

  function saveAccountFromUi() {
    Store.saveAccount({
      playerLevel: Number($("profilePlayerLevel")?.value || 300),
      fellowshipEnabled: !!$("profileFellowshipEnabled")?.checked,
      fellowshipHp: Number($("profileFellowshipHp")?.value || 0),
      fellowshipAtk: Number($("profileFellowshipAtk")?.value || 0)
    });
    refreshPreviews();
  }

  function exportProfiles() {
    const blob = new Blob([Store.exportText()], { type: "application/json" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `evertale-roster-profiles-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 250);
  }

  function importProfiles(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importText(String(reader.result || ""));
        alert("Roster profile backup imported.");
        location.reload();
      } catch (err) {
        alert(err && err.message ? err.message : "Import failed.");
      }
    };
    reader.readAsText(file);
  }

  function unitByCard(card) {
    const id = card?.dataset?.unitId || "";
    const units = global.__evertaleRosterState && Array.isArray(global.__evertaleRosterState.units) ? global.__evertaleRosterState.units : null;
    if (units) return units.find(u => String(u.id) === String(id)) || { id };
    return { id };
  }

  function fallbackStateLabel(row, index) {
    const state = String(row?.state || "").trim();
    const stars = Number(row?.stars || 0);
    if (state === "final") return "FA";
    if (stars >= 6) return index >= 2 ? "FA" : "6Star";
    if (stars >= 5) return "5Star";
    if (state) return state.replace(/(^|[-_])\w/g, s => s.replace(/[-_]/, "").toUpperCase());
    return `State ${index + 1}`;
  }

  function unitStates(unit) {
    const runtime = global.EvertaleRuntimeStatEngine;
    if (runtime && typeof runtime.listUnitStates === "function") {
      try {
        const states = runtime.listUnitStates(unit);
        if (Array.isArray(states) && states.length) return states;
      } catch (_) {}
    }

    const rows = [];
    const seen = new Set();
    function add(row, source) {
      if (!row || typeof row !== "object") return;
      const key = String(row.dataSourceId || row.sourceId || row.imageSourceId || row.state || source || rows.length);
      if (seen.has(key)) return;
      seen.add(key);
      const index = rows.length;
      rows.push({ ...row, index, label: fallbackStateLabel(row, index) });
    }
    (Array.isArray(unit?.forms) ? unit.forms : []).forEach(row => add(row, "forms"));
    (Array.isArray(unit?.statsByForm) ? unit.statsByForm : []).forEach(row => add(row, "statsByForm"));
    (Array.isArray(unit?.imageVariants) ? unit.imageVariants : []).forEach(row => add(row, "imageVariants"));
    return rows;
  }

  function stateOptions(unit, selected) {
    const selectedIndex = Number.isFinite(Number(selected)) ? Number(selected) : -1;
    const states = unitStates(unit);
    const highestSelected = selectedIndex < 0 || !states[selectedIndex];
    return [
      `<option value="-1" ${highestSelected ? "selected" : ""}>Highest State</option>`,
      ...states.map((row, index) => {
        const label = esc(row.label || fallbackStateLabel(row, index));
        return `<option value="${index}" ${selectedIndex === index ? "selected" : ""}>${label}</option>`;
      })
    ].join("");
  }

  function refreshStateControls() {
    document.querySelectorAll(".rosterProfilePanel").forEach(panel => {
      const card = panel.closest(".unitCard");
      const select = panel.querySelector('[data-field="stateIndex"]');
      if (!card || !select) return;
      const profile = Store.getProfile(card.dataset.unitId);
      select.innerHTML = stateOptions(unitByCard(card), profile.stateIndex);
      select.value = String(Number.isFinite(Number(profile.stateIndex)) ? profile.stateIndex : -1);
      if (!select.value) select.value = "-1";
    });
  }

  function renderEditor(card) {
    if (!card || card.querySelector(".rosterProfilePanel")) return;
    const unit = unitByCard(card);
    const id = String(card.dataset.unitId || unit.id || "");
    if (!id) return;

    const p = Store.getProfile(id);
    const smartAsc = Store.smartAscended(p);

    const panel = document.createElement("div");
    panel.className = "rosterProfilePanel";
    panel.dataset.profileFor = id;
    panel.innerHTML = `
      <div class="rosterProfilePanelHead">
        <div>
          <strong>Progression Profile</strong>
          <span class="muted">Used by optimizer after save.</span>
        </div>
        <button class="btn mini profileReset" type="button">Reset</button>
      </div>

      <div class="profileGrid">
        <label class="profileField profileAdvancedOnly">
          <span>Level</span>
          <input class="input profileInput" data-field="level" type="number" min="1" max="200" step="1" value="${esc(p.level)}">
        </label>
        <label class="profileField">
          <span>Stat State</span>
          <select class="input profileInput" data-field="stateIndex">
            ${stateOptions(unit, p.stateIndex)}
          </select>
        </label>
        <label class="profileField">
          <span>Awakened</span>
          <select class="input profileInput" data-field="awakening">
            ${[0,1,2,3,4].map(v => `<option value="${v}" ${Number(p.awakening)===v?"selected":""}>${v}/4</option>`).join("")}
          </select>
        </label>
        <label class="profileField">
          <span>Potential %</span>
          <input class="input profileInput" data-field="potential" type="number" min="0" max="100" step="0.01" value="${esc(p.potential)}">
        </label>
        <label class="profileField">
          <span>Bonus</span>
          <input class="input profileInput" data-field="bonus" type="number" min="0" step="1" value="${esc(p.bonus)}">
        </label>
        <label class="profileField">
          <span>Mastery</span>
          <input class="input profileInput" data-field="mastery" type="number" min="0" max="40" step="1" value="${esc(p.mastery)}">
        </label>
        <label class="profileField profileAdvancedOnly">
          <span>Boost</span>
          <input class="input profileInput" data-field="boost" type="number" min="0" max="300" step="1" value="${esc(p.boost)}">
        </label>
        <label class="profileCheck profileAdvancedOnly">
          <input class="profileInput" data-field="ascended" type="checkbox" ${smartAsc ? "checked" : ""}>
          <span>Ascended <small>(auto when level &gt;100 + 4/4)</small></span>
        </label>
      </div>

      <div class="profilePreview" data-preview-for="${esc(id)}"></div>
    `;

    card.appendChild(panel);
    wirePanel(panel, card, unit);
    syncAdvancedFields();
    updatePreview(card, unit);
  }

  function wirePanel(panel, card, unit) {
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());

    panel.querySelectorAll(".profileInput").forEach(input => {
      input.addEventListener("input", () => saveFromPanel(panel, card, unit));
      input.addEventListener("change", () => saveFromPanel(panel, card, unit));
    });

    panel.querySelector(".profileReset")?.addEventListener("click", () => {
      if (!confirm("Reset this unit's local progression profile?")) return;
      Store.deleteProfile(card.dataset.unitId);
      panel.remove();
      renderEditor(card);
    });
  }

  function readPanel(panel) {
    const patch = {};
    panel.querySelectorAll(".profileInput").forEach(input => {
      if (input.disabled) return;
      const field = input.dataset.field;
      if (!field) return;
      patch[field] = input.type === "checkbox" ? input.checked : Number(input.value);
    });
    return patch;
  }

  function saveFromPanel(panel, card, unit) {
    const id = card.dataset.unitId;
    const saved = Store.saveProfile(id, readPanel(panel));
    if (saved) {
      const ascInput = panel.querySelector('[data-field="ascended"]');
      if (ascInput) ascInput.checked = Store.smartAscended(saved);
    }
    updatePreview(card, unit);
  }

  function updatePreview(card, unit) {
    const preview = card.querySelector(".profilePreview");
    if (!preview) return;
    const estimated = Store.estimateUnitStats(unit);
    const stateText = estimated.stateLabel || (Number(estimated.stateIndex) >= 0 ? `State ${Number(estimated.stateIndex) + 1}` : "Highest");
    preview.innerHTML = `
      <span><strong>State</strong> ${esc(stateText)}</span>
      <span><strong>Est. ATK</strong> ${Math.round(estimated.atk).toLocaleString()}</span>
      <span><strong>Est. HP</strong> ${Math.round(estimated.hp).toLocaleString()}</span>
      <span><strong>Power</strong> ${Math.round(estimated.power).toLocaleString()}</span>
      <span><strong>Asc.</strong> ${estimated.ascended ? "Yes" : "No"}</span>
      ${estimated.isEstimated ? `<span class="warn">Estimated seed</span>` : ``}
    `;
  }

  function refreshPreviews() {
    document.querySelectorAll(".unitCard").forEach(card => updatePreview(card, unitByCard(card)));
  }

  function enhanceCards() {
    document.querySelectorAll(".unitCard").forEach(renderEditor);
    syncAdvancedFields();
  }

  function init() {
    injectProfileStyles();
    ensureAccountPanel();
    enhanceCards();

    if (global.EvertaleRuntimeStatEngine && typeof global.EvertaleRuntimeStatEngine.loadSeedIndex === "function") {
      global.EvertaleRuntimeStatEngine.loadSeedIndex()
        .then(() => {
          refreshStateControls();
          refreshPreviews();
        })
        .catch(err => console.warn("[roster-profile-ui] seed index unavailable", err));
    }

    const grid = $("unitGrid");
    if (grid) {
      const observer = new MutationObserver(() => {
        ensureAccountPanel();
        enhanceCards();
      });
      observer.observe(grid, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})(window);
