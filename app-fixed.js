const PORTS=[
  {id:'PGSM',name:'PGSM',code:'Puerto San Martín',products:['mz','sj']},
  {id:'TIMBUES',name:'Timbúes',code:'Terminal Timbúes',products:['mz','sj','epa']},
  {id:'LIMA',name:'Lima',code:'Puerto Lima',products:['mz']}
];
const ROWS=['Arribo','Desc','Rech','En playa'];
const REPORTS={h8:['ayer','h8'],h16:['h16'],h12:['h12']};
const HEADERS={ayer:'00 hs · día anterior',h8:'08 hs',h12:'12 hs',h16:'16 hs'};
const KNOWN=['mz','sj','tr','epa','rtrs','2vsbs'];
const ORDER={mz:1,sj:2,tr:3,epa:4,rtrs:5,'2vsbs':6};
const MAP={'MAIZ DURO':'mz','MAIZ':'mz','SOJA EPA':'epa','SOJA RTRS':'rtrs','SOJA 2VSBS':'2vsbs','2VSBS':'2vsbs','TRIGO PAN':'tr','TRIGO':'tr','SOJA':'sj'};
const KEY='guardia_reporte_v5';
const nl=String.fromCharCode(10);

function blankData(){return Object.fromEntries(ROWS.map(r=>[r,{}]));}
function fresh(){
  const s={date:new Date().toISOString().slice(0,10),report:'h8',ports:{},stock:{
    TIMBUES:{mz_ayer:0,mz_desc:0,mz_emb:0,tr_ayer:0,tr_desc:0,tr_emb:0},
    PGSM:{mz_ayer:0,mz_desc:0,mz_emb:0,tr_ayer:0,tr_desc:0,tr_emb:0},
    LIMA:{mz_ayer:0,mz_desc:0,mz_emb:0}
  }};
  PORTS.forEach(p=>{s.ports[p.id]={products:[...p.products],slots:{}};['ayer','h8','h12','h16'].forEach(t=>s.ports[p.id].slots[t]={text:'',data:blankData(),parsed:false});});
  return s;
}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&x.ports?x:fresh();}catch{return fresh();}}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function fmt(n){return (parseInt(n)||0).toLocaleString('es-AR').replaceAll(',','.');}
function reportSlots(){return REPORTS[state.report]||['h8'];}

function parseMail(text){
  let src=(text||'').toUpperCase();
  const ti=src.indexOf('TOTALES:'); if(ti>=0)src=src.slice(0,ti);
  const pi=src.indexOf('PRODUCTOS:'); if(pi>=0)src=src.slice(pi+10);
  const out={};
  const re=/([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ]*?):\s*D\s*=\s*(-?\d+)\s*P\s*=\s*(-?\d+)\s*A\s*=\s*(-?\d+)\s*R\s*=\s*(-?\d+)/g;
  let m;
  while((m=re.exec(src))){
    let k=MAP[m[1].trim()];
    if(!k)for(const name of Object.keys(MAP).sort((a,b)=>b.length-a.length)){if(m[1].includes(name)){k=MAP[name];break;}}
    if(k)out[k]={D:+m[2],P:+m[3],A:+m[4],R:+m[5]};
  }
  return out;
}
function parseLater(port,slot,text){
  clearTimeout(parseLater.timers?.[port+slot]); parseLater.timers=parseLater.timers||{};
  parseLater.timers[port+slot]=setTimeout(()=>applyParse(port,slot,text),220);
}
function applyParse(port,slot,text){
  const obj=state.ports[port].slots[slot], parsed=parseMail(text); obj.text=text; obj.data=blankData();
  const products=state.ports[port].products;
  Object.keys(parsed).forEach(k=>{const p=parsed[k];if(p.A+p.D+p.P+p.R>0&&!products.includes(k))products.push(k);});
  products.sort((a,b)=>(ORDER[a]||99)-(ORDER[b]||99));
  products.forEach(k=>{if(parsed[k]){obj.data.Arribo[k]=parsed[k].A;obj.data.Desc[k]=parsed[k].D;obj.data.Rech[k]=parsed[k].R;obj.data['En playa'][k]=parsed[k].P;}});
  obj.parsed=Object.keys(parsed).length>0; save(); renderGrid(port,slot); renderProductChips(port); renderOutput();
  const s=document.getElementById(`status-${port}-${slot}`); if(s){s.textContent=text.trim()?(obj.parsed?'Mail procesado automáticamente':'No se detectaron productos válidos'):'Pegá el mail para procesarlo automáticamente';s.classList.toggle('ok',obj.parsed);}
}

