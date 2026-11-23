import * as R from './real.js';

/* ---------- catalogue (sample data for testing) ----------
   Books and images, and the sample films and songs below, only feed the prototype's own Discover
   page. Making a map and its suggestions use the real model (real.js): its music, film and style. */
const RAW={
film:`bsr|Before Sunrise|Richard Linklater · 1995|talky romance travel dusk summer
pl|Past Lives|Celine Song · 2023|longing quiet romance city
fh|Frances Ha|Noah Baumbach · 2012|city youth quirky talky
as|Aftersun|Charlotte Wells · 2022|memory summer quiet melancholy sea
itm|In the Mood for Love|Wong Kar-wai · 2000|longing neon slow romance night
lit|Lost in Translation|Sofia Coppola · 2003|city night neon quiet longing
mm|Mad Max: Fury Road|George Miller · 2015|energy loud desert epic
lw|Little Women|Greta Gerwig · 2019|youth warm literary storytelling autumn
pat|Paterson|Jim Jarmusch · 2016|writing quiet everyday literary
lll|La La Land|Damien Chazelle · 2016|dusk dream romance city
sa|Spirited Away|Hayao Miyazaki · 2001|dream fantasy warm
br|Blade Runner 2049|Denis Villeneuve · 2017|neon night slow epic`,
music:`pw|Pink + White|Frank Ocean|summer dream warm
ms|Motion Sickness|Phoebe Bridgers|melancholy youth quiet
bib|Back in Black|AC/DC|loud energy rock
car|cardigan|Taylor Swift|storytelling autumn warm literary
ad|Aruarian Dance|Nujabes|rain night calm cafe
ic|Instant Crush|Daft Punk|neon night longing
hol|Holocene|Bon Iver|quiet calm melancholy
cdl|Clair de Lune|Claude Debussy|calm night dream
sc|Self Control|Frank Ocean|longing summer melancholy
mr|Mr. Brightside|The Killers|energy rock youth loud`,
book:`nw|Norwegian Wood|Haruki Murakami|melancholy youth longing literary
kts|Klara and the Sun|Kazuo Ishiguro|quiet tender dream longing
bj|The Bell Jar|Sylvia Plath|youth melancholy literary
np|Normal People|Sally Rooney|youth romance talky
kit|Kitchen|Banana Yoshimoto|quiet warm memory calm
jk|Just Kids|Patti Smith|city youth writing
lp|The Little Prince|Antoine de Saint-Exupéry|dream fantasy tender
dune|Dune|Frank Herbert|desert epic fantasy
kos|Kafka on the Shore|Haruki Murakami|dream quirky fantasy
cof|Before the Coffee Gets Cold|Toshikazu Kawaguchi|cafe memory warm`,
image:`sun|Sunsets|Saved images|dusk warm summer
rain|Rainy windows|Saved images|rain calm night
tok|Tokyo at night|Saved images|neon city night
sea|Seaside in August|Saved images|summer sea memory travel
bks|Old bookshops|Saved images|literary warm quiet
road|Desert roads|Saved images|desert travel epic
fog|Fog over the river|Saved images|calm quiet melancholy
neo|Neon signs|Saved images|neon night city
grh|Greenhouses|Saved images|calm dream warm
win|Window light at 4 p.m.|Saved images|warm quiet everyday
snow|First snow|Saved images|calm quiet memory
cafes|Small cafés|Saved images|cafe warm everyday
train|Night trains|Saved images|night travel longing
wfl|Wildflowers|Saved images|summer dream tender
han|Han River at dusk|Saved images|dusk city calm
rec|Record shops|Saved images|analog warm youth`,
film2:`mos|Moonlight|Barry Jenkins · 2016|night sea tender quiet
cmb|Call Me by Your Name|Luca Guadagnino · 2017|summer romance longing
eea|Everything Everywhere All at Once|Daniel Kwan, Daniel Scheinert · 2022|quirky energy fantasy
gbh|The Grand Budapest Hotel|Wes Anderson · 2014|quirky storytelling warm
her|Her|Spike Jonze · 2013|longing city tender
ets|Eternal Sunshine of the Spotless Mind|Michel Gondry · 2004|memory romance dream
lb|Lady Bird|Greta Gerwig · 2017|youth warm talky
tot|My Neighbor Totoro|Hayao Miyazaki · 1988|dream warm tender
drv|Drive|Nicolas Winding Refn · 2011|neon night loud
pd|Perfect Days|Wim Wenders · 2023|everyday quiet calm
ck|Chungking Express|Wong Kar-wai · 1994|neon city youth quirky
dtl|Decision to Leave|Park Chan-wook · 2022|longing sea slow
par|Parasite|Bong Joon-ho · 2019|city energy storytelling
lf|Little Forest|Yim Soon-rye · 2018|everyday calm warm`,
music2:`nts|Nights|Frank Ocean|night longing summer
ssg|Space Song|Beach House|dream night slow
lng|Linger|The Cranberries|longing melancholy youth
alr|Alright|Kendrick Lamar|energy city
gou|Glimpse of Us|Joji|melancholy longing
drm|Dreams|Fleetwood Mac|dream warm
hvm|Harvest Moon|Neil Young|warm autumn calm
dit|Ditto|NewJeans|youth longing dream
hyb|Hype Boy|NewJeans|youth energy summer
rbs|Ribs|Lorde|youth melancholy night
kds|Kids|MGMT|youth energy dream
mrv|Moon River|Audrey Hepburn|dream romance calm
gym|Gymnopédie No. 1|Erik Satie|calm quiet melancholy
bgs|Bags|Clairo|youth longing quiet
swt|Sweater Weather|The Neighbourhood|autumn night longing`,
book2:`sto|Stoner|John Williams|quiet melancholy literary
tsh|The Secret History|Donna Tartt|youth literary autumn
nlm|Never Let Me Go|Kazuo Ishiguro|memory tender melancholy
rod|The Remains of the Day|Kazuo Ishiguro|memory quiet literary
veg|The Vegetarian|Han Kang|dream melancholy quiet
alc|The Alchemist|Paulo Coelho|desert travel dream
otr|On the Road|Jack Kerouac|travel youth energy
alm|Almond|Sohn Won-pyung|youth tender quiet
pch|Pachinko|Min Jin Lee|memory storytelling epic
csw|Convenience Store Woman|Sayaka Murata|everyday quirky city
wh|Wuthering Heights|Emily Brontë|longing romance autumn
bat|Breakfast at Tiffany’s|Truman Capote|city romance night
mdl|The Midnight Library|Matt Haig|dream night tender`,
};
const CAT={};
for(const [t0,s] of Object.entries(RAW)){const t=t0.replace('2','');s.split('\n').forEach(l=>{const [id,title,by,tags]=l.split('|');CAT[id]={id,t,title,by,tags:tags.split(' ')}})}
const TYPE={film:'Film',music:'Music',book:'Book',style:'Style',image:'Image'};
const PLURAL={film:'Films',music:'Music',book:'Books',style:'Style',image:'Images'};
const TYPES=['film','music','book','style','image'];
const REAL=['music','film','style'];   // the layers the model knows

/* ---------- real items on the prototype's maps ----------
   A real item gets a catalogue entry like the sample ones, with id "<layer>/<id>". Its tags are moods
   (from its genres, below), so the prototype's lines, covers and Discover still work with it. */
const MOOD={
  'Pop':['youth','dream'],'Rock':['loud','energy'],'Classic Rock':['loud','rock'],'Hard Rock':['loud','rock'],'Metal':['loud','energy'],
  'Indie & Alternative':['youth','melancholy'],'Indie & Lo-Fi':['quiet','youth'],'Alternative Rock':['youth','loud'],'Jazz':['night','cafe'],
  'Classical':['calm','quiet'],'Country':['storytelling','warm'],'Dance & Electronic':['neon','night'],'Dance Pop':['neon','youth'],'R&B':['night','longing'],
  'Rap & Hip-Hop':['city','energy'],'Folk':['quiet','warm'],'Soundtracks':['dream','epic'],'Blues':['melancholy','night'],'New Age':['calm','dream'],
  'Soul':['warm','night'],'Singer-Songwriters':['storytelling','quiet'],'Latin Music':['summer','energy'],'Reggae':['summer','calm'],
  'Korean Pop':['youth','energy'],'Ambient':['calm','dream'],'Broadway & Vocalists':['romance','dream'],'International Music':['travel','city'],
  'Christian & Gospel':['warm','tender'],'Children’s Music':['tender','warm'],"Children's Music":['tender','warm'],'Holiday & Wedding':['warm','romance'],
  'Drama':['quiet','longing'],'Action & Adventure':['energy','epic'],'Comedy':['quirky','warm'],'Mystery & Thriller':['night','slow'],
  'Kids & Family':['warm','dream'],'Sci-Fi & Fantasy':['fantasy','epic'],'Horror':['night','loud'],'Animation':['dream','fantasy'],
  'Documentary':['memory','everyday'],'Romance':['romance','longing'],'Anime':['dream','fantasy'],'International':['travel','city'],
  'Music & Concerts':['loud','energy'],'Musicals':['dream','romance'],'War':['epic','melancholy'],'Western':['desert','travel'],
  'Holiday':['warm','tender'],'Crime':['city','night'],'Sports':['energy','youth'],'LGBTQ+':['tender','romance'],
  'Activewear':['energy','everyday'],'Sportswear':['energy','youth'],'Athletic shoes':['energy','city'],'Sneakers':['youth','city'],
  'Boots':['autumn','city'],'Jackets & coats':['autumn','city'],'Sweaters':['autumn','warm'],'Cardigans':['autumn','literary'],'Dresses':['romance','summer'],
  'Swimwear':['summer','sea'],'Sandals':['summer','travel'],'Hats':['summer','travel'],'Sunglasses':['summer','city'],'Watches':['everyday','analog'],
  'Necklaces':['tender','romance'],'Earrings':['tender','romance'],'Rings':['tender','memory'],'Bracelets':['tender','summer'],'Jeans':['youth','everyday'],
  'Hoodies':['youth','calm'],'Scarves':['autumn','warm'],'Casual':['everyday','calm'],'Workwear':['city','everyday'],'Club & night out':['night','neon'],
  'Luggage & travel gear':['travel'],'Backpacks':['travel','youth'],'Tops':['everyday','summer'],'T-shirts':['everyday','youth'],'Shirts':['everyday','city'],
  'Slippers':['calm','warm'],'Flats':['everyday','city'],'Leggings':['energy','everyday'],'Pants':['everyday','city'],'Wallets':['everyday','analog']};
const FALLBACK={music:['night'],film:['storytelling'],style:['everyday']};
const rid=it=>`${it.layer}/${it.id}`;
/** puts a real item (from real.js) in the catalogue, returns its id there */
function addReal(it){
  const id=rid(it);
  if(!CAT[id]){const g=R.genres(it),moods=[...new Set(g.flatMap(x=>MOOD[x]||[]))].slice(0,4);
    CAT[id]={id,t:it.layer,title:it.name,by:it.sub||TYPE[it.layer],tags:moods.length?moods:FALLBACK[it.layer],genres:g.slice(0,4),
      real:{layer:it.layer,id:it.id,src:it.src,img:it.img}}}
  return id;
}
const realOf=id=>CAT[id]&&CAT[id].real;

const PEOPLE={
  mina:{h:'@mina.k',board:'Rainy library',items:['rain','ad','kit','v60','kts','lit','bks']},
  dohyun:{h:'@dohyun',board:'Slow cinema',items:['itm','as','pl','pat','hol','pol']},
  seoy:{h:'@seo.y',board:'Loud summer',items:['mm','bib','mr','sea','road','ear']},
  jiwoo:{h:'@jiwoo',board:'Quiet mornings',items:['v60','hol','kit','sun','cdl']},
  hana:{h:'@hana.p',board:'Film club',items:['fh','lw','lll','pat','np']},
  tae:{h:'@tae.k',board:'Night drive',items:['ic','tok','br','road','sc']}
};
const FOLLOWERS=['mina','jiwoo','hana','tae','seoy'];
// the sample people's maps keep only things still in the catalogue (the made-up "things" became the real style layer)
Object.values(PEOPLE).forEach(p=>p.items=p.items.filter(i=>CAT[i]));
const _unused={
};
// Linked accounts are still pretend. The film and music ones bring real items from the model's
// catalogue (real: [layer, id]), so they count for the map's suggestions.
const ACC=[
  {k:'letterboxd',name:'Letterboxd',t:'film',sub:'64 films logged',items:[],real:[['film','in-the-mood-for-love'],['film','before-sunrise-before-sunset']]},
  {k:'spotify',name:'Spotify',t:'music',sub:'120 liked songs',items:[],real:[['music','frank-ocean'],['music','bon-iver']]},
  {k:'goodreads',name:'Goodreads',t:'book',sub:'38 books read',items:['nw']},
  {k:'pinterest',name:'Pinterest',t:'image',sub:'212 pins',items:['sun']}
];
// Either/or questions, two per layer the model knows. tags are the prototype's moods (they shape its
// Discover page), real is what goes into the model: [layer, 'item', id] or [layer, 'tag', genre].
const QS=[
  {a:{t:'AC/DC',s:'Leather, volume, no notes',g:'music',tags:['loud','energy','rock'],real:[['music','item','ac-dc']]},
   b:{t:'Taylor Swift',s:'Bridges, cardigans, lore',g:'music',tags:['storytelling','warm','autumn'],real:[['music','item','taylor-swift']]}},
  {a:{t:'A crowded dance floor',s:'Neon, bass, one more song',g:'music',tags:['night','neon','energy'],real:[['music','tag','Dance & Electronic'],['music','tag','Rap & Hip-Hop']]},
   b:{t:'A record at midnight',s:'Vinyl crackle, lights low',g:'music',tags:['night','calm','cafe'],real:[['music','tag','Jazz'],['music','tag','R&B']]}},
  {a:{t:'A film that’s all talking',s:'Two people, one long walk',g:'film',tags:['talky','romance','quiet'],real:[['film','tag','Drama'],['film','tag','Romance']]},
   b:{t:'A film that’s all action',s:'Popcorn and a subwoofer',g:'film',tags:['energy','loud','epic'],real:[['film','tag','Action & Adventure'],['film','tag','Sci-Fi & Fantasy']]}},
  {a:{t:'Something that makes you laugh',s:'Quotable by Monday',g:'film',tags:['quirky','warm','youth'],real:[['film','tag','Comedy'],['film','tag','Animation']]},
   b:{t:'Something that keeps you up',s:'Lights on, door locked',g:'film',tags:['night','slow','melancholy'],real:[['film','tag','Mystery & Thriller'],['film','tag','Horror']]}},
  {a:{t:'Sneakers and a hoodie',s:'Ready to walk anywhere',g:'style',tags:['youth','city','everyday'],real:[['style','tag','Sneakers'],['style','tag','Hoodies'],['style','tag','Activewear']]},
   b:{t:'Boots and a good coat',s:'Dressed for the first cold day',g:'style',tags:['autumn','city','warm'],real:[['style','tag','Boots'],['style','tag','Jackets & coats'],['style','tag','Sweaters']]}},
  {a:{t:'One good watch',s:'Plain, and worn every day',g:'style',tags:['analog','everyday','quiet'],real:[['style','tag','Watches'],['style','tag','Wallets']]},
   b:{t:'Rings on every finger',s:'A little shine, always',g:'style',tags:['tender','romance','dream'],real:[['style','tag','Rings'],['style','tag','Necklaces'],['style','tag','Earrings']]}}
];
const NOTES=['Noted. Your map just got a little louder.','The map is listening.','That tells us a lot.','Interesting. Keep going.','Almost there.','That’s everything we need.'];

