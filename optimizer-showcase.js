/* optimizer-showcase.js — platoon showcase transformer
   Converts optimizer platoon slot markup into a full-width, five-card showcase row.
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

  function ensureEmptyEquipment(card){
    if (card.querySelector(".equipmentPair")) return;
    const mid = card.querySelector(".slotMid");
    if (!mid) return;
    const pair = document.createElement("div");
    pair.className = "equipmentPair equipmentPair-empty";
    pair.innerHTML = '<div class="equipmentMini equipment-weapon"><span class="equipmentMiniFallback">-</span><span class="equipmentMiniName">Weapon</span></div><div class="equipmentMini equipment-accessory"><span class="equipmentMiniFallback">-</span><span class="equipmentMiniName">Accessory</span></div>';
    mid.appendChild(pair);
  }

  function ensureSelectUnderPortrait(card){
    const select = card.querySelector(".slotSelect");
    const top = card.querySelector(".slotTop");
    if (select && top && select.parentElement !== top) top.appendChild(select);
  }

  function normalizeCard(card){
    const filled = isFilledCard(card);
    card.classList.toggle("is-filled", filled);
    card.classList.toggle("is-empty", !filled);

    const placeholder = card.querySelector(".unitPortraitPlaceholder");
    if (placeholder) setText(placeholder, filled ? "" : "+");

    const title = card.querySelector(".slotTitle");
    if (title) setText(title, filled ? parseUnitName(card) : "Select a unit");

    const kind = card.querySelector(".slotBadges .tag.kind");
    if (kind) kind.remove();

    $all(".slotNumberBadge,.slotShowcaseMeta,.slotChangeButton", card).forEach(n => n.remove());
    ensureEmptyEquipment(card);
    ensureSelectUnderPortrait(card);
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
    grid.classList.add("platoonShowcaseGrid");
    $all(".platoonPanel", grid).forEach(panel => {
      panel.classList.add("platoonShowcasePanel");
      const slots = panel.querySelector(".platoonSlots");
      if (slots) slots.classList.add("platoonShowcaseSlots");
      $all(".platoonSlotCard", panel).forEach(normalizeCard);
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
      new MutationObserver(schedule).observe(grid, { childList:true, subtree:true });
    }
  });
})();