function renderTabs(){
  document.querySelectorAll('.report-tab').forEach(b=>{b.classList.toggle('active',b.dataset.value===state.report);b.onclick=()=>{state.report=b.dataset.value;save();renderTabs();renderPorts();renderOutput();};});
}
function renderPorts(){
  const root=document.getElementById('puertos-grid');root.innerHTML='';
  PORTS.forEach(p=>{const card=document.createElement('div');card.className='card';card.dataset.puerto=p.id;root.appendChild(card);renderPort(p.id);});
}
function renderPort(id){
  const p=PORTS.find(x=>x.id===id), card=document.querySelector(`[data-puerto="${id}"]`), products=state.ports[id].products;
  const slots=reportSlots().map(slot=>{const o=state.ports[id].slots[slot];return `<div class="sub-tramo"><div class="sub-tramo-head"><div class="sub-tramo-title">${HEADERS[slot]}</div></div><textarea data-slot="${slot}" placeholder="Pegá el mail de posición..." oninput="parseLater('${id}','${slot}',this.value)"></textarea><div class="auto-status ${o.parsed?'ok':''}" id="status-${id}-${slot}">${o.parsed?'Mail procesado automáticamente':'Pegá el mail para procesarlo automáticamente'}</div><div class="grilla" id="grilla-${id}-${slot}"></div></div>`;}).join('');
  card.innerHTML=`<div class="puerto-head"><div><div class="puerto-name">${p.name}</div><div class="puerto-code">${p.code}</div></div></div><div class="puerto-tools"><button class="chip-btn" id="prod-btn-${id}" onclick="toggleProducts('${id}')">Productos <span class="count">${products.length}</span></button></div><div class="productos-panel" id="prod-panel-${id}"><div class="panel-hint">Activá, desactivá o agregá productos.</div><div class="chips" id="prod-chips-${id}"></div><div class="productos-add"><input id="prod-input-${id}" placeholder="Ej. sorgo, girasol..." onkeydown="if(event.key==='Enter')addProduct('${id}')"><button onclick="addProduct('${id}')">Agregar</button></div></div>${slots}`;
  reportSlots().forEach(slot=>{card.querySelector(`[data-slot="${slot}"]`).value=state.ports[id].slots[slot].text||'';renderGrid(id,slot);});renderProductChips(id);
}
function toggleProducts(id){document.getElementById(`prod-panel-${id}`).classList.toggle('open');document.getElementById(`prod-btn-${id}`).classList.toggle('open');}
function toggleProduct(id,p){const a=state.ports[id].products,i=a.indexOf(p);i>=0?a.splice(i,1):a.push(p);a.sort((x,y)=>(ORDER[x]||99)-(ORDER[y]||99));save();renderPort(id);renderOutput();}
function addProduct(id){const input=document.getElementById(`prod-input-${id}`),v=input.value.trim().toLowerCase();if(!v)return;if(!state.ports[id].products.includes(v))state.ports[id].products.push(v);save();renderPort(id);renderOutput();}
function removeProduct(id,p){state.ports[id].products=state.ports[id].products.filter(x=>x!==p);save();renderPort(id);renderOutput();}
function renderProductChips(id){const active=state.ports[id].products, all=[...new Set([...KNOWN,...active])].sort((a,b)=>(ORDER[a]||99)-(ORDER[b]||99)), box=document.getElementById(`prod-chips-${id}`);if(!box)return;box.innerHTML=all.map(p=>`<span class="chip ${active.includes(p)?'active':''}" onclick="toggleProduct('${id}','${p}')">${p}${KNOWN.includes(p)?'':`<span class="rem" onclick="event.stopPropagation();removeProduct('${id}','${p}')">×</span>`}</span>`).join('');}
function renderGrid(id,slot){
  const box=document.getElementById(`grilla-${id}-${slot}`);if(!box)return;const products=state.ports[id].products,data=state.ports[id].slots[slot].data,rows=slot==='ayer'?ROWS.slice(0,3):ROWS;
  if(!products.length){box.innerHTML='<div class="grilla-empty">Sin productos activos.</div>';return;}
  const cols=`76px repeat(${products.length},minmax(64px,1fr))`, min=68+products.length*58;
  let html=`<div class="grilla-header" style="--prod-count:${products.length};--mobile-min:${min}px;grid-template-columns:${cols}"><div></div>${products.map(p=>`<div>${p}</div>`).join('')}</div>`;
  rows.forEach(r=>{html+=`<div class="grilla-row" style="--prod-count:${products.length};--mobile-min:${min}px;grid-template-columns:${cols}"><div class="label">${r}</div>`;products.forEach(p=>html+=`<input class="num-input" inputmode="numeric" value="${data[r]?.[p]||0}" data-port="${id}" data-slot="${slot}" data-row="${r}" data-prod="${p}" onfocus="this.select()" oninput="gridInput(this)">`);html+='</div>';});box.innerHTML=html;
}
function gridInput(i){i.value=i.value.replace(/[^0-9]/g,'');state.ports[i.dataset.port].slots[i.dataset.slot].data[i.dataset.row][i.dataset.prod]=parseInt(i.value)||0;save();renderOutput();}