/* ---------- state ---------- */
const KEY='umix-proto-v3';
function fresh(){return{step:'welcome',qi:0,answers:[],links:{letterboxd:true,spotify:true,goodreads:false,pinterest:false},
  creating:null,draft:{music:[],film:[],style:[]},ptab:'music',pq:'',rc:{},
  tab:'board',cur:0,boards:[],profile:{},settings:false,priv:{profile:'public',share:'anon',rhyme:true,quiz:true},
  pin:[],dfilt:'all',atype:'all',aq:'',addTo:0,viewing:null,follow:{mina:true,hana:true},custom:[],newId:null,picking:false,flist:null,
  me:{name:'Your name',handle:'@you',bio:'Films, songs and books I keep coming back to.'}}}
let S=fresh();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.step){S=Object.assign(fresh(),s);S.picking=false}}catch(e){}
S.custom.forEach(c=>CAT[c.id]=c);
Object.values(S.rc||{}).forEach(c=>{if(!CAT[c.id])CAT[c.id]=c});
/** keeps the catalogue entries of real items that are on a map or in the search step, so they show before the model loads */
function save(){
  const keep=new Set([...S.boards.flatMap(b=>[...b.items,...b.forced]),...REAL.flatMap(L=>S.draft[L].map(x=>`${L}/${x.id}`))]);
  S.rc={};keep.forEach(id=>{if(realOf(id))S.rc[id]=CAT[id]});
  try{localStorage.setItem(KEY,JSON.stringify(Object.assign({},S,{newId:null})))}catch(e){}}

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>(+n).toFixed(1);
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const cur=()=>S.boards[S.cur];

/* ---------- icons ---------- */
const I={
  back:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  share:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v9h14v-9h-1"/></svg>',
  gear:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  search:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  plus:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  down:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  checkc:'<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--label)"/><path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tabMap:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="9" r="2.4"/><circle cx="11" cy="18" r="2.4"/><path d="M8.3 8 Q13 6 15.6 8.4M7 9.3 Q8 14 9.6 16M16.8 11.2 Q15 15 13.3 16.9"/></svg>',
  tabDisc:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="10" r="5.5"/><circle cx="17" cy="15.5" r="3.5"/><circle cx="16.5" cy="5" r="1.8"/></svg>',
  tabAcc:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 18.6c1.3-2.4 3.5-3.6 6.2-3.6s4.9 1.2 6.2 3.6"/></svg>',
  tabPpl:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.3"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M14.5 15.2c2.6-.5 4.8 1 5.6 3.8"/></svg>'
};

/* ---------- glyphs: one shape per medium ---------- */
function glyph(t,r,ghost,col){
  const c=col||`var(--${t})`,op=ghost?.25:.9,sw=ghost?1:1.4,d=ghost?' stroke-dasharray="3 3"':'';let s='';
  if(t==='film')s=`<circle r="${f(r*.6)}" fill="${c}" fill-opacity="${op}"/><circle r="${f(r)}" fill="none" stroke="${c}" stroke-width="${sw}"${d}/>`;
  else if(t==='music'){for(let i=0;i<12;i++){const a=i/12*Math.PI*2;s+=`<line x1="${f(Math.cos(a)*r*.38)}" y1="${f(Math.sin(a)*r*.38)}" x2="${f(Math.cos(a)*r)}" y2="${f(Math.sin(a)*r)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-opacity="${ghost?.55:1}"/>`}s+=`<circle r="${f(r*.24)}" fill="${c}" fill-opacity="${op}"/>`}
  else if(t==='book')s=`<path d="M0,${f(-r)} Q${f(r*.85)},0 0,${f(r)} Q${f(-r*.85)},0 0,${f(-r)}Z" fill="${c}" fill-opacity="${op*.85}" stroke="${c}" stroke-width="${sw}"${d}/>`+(ghost?'':`<line y1="${f(-r)}" y2="${f(r)}" stroke="#fff" stroke-width="1" opacity=".7"/>`);
  else if(t==='thing'||t==='style'){const p=[0,1,2].map(i=>{const a=-Math.PI/2+i*2*Math.PI/3;return `${f(Math.cos(a)*r)},${f(Math.sin(a)*r)}`}).join(' ');s=`<polygon points="${p}" fill="${c}" fill-opacity="${op*.85}" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"${d}/>`}
  else{for(let i=0;i<5;i++)s+=`<ellipse cy="${f(-r*.52)}" rx="${f(r*.3)}" ry="${f(r*.5)}" transform="rotate(${i*72})" fill="${c}" fill-opacity="${op*.72}" stroke="${c}" stroke-width="${sw*.8}"${d}/>`;s+=`<circle r="${f(r*.16)}" fill="#fff"/>`}
  return s;
}
const icon=(t,size,ghost)=>`<svg width="${size}" height="${size}" viewBox="${-size/2} ${-size/2} ${size} ${size}" aria-hidden="true">${glyph(t,size/2-2,ghost)}</svg>`;
function flower(size){
  const cols=['film','music','book','style','image'];
  const p=cols.map((c,i)=>`<ellipse cy="-5.4" rx="3.3" ry="5.6" fill="var(--${c})" fill-opacity=".92" transform="rotate(${i*72})"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true"><g transform="rotate(18)">${p}</g><circle r="1.9" fill="var(--bg)"/></svg>`;
}
const logo=(size)=>`<button class="logo" data-act="wm" aria-label="um!x">${flower(size||30)}</button>`;

/* ---------- the fake engine ---------- */
function rank(items,exclude,forced){
  const prof=S.priv&&S.priv.quiz===false?{}:S.profile;
  const list=Object.values(CAT).filter(c=>!exclude.has(c.id)).map(c=>{
    let best=null,bs=0,sum=0;
    items.forEach(b=>{const bt=CAT[b]?CAT[b].tags:[];const sh=c.tags.filter(t=>bt.includes(t)).length;sum+=sh;if(sh>bs){bs=sh;best=b}});
    const p=c.tags.reduce((s,t)=>s+(prof[t]||0),0);
    const fi=forced.indexOf(c.id);
    return{id:c.id,sc:sum+p*.6+(fi>=0?1000-fi:0),forced:fi>=0,from:best,shared:best?c.tags.filter(t=>CAT[best].tags.includes(t)):[]};
  }).sort((a,b)=>b.sc-a.sc);
  const max=Math.max(1,...list.filter(x=>!x.forced).map(x=>x.sc));
  list.forEach(x=>x.s=x.forced?.95:Math.max(.15,Math.min(1,x.sc/max)));
  return list;
}
/* the suggestions on a map come from the real model: the best pick of each layer in turn, so a map
   shows music, film and style. Ones the facilitator forced (the Wizard) come first. */
const quizOn=()=>!(S.priv&&S.priv.quiz===false);
function realPicks(b,k){
  if(!b.real||!R.ready())return [];
  const per=REAL.map(L=>R.picks(b,L,k+b.dismissed.length+2,quizOn()).filter(p=>{const id=rid(p.item);return !b.items.includes(id)&&!b.dismissed.includes(id)}));
  const out=[];
  for(let r=0;out.length<k&&r<k;r++)for(const list of per)if(list[r]&&out.length<k){const p=list[r],id=addReal(p.item);
    const from=p.because&&p.because.src!=='tag'&&b.items.includes(rid(p.because))?rid(p.because):null;
    out.push({id,s:p.match,from,shared:[],real:true,because:p.because?{name:p.because.name,tag:p.because.src==='tag'}:null})}
  return out;
}
function hunches(b,k=3){
  const forced=b.forced.filter(id=>CAT[id]&&!b.items.includes(id)).map(id=>({id,s:.95,forced:true,from:null,shared:[]}));
  return [...forced,...realPicks(b,k)].slice(0,k);
}
function discoverList(){
  const b=cur(),all=new Set(S.boards.flatMap(x=>x.items).concat(b.dismissed));
  const r=rank(b.items,all,S.pin);const out=[],per={};
  for(const x of r){const t=CAT[x.id].t;if(S.dfilt!=='all'&&t!==S.dfilt)continue;
    if(S.dfilt==='all'&&!x.forced&&(per[t]||0)>=2)continue;per[t]=(per[t]||0)+1;out.push(x);if(out.length===6)break}
  return out;
}
function why(x){
  if(x.forced&&!x.from)return 'Picked for you this week.';
  if(x.real)return !x.because?'Popular with people whose saves look like yours.'
    :x.because.tag?`People who like ${x.because.name} saved this.`:`People who saved ${x.because.name} also saved this.`;
  if(x.from)return `People who saved ${CAT[x.from].title} also saved this`+(x.shared.length?`. You both seem to like things that feel ${x.shared.slice(0,2).join(' and ')}.`:'.');
  return 'It matches what you told us you like.';
}
const conf=s=>`<div class="conf"><span>Match</span><span class="bar"><i style="width:${Math.round(s*100)}%"></i></span><span>${s>.8?'Strong':s>.5?'Good':'Worth a try'}</span></div>`;
function buildProfile(){
  const p={};S.answers.forEach((a,i)=>{if(!a)return;const q=QS[i];
    const add=(tags,w)=>tags.forEach(t=>p[t]=(p[t]||0)+w);
    if(a==='a')add(q.a.tags,2);else if(a==='b')add(q.b.tags,2);else if(a==='both'){add(q.a.tags,1);add(q.b.tags,1)}});
  S.profile=p;
}
/** what the quiz answers put into the model: [{ layer, id, src }] */
function quizInputs(){
  const out=[];S.answers.forEach((a,i)=>{if(!a||a==='neither')return;const q=QS[i];
    const opts=a==='both'?[q.a,q.b]:[q[a]];opts.forEach(o=>o.real.forEach(([L,kind,id])=>out.push({layer:L,id,src:kind==='tag'?'tag':'graph'})))});
  return out;
}
/** a new map from the linked accounts (first map only), the quiz and the search step. Needs the model */
function makeBoard(name,withAccounts){
  const b={name,items:[],dismissed:[],forced:[],real:R.emptyReal()};
  const put=(L,id,src,via)=>{const it=src==='tag'?R.genre(L,id):R.find(L,id,src);if(!it)return;
    const ins=b.real.inputs[L];if(ins.some(x=>x.id===it.id))return;ins.push({id:it.id,src:it.src,via});if(src!=='tag')b.items.push(addReal(it))};
  if(withAccounts)ACC.forEach(a=>{if(!S.links[a.k])return;b.items.push(...a.items);(a.real||[]).forEach(([L,id])=>put(L,id,undefined,'account'))});
  if(R.ready()){quizInputs().forEach(x=>put(x.layer,x.id,x.src,'quiz'));REAL.forEach(L=>S.draft[L].forEach(x=>put(L,x.id,x.src,'you')))}
  b.items=[...new Set(b.items)];
  return b;
}
function seedBoards(){
  buildProfile();
  S.boards=[makeBoard('My university self',true),{name:'My dream life',items:[],dismissed:[],forced:[],real:R.emptyReal()}];
  S.cur=0;S.addTo=0;
}
const vis=b=>S.priv.profile==='only me'?'only me':(b.vis||'public');
const VISL={'public':'Everyone','followers':'Followers','only me':'Only me'};

/* ---------- map drawing ---------- */
function cv(a,b,k){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y;return `M${f(a.x)},${f(a.y)} Q${f(mx-dy*k)},${f(my+dx*k)} ${f(b.x)},${f(b.y)}`}
function mapSVG(ids,hun,o={}){
  const W=350,H=470,C={x:175,y:238},n=ids.length;
  const rx=n<=6?100:112,ry=n<=6?132:150,off=n%2?0:18;
  const P={};
  ids.forEach((id,i)=>{const a=(-90+i*360/n+off)*Math.PI/180;P[id]={x:C.x+rx*Math.cos(a),y:C.y+ry*Math.sin(a)}});
  const Hs=hun.map((h,j)=>{const slots=Math.max(n,hun.length),g=n?Math.floor(j*n/hun.length)+.5:j+.25;
    const a=(-90+g*360/slots+off)*Math.PI/180;return Object.assign({},h,{x:C.x+126*Math.cos(a),y:C.y+196*Math.sin(a),r:9+8*h.s})});
  let s='';
  ids.forEach((id,i)=>s+=`<path d="${cv(C,P[id],.14)}" pathLength="1" class="draw" style="--d:${i*.05}s" fill="none" stroke="var(--label)" stroke-opacity=".3" stroke-width="1"/>`);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=CAT[ids[i]],b=CAT[ids[j]];const sh=a.tags.filter(t=>b.tags.includes(t)).length;
    if(sh)s+=`<path d="${cv(P[ids[i]],P[ids[j]],(i+j)%2?.22:-.22)}" fill="none" stroke="var(--label)" stroke-opacity="${f(Math.min(.26,.08+sh*.06))}"/>`}
  Hs.forEach(h=>{const src=h.from&&P[h.from]?P[h.from]:C;s+=`<path d="${cv(src,h,.16)}" fill="none" stroke="var(--${CAT[h.id].t})" stroke-opacity=".65" stroke-width="1" stroke-dasharray="2 4" stroke-linecap="round"/>`});
  const label=(x,y,t,w,c)=>`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-size="11" font-weight="${w||500}" fill="${c||'var(--label)'}" stroke="var(--bg2)" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(trunc(t,18))}</text>`;
  Hs.forEach((h,i)=>{const c=CAT[h.id];
    s+=`<g class="node" role="button" tabindex="0" data-act="${o.peek?'peek-item':'hunch'}" data-id="${h.id}" aria-label="Suggestion: ${esc(c.title)}"><g transform="translate(${f(h.x)},${f(h.y)})"><g class="bloom" style="--d:${.4+i*.15}s">
      <circle class="hit" r="${f(h.r+10)}"/><circle class="pulse" r="${f(h.r)}" fill="var(--${c.t})" fill-opacity=".08" stroke="var(--${c.t})" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2.5 3"/>${glyph(c.t,h.r*.42,true)}</g></g>
      ${label(h.x,h.y+h.r+14,c.title,400,'var(--label2)')}</g>`});
  ids.forEach((id,i)=>{const c=CAT[id],p=P[id],isNew=o.newId===id;
    s+=`<g class="node" role="button" tabindex="0" data-act="${o.peek?'peek-item':'item'}" data-id="${id}" aria-label="${esc(c.title)}, ${TYPE[c.t]}"><g transform="translate(${f(p.x)},${f(p.y)})"><g class="bloom" style="--d:${isNew?0:.1+i*.05}s">
      <circle class="hit" r="24"/>${glyph(c.t,isNew?13:11)}</g></g>${label(p.x,p.y+26,c.title)}</g>`});
  s+=`<circle cx="${C.x}" cy="${C.y}" r="5" fill="var(--label)"/><text x="${C.x+11}" y="${C.y-8}" font-family="var(--serif)" font-style="italic" font-size="15" fill="var(--label)" stroke="var(--bg2)" stroke-width="5" paint-order="stroke">${esc(o.center||'You')}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Map">${s}</svg>`;
}
function miniSVG(items){
  const pts=[[34,50],[96,32],[160,26],[134,62],[64,66]];let s='';
  for(let i=1;i<Math.min(items.length,5);i++)s+=`<path d="${cv({x:pts[i-1][0],y:pts[i-1][1]},{x:pts[i][0],y:pts[i][1]},.25)}" fill="none" stroke="var(--label)" stroke-opacity=".22"/>`;
  items.slice(0,5).forEach((id,i)=>s+=`<g transform="translate(${pts[i][0]},${pts[i][1]})">${glyph(CAT[id].t,i===1?8:6)}</g>`);
  return `<svg viewBox="0 0 192 84" width="100%" height="84" aria-hidden="true">${s}</svg>`;
}

