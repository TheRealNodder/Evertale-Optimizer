// ---------- Modal (Unit Details) ----------
let currentModalUnitId = null;

function initUnitModal() {
  const overlay = document.getElementById("unitModal");
  const close1 = document.getElementById("unitModalClose");
  const close2 = document.getElementById("unitModalClose2");

  function close() { closeUnitModal(); }

  close1?.addEventListener("click", close);
  close2?.addEventListener("click", close);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.getElementById("unitModalAddStory")?.addEventListener("click", () => {
    if (!currentModalUnitId) return;
    addToStoryFirstEmpty(currentModalUnitId);
    closeUnitModal();
  });
}

function openUnitModal(unitId) {
  const u = unitById.get(unitId);
  if (!u) return;

  currentModalUnitId = unitId;

  const title = document.getElementById("unitModalTitle");
  const subtitle = document.getElementById("unitModalSubtitle");
  const badges = document.getElementById("unitModalBadges");

  const costEl = document.getElementById("unitModalCost");
  const atkEl = document.getElementById("unitModalAtk");
  const hpEl = document.getElementById("unitModalHp");
  const spdEl = document.getElementById("unitModalSpd");

  const leaderEl = document.getElementById("unitModalLeader");
  const activeEl = document.getElementById("unitModalActive");
  const passiveEl = document.getElementById("unitModalPassive");

  title.textContent = u.name || "Unknown";
  subtitle.textContent = u.title || "";

  // badges
  badges.innerHTML = "";
  const b1 = document.createElement("span");
  b1.className = "badge accent";
  b1.textContent = elementLabel(u.element);
  badges.appendChild(b1);

  const b2 = document.createElement("span");
  b2.className = "badge green";
  b2.textContent = `${rarityLabel(Number(u.rarity || 0))} (${Number(u.rarity || 0) || "?"})`;
  badges.appendChild(b2);

  // stats
  costEl.textContent = (u.cost ?? "-");
  atkEl.textContent = (u?.stats?.atk ?? getStat(u, "atk") ?? 0);
  hpEl.textContent = (u?.stats?.hp ?? getStat(u, "hp") ?? 0);
  spdEl.textContent = (u?.stats?.spd ?? getStat(u, "spd") ?? 0);

  // leader
  const leader = [
    u.leaderSkillName ? u.leaderSkillName : null,
    u.leaderSkillText ? u.leaderSkillText : (u.leaderSkill || null)
  ].filter(Boolean).join("\n");
  leaderEl.textContent = leader || "-";

  // skills
  activeEl.innerHTML = "";
  (Array.isArray(u.activeSkills) ? u.activeSkills : []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    activeEl.appendChild(li);
  });
  if (!activeEl.children.length) activeEl.innerHTML = `<li class="muted">-</li>`;

  passiveEl.innerHTML = "";
  (Array.isArray(u.passiveSkills) ? u.passiveSkills : []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    passiveEl.appendChild(li);
  });
  if (!passiveEl.children.length) passiveEl.innerHTML = `<li class="muted">-</li>`;

  // open
  const overlay = document.getElementById("unitModal");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeUnitModal() {
  currentModalUnitId = null;
  const overlay = document.getElementById("unitModal");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}
