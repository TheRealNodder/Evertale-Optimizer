/* optimizer-showcase.js — visual enhancer for optimizer platoon showcase
   Idempotent and throttled so optimizer rerenders stay smooth.
*/
(function(){
  "use strict";

  const $all = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function setText(node, value){
    if (node && node.textContent !== value) node.textContent = value;
  }

  function selectedText(select){
    if (!select) return "";
    const opt = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    return (opt && opt.textContent ? opt.textContent : "").trim();
  }

  function isFilledCard(card){
    const select = card.querySelector(".slotSelect");
    return !!(select && select.value);
  }

  function parseUnitName(card){
    const select = card.querySelector(".slotSelect");
    const text = selectedText(select);
    return text.replace(/\s*\([^)]*\)\s*$/g, "") || "Select a unit";
  }

  function ensureChangeButton(card){
    const select = card.querySelector(".slotSelect");
    if (!select) return;
    let button = card.querySelector(".slotChangeButton");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "slotChangeButton";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        select.focus();
        try { select.showPicker && select.showPicker(); } catch (_) {}
      });
      select.insertAdjacentElement("afterend", button);
    }
    setText(button, isFilledCard(card) ? "Change" : "Select");
  }

  function ensureSlotNumber(card, index){
    let badge = card.querySelector(".slotNumberBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "slotNumberBadge";
      card.appendChild(badge);
    }
    setText(badge, String(index + 1));
  }

  function ensureEmptyVisual(card){
    const filled = isFilledCard(card);
    if (card.classList.contains("is-filled") !== filled) card.classList.toggle("is-filled", filled);
    if (card.classList.contains("is-empty") === filled) card.classList.toggle("is-empty", !filled);

    const placeholder = card.querySelector(".unitPortraitPlaceholder");
    if (placeholder) setText(placeholder, filled ? "" : "+");

    const title = card.querySelector(".slotTitle");
    if (title) setText(title, filled ? parseUnitName(card) : "Select a unit");
  }

  function ensureLevelStars(card){
    let meta = card.querySelector(".slotShowcaseMeta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "slotShowcaseMeta";
      const title = card.querySelector(".slotTitle");
      if (title) title.insertAdjacentElement("afterend", meta);
    }
    setText(meta, isFilledCard(card) ? "Lv. 200  ★★★★★" : "");
  }

  function ensureEmptyEquipment(card){
    if (card.querySelector(".equipmentPair")) return;
    const mid = card.querySelector(".slotMid");
    if (!mid) return;
    const pair = document.createElement("div");
    pair.className = "equipmentPair equipmentPair-empty";
    pair.innerHTML = '<div class="equipmentMini equipment-weapon"><span class="equipmentMiniFallback">-</span><span class="equipmentMiniName">Weapon</span></div><div class="equipmentMini equipment-accessory"><span class="equipmentMiniFallback">-</span><span class="equipmentMiniName">Accessory</span></div>';
    mid.appendChild(pair);
  }

  function enhanceCard(card, index){
    ensureSlotNumber(card, index);
    ensureEmptyVisual(card);
    ensureLevelStars(card);
    ensureEmptyEquipment(card);
    ensureChangeButton(card);
  }

  function platoonPower(panel){
    const filled = $all(".platoonSlotCard.is-filled", panel).length;
    if (!filled) return "0";
    return String(filled * 25000 + 890).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function enhancePanel(panel){
    let head = panel.querySelector(":scope > .platoonShowcaseHead");
    const title = panel.querySelector(":scope > .panelTitle");
    if (!head && title) {
      head = document.createElement("div");
      head.className = "platoonShowcaseHead";
      head.innerHTML = '<span></span><span class="platoonPower">Total Power <b></b></span>';
      title.insertAdjacentElement("afterend", head);
    }
    const power = head?.querySelector(".platoonPower b");
    if (power) setText(power, `⚔ ${platoonPower(panel)}`);
  }

  function enhance(){
    const grid = document.getElementById("platoonsGrid");
    if (!grid) return;
    $all(".platoonPanel", grid).forEach(panel => {
      $all(".platoonSlotCard", panel).forEach(enhanceCard);
      enhancePanel(panel);
    });
  }

  let scheduled = false;
  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhance();
    const grid = document.getElementById("platoonsGrid");
    if (grid) {
      new MutationObserver((mutations) => {
        if (mutations.some(m => m.type === "childList" && Array.from(m.addedNodes).some(n => n.nodeType === 1 && !n.classList?.contains("slotNumberBadge") && !n.classList?.contains("slotShowcaseMeta") && !n.classList?.contains("slotChangeButton")))) {
          schedule();
        }
      }).observe(grid, { childList:true, subtree:true });
    }
  });
})();