/* ---------- shared bits ---------- */
const backBtn=(act,to)=>`<button class="glass circ" data-act="${act}" ${to?`data-to="${to}"`:''} aria-label="Back">${I.back}</button>`;
function fhdr(right){return `<div class="edge" id="edge"></div><div class="top float"><span class="fadelogo" id="flogo">${logo()}</span>${right}</div>`}
function searchResults(q){
  const box=$('#sres');if(!box)return;q=q.trim().toLowerCase();if(!q){box.hidden=true;box.innerHTML='';return}
  const L=Object.values(CAT).filter(c=>(c.title+' '+c.by+' '+c.tags.join(' ')).toLowerCase().includes(q)).slice(0,14);
  box.hidden=false;
  box.innerHTML=L.length?L.map(c=>`<button class="irow" data-act="disc" data-id="${c.id}"><span style="width:46px;flex-shrink:0">${cover(c)}</span><span class="m"><b>${esc(c.title)}</b><span>${esc(c.by)} · ${TYPE[c.t]}</span></span></button>`).join(''):`<p class="sub" style="padding:16px 4px">Nothing called “${esc(q)}” yet.</p>`;
}
function openSearch(on){const sb=$('#sbox');if(!sb)return;const i=$('#dq'),lg=$('#flogo');
  if(on){sb.classList.add('open');i.tabIndex=0;if(lg)lg.style.opacity=0;setTimeout(()=>i.focus(),60);if(i.value)searchResults(i.value)}
  else{sb.classList.remove('open');i.value='';i.tabIndex=-1;searchResults('');onScrollFx()}}
function onScrollFx(){const sc=$('.scroll.under');if(!sc)return;const y=sc.scrollTop,lg=$('#flogo'),ed=$('#edge'),open=$('#sbox')&&$('#sbox').classList.contains('open');
  if(lg)lg.style.opacity=open?0:Math.max(0,1-y/36);if(ed)ed.style.opacity=Math.min(1,y/24)}
function hdr(left,right){return `<div class="top">${left||'<span style="width:44px"></span>'}<div class="r">${right||''}</div></div>`}
function segc(act,curv,opts,label){return `<div class="segc" role="tablist" aria-label="${label}">${opts.map(([v,l])=>`<button role="tab" data-act="${act}" data-v="${v}" aria-selected="${curv===v}">${l}</button>`).join('')}</div>`}
function common(k){const mine=new Set(S.boards.flatMap(b=>b.items));const n=PEOPLE[k].items.filter(i=>mine.has(i)).length;
  if(n)return `${n} thing${n>1?'s':''} in common`;const myt=new Set([...mine].flatMap(i=>CAT[i].tags));const t=PEOPLE[k].items.flatMap(i=>CAT[i].tags).find(x=>myt.has(x));return t?`You both like ${t} things`:'Something new for you';}

