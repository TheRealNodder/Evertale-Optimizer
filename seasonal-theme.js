(function(){
  const TZ = 'America/Los_Angeles';
  const STORAGE_KEY = 'evertale_theme_choice_v1';

  const themes = {
    default: ['#0b0d12','#182131','#24324a','#dce6ff'],
    spring: ['#153b2b','#3f7d57','#91d18b','#f1ffe8'],
    summer: ['#0b2e4f','#145da0','#f7b733','#fff3b0'],
    autumn: ['#2d1b12','#7b3f00','#c97a40','#f2c572'],
    winter: ['#0a1f33','#183a5c','#7fb3d5','#eaf6ff'],
    newyear: ['#0b1020','#1e2a78','#7c4dff','#d7c8ff'],
    valentine: ['#3b0a23','#8b1e4f','#d94f70','#ffd1dc'],
    stpatrick: ['#062b16','#0f6b3a','#5dbb63','#daf7dc'],
    easter: ['#2e245c','#7c70d8','#f7c6e0','#fff7c2'],
    independence: ['#081f5c','#b22234','#ffffff','#6ea8fe'],
    halloween: ['#140b1f','#4a235a','#d35400','#f39c12'],
    thanksgiving: ['#2b1a10','#8c4a1f','#d4a373','#f6e7cb'],
    christmas: ['#072a1f','#0f5132','#b22222','#f3fff6'],
  };

  const labels = {
    auto:'Auto Style', default:'Default', spring:'Spring', summer:'Summer', autumn:'Autumn', winter:'Winter',
    newyear:'New Year', valentine:'Valentine', stpatrick:'St. Patrick', easter:'Easter', independence:'Independence Day',
    halloween:'Halloween', thanksgiving:'Thanksgiving', christmas:'Christmas'
  };

  function nowInLA(){
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year:'numeric', month:'numeric', day:'numeric', weekday:'short' }).formatToParts(new Date());
    const get = t => Number(parts.find(p => p.type===t)?.value || 0);
    const weekdayStr = parts.find(p => p.type==='weekday')?.value || 'Sun';
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return { year:get('year'), month:get('month'), day:get('day'), weekday: weekdays.indexOf(weekdayStr.slice(0,3)) };
  }
  function nthWeekdayOfMonth(year, month, weekday, nth){
    const d = new Date(Date.UTC(year, month-1, 1)); let count = 0;
    while (d.getUTCMonth() === month-1) {
      const localWeekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday:'short' }).format(d);
      const idx = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(localWeekday.slice(0,3));
      if (idx === weekday) { count += 1; if (count === nth) return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, day:'numeric' }).format(d)); }
      d.setUTCDate(d.getUTCDate()+1);
    }
    return null;
  }
  function easterDate(year){
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1; return {month,day};
  }
  function inRange(month, day, startMonth, startDay, endMonth, endDay){
    const md=month*100+day,start=startMonth*100+startDay,end=endMonth*100+endDay;
    return start<=end ? (md>=start && md<=end) : (md>=start || md<=end);
  }
  function getSeason(month, day){
    const md=month*100+day;
    if (md>=320 && md<621) return 'spring';
    if (md>=621 && md<923) return 'summer';
    if (md>=923 && md<1221) return 'autumn';
    return 'winter';
  }
  function chooseAutoTheme(){
    const {year,month,day}=nowInLA();
    const thanksgivingDay=nthWeekdayOfMonth(year,11,4,4);
    const easter=easterDate(year);
    if (inRange(month,day,12,1,12,31)) return 'christmas';
    if (inRange(month,day,1,1,1,10)) return 'newyear';
    if (inRange(month,day,2,1,2,15)) return 'valentine';
    if (inRange(month,day,3,10,3,18)) return 'stpatrick';
    if (inRange(month,day,easter.month,Math.max(1,easter.day-5),easter.month,Math.min(31,easter.day+2))) return 'easter';
    if (inRange(month,day,7,1,7,7)) return 'independence';
    if (inRange(month,day,10,1,10,31)) return 'halloween';
    if (thanksgivingDay && inRange(month,day,11,Math.max(1,thanksgivingDay-6),11,Math.min(30,thanksgivingDay+3))) return 'thanksgiving';
    return getSeason(month,day);
  }
  function getChoice(){ return localStorage.getItem(STORAGE_KEY) || 'auto'; }
  function getActiveTheme(){ const choice=getChoice(); return choice === 'auto' ? chooseAutoTheme() : (themes[choice] ? choice : 'default'); }
  function applyTheme(choice){
    if (choice) localStorage.setItem(STORAGE_KEY, choice);
    const selected=getChoice(); const key=getActiveTheme(); const colors=themes[key] || themes.default; const root=document.documentElement;
    root.style.setProperty('--bg', colors[0]); root.style.setProperty('--season-a', colors[0]); root.style.setProperty('--season-b', colors[1]); root.style.setProperty('--season-c', colors[2]); root.style.setProperty('--season-d', colors[3]);
    document.body.setAttribute('data-theme-choice', selected); document.body.setAttribute('data-theme-key', key);
    document.body.setAttribute('data-theme-season', ['spring','summer','autumn','winter'].includes(key) ? key : getSeason(nowInLA().month, nowInLA().day));
    document.body.setAttribute('data-theme-holiday', ['spring','summer','autumn','winter','default'].includes(key) ? '' : key);
    document.dispatchEvent(new CustomEvent('evertale-theme-change', { detail:{ choice:selected, active:key }}));
  }

  window.EvertaleTheme = { themes, labels, getChoice, getActiveTheme, applyTheme, chooseAutoTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>applyTheme(), {once:true}); else applyTheme();
})();