const STOCK=[['TIMBUES','mz','Timbúes','Maíz'],['TIMBUES','tr','Timbúes','Trigo'],['PGSM','mz','PGSM','Maíz'],['PGSM','tr','PGSM','Trigo'],['LIMA','mz','Lima','Maíz']];
function stockField(key,ro=false){return `<input class="stock-input" inputmode="numeric" data-key="${key}" ${ro?'readonly':'onfocus="stockFocus(this)" oninput="stockChange(this)" onblur="stockBlur(this)"'}>`;}
function renderStock(){document.getElementById('stock-grid').innerHTML=`<div class="stock-grid">${STOCK.map(([p,prod,n,label])=>`<div class="stock-product-card"><div class="stock-product-title">${n}<span>${label}</span></div><div class="stock-product-fields"><div class="stock-field"><label>Stock ayer</label>${stockField(`${p}.${prod}_ayer`)}</div><div class="stock-field"><label>Descargas</label>${stockField(`${p}.${prod}_desc`)}</div><div class="stock-field"><label>Embarques</label>${stockField(`${p}.${prod}_emb`)}</div><div class="stock-field total"><label>Stock hoy</label>${stockField(`${p}.${prod}_hoy`,true)}</div></div></div>`).join('')}</div>`;refreshStock();document.querySelectorAll('#stock-grid input').forEach(i=>{const [p,k]=i.dataset.key.split('.');i.value=fmt(state.stock[p][k]||0);});}
function stockFocus(i){i.value=i.value.replaceAll('.','');i.select();}
function stockChange(i){i.value=i.value.replace(/[^0-9]/g,'');const [p,k]=i.dataset.key.split('.');state.stock[p][k]=parseInt(i.value)||0;refreshStock();save();renderOutput();}
function stockBlur(i){const [p,k]=i.dataset.key.split('.');i.value=fmt(state.stock[p][k]||0);}
function refreshStock(){STOCK.forEach(([p,prod])=>{const s=state.stock[p],v=(s[prod+'_ayer']||0)+(s[prod+'_desc']||0)-(s[prod+'_emb']||0);s[prod+'_hoy']=v;const el=document.querySelector(`[data-key="${p}.${prod}_hoy"]`);if(el)el.value=fmt(v);});}

