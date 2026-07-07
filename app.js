const PUERTOS=[
{id:'PGSM',nombre:'PGSM',codigo:'Puerto San Martín',default:['mz','sj']},
{id:'TIMBUES',nombre:'Timbúes',codigo:'Terminal Timbúes',default:['mz','sj','epa']},
{id:'LIMA',nombre:'Lima',codigo:'Puerto Lima',default:['mz']}
];
const PRODUCTOS_CONOCIDOS=['mz','sj','tr','epa','rtrs','2vsbs'];
const ORDEN_PROD={mz:1,sj:2,tr:3,epa:4,rtrs:5,'2vsbs':6};
const PROD_MAP={'MAIZ DURO':'mz','MAIZ':'mz','SOJA EPA':'epa','SOJA RTRS':'rtrs','SOJA 2VSBS':'2vsbs','2VSBS':'2vsbs','TRIGO PAN':'tr','TRIGO':'tr','SOJA':'sj'};
const FILAS=['Arribo','Desc','Rech','En playa'];
const TRAMOS=['ayer','h8','h12','h16'];
const NOMBRE_TRAMO_HEADER={ayer:'00 hs · día anterior',h8:'08 hs',h12:'12 hs',h16:'16 hs'};
const STORAGE_KEY='guardia_reporte_v4';
let state=loadState();