/* ---------- onboarding ---------- */
function welcomeField(){
  let r=7,s='';const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647};const pts=[];let tries=0;
  while(pts.length<22&&tries++<4000){const p={x:24+rnd()*354,y:70+rnd()*560,r:3.5+Math.pow(rnd(),2)*8,t:TYPES[Math.floor(rnd()*5)]};
    if(Math.abs(p.x-201)<165&&Math.abs(p.y-400)<130)continue;
    if(pts.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>q.r+p.r+30))pts.push(p)}
  pts.forEach((p,i)=>{const nb=pts.map((q,j)=>({j,d:Math.hypot(q.x-p.x,q.y-p.y)})).filter(o=>o.j>i).sort((a,b)=>a.d-b.d)[0];
    if(nb&&nb.d<170)s+=`<path d="${cv(p,pts[nb.j],.2)}" fill="none" stroke="var(--label)" stroke-opacity=".1"/>`});
  pts.forEach((p,i)=>s+=`<g transform="translate(${f(p.x)},${f(p.y)})"><g class="bloom" style="--d:${(i%12)*.06}s">${glyph(p.t,p.r)}</g></g>`);
  return `<svg class="wfield" viewBox="0 0 402 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
}
function renderOnb(){
  if(S.step==='welcome')return `<div class="onb welcome">${welcomeField()}
    <div class="wcenter"><button class="logo" data-act="wm" aria-label="um!x" style="width:96px;height:96px">${flower(92)}</button>
    <h1 class="lt" style="font-size:38px">All your taste,<br><i>on one map.</i></h1><p class="body" style="color:var(--label2);max-width:300px">Music, films, books and what you wear, connected for you.</p></div>
    <div class="foot"><button class="btn prim block" data-act="go" data-to="connect">Get started</button>
    <p class="fine">Prototype for user testing. Nothing you tap leaves this page.</p></div></div>`;
  if(S.step==='connect'){
    const any=Object.values(S.links).some(Boolean);
    return hdr(backBtn('go','welcome'))+
    `<div class="onb"><p class="fn" style="margin-top:12px">${stepLabel(1)}</p><h1 class="lt" style="margin-top:6px">Bring your taste <i>with you</i></h1>
    <p class="sub" style="margin-top:10px;font-size:17px">Link the apps where you already save things. We copy your saves onto your first map.</p>
    <div class="group" style="margin-top:32px">${ACC.map(a=>`<button class="li ind" data-act="link" data-k="${a.k}" aria-pressed="${!!S.links[a.k]}"><span class="tile">${icon(a.t,26)}</span><span class="m"><b>${a.name}</b><span>${a.sub}</span></span>
      <span class="v" style="color:${S.links[a.k]?'var(--label)':'var(--tint)'}">${S.links[a.k]?I.check+' Linked':'Link'}</span></button>`).join('')}</div>
    <div class="foot"><button class="btn prim block" data-act="go" data-to="quiz">${any?'Continue':'Continue without linking'}</button></div></div>`;
  }
  if(S.step==='quiz'){
    const q=QS[S.qi],a=S.answers[S.qi];
    const card=(k,o)=>`<button class="choice" data-act="pick" data-v="${k}" aria-pressed="${a===k}"><span class="gt">${icon(o.g,36)}</span><span style="min-width:0"><b>${o.t}</b><span class="s">${o.s}</span></span>${a===k?`<span class="ck">${I.checkc}</span>`:''}</button>`;
    const note=a?(a==='both'?'A person of range. Respect.':a==='neither'?'Fair. We’ll find your thing elsewhere.':NOTES[S.qi]):'Go with your gut.';
    return `<div class="top">${backBtn('qback')}<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${QS.length}" aria-valuenow="${S.qi+1}" aria-label="Question ${S.qi+1} of ${QS.length}"><i style="width:${(S.qi+1)/QS.length*100}%"></i></div><button class="tbtn" data-act="pick" data-v="skip">Skip</button></div>
    <div class="onb"><p class="fn" style="margin-top:12px">${stepLabel(2)} · Question ${S.qi+1} of ${QS.length}</p>
    <h1 class="lt" style="margin-top:6px">Which do you like <i>more?</i></h1>
    <div style="position:relative;display:flex;flex-direction:column;gap:12px;margin-top:28px">${card('a',q.a)}${card('b',q.b)}<span class="ordot glass" aria-hidden="true">or</span></div>
    <div class="alt"><button data-act="pick" data-v="both" aria-pressed="${a==='both'}">I like both</button><button data-act="pick" data-v="neither" aria-pressed="${a==='neither'}">Neither</button></div>
    <div class="foot"><p class="sub" style="text-align:center" aria-live="polite">${note}</p></div></div>`;
  }
  if(S.step==='building'){
    let s='';
    TYPES.forEach((t,i)=>{const a=(i*72-90)*Math.PI/180,x=Math.cos(a)*92,y=Math.sin(a)*92;
      s+=`<path d="M0,0 Q${f(x*.5-y*.2)},${f(y*.5+x*.2)} ${f(x)},${f(y)}" pathLength="1" class="draw" style="--d:${.2+i*.25}s" fill="none" stroke="var(--label)" stroke-opacity=".3" stroke-width="1.4"/>`+
         `<g transform="translate(${f(x)},${f(y)})"><g class="bloom" style="--d:${.3+i*.25}s">${glyph(t,12)}</g></g>`});
    s+=`<circle r="5" fill="var(--label)"/>`;
    return `<div class="onb" style="align-items:center;justify-content:center;text-align:center;gap:24px">
      <svg width="240" height="240" viewBox="-120 -120 240 240" aria-hidden="true">${s}</svg>
      <h1 class="lt">Drawing <i>${S.creating?esc(S.creating.name):'your map'}</i></h1><p class="sub" id="bmsg" aria-live="polite">Reading your saves…</p></div>`;
  }
  if(S.step==='search')return renderPick();
}
/** "Step 2 of 3" in onboarding; a new map has no accounts step, and Answer again has only the questions */
function stepLabel(n){return S.redo?'Taste questions':S.creating?`${esc(S.creating.name)} · Step ${n-1} of 2`:`Step ${n} of 3`}

/* ---------- the search step: real artists, films and brands from the model's catalogue ---------- */
const PTAB={music:['Music','Search artists and bands'],film:['Film & TV','Search films and series'],style:['Style','Search brands, like Levi’s or Nike']};
const inDraft=(L,id)=>S.draft[L].some(x=>x.id===id);
function renderPick(){
  const n=REAL.reduce((t,L)=>t+S.draft[L].length,0);
  return hdr(backBtn('pback'))+
  `<div class="onb" style="padding-bottom:0"><p class="fn" style="margin-top:12px">${stepLabel(3)}</p><h1 class="lt" style="margin-top:6px">Add a few <i>you love</i></h1>
  <p class="sub" style="margin-top:10px;font-size:17px">Real artists, films and brands. The map starts from these and your answers.</p>
  <div style="margin-top:20px">${segc('ptab',S.ptab,REAL.map(L=>[L,PTAB[L][0]+(S.draft[L].length?` · ${S.draft[L].length}`:'')]),'Choose a layer')}</div>
  <label class="search" style="margin-top:14px"><span style="color:var(--label2);display:grid">${I.search}</span><span class="vh">${PTAB[S.ptab][1]}</span><input id="pq" type="search" placeholder="${PTAB[S.ptab][1]}" autocomplete="off" value="${esc(S.pq)}"></label>
  <div id="pickList" style="flex:1;min-height:0;overflow-y:auto;margin:8px calc(var(--g) * -1) 0;padding:0 var(--g)"></div>
  <div class="foot" style="padding:12px 0 calc(var(--bot) + 18px)"><button class="btn prim block" data-act="pdone">${n?`Draw my map · ${n} added`:'Skip and draw my map'}</button></div></div>`;
}
function fillPick(){
  const box=$('#pickList');if(!box)return;
  if(!R.ready()){box.innerHTML='<p class="sub" style="padding:24px 4px;text-align:center">Loading the taste model…</p>';return}
  const L=S.ptab,q=S.pq.trim();
  const list=q.length>=2?R.search(L,q,12):R.popular(L,14);
  const row=it=>{const id=addReal(it),c=CAT[id],on=inDraft(L,it.id);
    return `<div class="irow"><span style="width:46px;flex-shrink:0">${cover(c)}</span><div class="m"><b>${esc(c.title)}</b><span>${esc(c.by)}</span></div>
    <button class="glass circ" style="width:36px;height:36px" data-act="ptoggle" data-l="${L}" data-id="${esc(it.id)}" data-src="${it.src}" aria-pressed="${on}" aria-label="${on?'Remove':'Add'} ${esc(c.title)}">${on?I.check:I.plus}</button></div>`};
  box.innerHTML=(q.length>=2?'':`<p class="slabel" style="margin-top:12px">Most saved in our data</p>`)+
    (list.length?list.map(row).join(''):`<p class="sub" style="padding:20px 4px">Nothing called “${esc(q)}” in our data yet. Try another spelling.</p>`);
}

/* ---------- app screens ---------- */
function tabbar(){
  const T=[['board','Map',I.tabMap],['discover','Discover',I.tabDisc],['account','Account',I.tabAcc]];
  return `<div class="tabbar"><nav class="tabs glass" aria-label="Main">${T.map(([t,l,ic])=>`<button data-act="tab" data-t="${t}" ${S.tab===t?'aria-current="page"':''}>${ic}${l}</button>`).join('')}</nav>
    ${S.tab==='board'?`<button class="fab glass" data-act="add" aria-label="Add to map">${I.plus}</button>`:''}</div>`;
}
function renderBoard(){
  const b=cur(),h=hunches(b),total=S.boards.reduce((s,x)=>s+x.items.length,0),v=vis(b);
  return hdr(logo(),`<button class="glass circ" data-act="toast" data-msg="${v==='only me'?'This map is private. Change it in Settings to share.':'Link to your map copied'}" aria-label="Share map">${I.share}</button>`)+
  `<div class="boardwrap"><button class="prof" data-act="tab" data-t="account" style="margin-top:4px;border:0;background:none;padding:0;text-align:left"><span class="av">${esc(S.me.name.trim()[0]||'Y').toUpperCase()}</span><span><span style="display:block;font-size:17px;font-weight:600">${esc(S.me.name)}</span><span class="fn" style="display:block;font-size:14px">${S.boards.length} maps · ${total} saves · ${FOLLOWERS.length} followers</span></span></button>
  <button class="mapname" data-act="boardmenu" aria-haspopup="menu" aria-label="Switch map, current: ${esc(b.name)}"><span class="lt"><i>${esc(b.name)}</i></span><span style="color:var(--label2);margin-top:6px">${I.down}</span></button>
  <p class="sub" style="margin-top:6px">${b.items.length} saves · ${h.length} suggestions · ${VISL[v]}</p>
  <button class="map mapbtn" data-act="full" aria-label="Open ${esc(b.name)} to explore">${mapSVG(b.items,h,{newId:S.newId}).replace(/ role="button" tabindex="0"/g,'')}
    <span class="openhint glass">${b.items.length?'Tap to explore':'Tap to start'}</span></button>
  </div>`;
}

/* ---------- full interactive map (force layout, drag, pan, pinch) ---------- */
let G=null;const POS={};
function renderFull(){
  const b=cur();
  return `<div class="full"><svg id="graph" class="graph" role="group" aria-label="${esc(b.name)}, interactive map"></svg>
  <div class="fulltop"><button class="glass circ" data-act="unfull" aria-label="Close map">${I.x}</button><span class="ttl">${esc(b.name)}</span><button class="glass circ" data-act="add" aria-label="Add to map">${I.plus}</button></div>
  <div class="fullhint glass">Drag things around · pinch to zoom</div></div>`;
}
function gnode(n){
  if(n.kind==='me')return `<circle r="16" fill="transparent"/><circle r="6" fill="var(--label)"/><text x="11" y="-9" font-family="var(--serif)" font-style="italic" font-size="16" fill="var(--label)" stroke="var(--bg)" stroke-width="5" paint-order="stroke">You</text>`;
  const c=CAT[n.id],h=n.kind==='hunch';
  const lab=`<text y="${h?f(n.r+15):26}" text-anchor="middle" font-size="11.5" font-weight="${h?400:500}" fill="var(--${h?'label2':'label'})" stroke="var(--bg)" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(trunc(c.title,22))}</text>`;
  if(h)return `<circle r="${f(n.r+12)}" fill="transparent"/><circle class="pulse" r="${f(n.r)}" fill="var(--${c.t})" fill-opacity=".08" stroke="var(--${c.t})" stroke-opacity=".7" stroke-dasharray="2.5 3"/>${glyph(c.t,n.r*.42,true)}${lab}`;
  return `<circle r="22" fill="transparent"/>${glyph(c.t,11)}${lab}`;
}
function initGraph(){
  const svg=$('#graph');if(!svg)return;
  const W=svg.clientWidth||360,H=svg.clientHeight||720;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const b=cur(),hs=hunches(b),cx=W/2,cy=H/2,nodes=[],idx={};
  const add=o=>{const p=POS[o.id];if(p){o.x=p.x;o.y=p.y}o.vx=0;o.vy=0;idx[o.id]=o;nodes.push(o)};
  add({id:'__me',kind:'me',x:cx,y:cy});
  b.items.forEach((id,i)=>{const a=i/Math.max(1,b.items.length)*Math.PI*2;add({id,kind:'item',x:cx+Math.cos(a)*120+Math.random()*6,y:cy+Math.sin(a)*160+Math.random()*6})});
  hs.forEach(h=>{const base=h.from&&idx[h.from]?idx[h.from]:idx.__me,a=Math.random()*Math.PI*2;add({id:h.id,kind:'hunch',from:h.from,r:9+8*h.s,x:base.x+Math.cos(a)*80,y:base.y+Math.sin(a)*80})});
  const links=[];
  b.items.forEach(id=>links.push({a:'__me',b:id,len:120,k:.035,t:'me'}));
  for(let i=0;i<b.items.length;i++)for(let j=i+1;j<b.items.length;j++){const A=CAT[b.items[i]],B=CAT[b.items[j]],sh=A.tags.filter(t=>B.tags.includes(t)).length;
    if(sh)links.push({a:A.id,b:B.id,len:105,k:.008*sh,t:'s',op:Math.min(.28,.08+sh*.06)})}
  hs.forEach(h=>links.push({a:h.from&&idx[h.from]?h.from:'__me',b:h.id,len:85,k:.05,t:'h',col:CAT[h.id].t}));
  svg.innerHTML=`<g id="vp"><g>${links.map((l,i)=>`<line id="gl${i}" stroke="${l.t==='h'?`var(--${l.col})`:'var(--label)'}" stroke-opacity="${l.t==='h'?.65:l.t==='me'?.3:l.op}" stroke-width="1"${l.t==='h'?' stroke-dasharray="2 4" stroke-linecap="round"':''}/>`).join('')}</g>
    <g>${nodes.map((n,i)=>`<g class="gn" data-i="${i}"${n.kind!=='me'?` role="button" tabindex="0" aria-label="${n.kind==='hunch'?'Suggestion: ':''}${esc(CAT[n.id].title)}"`:''}>${gnode(n)}</g>`).join('')}</g></g>`;
  const els=nodes.map((n,i)=>svg.querySelector(`.gn[data-i="${i}"]`)),lels=links.map((l,i)=>svg.querySelector('#gl'+i)),vp=svg.querySelector('#vp');
  G={nodes,links,idx,pan:{x:0,y:0},k:1,drag:null,ptrs:new Map(),pinch:null,raf:0};
  const pt=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const world=p=>({x:(p.x-G.pan.x)/G.k,y:(p.y-G.pan.y)/G.k});
  const open=n=>n.kind==='hunch'?hunchSheet(n.id):itemSheet(n.id);
  svg.onpointerdown=e=>{try{svg.setPointerCapture(e.pointerId)}catch(_){}const p=pt(e);G.ptrs.set(e.pointerId,p);
    if(G.ptrs.size===2){const [a,c]=[...G.ptrs.values()];G.pinch={d:Math.hypot(a.x-c.x,a.y-c.y)||1,k:G.k,mx:(a.x+c.x)/2,my:(a.y+c.y)/2,pan:{...G.pan}};if(G.drag&&G.drag.n)G.drag.n.fixed=false;G.drag=null;return}
    const g=e.target.closest('.gn');G.drag=g?{n:nodes[+g.dataset.i],sx:p.x,sy:p.y,moved:0}:{pan:true,sx:p.x,sy:p.y,px:G.pan.x,py:G.pan.y,moved:0}};
  svg.onpointermove=e=>{if(!G.ptrs.has(e.pointerId))return;const p=pt(e);G.ptrs.set(e.pointerId,p);
    if(G.pinch&&G.ptrs.size===2){const [a,c]=[...G.ptrs.values()],k=Math.max(.5,Math.min(2.5,G.pinch.k*Math.hypot(a.x-c.x,a.y-c.y)/G.pinch.d)),P=G.pinch;
      G.pan.x=P.mx-(P.mx-P.pan.x)*k/P.k;G.pan.y=P.my-(P.my-P.pan.y)*k/P.k;G.k=k;return}
    const D=G.drag;if(!D)return;D.moved=Math.max(D.moved,Math.hypot(p.x-D.sx,p.y-D.sy));
    if(D.pan){G.pan.x=D.px+p.x-D.sx;G.pan.y=D.py+p.y-D.sy}else if(D.moved>3){const w=world(p);D.n.x=w.x;D.n.y=w.y;D.n.vx=D.n.vy=0;D.n.fixed=true}};
  const up=e=>{G.ptrs.delete(e.pointerId);if(G.ptrs.size<2)G.pinch=null;const D=G.drag;G.drag=null;if(!D||!D.n)return;D.n.fixed=false;if(D.moved<6&&D.n.kind!=='me')open(D.n)};
  svg.onpointerup=up;svg.onpointercancel=up;
  svg.onwheel=e=>{e.preventDefault();const p=pt(e),k=Math.max(.5,Math.min(2.5,G.k*Math.exp(-e.deltaY*.0015)));G.pan.x=p.x-(p.x-G.pan.x)*k/G.k;G.pan.y=p.y-(p.y-G.pan.y)*k/G.k;G.k=k};
  svg.onkeydown=e=>{const g=e.target.closest&&e.target.closest('.gn');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const n=nodes[+g.dataset.i];if(n.kind!=='me')open(n)}};
  const step=()=>{
    const N=nodes.length;
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=nodes[i],c=nodes[j];let dx=c.x-a.x,dy=c.y-a.y,d2=dx*dx+dy*dy;if(d2>160000)continue;d2=Math.max(d2,80);const d=Math.sqrt(d2),F=1500/d2;
      a.vx-=dx/d*F;a.vy-=dy/d*F;c.vx+=dx/d*F;c.vy+=dy/d*F}
    links.forEach(l=>{const a=idx[l.a],c=idx[l.b];if(!a||!c)return;const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy)||1,F=(d-l.len)*l.k;a.vx+=dx/d*F;a.vy+=dy/d*F;c.vx-=dx/d*F;c.vy-=dy/d*F});
    nodes.forEach((n,i)=>{const pull=n.kind==='me'?.01:.0015;n.vx+=(cx-n.x)*pull;n.vy+=(cy-n.y)*pull;
      if(n.fixed){n.vx=n.vy=0}else{n.vx*=.78;n.vy*=.78;n.x+=n.vx;n.y+=n.vy}
      els[i].setAttribute('transform',`translate(${f(n.x)},${f(n.y)})`);POS[n.id]={x:n.x,y:n.y}});
    links.forEach((l,i)=>{const a=idx[l.a],c=idx[l.b];lels[i].setAttribute('x1',f(a.x));lels[i].setAttribute('y1',f(a.y));lels[i].setAttribute('x2',f(c.x));lels[i].setAttribute('y2',f(c.y))});
    vp.setAttribute('transform',`translate(${f(G.pan.x)},${f(G.pan.y)}) scale(${G.k.toFixed(3)})`);
    G.raf=requestAnimationFrame(step)};
  step();
}
/* ---------- covers ---------- */
const MOODC={summer:['#EE9447','#C24A2A'],dusk:['#EE8A69','#6E4FA6'],warm:['#E09A55','#9E4A31'],night:['#3A3F7A','#14183A'],neon:['#D23E8A','#33267A'],city:['#5B6C8C','#1E2A3F'],rain:['#6C8AA5','#273B50'],calm:['#7AA59D','#2F5654'],quiet:['#9B998B','#47493F'],melancholy:['#82709A','#36304A'],longing:['#B06E8C','#46293F'],romance:['#DE7486','#7E2D4A'],dream:['#9786DD','#3F3F8C'],fantasy:['#4FA9A1','#33467F'],energy:['#E4493B','#6E1A27'],loud:['#D9372D','#2E1212'],rock:['#B73A30','#1E1A1A'],epic:['#C68E39','#553517'],desert:['#D79D58','#8C4F25'],sea:['#3B97B1','#173F5C'],travel:['#56A09C','#294F6E'],youth:['#8EBF48','#2F6A44'],quirky:['#E1BE45','#B5502F'],memory:['#C49683','#5E434A'],tender:['#E3A1A6','#8B4E64'],literary:['#9C8160','#463527'],writing:['#8A7962','#383026'],analog:['#AE784C','#45301F'],autumn:['#C46A2E','#5E2818'],storytelling:['#B5743A','#523425'],everyday:['#A09D86','#4F4D42'],cafe:['#9A7154','#412E22'],talky:['#C8826A','#5E4152'],slow:['#6B7CA0','#2A3049']};
const TBASE={film:['#D2603F','#5E2A1E'],music:['#5E9150','#23402A'],book:['#4A6FB0','#1E2D4E'],style:['#C8952A','#5A3E12'],thing:['#C8952A','#5A3E12'],image:['#C9668A','#55263C']};
const hsh=s=>{let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
function pal(c){const a=MOODC[c.tags[0]]||TBASE[c.t],b=MOODC[c.tags[1]]||MOODC[c.tags[0]]||TBASE[c.t];return [a[0],b[0],a[1]]}
function cover(c,cls){const [a,b,d]=pal(c),h=hsh(c.id),px=15+h%70,py=10+(h>>5)%55,ang=135+(h>>9)%70;
  const img=c.real&&R.imageUrl(c.real.img,cls==='wide'?500:300);
  if(img)return `<span class="cv ph ${c.t==='style'?'prod':''} ${cls||''}" style="background:linear-gradient(${ang}deg, ${a} 0%, ${d} 100%)">
    <img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><span class="cvk">${TYPE[c.t]}</span><span class="cvt">${esc(c.title)}</span><span class="cvb">${esc(c.by)}</span></span>`;
  return `<span class="cv ${cls||''}" style="background:radial-gradient(110% 85% at ${px}% ${py}%, ${b} 0%, ${b}00 62%),linear-gradient(${ang}deg, ${a} 0%, ${d} 100%)">
    <svg class="cvg" viewBox="-12 -12 24 24" aria-hidden="true">${glyph(c.t,10.5,false,'#fff')}</svg><span class="cvk">${TYPE[c.t]}</span><span class="cvt">${esc(c.title)}</span><span class="cvb">${esc(c.by)}</span></span>`}
const tile=(id,cap)=>`<button class="tb" data-act="disc" data-id="${id}" aria-label="${esc(CAT[id].title)}, ${TYPE[CAT[id].t]}">${cover(CAT[id])}${cap?`<span class="cap">${esc(cap)}</span>`:''}</button>`;
const MIXN={summer:'Summer at dusk',night:'After midnight',rain:'Rainy afternoon',calm:'Slow Sunday',city:'City walk',youth:'Coming of age',melancholy:'Sad in a good way',dream:'Half asleep',energy:'Turn it up',warm:'Warm and slow',longing:'Missing someone',quiet:'Quiet hours',travel:'Road trip',literary:'Reading nook',neon:'Neon nights',sea:'By the sea',everyday:'Small rituals',memory:'Old photographs',romance:'First dates',autumn:'Early autumn',cafe:'Window seat',tender:'Soft things',analog:'Film grain',dusk:'Golden hour'};
function mixItems(tag,excl){const out=[];TYPES.forEach(t=>{const c=Object.values(CAT).find(x=>x.t===t&&x.tags.includes(tag)&&!excl.has(x.id)&&!out.includes(x.id));if(c)out.push(c.id)});
  Object.values(CAT).forEach(x=>{if(out.length<5&&x.tags.includes(tag)&&!excl.has(x.id)&&!out.includes(x.id))out.push(x.id)});return out.slice(0,5)}
function mixCard(tag,items){const C=MOODC[tag]||['#777','#333'];const pts=[[44,58],[118,40],[196,62],[236,30],[154,98]];let s='';
  for(let i=1;i<items.length;i++)s+=`<path d="${cv({x:pts[i-1][0],y:pts[i-1][1]},{x:pts[i][0],y:pts[i][1]},.25)}" fill="none" stroke="#fff" stroke-opacity=".45"/>`;
  items.forEach((id,i)=>s+=`<g transform="translate(${pts[i][0]},${pts[i][1]})">${glyph(CAT[id].t,i===1?11:8,false,'#fff')}</g>`);
  const types=[...new Set(items.map(id=>TYPE[CAT[id].t].toLowerCase()))];
  return `<button class="mix" data-act="mix" data-v="${tag}" style="background:linear-gradient(150deg, ${C[0]}, ${C[1]})"><svg viewBox="0 0 272 200" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${s}</svg>
    <span class="mt"><b>${MIXN[tag]||tag[0].toUpperCase()+tag.slice(1)+' mix'}</b><span>${items.length} things · ${types.join(', ')}</span></span></button>`}
function mixSheet(tag){
  const b=cur(),items=mixItems(tag,new Set(b.items));
  sheet(`<div class="shead"><div class="t"><div class="k">A mix for you</div><h2>${esc(MIXN[tag]||tag)}</h2><div class="by">${items.length} things that feel ${tag}</div></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <div style="margin-top:16px">${items.map(id=>{const c=CAT[id];return `<div class="irow"><span style="width:52px;flex-shrink:0">${cover(c)}</span><div class="m"><b>${esc(c.title)}</b><span>${esc(c.by)} · ${TYPE[c.t]}</span></div><button class="glass circ" style="width:36px;height:36px" data-act="addit" data-id="${id}" aria-label="Add ${esc(c.title)}">${I.plus}</button></div>`}).join('')}</div>
  <div class="row-actions"><button class="btn prim block" data-act="savemix" data-v="${tag}">Save as a new map</button></div>`,true);
}
function todayPick(excl){const p=S.pin.find(x=>!excl.has(x));if(p)return rank(cur().items,new Set(),S.pin).find(h=>h.id===p);return rank(cur().items,excl,[])[0]}
function renderDiscover(){
  const b=cur(),onb=new Set(S.boards.flatMap(x=>x.items)),excl=new Set([...onb,...b.dismissed]);
  const used=new Set();const take=(arr,n)=>{const out=[];for(const id of arr){if(out.length>=n)break;if(!used.has(id)){out.push(id);used.add(id)}}return out};
  const R=rank(b.items,excl,S.pin);
  const tp=todayPick(excl);if(tp)used.add(tp.id);
  let h='';
  if(tp){const c=CAT[tp.id];h+=`<button class="hero" data-act="disc" data-id="${tp.id}"><p class="k">Today’s pick</p>${cover(c,'wide')}<p class="r">${esc(why(tp))}</p></button>`}
  h=`<button class="bentry" data-act="bubbles"><svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">${R.slice(0,6).map((x,i)=>{const P=[[32,26,15],[12,16,8],[54,14,7],[52,40,9],[14,40,7],[33,6,4]][i],C=pal(CAT[x.id]);return `<circle cx="${P[0]}" cy="${P[1]}" r="${P[2]}" fill="${C[0]}"/>`}).join('')}</svg>
    <span class="m"><b>Explore as bubbles</b><span>Everything for you, biggest match in the middle</span></span><span style="color:var(--label2)">${I.chev}</span></button>`+h;
  // because you saved X
  b.items.slice(0,3).forEach(src=>{const S0=CAT[src];
    const L=Object.values(CAT).filter(c=>!excl.has(c.id)&&c.t!==S0.t&&c.tags.some(t=>S0.tags.includes(t))).sort((x,y)=>y.tags.filter(t=>S0.tags.includes(t)).length-x.tags.filter(t=>S0.tags.includes(t)).length).map(c=>c.id);
    const ids=take(L,8);if(ids.length<3)return;
    h+=`<section class="dsec"><div class="sechead"><div><h2 class="t3">Because you saved <i>${esc(S0.title)}</i></h2><p class="why2">From other shelves, with the same feeling</p></div></div>
    <div class="hrow">${ids.map(id=>tile(id,CAT[id].tags.filter(t=>S0.tags.includes(t)).join(', '))).join('')}</div></section>`});
  // cross-media twins
  const twins=[];b.items.concat(R.slice(0,6).map(x=>x.id)).forEach(src=>{if(twins.length>=4)return;const s=CAT[src];
    const want=s.t==='book'?'film':'book';const m=Object.values(CAT).filter(c=>c.t===want&&!excl.has(c.id)&&c.id!==src&&!twins.some(t=>t[1]===c.id)).map(c=>[c.id,c.tags.filter(t=>s.tags.includes(t)).length]).sort((a,b2)=>b2[1]-a[1])[0];
    if(m&&m[1]>0)twins.push([src,m[0],want])});
  if(twins.length)h+=`<section class="dsec"><h2 class="t3">If it were a <i>book</i>, or a <i>film</i></h2><p class="why2" style="font-size:14px;color:var(--label2)">Twins across media</p>
    <div class="hrow">${twins.map(([a,b2,w])=>`<button class="pair" data-act="disc" data-id="${b2}"><span class="two">${cover(CAT[a])}${cover(CAT[b2])}<span class="eq glass">≈</span></span><span class="pc"><i>${esc(CAT[a].title)}</i>, as a ${w}</span></button>`).join('')}</div></section>`;
  // mixes
  const pt=Object.entries(S.profile).sort((x,y)=>y[1]-x[1]).map(x=>x[0]);const bt={};b.items.forEach(id=>CAT[id].tags.forEach(t=>bt[t]=(bt[t]||0)+1));
  const tags=[...new Set([...pt,...Object.entries(bt).sort((x,y)=>y[1]-x[1]).map(x=>x[0]),'calm','night','summer','travel'])].filter(t=>MIXN[t]);
  const mixes=tags.slice(0,4).map(t=>[t,mixItems(t,new Set(b.items))]).filter(m=>m[1].length>=4);
  if(mixes.length)h+=`<section class="dsec"><h2 class="t3">Your <i>mixes</i></h2><p class="why2">Small maps, ready to keep</p><div class="hrow">${mixes.map(m=>mixCard(m[0],m[1])).join('')}</div></section>`;
  // mood shelves
  tags.slice(4,7).forEach(t=>{const ids=take(R.filter(x=>CAT[x.id].tags.includes(t)).map(x=>x.id),8);if(ids.length<3)return;
    h+=`<section class="dsec"><h2 class="t3">Things that feel <i>${t}</i></h2><div class="hrow">${ids.map(id=>tile(id,TYPE[CAT[id].t])).join('')}</div></section>`});
  // missing type
  const have=new Set(b.items.map(id=>CAT[id].t)),miss=TYPES.find(t=>!have.has(t));
  if(miss){const ids=take(R.filter(x=>CAT[x.id].t===miss).map(x=>x.id),8);if(ids.length)h+=`<section class="dsec"><h2 class="t3">Your map has no <i>${PLURAL[miss].toLowerCase()}</i> yet</h2><p class="why2">A few that fit what’s already there</p><div class="hrow">${ids.map(id=>tile(id)).join('')}</div></section>`}
  // people
  const pk=Object.keys(PEOPLE).filter(k=>!S.follow[k]).concat(Object.keys(PEOPLE).filter(k=>S.follow[k])).slice(0,5);
  h+=`<section class="dsec"><div class="sechead"><h2 class="t3">From maps like <i>yours</i></h2><button class="tbtn sm" data-act="flist" data-v="following">See all</button></div>
    <div class="hrow">${pk.map(k=>{const p=PEOPLE[k],three=p.items.filter(i=>!onb.has(i)).slice(0,3);return `<button class="pcard" data-act="peek" data-u="${k}"><span class="three">${three.map(i=>cover(CAT[i])).join('')}</span><b>${p.board}</b><span>${p.h} · ${common(k)}</span></button>`}).join('')}</div></section>`;
  // outside your bubble
  const far=take(R.slice().reverse().map(x=>x.id),8);
  if(far.length)h+=`<section class="dsec"><h2 class="t3">Outside your <i>bubble</i></h2><p class="why2">Far from your usual. Might be your next favourite.</p><div class="hrow">${far.map(id=>tile(id,TYPE[CAT[id].t])).join('')}</div></section>`;
  h+=`<div class="endcard">${flower(40)}<h2>That’s everything<br><i>for this week.</i></h2><p class="sub">New suggestions arrive every Monday, shaped by what you keep.</p>
    <div class="row-actions"><button class="btn glass" data-act="surprise">Surprise me</button><button class="btn glass" data-act="bubbles">Bubbles</button></div></div>`;
  return fhdr(`<div class="sbox glass" id="sbox"><button class="sbtn" data-act="dsearch" aria-label="Search">${I.search}</button><label class="vh" for="dq">Search</label><input id="dq" type="search" placeholder="Films, music, books, style" autocomplete="off" tabindex="-1"><button class="sx" data-act="dsearchx" aria-label="Close search">${I.x}</button></div>`)+
  `<div class="sres" id="sres" hidden></div><div class="scroll under"><h1 class="lt" style="margin-top:8px">For you <i>this week</i></h1>
  <p class="sub" style="margin-top:8px">Shaped by ${esc(b.name)} and maps that overlap with it.</p>${h}</div>`;
}

/* ---------- bubble explorer ---------- */
let B=null;const BP={x:0,y:0};
function renderBubbles(){
  return `<div class="full"><div class="bfield" id="bfield" role="group" aria-label="All suggestions as bubbles"></div>
  <div class="fulltop"><button class="glass circ" data-act="unbubbles" aria-label="Close">${I.x}</button><span class="ttl">Everything for you</span><span style="width:44px"></span></div>
  <div class="fullhint glass">Drag to explore · tap a bubble</div></div>`;
}
function initBubbles(){
  const el=$('#bfield');if(!el)return;
  const b=cur(),excl=new Set([...S.boards.flatMap(x=>x.items),...b.dismissed]),L=rank(b.items,excl,S.pin);
  const sp=104,pos=[[0,0]];
  for(let ring=1;pos.length<L.length;ring++){let q=ring,r=0;const dirs=[[-1,1],[-1,0],[0,-1],[1,-1],[1,0],[0,1]];
    for(let d=0;d<6;d++)for(let s=0;s<ring;s++){pos.push([q,r]);q+=dirs[d][0];r+=dirs[d][1]}}
  const pts=L.map((x,i)=>{const [q,r]=pos[i];return{id:x.id,x:sp*(q+r/2),y:sp*.866*r}});
  el.innerHTML=pts.map((p,i)=>`<button class="bb" data-i="${i}" aria-label="${esc(CAT[p.id].title)}, ${TYPE[CAT[p.id].t]}">${cover(CAT[p.id],'round')}</button>`).join('');
  const els=[...el.children];
  B={raf:0,vx:0,vy:0,drag:null};
  const W=()=>el.clientWidth,H=()=>el.clientHeight;
  el.onpointerdown=e=>{try{el.setPointerCapture(e.pointerId)}catch(_){}const t=e.target.closest('.bb');B.drag={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:0,i:t?+t.dataset.i:-1,lt:performance.now()};B.vx=B.vy=0};
  el.onpointermove=e=>{const D=B.drag;if(!D)return;const sc=el.getBoundingClientRect().width/el.clientWidth||1;const dx=(e.clientX-D.lx)/sc,dy=(e.clientY-D.ly)/sc;
    BP.x+=dx;BP.y+=dy;D.moved=Math.max(D.moved,Math.hypot(e.clientX-D.sx,e.clientY-D.sy));const now=performance.now(),dt=Math.max(1,now-D.lt);B.vx=dx*16/dt;B.vy=dy*16/dt;D.lx=e.clientX;D.ly=e.clientY;D.lt=now};
  const up=()=>{const D=B.drag;B.drag=null;if(D&&D.moved<6&&D.i>=0){B.vx=B.vy=0;S.addTo=S.cur;discSheet(pts[D.i].id)}};
  el.onpointerup=up;el.onpointercancel=up;
  el.onkeydown=e=>{const t=e.target.closest&&e.target.closest('.bb');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();S.addTo=S.cur;discSheet(pts[+t.dataset.i].id)}};
  const step=()=>{
    if(!B.drag){BP.x+=B.vx;BP.y+=B.vy;B.vx*=.93;B.vy*=.93}
    const w=W(),hh=H(),cx=w/2,cy=hh/2,R=Math.min(w,hh)*.62;
    pts.forEach((p,i)=>{let x=p.x+BP.x+cx,y=p.y+BP.y+cy;const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
      const t=Math.min(1,d/R),s=Math.max(.32,1-t*t*.7);const pull=.82+.18*s;x=cx+dx*pull;y=cy+dy*pull;
      const st=els[i].style;st.transform=`translate(${f(x-48)}px,${f(y-48)}px) scale(${s.toFixed(3)})`;st.opacity=d>R*1.6?0:1;st.zIndex=Math.round(s*100)});
    B.raf=requestAnimationFrame(step)};
  step();
}
function renderDiscoverOld(){
  const b=cur(),L=discoverList(),slots=[[120,135,78],[270,92,52],[276,228,44],[68,262,40],[178,262,28],[34,44,24]];
  const topi=b.items.slice(0,2).map(id=>CAT[id].title);
  let s='';L.forEach((x,i)=>{const c=CAT[x.id],[cx,cy,R]=slots[i];const fs=Math.max(10,Math.min(16,R/4.4));const maxc=Math.floor(R*1.8/(fs*.58));
    s+=`<g class="node" role="button" tabindex="0" data-act="disc" data-id="${x.id}" aria-label="${esc(c.title)}, ${TYPE[c.t]}"><g transform="translate(${cx},${cy})"><g class="bloom" style="--d:${i*.08}s">
      <circle r="${R}" fill="var(--${c.t})" fill-opacity=".08" stroke="var(--${c.t})" stroke-opacity=".6" stroke-width="1"/>
      <g transform="translate(0,${f(R>30?-R*.2:-R*.1)})">${glyph(c.t,Math.max(4.5,R*.15))}</g>
      ${R>=24?`<text y="${f(R*.3)}" text-anchor="middle" font-family="var(--serif)" font-size="${f(fs+1)}" fill="var(--label)">${esc(trunc(c.title,maxc))}</text>`:''}
      ${R>=50?`<text y="${f(R*.3+fs+4)}" text-anchor="middle" font-size="12" fill="var(--label2)">${TYPE[c.t]}${x.forced?' · Picked for you':''}</text>`:''}</g></g>
      ${R<24?`<text x="${cx+R+7}" y="${cy+4}" font-size="12" font-weight="600" fill="var(--label)">${esc(trunc(c.title,12))}</text>`:''}</g>`});
  const field=`<svg viewBox="0 0 336 316" aria-label="Recommendations" role="group">${s}<text x="320" y="302" text-anchor="end" font-size="12" fill="var(--label2)">Bigger means a stronger match</text></svg>`;
  const ppl=['mina','dohyun','seoy'].map(k=>{const p=PEOPLE[k];return `<button class="card" data-act="peek" data-u="${k}"><div class="mini">${miniSVG(p.items)}</div><b>${p.board}</b><span>${p.h} · ${common(k)}</span></button>`}).join('');
  return hdr(logo(),`<button class="glass circ" data-act="add" aria-label="Search">${I.search}</button>`)+
  `<div class="scroll"><h1 class="lt" style="margin-top:8px">For you <i>this week</i></h1>
  <p class="sub" style="margin-top:8px">${topi.length>1?`Because ${esc(topi[0])} and ${esc(topi[1])} are on ${esc(b.name)}.`:topi.length?`Because ${esc(topi[0])} is on ${esc(b.name)}.`:'Based on your answers. Save a few things and these get sharper.'}</p>
  <div style="margin-top:24px">${segc('dfilt',S.dfilt,[['all','All'],...TYPES.map(t=>[t,PLURAL[t]])],'Filter by type')}</div>
  <div class="field">${L.length?field:'<p class="sub" style="padding:48px 24px;text-align:center">Nothing left in this category. Try another.</p>'}</div>
  <div class="sechead"><h2 class="t3">Maps like yours</h2><button class="tbtn sm" data-act="flist" data-v="following">See all</button></div>
  <div class="cards">${ppl}</div></div>`;
}
const following=()=>Object.keys(S.follow).filter(k=>S.follow[k]&&PEOPLE[k]);
function renderAccount(){
  const M=S.me,total=S.boards.reduce((s,x)=>s+x.items.length,0),linked=ACC.filter(a=>S.links[a.k]).length;
  const row=(act,label,val,extra)=>`<button class="li" data-act="${act}" ${extra||''}><span class="m"><b>${label}</b></span><span class="v">${val||''} ${I.chev}</span></button>`;
  return fhdr(`<button class="glass circ" data-act="settings" aria-label="Settings">${I.gear}</button>`)+
  `<div class="scroll under">
  <div class="acc-top"><span class="av big" aria-hidden="true">${esc(M.name.trim()[0]||'Y').toUpperCase()}</span>
    <div class="stats"><div class="stat"><b>${S.boards.length}</b><span>Maps</span></div>
      <button class="stat" data-act="flist" data-v="followers"><b>${FOLLOWERS.length}</b><span>Followers</span></button>
      <button class="stat" data-act="flist" data-v="following"><b>${following().length}</b><span>Following</span></button></div></div>
  <h1 class="lt" style="font-size:28px;margin-top:20px">${esc(M.name)}</h1>
  <p class="sub" style="margin-top:2px">${esc(M.handle)} · ${total} saves</p>
  <p class="body" style="margin-top:10px">${esc(M.bio)}</p>
  <div class="row-actions" style="margin-top:20px"><button class="btn glass" style="height:44px;font-size:15px" data-act="editprof">Edit profile</button><button class="btn glass" style="height:44px;font-size:15px" data-act="toast" data-msg="Profile link copied">Share profile</button></div>
  <div class="ghead">Your maps</div>
  <div class="group">${S.boards.map((b,i)=>`<button class="li ind" data-act="openboard" data-i="${i}"><span class="tile" style="background:var(--bg)">${b.items.length?icon(CAT[b.items[0]].t,22):flower(22)}</span><span class="m"><b style="font-family:var(--serif);font-style:italic;font-size:19px;font-weight:400">${esc(b.name)}</b><span>${b.items.length} saves · ${VISL[vis(b)]}</span></span><span class="v">${I.chev}</span></button>`).join('')}</div>
  <div class="ghead">Settings</div>
  <div class="group">${row('settings','Privacy',VISL[S.priv.profile])}${row('settings','Linked accounts',linked+' linked')}${row('redoquiz','Taste questions','Answer again')}${row('toast','Notifications','','data-msg="Notifications aren’t part of this prototype"')}${row('toast','Help and feedback','','data-msg="Thanks! Tell the facilitator anything you noticed."')}</div>
  <p class="fine" style="margin-top:32px">um!x prototype · for user testing</p></div>`;
}
function personRow(k,mode){const p=PEOPLE[k],f=!!S.follow[k];
  return `<div class="li"><span class="av">${p.h[1].toUpperCase()}</span>
    <button class="m" data-act="peek" data-u="${k}" style="border:0;background:none;padding:0;text-align:left"><b>${p.h}</b><span><i style="font-family:var(--serif);font-size:15px;color:var(--label)">${p.board}</i> · ${common(k)}</span></button>
    <button class="tbtn sm" data-act="follow" data-u="${k}" aria-pressed="${f}" style="${f?'color:var(--label2)':''}">${f?'Following':mode==='followers'?'Follow back':'Follow'}</button></div>`}
function renderFollowList(){
  const F=S.flist,fl=following(),sugg=Object.keys(PEOPLE).filter(k=>!S.follow[k]);
  const L=F==='followers'?FOLLOWERS:fl;
  return hdr(backBtn('unflist'))+`<div class="scroll"><p class="fn" style="margin-top:8px;font-size:14px">${esc(S.me.handle)}</p><h1 class="lt" style="margin-top:2px">${F==='followers'?'Followers':'Following'}</h1>
  <div style="margin-top:20px">${segc('flseg',F,[['followers',`${FOLLOWERS.length} Followers`],['following',`${fl.length} Following`]],'Followers or following')}</div>
  ${L.length?`<div class="group" style="margin-top:20px">${L.map(k=>personRow(k,F)).join('')}</div>`:`<p class="sub" style="margin-top:28px;text-align:center">You’re not following anyone yet.</p>`}
  ${F==='following'&&sugg.length?`<div class="ghead">Maps like yours</div><div class="group">${sugg.map(k=>personRow(k)).join('')}</div><p class="gfoot">People whose maps overlap with yours. You see their maps, never a feed.</p>`:''}</div>`;
}
function openProfSheet(){
  sheet(`<div class="shead"><div class="t"><h2 style="margin:0">Edit profile</h2></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <label class="flabel" for="pname">Name</label><input class="inp" id="pname" value="${esc(S.me.name)}" autocomplete="off">
  <label class="flabel" for="phandle">Username</label><input class="inp" id="phandle" value="${esc(S.me.handle)}" autocomplete="off">
  <label class="flabel" for="pbio">Bio</label><textarea class="inp" id="pbio" rows="3">${esc(S.me.bio)}</textarea>
  <div class="row-actions"><button class="btn glass" data-act="close">Cancel</button><button class="btn prim" data-act="saveprof">Save</button></div>`);
}
function renderPeek(){
  const k=S.viewing,p=PEOPLE[k];
  return hdr(backBtn('unpeek'),`<button class="glass btn" style="height:44px;font-size:15px;padding:0 18px" data-act="follow" data-u="${k}" aria-pressed="${!!S.follow[k]}">${S.follow[k]?'Following':'Follow'}</button>`)+
  `<div class="scroll"><p class="fn" style="margin-top:8px;font-size:14px">${p.h}’s map</p><h1 class="lt" style="margin-top:4px"><i>${p.board}</i></h1>
  <p class="sub" style="margin-top:6px">${common(k)}. Tap anything to save it to your own map.</p>
  <div class="map">${mapSVG(p.items,[],{peek:true,center:p.h.slice(1,2).toUpperCase()+p.h.slice(2).split('.')[0]})}</div></div>`;
}
function renderSettings(){
  const P=S.priv,priv=P.profile==='only me';
  const radio=(k,v,l,sub)=>`<button class="li" data-act="pv" data-k="${k}" data-v="${v}" role="radio" aria-checked="${P[k]===v}"><span class="m"><b>${l}</b>${sub?`<span>${sub}</span>`:''}</span>${P[k]===v?`<span class="check">${I.check}</span>`:''}</button>`;
  const sw=(k,l,sub,dis)=>`<div class="li"><span class="m"><b id="sw-${k}">${l}</b><span>${sub}</span></span><button class="switch" role="switch" aria-labelledby="sw-${k}" aria-checked="${!!P[k]&&!dis}" data-act="pswitch" data-k="${k}" ${dis?'disabled':''}></button></div>`;
  return hdr(backBtn('unsettings'))+
  `<div class="scroll" style="padding-bottom:48px"><h1 class="lt" style="margin-top:8px">Privacy</h1>
  <p class="sub" style="margin-top:8px">Choose who sees your maps, and how your saves help other people find things.</p>
  <div class="ghead">Who can see your profile</div>
  <div class="group">${radio('profile','public','Everyone')}${radio('profile','followers','Followers')}${radio('profile','only me','Only me')}</div>
  <div class="ghead">Each map</div>
  <div class="group">${S.boards.map((b,i)=>`<button class="li" data-act="bvismenu" data-i="${i}" ${priv?'disabled':''} aria-haspopup="menu"><span class="m"><b>${esc(b.name)}</b><span>${b.items.length} saves</span></span><span class="v">${VISL[vis(b)]} ${priv?'':I.chev}</span></button>`).join('')}</div>
  <p class="gfoot">${priv?'Your profile is private, so every map is private too.':'A map set to Only me never shows on your profile.'}</p>
  <div class="ghead">Helping other people’s suggestions</div>
  <div class="group">${radio('share','named','With my name','Others may see “saved by you” on a suggestion')}${radio('share','anon','Anonymously','Your saves count, but nobody sees they came from you')}${radio('share','off','Don’t use my maps','Your saves never shape anyone else’s suggestions')}</div>
  <p class="gfoot">When your maps overlap with someone else’s, the things you saved together can become their suggestions.</p>
  <div class="ghead">Being found</div>
  <div class="group">${sw('rhyme','Show me in Maps like yours','People with similar maps can see yours in Discover',priv)}${sw('quiz','Use my setup answers','Your either/or answers shape your own suggestions')}</div>
  <div class="ghead">Linked accounts</div>
  <div class="group">${ACC.map(a=>`<button class="li ind" data-act="link" data-k="${a.k}" aria-pressed="${!!S.links[a.k]}"><span class="tile" style="background:var(--bg)">${icon(a.t,24)}</span><span class="m"><b>${a.name}</b><span>${S.links[a.k]?'Syncing new saves':'Not linked'}</span></span><span class="v" style="color:${S.links[a.k]?'var(--label2)':'var(--tint)'}">${S.links[a.k]?'Unlink':'Link'}</span></button>`).join('')}</div>
  <p class="fine" style="margin-top:32px">Prototype. These settings only change what this page shows.</p></div>`;
}

/* ---------- sheets & menus ---------- */
function sheet(html,tall){const w=$('#sheetWrap');w.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet${tall?' tall':''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;w.hidden=false;
  const fb=w.querySelector('.sheet input,.sheet button');fb&&setTimeout(()=>fb.focus({preventScroll:true}),60)}
function closeSheet(){const w=$('#sheetWrap');w.hidden=true;w.innerHTML=''}
function menu(anchor,items){
  const w=$('#menuWrap'),pr=$('#phone').getBoundingClientRect(),ar=anchor.getBoundingClientRect(),sc=pr.width/$('#phone').offsetWidth||1;
  const pw=$('#phone').offsetWidth,left=Math.max(16,Math.min((ar.left-pr.left)/sc,pw-256)),topp=(ar.bottom-pr.top)/sc+8;
  w.innerHTML=`<div class="scrim" data-act="closemenu"></div><div class="menu" role="menu" style="left:${f(left)}px;top:${f(topp)}px">${items.map(it=>it==='-'?'<hr>':
    `<button role="menuitemradio" aria-checked="${!!it.on}" data-act="${it.act}" ${Object.entries(it.data||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}><span class="ck">${it.on?I.check:''}</span>${esc(it.label)}</button>`).join('')}</div>`;
  w.hidden=false;const fb=w.querySelector('.menu button');fb&&fb.focus({preventScroll:true});
}
function closeMenu(){const w=$('#menuWrap');w.hidden=true;w.innerHTML=''}
const head=(c,k,sugg)=>`<div class="shead">${c.real?`<div style="width:72px;flex-shrink:0">${cover(c)}</div>`:`<div class="bigtile${sugg?' sugg':''}">${icon(c.t,sugg?40:46,sugg)}</div>`}
  <div class="t"><div class="k">${k}</div><h2>${esc(c.title)}</h2><div class="by">${esc(c.by)} · ${TYPE[c.t]}</div></div></div>`;
function itemSheet(id){
  const c=CAT[id],b=cur();const conn=b.items.filter(x=>x!==id&&CAT[x].tags.some(t=>c.tags.includes(t))).map(x=>CAT[x].title);
  sheet(head(c,'On '+esc(b.name))+`<dl class="kv">${c.genres&&c.genres.length?`<dt>Genres</dt><dd>${c.genres.map(esc).join(', ')}</dd>`:''}<dt>Feels</dt><dd>${c.tags.length?c.tags.join(', '):'Not known yet. The map learns this from other people’s maps.'}</dd>
  <dt>Connected on this map to</dt><dd>${conn.length?conn.map(esc).join(', '):'Nothing yet. Add more and lines appear.'}</dd></dl>
  <div class="row-actions"><button class="btn glass" data-act="remove" data-id="${id}">Remove</button><button class="btn prim" data-act="close">Done</button></div>`);
}
function hunchSheet(id){
  const x=hunches(cur()).find(h=>h.id===id)||rank(cur().items,new Set(),[]).find(h=>h.id===id);const c=CAT[id];
  sheet(head(c,'Suggestion',true)+`<p class="why">${esc(why(x))}</p>${conf(x.s)}
  <div class="row-actions"><button class="btn glass" data-act="dismiss" data-id="${id}">Not for me</button><button class="btn prim" data-act="keep" data-id="${id}">Keep it</button></div>`);
}
function discSheet(id){
  const all=new Set(S.boards.flatMap(b=>b.items));const x=rank(cur().items,all,S.pin).find(h=>h.id===id)||{s:.5,from:null,shared:[]};const c=CAT[id];
  sheet(`<div class="shead"><div style="width:96px;flex-shrink:0">${cover(c)}</div><div class="t"><div class="k">For you</div><h2>${esc(c.title)}</h2><div class="by">${esc(c.by)} · ${TYPE[c.t]}</div></div></div>`+`<p class="why">${esc(why(x))}</p>${conf(x.s)}
  <p class="slabel">Add to</p><div class="group" style="margin-top:10px">${S.boards.map((b,i)=>`<button class="li" data-act="pickboard" data-i="${i}" data-id="${id}" role="radio" aria-checked="${i===S.addTo}"><span class="m"><b>${esc(b.name)}</b></span>${i===S.addTo?`<span class="check">${I.check}</span>`:''}</button>`).join('')}</div>
  <div class="row-actions"><button class="btn glass" data-act="dskip" data-id="${id}">Not for me</button><button class="btn prim" data-act="dadd" data-id="${id}">Add to map</button></div>`);
}
function peekSheet(id){
  const c=CAT[id],p=PEOPLE[S.viewing],has=cur().items.includes(id);
  sheet(head(c,'On '+p.h+'’s map')+`<dl class="kv"><dt>Feels</dt><dd>${c.tags.join(', ')}</dd></dl>
  <div class="row-actions"><button class="btn glass" data-act="close">Close</button><button class="btn prim" data-act="addit" data-id="${id}" ${has?'disabled':''}>${has?'Already saved':'Save to my map'}</button></div>`);
}
function addSheet(){
  const b=cur();const sug=hunches(b,4);
  sheet(`<div class="shead"><div class="t"><div class="k">Add to</div><h2 style="margin:4px 0 0">${esc(b.name)}</h2></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <label class="search"><span style="color:var(--label2);display:grid">${I.search}</span><span class="vh">Search</span><input id="q" type="search" placeholder="Artists, films, brands, books" autocomplete="off" value="${esc(S.aq)}"></label>
  <p class="slabel">Suggested for this map</p>
  <div class="sugs">${sug.map(x=>{const c=CAT[x.id];return `<button class="sug" data-act="addsug" data-id="${x.id}" aria-label="Add ${esc(c.title)}">${icon(c.t,28)}<b>${esc(c.title)}</b><span>${x.because?(x.because.tag?'Fits '+esc(x.because.name):'Goes with '+esc(x.because.name)):x.from?'Goes with '+esc(CAT[x.from].title):'From your answers'}</span></button>`}).join('')||'<p class="sub">Loading the taste model…</p>'}</div>
  <div id="addSeg" style="margin-top:28px"></div><div id="addList" style="margin-top:8px"></div>`,true);
  fillAdd();
}
function fillAdd(){
  const b=cur(),q=S.aq.trim().toLowerCase();
  $('#addSeg').innerHTML=segc('atype',S.atype,[['all','All'],...TYPES.map(t=>[t,PLURAL[t]])],'Filter by type');
  // music, film and style come from the model's catalogue; books, images and things people typed in are the prototype's own
  const all=S.atype==='all',layers=all?REAL:REAL.filter(L=>L===S.atype),raw=S.aq.trim();
  const realIds=R.ready()?layers.flatMap(L=>(raw.length>=2?R.search(L,raw,all?5:15):R.popular(L,all?4:15)).map(addReal)):[];
  const own=Object.values(CAT).filter(c=>!c.real&&(['book','image'].includes(c.t)||S.custom.some(x=>x.id===c.id))&&(all||c.t===S.atype)&&(!q||(c.title+' '+c.by).toLowerCase().includes(q)));
  const L=[...realIds.map(id=>CAT[id]),...own];
  const art=c=>c.real?`<span style="width:44px;flex-shrink:0">${cover(c)}</span>`:`<span class="tile" style="background:var(--bg2)">${icon(c.t,26)}</span>`;
  let h=(!R.ready()&&layers.length?'<p class="sub" style="margin:12px 0">Loading the taste model…</p>':'')+L.slice(0,40).map(c=>`<div class="irow">${art(c)}<div class="m"><b>${esc(c.title)}</b><span>${esc(c.by)} · ${TYPE[c.t]}</span></div>
    ${b.items.includes(c.id)?'<span class="added">Added</span>':`<button class="glass circ" style="width:36px;height:36px" data-act="addit" data-id="${c.id}" aria-label="Add ${esc(c.title)}">${I.plus}</button>`}</div>`).join('');
  if(q&&!L.length)h=`<p class="sub" style="margin:20px 0 12px">Nothing called “${esc(S.aq)}” yet. Add it anyway as a:</p><div class="group">${TYPES.map(t=>`<button class="li ind" data-act="addcustom" data-t="${t}"><span class="tile" style="background:var(--bg)">${icon(t,24)}</span><span class="m"><b>${TYPE[t]}</b></span><span class="v">${I.chev}</span></button>`).join('')}</div>`;
  $('#addList').innerHTML=h;
}

function newMapSheet(){
  sheet(`<div class="shead"><div class="t"><h2 style="margin:0">New map</h2></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <p class="sub" style="margin-top:8px">A map for one side of you. Answer a few questions and add what you love, and the model draws it.</p>
  <label class="flabel" for="nmname">Name</label><input class="inp" id="nmname" placeholder="New map ${S.boards.length-1}" autocomplete="off">
  <div class="row-actions"><button class="btn glass" data-act="newmap" data-v="empty">Start empty</button><button class="btn prim" data-act="newmap" data-v="flow">Continue</button></div>`);
}

/* ---------- actions ---------- */
let toastT;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2200)}
/** a real item as the test log wants it */
const logItem=id=>{const r=realOf(id);return {layer:r.layer,id:r.id,name:CAT[id].title}};
/** adds to a map. via is 'you' (added it) or 'pick' (kept a suggestion), from is the screen, for the test log */
function addTo(bi,id,via='you',from='add'){
  const b=S.boards[bi];if(b.items.includes(id))return;
  const before=new Set(hunches(b).map(h=>h.id)),r=realOf(id);
  if(r){if(via==='pick')R.log('keep',b,logItem(id),from,quizOn());
    const ins=b.real.inputs[r.layer];if(!ins.some(x=>x.id===r.id))ins.push({id:r.id,src:r.src,via});
    b.real.skipped[r.layer]=b.real.skipped[r.layer].filter(x=>x!==r.id)}
  b.dismissed=b.dismissed.filter(x=>x!==id);
  b.items.push(id);b.forced=b.forced.filter(x=>x!==id);S.pin=S.pin.filter(x=>x!==id);
  const nw=hunches(b).filter(h=>!before.has(h.id)).length;
  if(bi===S.cur)S.newId=id;
  toast(`Added to ${b.name}`+(nw?` · ${nw} new suggestion${nw>1?'s':''}`:''));
}
/** draws the map once the model is in (and the drawing has played): the first map, a new one, or new answers */
function startBuilding(){
  S.step='building';render();
  const msgs=['Reading your saves…','Finding what goes together…',()=>`Comparing with ${(R.people()||105526).toLocaleString('en-US')} people’s real saves…`];let i=0;
  const iv=setInterval(()=>{i++;const el=$('#bmsg'),m=msgs[i];if(el&&m)el.textContent=typeof m==='function'?m():m},800);
  Promise.all([R.load().then(()=>true,e=>{console.warn('um!x: the model did not load',e);return false}),new Promise(r=>setTimeout(r,2700))]).then(([ok])=>{
    clearInterval(iv);if(S.step!=='building')return;
    let msg;
    if(S.redo&&S.boards.length){buildProfile();redoQuiz(S.boards[0]);S.redo=false;msg='Your answers are updated'}
    else if(S.creating){buildProfile();S.boards.push(makeBoard(S.creating.name,false));S.cur=S.boards.length-1;S.addTo=S.cur;S.creating=null;msg='Your new map is ready'}
    else{seedBoards();msg='Your first map is ready'}
    S.draft={music:[],film:[],style:[]};S.pq='';S.answers=[];S.step='app';S.tab='board';S.full=false;S.settings=false;render();
    toast(ok?msg:'The taste model didn’t load, so there are no suggestions yet');
  });
}
/** Answer again: the quiz's part of the first map is swapped for the new answers */
function redoQuiz(b){
  if(!b.real||!R.ready())return;
  REAL.forEach(L=>{b.real.inputs[L].filter(x=>x.via==='quiz'&&x.src!=='tag').forEach(x=>{b.items=b.items.filter(id=>id!==`${L}/${x.id}`)});
    b.real.inputs[L]=b.real.inputs[L].filter(x=>x.via!=='quiz')});
  quizInputs().forEach(x=>{const it=x.src==='tag'?R.genre(x.layer,x.id):R.find(x.layer,x.id);if(!it||b.real.inputs[x.layer].some(v=>v.id===it.id))return;
    b.real.inputs[x.layer].push({id:it.id,src:it.src,via:'quiz'});if(x.src!=='tag'&&!b.items.includes(rid(it)))b.items.push(addReal(it))});
}
function go(to){
  if(['welcome','connect','quiz'].includes(to)){S.step=to;if(to==='quiz')S.qi=0;render();return}
  if(!S.boards.length)seedBoards();
  S.step='app';S.viewing=null;S.flist=null;S.settings=to==='settings';S.tab=to==='discover'?'discover':'board';render();
}
function next(){if(S.qi<QS.length-1){S.qi++;render()}else if(S.redo)startBuilding();else{S.step='search';render()}}
/** leaves the questions or the search step without making a map */
function cancelCreate(){S.creating=null;S.redo=false;S.draft={music:[],film:[],style:[]};S.pq='';S.answers=[];S.step='app';render()}
function toggleWiz(on){const w=$('#wiz');w.hidden=on===undefined?!w.hidden:!on;
  if(!w.hidden)$('#wzItem').innerHTML=TYPES.map(t=>`<optgroup label="${PLURAL[t]}">${Object.values(CAT).filter(c=>c.t===t).map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</optgroup>`).join('')}
function resetAll(){try{localStorage.removeItem(KEY)}catch(e){}S.custom.forEach(c=>delete CAT[c.id]);S=fresh();closeSheet();closeMenu();render();toast('Back to the start')}

let taps=[];
function act(el){
  const a=el.dataset.act,id=el.dataset.id;
  if(el.closest('.menu'))closeMenu();
  switch(a){
    case 'wm':{const now=Date.now();taps=taps.filter(t=>now-t<700);taps.push(now);if(taps.length>=3){taps=[];toggleWiz()}return}
    case 'go':return go(el.dataset.to);
    case 'link':S.links[el.dataset.k]=!S.links[el.dataset.k];return render();
    case 'qback':if(S.qi>0){S.qi--;render()}else if((S.creating||S.redo)&&S.boards.length)cancelCreate();else go('connect');return;
    case 'pback':S.step='quiz';S.qi=QS.length-1;return render();
    case 'pdone':return startBuilding();
    case 'ptab':S.ptab=el.dataset.v;S.pq='';return render();
    case 'ptoggle':{const L=el.dataset.l,pid=el.dataset.id,box=$('#pickList'),st=box?box.scrollTop:0;
      S.draft[L]=inDraft(L,pid)?S.draft[L].filter(x=>x.id!==pid):[...S.draft[L],{id:pid,src:el.dataset.src}];
      render();const nb=$('#pickList');if(nb)nb.scrollTop=st;return}
    case 'pick':{if(S.picking)return;const v=el.dataset.v;S.answers[S.qi]=v==='skip'?null:v;
      if(v==='skip'){next();return}S.picking=true;render();setTimeout(()=>{S.picking=false;next()},650);return}
    case 'tab':S.tab=el.dataset.t;S.viewing=null;S.settings=false;S.full=false;S.flist=null;S.bubbles=false;closeSheet();return render();
    case 'flist':S.flist=el.dataset.v;S.viewing=null;return render();
    case 'flseg':S.flist=el.dataset.v;return render();
    case 'unflist':S.flist=null;return render();
    case 'openboard':S.cur=+el.dataset.i;S.addTo=S.cur;S.tab='board';S.flist=null;return render();
    case 'editprof':return openProfSheet();
    case 'saveprof':{const n=$('#pname').value.trim(),hd=$('#phandle').value.trim(),bi=$('#pbio').value.trim();
      if(n)S.me.name=n;if(hd)S.me.handle=hd[0]==='@'?hd:'@'+hd;S.me.bio=bi;closeSheet();render();return toast('Profile saved')}
    case 'redoquiz':S.redo=true;S.creating=null;S.answers=[];S.step='quiz';S.qi=0;S.settings=false;return render();
    case 'full':S.full=true;return render();
    case 'unfull':S.full=false;return render();
    case 'boardmenu':return menu(el,[...S.boards.map((b,i)=>({label:b.name,act:'board',data:{i},on:i===S.cur})),'-',{label:'New map',act:'newboard'}]);
    case 'board':S.cur=+el.dataset.i;S.addTo=S.cur;return render();
    case 'newboard':return newMapSheet();
    case 'newmap':{const name=($('#nmname').value.trim()||$('#nmname').placeholder);closeSheet();
      if(el.dataset.v==='empty'){S.boards.push({name,items:[],dismissed:[],forced:[],real:R.emptyReal()});S.cur=S.boards.length-1;S.addTo=S.cur;render();return toast('New map. Start with a suggestion.')}
      S.creating={name};S.redo=false;S.answers=[];S.qi=0;S.draft={music:[],film:[],style:[]};S.pq='';S.ptab='music';S.step='quiz';S.full=false;return render()}
    case 'item':return itemSheet(id);
    case 'hunch':return hunchSheet(id);
    case 'keep':closeSheet();addTo(S.cur,id,'pick',S.full?'map-explore':'map');return render();
    case 'dismiss':{const r=realOf(id),b=cur();if(r){R.log('skip',b,logItem(id),S.full?'map-explore':'map',quizOn());b.real.skipped[r.layer].push(r.id)}}
      cur().dismissed.push(id);cur().forced=cur().forced.filter(x=>x!==id);closeSheet();render();return toast('Got it. We’ll stop suggesting that.');
    case 'remove':{const b=cur(),r=realOf(id);
      if(r){const x=b.real.inputs[r.layer].find(v=>v.id===r.id);if(x&&x.via==='pick')R.log('remove',b,logItem(id),'map',quizOn());
        b.real.inputs[r.layer]=b.real.inputs[r.layer].filter(v=>v.id!==r.id);b.real.skipped[r.layer].push(r.id)}
      b.items=b.items.filter(x=>x!==id);b.dismissed.push(id);closeSheet();render();return toast('Removed from '+b.name)}
    case 'add':S.aq='';S.atype='all';return addSheet();
    case 'atype':S.atype=el.dataset.v;return fillAdd();
    case 'addit':closeSheet();addTo(S.cur,id);return render();
    case 'addsug':closeSheet();addTo(S.cur,id,'pick','add-suggested');return render();
    case 'addcustom':{const cid='c'+Date.now(),c={id:cid,t:el.dataset.t,title:S.aq.trim(),by:'Added by you',tags:[]};S.custom.push(c);CAT[cid]=c;closeSheet();addTo(S.cur,cid);return render()}
    case 'dfilt':S.dfilt=el.dataset.v;return render();
    case 'disc':S.addTo=S.cur;return discSheet(id);
    case 'dsearch':return openSearch(true);
    case 'dsearchx':return openSearch(false);
    case 'bubbles':S.bubbles=true;closeSheet();return render();
    case 'unbubbles':S.bubbles=false;return render();
    case 'mix':return mixSheet(el.dataset.v);
    case 'savemix':{const t=el.dataset.v,items=mixItems(t,new Set(cur().items));S.boards.push({name:MIXN[t]||t,items,dismissed:[],forced:[],real:R.emptyReal()});S.cur=S.boards.length-1;S.addTo=S.cur;closeSheet();S.tab='board';S.bubbles=false;render();return toast('Saved as a new map')}
    case 'surprise':{const ex=new Set([...S.boards.flatMap(b=>b.items),...cur().dismissed]),pool=Object.values(CAT).filter(c=>!ex.has(c.id));if(pool.length){S.addTo=S.cur;discSheet(pool[Math.floor(Math.random()*pool.length)].id)}return}
    case 'pickboard':S.addTo=+el.dataset.i;return discSheet(id);
    case 'dadd':closeSheet();addTo(S.addTo,id);return render();
    case 'dskip':cur().dismissed.push(id);S.pin=S.pin.filter(x=>x!==id);closeSheet();render();return toast('Skipped');
    case 'peek':S.viewing=el.dataset.u;closeSheet();return render();
    case 'unpeek':S.viewing=null;return render();
    case 'peek-item':return peekSheet(id);
    case 'follow':{const k=el.dataset.u;S.follow[k]=!S.follow[k];render();return toast(S.follow[k]?'Following '+PEOPLE[k].h:'Unfollowed')}
    case 'settings':S.settings=true;closeSheet();return render();
    case 'unsettings':S.settings=false;return render();
    case 'pv':S.priv[el.dataset.k]=el.dataset.v;return render();
    case 'bvismenu':{const i=+el.dataset.i,b=S.boards[i];return menu(el,['public','followers','only me'].map(v=>({label:VISL[v],act:'bvis',data:{i,v},on:(b.vis||'public')===v})))}
    case 'bvis':S.boards[+el.dataset.i].vis=el.dataset.v;return render();
    case 'pswitch':S.priv[el.dataset.k]=!S.priv[el.dataset.k];return render();
    case 'toast':return toast(el.dataset.msg);
    case 'close':return closeSheet();
    case 'closemenu':return closeMenu();
    case 'hardreset':{const btn=$('#resetBtn'),sp=btn.querySelector('span');
      if(!btn.classList.contains('armed')){btn.classList.add('armed');sp.textContent='Tap again to reset';clearTimeout(btn._t);btn._t=setTimeout(()=>{btn.classList.remove('armed');sp.textContent='Reset prototype'},3000);return}
      clearTimeout(btn._t);btn.classList.remove('armed');sp.textContent='Reset prototype';toggleWiz(false);return resetAll()}
    case 'wz-close':return toggleWiz(false);
    case 'wz-jump':closeSheet();closeMenu();S.settings=false;S.full=false;return go(el.dataset.to);
    case 'wz-board':{if(!S.boards.length)seedBoards();const v=$('#wzItem').value,b=cur();if(b.items.includes(v))return toast('Already on this map');
      b.dismissed=b.dismissed.filter(x=>x!==v);b.forced=[v,...b.forced.filter(x=>x!==v)];S.step='app';S.viewing=null;S.settings=false;S.tab='board';return render()}
    case 'wz-disc':{if(!S.boards.length)seedBoards();const v=$('#wzItem').value;S.pin=[v,...S.pin.filter(x=>x!==v)];S.dfilt='all';S.step='app';S.viewing=null;S.settings=false;S.tab='discover';return render()}
    case 'wz-undismiss':S.boards.forEach(b=>b.dismissed=[]);render();return toast('Skipped suggestions are back');
  }
}

document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(el&&!el.disabled)act(el)});
document.addEventListener('keydown',e=>{
  if(e.key==='`'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();toggleWiz();return}
  if(e.key==='Escape'){if($('#sbox')&&$('#sbox').classList.contains('open')&&$('#sheetWrap').hidden){openSearch(false);return}if(!$('#menuWrap').hidden)closeMenu();else if(!$('#sheetWrap').hidden)closeSheet();else if(!$('#wiz').hidden)toggleWiz(false);return}
  const el=e.target.closest&&e.target.closest('[data-act][role="button"]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();act(el)}});
document.addEventListener('input',e=>{if(e.target.id==='pq'){S.pq=e.target.value;fillPick()}else if(e.target.id==='q'){S.aq=e.target.value;fillAdd()}else if(e.target.id==='dq')searchResults(e.target.value)});

function render(){
  let h;
  if(S.step==='app'&&!S.boards.length)seedBoards();
  if(G){cancelAnimationFrame(G.raf);G=null}
  if(B){cancelAnimationFrame(B.raf);B=null}
  if(S.step!=='app')h=renderOnb();
  else if(S.full&&S.tab==='board'&&!S.settings&&!S.viewing)h=renderFull();
  else if(S.bubbles&&S.tab==='discover'&&!S.settings&&!S.viewing&&!S.flist)h=renderBubbles();
  else if(S.settings)h=renderSettings();
  else if(S.viewing)h=renderPeek();
  else if(S.flist)h=renderFollowList();
  else{if(!['board','discover','account'].includes(S.tab))S.tab='account';h=({board:renderBoard,discover:renderDiscover,account:renderAccount})[S.tab]()+tabbar()}
  $('#screen').innerHTML=h;S.newId=null;save();
  if($('#pickList'))fillPick();
  if($('#graph'))initGraph();
  if($('#bfield'))initBubbles();
  const sc=$('.scroll.under');$('#screen').classList.toggle('flush',!!sc);if(sc){sc.onscroll=onScrollFx;onScrollFx()}
}
S.boards.forEach(b=>{if(!b.real)b.real=R.emptyReal()});
if(S.step==='building')S.step=S.redo?'quiz':'search';
render();
R.load().then(()=>{if(S.step==='search')fillPick();else if(S.step==='app'&&$('#sheetWrap').hidden)render()},e=>console.warn('um!x: the model did not load',e));