function titleFor(id,slot){const n=id==='TIMBUES'?'Timbues':id;return {ayer:`${id} AYER`,h8:`Arribo h8 hs ${n}`,h12:`Arribo h12 hs ${n}`,h16:`Arribo h16 hs ${n}`}[slot];}
function portBlock(id,slot){const products=state.ports[id].products,data=state.ports[id].slots[slot].data,rows=slot==='ayer'?ROWS.slice(0,3):ROWS,out=[`*${titleFor(id,slot)}* 🚚`];rows.forEach(r=>{let total=0,parts=[r];products.forEach(p=>{const v=data[r]?.[p]||0;total+=v;parts.push(p,String(v));});out.push(parts.join(' ')+` (${total})`);});return out.join(nl);}
function stockBlock(){const s=state.stock;return ['*STOCK TIMBUES* ⛰️',`Mz ${fmt(s.TIMBUES.mz_hoy)} Tn | Tr ${fmt(s.TIMBUES.tr_hoy)} Tn`,'','*STOCK PGSM* ⛰️',`Mz ${fmt(s.PGSM.mz_hoy)} Tn | Tr ${fmt(s.PGSM.tr_hoy)} Tn`,'','*STOCK LIMA* ⛰️',`Mz ${fmt(s.LIMA.mz_hoy)} Tn`].join(nl);}
function renderOutput(){const parts=['Buen día,',''];reportSlots().forEach(slot=>PORTS.forEach(p=>parts.push(portBlock(p.id,slot),'')));if(state.report==='h8')parts.push(stockBlock());while(parts.at(-1)==='')parts.pop();document.getElementById('output').value=parts.join(nl);document.getElementById('tramo-label').textContent={h8:'00 HS / 08 HS + STOCK',h16:'16 HS · SÁBADO',h12:'12 HS · DOMINGO'}[state.report];document.getElementById('stock-block').classList.toggle('hidden',state.report!=='h8');document.getElementById('info-strip').innerHTML=state.report==='h8'?'<div><b>Reporte del sábado por la mañana.</b> Pegá los mails de 00 hs y 08 hs por puerto y completá el stock.</div>':state.report==='h16'?'<div><b>Reporte 16 hs · sábado.</b> Un mail por puerto, sin stock.</div>':'<div><b>Reporte 12 hs · domingo.</b> Un mail por puerto, sin stock.</div>';}
function copiarMensaje(){const out=document.getElementById('output'),done=()=>{const t=document.getElementById('toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1500);};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(out.value).then(done).catch(()=>{out.select();document.execCommand('copy');done();});else{out.select();document.execCommand('copy');done();}}
function regenerar(){renderOutput();}
function resetAll(){if(confirm('¿Borrar todo y empezar de cero?')){state=fresh();save();location.reload();}}
function detectarInterno(){return /WhatsApp|FBAN|FBAV|Instagram/i.test(navigator.userAgent||'')||/whatsapp/i.test(document.referrer||'');}
function mostrarAviso(){const a=document.getElementById('inapp-warning'),l=document.getElementById('inapp-steps');if(!a||!l)return;const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);l.innerHTML=(ios?['Tocá el menú de WhatsApp.','Elegí “Abrir en Safari”.']:['Tocá los tres puntos.','Elegí “Abrir en Chrome”.']).map(x=>`<li>${x}</li>`).join('');a.classList.add('show');document.body.style.overflow='hidden';}
function cerrarAvisoNavegador(){document.getElementById('inapp-warning')?.classList.remove('show');document.body.style.overflow='';}
function mostrarAyudaNavegador(){document.getElementById('inapp-steps')?.scrollIntoView({behavior:'smooth'});}

document.getElementById('fecha').value=state.date;document.getElementById('fecha').addEventListener('change',e=>{state.date=e.target.value;save();});
renderTabs();renderPorts();renderStock();renderOutput();if(detectarInterno())mostrarAviso();
window.__appReady=true;
