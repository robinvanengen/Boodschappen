const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID();
const startOfWeek = date => { const d = new Date(date); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d; };
// Gebruik de lokale datum van het apparaat; UTC kon de verkeerde dag markeren.
const keyFor = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt = new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'});
const dayFmt = new Intl.DateTimeFormat('nl-NL',{weekday:'long'});
const initial = {
  recipes:[], plans:{}, extras:[], checked:{}, hidden:{}, dayDone:{}, quickMeals:{}, mealMeta:{}, storeOverrides:{}, version:4
};
let data = JSON.parse(localStorage.getItem('samenBoodschappen') || 'null') || initial;
let selectedWho='both'; let selectedMealIndex; let editingQuickId;
if(data.version!==4){const sampleIds=new Set(['pasta','curry','tacos']);data.recipes=(data.recipes||[]).filter(r=>!sampleIds.has(r.id));Object.keys(data.plans||{}).forEach(date=>data.plans[date]=data.plans[date].filter(id=>!sampleIds.has(id)));data.extras=(data.extras||[]).map(x=>({...x,store:x.store==='any'?'home':x.store}));data.recipes.forEach(r=>r.ingredients=r.ingredients.map(x=>[x[0],x[1],x[2]==='any'?'home':x[2]]));Object.assign(data,{hidden:data.hidden||{},dayDone:data.dayDone||{},quickMeals:data.quickMeals||{},mealMeta:data.mealMeta||{},storeOverrides:data.storeOverrides||{}});Object.entries(data.plans).forEach(([date,ids])=>ids.forEach((recipeId,mealIndex)=>{const recipe=data.recipes.find(r=>r.id===recipeId);recipe?.ingredients.forEach((_,ingredientIndex)=>{const oldId=`${date}-${recipeId}-${ingredientIndex}`,newId=`${date}-${mealIndex}-${recipeId}-${ingredientIndex}`;if(data.hidden[oldId])data.hidden[newId]=true;if(data.storeOverrides[oldId])data.storeOverrides[newId]=data.storeOverrides[oldId];})}));data.version=4;localStorage.setItem('samenBoodschappen',JSON.stringify(data));}
let week = startOfWeek(new Date()); let selectedDate = keyFor(new Date()); let activeStore='lidl'; let installPrompt;
let supabaseClient, householdId, lastCloudUpdate='', lastCloudFingerprint='';
const save = () => {
  localStorage.setItem('samenBoodschappen',JSON.stringify(data));
  if(supabaseClient&&householdId) saveToCloud();
};
async function saveToCloud(){
  // Een kopie voorkomt dat een wijziging tijdens de netwerkactie half wordt opgeslagen.
  const snapshot=JSON.parse(JSON.stringify(data));
  const {data:result,error}=await supabaseClient.from('oi_state').update({payload:snapshot,updated_at:new Date().toISOString()}).eq('household_id',householdId).select('updated_at');
  if(error){console.error('Opslaan van de gedeelde lijst lukt niet:',error.message);return;}
  lastCloudFingerprint=JSON.stringify(snapshot);
  if(result?.[0]?.updated_at)lastCloudUpdate=result[0].updated_at;
}
async function loadFromCloud(){
  if(!supabaseClient||!householdId)return;
  const {data:shared,error}=await supabaseClient.from('oi_state').select('payload,updated_at').eq('household_id',householdId).single();
  if(error){console.error('Ophalen van de gedeelde lijst lukt niet:',error.message);return;}
  const fingerprint=shared?.payload?JSON.stringify(shared.payload):'';
  // Vergelijk ook de inhoud. Zo missen we geen wijziging als twee apparaten
  // dezelfde server-tijd meekrijgen of een mobiel tabblad later wakker wordt.
  if(shared?.payload&&fingerprint!==lastCloudFingerprint){
    data=shared.payload; lastCloudUpdate=shared.updated_at;lastCloudFingerprint=fingerprint;
    localStorage.setItem('samenBoodschappen',JSON.stringify(data));
    renderPlanner();renderRecipes();renderList();
  }
}
const esc = s => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function recipesForDate(date){ return (data.plans[date]||[]).map(id=>data.recipes.find(r=>r.id===id)).filter(Boolean); }
const whoLabel = who => ({both:'Samen',oppie:'Oppie',ienie:'Ienie'}[who]||'Samen');
function renderPlanner(){
  const end = new Date(week); end.setDate(end.getDate()+6);
  $('#weekLabel').textContent=`${fmt.format(week)} – ${fmt.format(end)}`;
  $('#weekTitle').textContent='Weekmenu'; const today=keyFor(new Date()); let html='';
  for(let i=0;i<7;i++){const d=new Date(week);d.setDate(d.getDate()+i);const k=keyFor(d), meals=recipesForDate(k), quick=data.quickMeals[k]||[];const all=[...meals.map((r,index)=>({name:r.name,emoji:r.emoji,index,who:data.mealMeta[k]?.[index]?.who||'both'})),...quick.map(m=>({name:m.name,emoji:'🍽️',quickId:m.id,who:m.who||'both'}))]; html+=`<article class="week-day ${k===today?'today':''} ${data.dayDone[k]?'complete':''}" data-date="${k}"><div class="day-top"><input class="day-done" type="checkbox" data-day-done="${k}" ${data.dayDone[k]?'checked':''} aria-label="Dag afvinken"/><span class="day-label">${dayFmt.format(d)}</span><span class="date-number">${d.getDate()}</span></div>${all.length?all.map(m=>`<div class="meal-chip" ${m.quickId?`data-edit-quick="${k}" data-quick-id="${m.quickId}"`:`data-edit-meal="${k}" data-edit-index="${m.index}"`}><span>${m.emoji} ${esc(m.name)}</span><small class="meal-for">${whoLabel(m.who)}</small><button class="meal-remove" ${m.quickId?`data-remove-quick="${k}" data-quick-id="${m.quickId}"`:`data-remove-meal="${k}" data-meal-index="${m.index}"`} aria-label="Verwijder ${esc(m.name)}">×</button></div>`).join(''):'<p class="empty-day">Tik om te plannen</p>'}</article>`;}
  $('#weekGrid').innerHTML=html;
}
function renderRecipes(){
  const term=$('#recipeSearch').value.toLowerCase(); const list=data.recipes.filter(r=>r.name.toLowerCase().includes(term));
  $('#recipeList').innerHTML=list.length?list.map(r=>`<article class="recipe-card"><div class="recipe-icon">${r.emoji}</div><div><strong>${esc(r.name)}</strong><p class="recipe-meta">${r.ingredients.length} ingrediënten · ${r.servings} porties</p></div><div class="recipe-actions"><button class="mini-button" data-edit="${r.id}" aria-label="Bewerk">✎</button><button class="mini-button" data-plan-recipe="${r.id}" aria-label="Plan in">＋</button></div></article>`).join(''):'<p class="muted">Nog geen gerechten gevonden.</p>';
}
function weekItems(){
  let items=[]; for(let i=0;i<7;i++){const d=new Date(week);d.setDate(d.getDate()+i);recipesForDate(keyFor(d)).forEach((r,mealIndex)=>r.ingredients.forEach((x,index)=>{const id=`${keyFor(d)}-${mealIndex}-${r.id}-${index}`;items.push({id,name:x[0],amount:x[1],store:data.storeOverrides?.[id]||x[2],source:r.name})}));} return items.concat(data.extras.filter(x=>x.week===keyFor(week))).filter(x=>!data.hidden?.[x.id]);
}
function renderList(){
  const items=weekItems(); $('#listSummary').textContent=items.length?`${items.length} boodschappen uit je weekmenu.`:'Plan een gerecht of voeg een los item toe.';
  const visible=items.filter(x=>activeStore==='stores'?['lidl','jumbo'].includes(x.store):x.store===activeStore); $('#shoppingList').innerHTML=visible.length?visible.map(x=>`<label draggable="true" class="shopping-item ${data.checked[x.id]?'done':''}" data-drag-item="${x.id}"><input type="checkbox" data-check="${x.id}" ${data.checked[x.id]?'checked':''}/><div class="item-main"><strong class="item-name">${esc(x.name)}</strong><div class="item-detail">${esc(x.amount)}${x.source?` · ${esc(x.source)}`:''}</div></div><button class="delete" data-remove-item="${x.id}" aria-label="Verwijder">×</button></label>`).join(''):'<p class="muted">Hier staat nog niets. Voeg een gerecht of los item toe.</p>';
}
function ingredientRow(values=['','1','lidl']){return `<div class="ingredient-row"><label>Product<input required value="${esc(values[0])}" placeholder="Product" /></label><label>Aantal<input value="${esc(values[1])}" placeholder="1 zak" /></label><label>Winkel<select><option value="lidl" ${values[2]==='lidl'?'selected':''}>Lidl</option><option value="jumbo" ${values[2]==='jumbo'?'selected':''}>Jumbo</option><option value="home" ${values[2]==='home'?'selected':''}>Thuis</option></select></label><button class="delete remove-row" type="button">×</button></div>`}
function openRecipe(recipe){
  $('#recipeId').value=recipe?.id||'';$('#recipeName').value=recipe?.name||'';$('#recipeServings').value=recipe?.servings||2;$('#recipeEmoji').value=recipe?.emoji||'🍽️';$('#recipeNote').value=recipe?.note||'';$('#recipeDialogEyebrow').textContent=recipe?'RECEPT BEWERKEN':'NIEUW RECEPT';$('#recipeDialogTitle').textContent=recipe?'Gerecht aanpassen':'Een gerecht maken';$('#ingredientRows').innerHTML=(recipe?.ingredients||[['','1','lidl']]).map(ingredientRow).join('');$('#recipeDialog').showModal();
}
function renderMealChoices(){
  const choices=$('#mealChoices');
  choices.innerHTML=data.recipes.length
    ?data.recipes.map(recipe=>`<button type="button" class="choice" data-pick="${recipe.id}"><strong>${recipe.emoji} ${esc(recipe.name)}</strong><span>${recipe.ingredients.length} ingrediënten · ${recipe.servings} porties</span></button>`).join('')
    :'<p class="muted">Je hebt nog geen opgeslagen gerechten. Maak hieronder je eerste gerecht.</p>';
}
function openMealPicker(date){
  selectedDate=date||selectedDate;
  selectedWho='both';
  $('#quickMealName').value='';
  $('#mealPickerTitle').textContent=`Gerecht kiezen voor ${dayFmt.format(new Date(`${selectedDate}T12:00:00`))}`;
  document.querySelectorAll('[data-who]').forEach(x=>x.classList.toggle('active',x.dataset.who==='both'));
  renderMealChoices();
  $('#mealDialog').showModal();
}
function openMealEditor(date,mealIndex){
  selectedDate=date;selectedMealIndex=mealIndex; const recipe=recipesForDate(date)[mealIndex];if(!recipe)return;const who=data.mealMeta[date]?.[mealIndex]?.who||'both';$('#mealEditTitle').textContent=`${recipe.emoji} ${recipe.name}`;
  const ingredients=recipe.ingredients.map((x,index)=>{const id=`${date}-${mealIndex}-${recipe.id}-${index}`;if(data.hidden?.[id])return '';const store=data.storeOverrides?.[id]||x[2];return `<div class="detail-ingredient"><span>${esc(x[0])}<small class="item-detail"> · ${esc(x[1])}</small></span><select data-detail-store="${id}"><option value="lidl" ${store==='lidl'?'selected':''}>Lidl</option><option value="jumbo" ${store==='jumbo'?'selected':''}>Jumbo</option><option value="home" ${store==='home'?'selected':''}>Thuis</option></select><button type="button" class="delete" data-detail-remove="${id}" aria-label="Verwijder ${esc(x[0])}">×</button></div>`}).join('');
  $('#mealEditDetails').innerHTML=`<section class="detail-meal"><p class="item-detail">Voor ${whoLabel(who)}</p>${ingredients||'<p class="muted">Alle ingrediënten zijn verwijderd.</p>'}</section>`;$('#mealEditDialog').showModal();
}
function openQuickEditor(date,id){selectedDate=date;editingQuickId=id;const meal=(data.quickMeals[date]||[]).find(m=>m.id===id);if(!meal)return;$('#quickEditName').value=meal.name;$('#quickEditNote').value=meal.note||'';$('#quickEditDialog').showModal();}
function saveRecipe(e){e.preventDefault();const rows=[...document.querySelectorAll('.ingredient-row')];const ingredients=rows.map(row=>{const x=row.querySelectorAll('input,select');return [x[0].value.trim(),x[1].value.trim(),x[2].value]}).filter(x=>x[0]);if(!ingredients.length)return;const id=$('#recipeId').value||uid();const recipe={id,name:$('#recipeName').value.trim(),servings:+$('#recipeServings').value,emoji:$('#recipeEmoji').value||'🍽️',note:$('#recipeNote').value.trim(),ingredients}; const old=data.recipes.findIndex(r=>r.id===id);if(old>-1)data.recipes[old]=recipe;else data.recipes.push(recipe);save();renderRecipes();renderPlanner();renderList();$('#recipeDialog').close();}
function addToPlan(id){data.plans[selectedDate]??=[];data.mealMeta[selectedDate]??=[];data.plans[selectedDate].push(id);data.mealMeta[selectedDate].push({who:selectedWho});save();renderPlanner();renderList();if($('#mealDialog').open)$('#mealDialog').close();}
function addQuickMeal(){const name=$('#quickMealName').value.trim();if(!name)return;data.quickMeals[selectedDate]??=[];data.quickMeals[selectedDate].push({id:uid(),name,who:selectedWho,note:''});save();renderPlanner();$('#mealDialog').close();}

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]');if(nav){document.querySelectorAll('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${nav.dataset.view}`).classList.add('active');nav.classList.add('active');}
  const done=e.target.closest('[data-day-done]');if(done){data.dayDone[done.dataset.dayDone]=done.checked;save();renderPlanner();return;}
  const removeMeal=e.target.closest('[data-remove-meal]');if(removeMeal){const date=removeMeal.dataset.removeMeal;const index=+removeMeal.dataset.mealIndex;data.plans[date].splice(index,1);data.mealMeta[date]?.splice(index,1);if(!data.plans[date].length){delete data.plans[date];delete data.mealMeta[date];}save();renderPlanner();renderList();return;}
  const removeQuick=e.target.closest('[data-remove-quick]');if(removeQuick){const date=removeQuick.dataset.removeQuick;data.quickMeals[date]=data.quickMeals[date].filter(m=>m.id!==removeQuick.dataset.quickId);if(!data.quickMeals[date].length)delete data.quickMeals[date];save();renderPlanner();return;}
  const editQuick=e.target.closest('[data-edit-quick]');if(editQuick){openQuickEditor(editQuick.dataset.editQuick,editQuick.dataset.quickId);return;}
  const editMeal=e.target.closest('[data-edit-meal]');if(editMeal){openMealEditor(editMeal.dataset.editMeal,+editMeal.dataset.editIndex);return;}
  const day=e.target.closest('.week-day');if(day)openMealPicker(day.dataset.date);
  if(e.target.closest('#addMealButton'))openMealPicker(keyFor(week));if(e.target.closest('#newRecipeButton'))openRecipe();
  const edit=e.target.closest('[data-edit]');if(edit)openRecipe(data.recipes.find(r=>r.id===edit.dataset.edit));const plan=e.target.closest('[data-plan-recipe]');if(plan){selectedDate=keyFor(week);addToPlan(plan.dataset.planRecipe);}
  const pick=e.target.closest('[data-pick]');if(pick)addToPlan(pick.dataset.pick);
  const who=e.target.closest('[data-who]');if(who){selectedWho=who.dataset.who;document.querySelectorAll('[data-who]').forEach(x=>x.classList.toggle('active',x===who));}
  const emoji=e.target.closest('[data-emoji]');if(emoji)$('#recipeEmoji').value=emoji.dataset.emoji;
  if(e.target.closest('#addQuickMeal'))addQuickMeal();
  if(e.target.closest('#mealNewRecipe')){$('#mealDialog').close();openRecipe();} if(e.target.closest('#addIngredient'))$('#ingredientRows').insertAdjacentHTML('beforeend',ingredientRow());if(e.target.closest('.remove-row'))e.target.closest('.ingredient-row').remove();
  const removeDetail=e.target.closest('[data-detail-remove]');if(removeDetail){data.hidden??={};data.hidden[removeDetail.dataset.detailRemove]=true;save();openMealEditor(selectedDate,selectedMealIndex);renderList();}
  const close=e.target.closest('[data-close]');if(close)$(`#${close.dataset.close}`).close();
  const tab=e.target.closest('.store-tab');if(tab){activeStore=tab.dataset.store;document.querySelectorAll('.store-tab').forEach(x=>x.classList.toggle('active',x===tab));renderList();}
  const del=e.target.closest('[data-remove-item]');if(del){const id=del.dataset.removeItem;const extra=data.extras.find(x=>x.id===id);if(extra)data.extras=data.extras.filter(x=>x.id!==id);else{data.hidden??={};data.hidden[id]=true;}delete data.checked[id];save();renderList();}
  if(e.target.closest('#addItemButton'))$('#itemDialog').showModal();if(e.target.closest('#clearChecked')){data.checked={};save();renderList();}
  if(e.target.closest('#previousWeek')){week.setDate(week.getDate()-7);renderPlanner();renderList()}if(e.target.closest('#nextWeek')){week.setDate(week.getDate()+7);renderPlanner();renderList()}
});
document.addEventListener('change',e=>{if(e.target.matches('[data-check]')){data.checked[e.target.dataset.check]=e.target.checked;save();renderList();}if(e.target.matches('[data-detail-store]')){data.storeOverrides??={};data.storeOverrides[e.target.dataset.detailStore]=e.target.value;save();renderList();}});
let draggingItem;
document.addEventListener('dragstart',e=>{const item=e.target.closest('[data-drag-item]');if(!item)return;draggingItem=item.dataset.dragItem;item.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragend',e=>{e.target.closest('[data-drag-item]')?.classList.remove('dragging');document.querySelectorAll('.store-tab').forEach(x=>x.classList.remove('drop-target'));draggingItem=undefined;});
document.addEventListener('dragover',e=>{const tab=e.target.closest('.store-tab');if(!tab||!draggingItem)return;e.preventDefault();tab.classList.add('drop-target');});
document.addEventListener('dragleave',e=>e.target.closest('.store-tab')?.classList.remove('drop-target'));
document.addEventListener('drop',e=>{const tab=e.target.closest('.store-tab');if(!tab||!draggingItem)return;e.preventDefault();const extra=data.extras.find(x=>x.id===draggingItem);if(extra)extra.store=tab.dataset.store;else{data.storeOverrides??={};data.storeOverrides[draggingItem]=tab.dataset.store;}save();activeStore=tab.dataset.store;document.querySelectorAll('.store-tab').forEach(x=>x.classList.toggle('active',x===tab));renderList();});
$('#recipeForm').addEventListener('submit',saveRecipe);$('#recipeSearch').addEventListener('input',renderRecipes);$('#itemForm').addEventListener('submit',e=>{e.preventDefault();data.extras.push({id:uid(),extra:true,week:keyFor(week),name:$('#itemName').value.trim(),amount:$('#itemAmount').value.trim(),store:$('#itemStore').value});save();renderList();e.target.reset();$('#itemDialog').close();});
$('#quickMealName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addQuickMeal();}});
$('#quickEditForm').addEventListener('submit',e=>{e.preventDefault();const meal=(data.quickMeals[selectedDate]||[]).find(m=>m.id===editingQuickId);if(!meal)return;meal.name=$('#quickEditName').value.trim();meal.note=$('#quickEditNote').value.trim();save();renderPlanner();$('#quickEditDialog').close();});
$('#emojiPicker').innerHTML=['🍝','🍛','🍕','🍲','🥗','🌮','🍔','🥘','🥪','🍜','🥞','🐟'].map(emoji=>`<button type="button" data-emoji="${emoji}" aria-label="Kies ${emoji}">${emoji}</button>`).join('');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installButton').hidden=false});$('#installButton').onclick=async()=>{installPrompt.prompt();await installPrompt.userChoice;$('#installButton').hidden=true};
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');renderPlanner();renderRecipes();renderList();

async function connectSharedApp(){
  if(!window.supabase||!window.SUPABASE_URL)return;
  supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
  // Eén gedeeld huishouden: de app opent direct, zonder e-mailstap.
  // Nieuwe vaste opslag voor de actuele appversie. Oude Vercel-links kunnen
  // deze gezamenlijke lijst daardoor niet meer met verouderde data overschrijven.
  householdId='bbd151f1-55d1-4e8c-b976-f02a1d5973d5';
  if(!householdId)return;
  const {data:shared}=await supabaseClient.from('oi_state').select('payload,updated_at').eq('household_id',householdId).single();
  if(shared?.payload&&Object.keys(shared.payload).length){data=shared.payload;lastCloudUpdate=shared.updated_at;lastCloudFingerprint=JSON.stringify(data);renderPlanner();renderRecipes();renderList();}else save();
  supabaseClient.channel(`oi-${householdId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'oi_state',filter:`household_id=eq.${householdId}`},payload=>{data=payload.new.payload;lastCloudUpdate=payload.new.updated_at;lastCloudFingerprint=JSON.stringify(data);localStorage.setItem('samenBoodschappen',JSON.stringify(data));renderPlanner();renderRecipes();renderList();}).subscribe();
  // Realtime is snel; deze korte controle vangt ook mobiele browsers op die
  // een realtime verbinding op de achtergrond tijdelijk pauzeren.
  window.setInterval(loadFromCloud,2000);
  window.addEventListener('focus',loadFromCloud);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadFromCloud();});
}
connectSharedApp();
