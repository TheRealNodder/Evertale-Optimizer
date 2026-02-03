
// STATE TOGGLE
document.addEventListener("click",e=>{
 const btn=e.target.closest(".stateBtn"); if(!btn)return;
 const img=document.getElementById(btn.dataset.target);
 const imgs=JSON.parse(img.dataset.imgs);
 img.src=imgs[btn.dataset.idx];
 document.querySelectorAll(`[data-target="${btn.dataset.target}"]`).forEach(b=>b.classList.remove("active"));
 btn.classList.add("active");
});

function renderStateRow(u){
  if(!u || !Array.isArray(u.imagesLarge) || u.imagesLarge.length < 2) return "";
  const btns = u.imagesLarge.map((_,i)=>`<button type="button" class="stateBtn ${i===0?"active":""}" data-idx="${i}">${i+1}</button>`).join("");
  return `<div class="stateRow" data-imgs='${JSON.stringify(u.imagesLarge)}'>State: ${btns}</div>`;
}

document.addEventListener("click",(e)=>{
  const btn = e.target.closest(".stateBtn");
  if(!btn) return;
  const row = btn.closest(".stateRow");
  if(!row) return;
  const imgs = JSON.parse(row.getAttribute("data-imgs") || "[]");
  if(!imgs.length) return;
  const card = row.closest(".unitCard, .slotCard, .card, .catalogCard") || row.parentElement;
  const img = card ? card.querySelector("img") : null;
  if(!img) return;
  const idx = parseInt(btn.getAttribute("data-idx") || "0", 10);
  if(!Number.isFinite(idx) || idx < 0 || idx >= imgs.length) return;
  img.src = imgs[idx];
  row.querySelectorAll(".stateBtn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
});