function emptyDatos(){const d={};FILAS.forEach(f=>d[f]={});return d;}
function defaultState(){
 const s={fecha:new Date().toISOString().slice(0,10),tramo:'h8',puertos:{},stock:{TIMBUES:{mz_ayer:0,mz_desc:0,mz_emb:0,tr_ayer:0,tr_desc:0,tr_emb:0},PGSM:{mz_ayer:0,mz_desc:0,mz_emb:0,tr_ayer:0,tr_desc:0,tr_emb:0},LIMA:{mz_ayer:0,mz_desc:0,mz_emb:0}}};
 PUERTOS.forEach(p=>{s.puertos[p.id]={productos:[...p.default],tramos:{}};TRAMOS.forEach(t=>s.puertos[p.id].tramos[t]={texto:'',datos:emptyDatos(),parsed:false});});
 return s;
}
function loadState(){
 try{
  const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaultState();
  const s=JSON.parse(raw);if(!['h8','h12','h16'].includes(s.tramo))s.tramo='h8';
  s.stock=s.stock||defaultState().stock;
  PUERTOS.forEach(p=>{
   if(!s.puertos?.[p.id]){s.puertos=s.puertos||{};s.puertos[p.id]={productos:[...p.default],tramos:{}};}
   s.puertos[p.id].productos=s.puertos[p.id].productos||[...p.default];
   s.puertos[p.id].tramos=s.puertos[p.id].tramos||{};
   TRAMOS.forEach(t=>{
    if(!s.puertos[p.id].tramos[t])s.puertos[p.id].tramos[t]={texto:'',datos:emptyDatos(),parsed:false};
    s.puertos[p.id].tramos[t].datos=s.puertos[p.id].tramos[t].datos||emptyDatos();
    FILAS.forEach(f=>s.puertos[p.id].tramos[t].datos[f]=s.puertos[p.id].tramos[t].datos[f]||{});
   });
  });return s;
 }catch(e){console.warn(e);return defaultState();}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function tramosDelReporte(r){return {h8:['ayer','h8'],h12:['h12'],h16:['h16']}[r]||[r];}
function reporteIncluyeStock(r){return r==='h8';}
function labelReporte(r){return {h8:'00 HS / 08 HS + STOCK',h12:'12 HS · DOMINGO',h16:'16 HS · SÁBADO'}[r]||r;}
function textoInfoBar(r){const i='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';return {h8:`${i}<div><b>Reporte del sábado por la mañana.</b> Pegá los mails de 00 hs y 08 hs por puerto y completá el stock.</div>`,h12:`${i}<div><b>Reporte 12 hs · domingo.</b> Un mail por puerto, sin stock.</div>`,h16:`${i}<div><b>Reporte 16 hs · sábado.</b> Un mail por puerto, sin stock.</div>`}[r]||'';}

function parseMail(texto){
 let target=(texto||'').toUpperCase();
 const cut=target.indexOf('TOTALES:');if(cut>-1)target=target.slice(0,cut);
 const prod=target.indexOf('PRODUCTOS:');if(prod>-1)target=target.slice(prod+10);
 const out={};const re=/([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ]*?):\s*D\s*=\s*(-?\d+)\s*P\s*=\s*(-?\d+)\s*A\s*=\s*(-?\d+)\s*R\s*=\s*(-?\d+)/g;let m;
 while((m=re.exec(target))){let key=PROD_MAP[m[1].trim()];if(!key){for(const k of Object.keys(PROD_MAP).sort((a,b)=>b.length-a.length)){if(m[1].includes(k)){key=PROD_MAP[k];break;}}}if(key)out[key]={D:+m[2],P:+m[3],A:+m[4],R:+m[5]};}
 return out;
}
function aplicarParseo(puertoId,tramo,texto){
 const obj=state.puertos[puertoId].tramos[tramo];obj.texto=texto;const parsed=parseMail(texto);obj.datos=emptyDatos();const activos=state.puertos[puertoId].productos;
 Object.keys(parsed).forEach(prod=>{const p=parsed[prod];if(p.A+p.D+p.P+p.R>0&&!activos.includes(prod))activos.push(prod);});
 activos.sort((a,b)=>(ORDEN_PROD[a]||99)-(ORDEN_PROD[b]||99));
 activos.forEach(prod=>{if(parsed[prod]){obj.datos.Arribo[prod]=parsed[prod].A;obj.datos.Desc[prod]=parsed[prod].D;obj.datos.Rech[prod]=parsed[prod].R;obj.datos['En playa'][prod]=parsed[prod].P;}});
 obj.parsed=Object.keys(parsed).length>0;saveState();renderGrilla(puertoId,tramo);renderChipsProductos(puertoId);
 const st=document.getElementById(`status-${puertoId}-${tramo}`);if(st){st.textContent=texto.trim()?(obj.parsed?'Mail procesado automáticamente':'No se detectaron productos válidos'):'Pegá el mail para procesarlo automáticamente';st.classList.toggle('ok',obj.parsed);}regenerar();
}
function programarParseo(p,t,x){programarParseo.timers=programarParseo.timers||{};const k=p+'-'+t;clearTimeout(programarParseo.timers[k]);programarParseo.timers[k]=setTimeout(()=>aplicarParseo(p,t,x),250);}

function toggleProductosPanel(p){document.getElementById(`prod-panel-${p}`).classList.toggle('open');document.getElementById(`prod-btn-${p}`).classList.toggle('open');}
function toggleProducto(p,prod){const a=state.puertos[p].productos,i=a.indexOf(prod);i>-1?a.splice(i,1):a.push(prod);a.sort((x,y)=>(ORDEN_PROD[x]||99)-(ORDEN_PROD[y]||99));saveState();renderPuerto(p);regenerar();}
function agregarProductoCustom(p){const i=document.getElementById(`prod-input-${p}`),n=i.value.trim().toLowerCase();if(!n)return;if(!state.puertos[p].productos.includes(n))state.puertos[p].productos.push(n);i.value='';saveState();renderPuerto(p);regenerar();}
function removerProductoCustom(p,prod){state.puertos[p].productos=state.puertos[p].productos.filter(x=>x!==prod);saveState();renderPuerto(p);regenerar();}

function renderReportPicker(){document.querySelectorAll('.report-tab').forEach(tab=>{tab.classList.toggle('active',tab.dataset.value===state.tramo);tab.onclick=()=>{state.tramo=tab.dataset.value;saveState();renderReportPicker();PUERTOS.forEach(p=>renderPuerto(p.id));regenerar();};});}
function renderPuertos(){const grid=document.getElementById('puertos-grid');grid.innerHTML='';PUERTOS.forEach(p=>{const c=document.createElement('div');c.className='card';c.dataset.puerto=p.id;grid.appendChild(c);renderPuerto(p.id);});}
function renderPuerto(puertoId){
 const p=PUERTOS.find(x=>x.id===puertoId),card=document.querySelector(`.card[data-puerto="${puertoId}"]`);if(!card)return;const activos=state.puertos[puertoId].productos;
 const subs=tramosDelReporte(state.tramo).map(t=>{const o=state.puertos[puertoId].tramos[t];return `<div class="sub-tramo"><div class="sub-tramo-head"><div class="sub-tramo-title">${NOMBRE_TRAMO_HEADER[t]}</div></div><textarea data-puerto="${puertoId}" data-tramo="${t}" placeholder="Pegá el mail de posición..." oninput="programarParseo('${puertoId}','${t}',this.value)"></textarea><div class="auto-status ${o.parsed?'ok':''}" id="status-${puertoId}-${t}">${o.parsed?'Mail procesado automáticamente':'Pegá el mail para procesarlo automáticamente'}</div><div class="grilla" id="grilla-${puertoId}-${t}"></div></div>`;}).join('');
 card.innerHTML=`<div class="puerto-head"><div><div class="puerto-name">${p.nombre}</div><div class="puerto-code">${p.codigo}</div></div></div><div class="puerto-tools"><button class="chip-btn" id="prod-btn-${puertoId}" onclick="toggleProductosPanel('${puertoId}')">Productos <span class="count">${activos.length}</span></button></div><div class="productos-panel" id="prod-panel-${puertoId}"><div class="panel-hint">Activá, desactivá o agregá productos.</div><div class="chips" id="prod-chips-${puertoId}"></div><div class="productos-add"><input id="prod-input-${puertoId}" placeholder="Ej. sorgo, girasol..." onkeydown="if(event.key==='Enter')agregarProductoCustom('${puertoId}')"><button onclick="agregarProductoCustom('${puertoId}')">Agregar</button></div></div>${subs}`;
 tramosDelReporte(state.tramo).forEach(t=>{const ta=card.querySelector(`textarea[data-tramo="${t}"]`);ta.value=state.puertos[puertoId].tramos[t].texto||'';renderGrilla(puertoId,t);});renderChipsProductos(puertoId);
}
function renderChipsProductos(p){const activos=state.puertos[p].productos,uni=[...new Set([...PRODUCTOS_CONOCIDOS,...activos])].sort((a,b)=>(ORDEN_PROD[a]||99)-(ORDEN_PROD[b]||99));const c=document.getElementById(`prod-chips-${p}`);if(!c)return;c.innerHTML=uni.map(prod=>{const active=activos.includes(prod),custom=!PRODUCTOS_CONOCIDOS.includes(prod);const rem=custom?`<span class="rem" onclick="event.stopPropagation();removerProductoCustom('${p}','${prod}')">×</span>`:'';return `<span class="chip ${active?'active':''}" onclick="toggleProducto('${p}','${prod}')">${prod}${rem}</span>`;}).join('');}
function renderGrilla(p,t){const c=document.getElementById(`grilla-${p}-${t}`);if(!c)return;const activos=state.puertos[p].productos,d=state.puertos[p].tramos[t].datos,filas=t==='ayer'?['Arribo','Desc','Rech']:FILAS;if(!activos.length){c.innerHTML='<div class="grilla-empty">Sin productos activos.</div>';return;}const cols=`76px repeat(${activos.length},minmax(64px,1fr))`,mobile=68+activos.length*58;let h=`<div class="grilla-header" style="--prod-count:${activos.length};--mobile-min:${mobile}px;grid-template-columns:${cols}"><div></div>${activos.map(x=>`<div>${x}</div>`).join('')}</div>`;filas.forEach(f=>{h+=`<div class="grilla-row" style="--prod-count:${activos.length};--mobile-min:${mobile}px;grid-template-columns:${cols}"><div class="label">${f}</div>`;activos.forEach(prod=>{const v=d[f]?.[prod]||0;h+=`<input class="num-input" inputmode="numeric" value="${v}" data-puerto="${p}" data-tramo="${t}" data-fila="${f}" data-prod="${prod}" onfocus="this.select()" oninput="onNumInput(this)">`;});h+='</div>';});c.innerHTML=h;}
function onNumInput(i){i.value=i.value.replace(/[^0-9]/g,'');const o=state.puertos[i.dataset.puerto].tramos[i.dataset.tramo];o.datos[i.dataset.fila][i.dataset.prod]=parseInt(i.value)||0;saveState();regenerar();}

const STOCK_COLS=[['TIMBUES','mz','Timbúes','Maíz'],['TIMBUES','tr','Timbúes','Trigo'],['PGSM','mz','PGSM','Maíz'],['PGSM','tr','PGSM','Trigo'],['LIMA','mz','Lima','Maíz']];
function stockInputHtml(k,ro=false){return `<input class="stock-input" inputmode="numeric" data-key="${k}" ${ro?'readonly':'onfocus="stockFocus(this)" oninput="stockInput(this)" onblur="stockBlur(this)"'}>`;}
function renderStock(){document.getElementById('stock-grid').innerHTML=`<div class="stock-grid">${STOCK_COLS.map(([p,prod,n,nom])=>`<div class="stock-product-card"><div class="stock-product-title">${n}<span>${nom}</span></div><div class="stock-product-fields"><div class="stock-field"><label>Stock ayer</label>${stockInputHtml(`${p}.${prod}_ayer`)}</div><div class="stock-field"><label>Descargas</label>${stockInputHtml(`${p}.${prod}_desc`)}</div><div class="stock-field"><label>Embarques</label>${stockInputHtml(`${p}.${prod}_emb`)}</div><div class="stock-field total"><label>Stock hoy</label>${stockInputHtml(`${p}.${prod}_hoy`,true)}</div></div></div>`).join('')}</div>`;refreshStockHoy();document.querySelectorAll('#stock-grid input').forEach(i=>{const [p,c]=i.dataset.key.split('.');i.value=fmt(state.stock[p][c]||0);});}
function stockFocus(i){i.value=i.value.replace(/\./g,'');i.select();}
function stockInput(i){i.value=i.value.replace(/[^0-9]/g,'');const [p,c]=i.dataset.key.split('.');state.stock[p][c]=parseInt(i.value)||0;refreshStockHoy();saveState();regenerar();}
function stockBlur(i){const [p,c]=i.dataset.key.split('.');i.value=fmt(state.stock[p][c]||0);}
function refreshStockHoy(){STOCK_COLS.forEach(([p,prod])=>{const s=state.stock[p],v=(s[prod+'_ayer']||0)+(s[prod+'_desc']||0)-(s[prod+'_emb']||0);s[prod+'_hoy']=v;const el=document.querySelector(`[data-key="${p}.${prod}_hoy"]`);if(el)el.value=fmt(v);});}
function fmt(n){return (parseInt(n)||0).toLocaleString('es-AR').replaceAll(',','.');}

function nombreBloque(p,t){const n=p==='PGSM'?'PGSM':p==='TIMBUES'?'Timbues':'Lima';return {ayer:`${p} AYER`,h8:`Arribo h8 hs ${n}`,h12:`Arribo h12 hs ${n}`,h16:`Arribo h16 hs ${n}`}[t];}
function armarBloquePuerto(p,t,titulo){const activos=state.puertos[p].productos,d=state.puertos[p].tramos[t].datos,filas=t==='ayer'?['Arribo','Desc','Rech']:FILAS;const out=[`*${titulo}* 🚚`];filas.forEach(f=>{let total=0;const partes=[f];activos.forEach(prod=>{const v=d[f]?.[prod]||0;total+=v;partes.push(prod,String(v));});out.push(partes.join(' ')+` (${total})`);});return out.join('\n');}
function armarStock(){const s=state.stock;return ['*STOCK TIMBUES* ⛰️',`Mz ${fmt(s.TIMBUES.mz_hoy)} Tn | Tr ${fmt(s.TIMBUES.tr_hoy)} Tn`,'','*STOCK PGSM* ⛰️',`Mz ${fmt(s.PGSM.mz_hoy)} Tn | Tr ${fmt(s.PGSM.tr_hoy)} Tn`,'','*STOCK LIMA* ⛰️',`Mz ${fmt(s.LIMA.mz_hoy)} Tn`].join('\n');}
function regenerar(){const b=['Buen día,',''];tramosDelReporte(state.tramo).forEach(t=>['PGSM','TIMBUES','LIMA'].forEach(p=>{b.push(armarBloquePuerto(p,t,nombreBloque(p,t)),'');}));if(reporteIncluyeStock(state.tramo))b.push(armarStock());while(b.at(-1)==='')b.pop();document.getElementById('output').value=b.join('\n');document.getElementById('tramo-label').textContent=labelReporte(state.tramo);document.getElementById('info-strip').innerHTML=textoInfoBar(state.tramo);document.getElementById('stock-block').classList.toggle('hidden',!reporteIncluyeStock(state.tramo));}
function copiarMensaje(){const t=document.getElementById('output');const ok=()=>{const x=document.getElementById('toast');x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1500);};navigator.clipboard?.writeText(t.value).then(ok).catch(()=>{t.select();document.execCommand('copy');ok();});}
function resetAll(){if(confirm('¿Borrar todo y empezar de cero?')){state=defaultState();saveState();location.reload();}}

function detectarNavegadorInterno(){const ua=navigator.userAgent||'',ref=document.referrer||'';return /WhatsApp|FBAN|FBAV|Instagram/i.test(ua)||/whatsapp/i.test(ref);}
function mostrarAvisoNavegador(){const a=document.getElementById('inapp-warning'),l=document.getElementById('inapp-steps');if(!a||!l)return;const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);l.innerHTML=(ios?['Tocá el menú de WhatsApp.','Elegí “Abrir en Safari”.']:['Tocá los tres puntos.','Elegí “Abrir en Chrome”.']).map(x=>`<li>${x}</li>`).join('');a.classList.add('show');document.body.style.overflow='hidden';}
function cerrarAvisoNavegador(){document.getElementById('inapp-warning')?.classList.remove('show');document.body.style.overflow='';}
function mostrarAyudaNavegador(){document.getElementById('inapp-steps')?.scrollIntoView({behavior:'smooth'});}

document.getElementById('fecha').value=state.fecha||new Date().toISOString().slice(0,10);document.getElementById('fecha').addEventListener('change',e=>{state.fecha=e.target.value;saveState();});
renderReportPicker();renderPuertos();renderStock();regenerar();if(detectarNavegadorInterno())mostrarAvisoNavegador();