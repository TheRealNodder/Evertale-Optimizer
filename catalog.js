
// STATE TOGGLE
document.addEventListener("click",e=>{
 const btn=e.target.closest(".stateBtn"); if(!btn)return;
 const img=document.getElementById(btn.dataset.target);
 const imgs=JSON.parse(img.dataset.imgs);
 img.src=imgs[btn.dataset.idx];
 document.querySelectorAll(`[data-target="${btn.dataset.target}"]`).forEach(b=>b.classList.remove("active"));
 btn.classList.add("active");
});
