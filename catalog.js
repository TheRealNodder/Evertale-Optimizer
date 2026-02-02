
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
  if(!u.imagesLarge||u.imagesLarge.length<2)return "";
  let btns=u.imagesLarge.map((_,i)=>`<button class="stateBtn ${i==0?"active":""}" data-idx="${i}">${i+1}</button>`).join("");
  return `<div class="stateRow" data-imgs='${JSON.stringify(u.imagesLarge)}'>State: ${btns}</div>`;
}

document.addEventListener("click",e=>{
  const btn=e.target.closest(".stateBtn");
  if(!btn)return;
  const row=btn.parentElement;
  const imgs=JSON.parse(row.dataset.imgs);
  const card=row.closest(".unitCard");
  const img=card.querySelector("img");
  img.src=imgs[btn.dataset.idx];
  row.querySelectorAll(".stateBtn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
});
