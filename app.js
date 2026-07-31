const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID();
const startOfWeek = date => { const d = new Date(date); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d; };
// Gebruik de lokale datum van het apparaat; UTC kon de verkeerde dag markeren.
const keyFor = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt = new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'});
const dayFmt = new Intl.DateTimeFormat('nl-NL',{weekday:'long'});
const initial = {
  recipes:[], plans:{}, extras:[], checked:{}, hidden:{}, dayDone:{}, quickMeals:{}, mealMeta:{}, storeOverrides:{}, temporaryRecipes:{}, customMealItems:{}, mealIngredientOrder:{}, pantry:[], baking:[], version:10
};
let data = JSON.parse(localStorage.getItem('samenBoodschappen') || 'null') || initial;
let selectedWho='both'; let selectedMealIndex; let editingQuickId; let temporaryRecipeDate; let pendingRecipeImage='';
const recipeKey=name=>String(name||'').trim().toLocaleLowerCase('nl-NL');
function upgradeData(){let changed=false;
if((data.version||0)<5){const sampleIds=new Set(['pasta','curry','tacos']);data.recipes=(data.recipes||[]).filter(r=>!sampleIds.has(r.id));Object.keys(data.plans||{}).forEach(date=>data.plans[date]=data.plans[date].filter(id=>!sampleIds.has(id)));data.extras=(data.extras||[]).map(x=>({...x,store:x.store==='any'?'home':x.store}));data.recipes.forEach(r=>r.ingredients=r.ingredients.map(x=>[x[0],x[1],x[2]==='any'?'home':x[2]]));Object.assign(data,{hidden:data.hidden||{},dayDone:data.dayDone||{},quickMeals:data.quickMeals||{},mealMeta:data.mealMeta||{},storeOverrides:data.storeOverrides||{},temporaryRecipes:data.temporaryRecipes||{},customMealItems:data.customMealItems||{}});Object.entries(data.plans).forEach(([date,ids])=>ids.forEach((recipeId,mealIndex)=>{const recipe=data.recipes.find(r=>r.id===recipeId);recipe?.ingredients.forEach((_,ingredientIndex)=>{const oldId=`${date}-${recipeId}-${ingredientIndex}`,newId=`${date}-${mealIndex}-${recipeId}-${ingredientIndex}`;if(data.hidden[oldId])data.hidden[newId]=true;if(data.storeOverrides[oldId])data.storeOverrides[newId]=data.storeOverrides[oldId];})}));data.version=5;changed=true;}
// Extra ingrediënten horen bij één specifieke ingeplande maaltijd. Oude,
// naamloze extra's kunnen anders bij een later recept op dezelfde dag terechtkomen.
if((data.version||0)<6){Object.values(data.customMealItems||{}).forEach(items=>items.forEach(item=>{if(!Object.hasOwn(item,'recipeId'))item.recipeId=null;}));data.version=6;changed=true;}
// Een recept met dezelfde naam is een aanpassing, geen tweede recept. Bij
// oudere data kiezen we de laatst opgeslagen versie en laten we het weekmenu
// daarnaar verwijzen; zo blijft bijvoorbeeld Wortel Juliette zichtbaar.
if((data.version||0)<7){const latestByName=new Map();(data.recipes||[]).forEach(recipe=>{if(recipeKey(recipe.name))latestByName.set(recipeKey(recipe.name),recipe);});const remap=new Map();(data.recipes||[]).forEach(recipe=>{const latest=latestByName.get(recipeKey(recipe.name));if(latest&&latest.id!==recipe.id)remap.set(recipe.id,latest.id);});if(remap.size){Object.keys(data.plans||{}).forEach(date=>data.plans[date]=data.plans[date].map(id=>remap.get(id)||id));data.recipes=data.recipes.filter(recipe=>latestByName.get(recipeKey(recipe.name))===recipe);}data.version=7;changed=true;}
// Ingrediënten krijgen een vaste sleutel op basis van hun naam, niet van hun
// plaats in het recept. Daardoor blijft een oud weggehaald product niet per
// ongeluk een nieuw product op dezelfde plek verbergen.
if((data.version||0)<8){data.version=8;changed=true;}
if((data.version||0)<9){data.pantry=data.pantry||[];data.version=9;changed=true;}
if((data.version||0)<10){data.baking=data.baking||[];data.version=10;changed=true;}
return changed;}
if(upgradeData())localStorage.setItem('samenBoodschappen',JSON.stringify(data));
let week = startOfWeek(new Date()); let selectedDate = keyFor(new Date()); let activeStore='lidl'; let installPrompt;
let supabaseClient, householdId, lastCloudUpdate='', lastCloudFingerprint='', cloudSaveQueue=Promise.resolve();
const save = () => {
  localStorage.setItem('samenBoodschappen',JSON.stringify(data));
  if(supabaseClient&&householdId){const snapshot=JSON.parse(JSON.stringify(data));cloudSaveQueue=cloudSaveQueue.then(()=>saveToCloud(snapshot)).catch(error=>console.error('Opslaan van de gedeelde lijst lukt niet:',error));}
};
async function saveToCloud(snapshot=JSON.parse(JSON.stringify(data))){
  // Sla acties altijd op volgorde op. De extra updated_at-filter voorkomt dat
  // een apparaat een nieuwere wijziging van een ander apparaat overschrijft.
  const query=supabaseClient.from('oi_state').update({payload:snapshot,updated_at:new Date().toISOString()}).eq('household_id',householdId);
  const {data:result,error}=lastCloudUpdate?await query.eq('updated_at',lastCloudUpdate).select('updated_at'):await query.select('updated_at');
  if(error){console.error('Opslaan van de gedeelde lijst lukt niet:',error.message);return;}
  if(!result?.length){console.warn('Een nieuwere wijziging staat al in de cloud; de lijst wordt opnieuw geladen.');await loadFromCloud();return;}
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
    data=shared.payload; const upgraded=upgradeData(); lastCloudUpdate=shared.updated_at;lastCloudFingerprint=JSON.stringify(data);
    localStorage.setItem('samenBoodschappen',JSON.stringify(data));
    renderPlanner();renderRecipes();renderList();if(upgraded)saveToCloud();
  }
}
const esc = s => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function plannedMealsForDate(date){return (data.plans[date]||[]).map((id,mealIndex)=>({recipe:data.recipes.find(r=>r.id===id)||data.temporaryRecipes?.[date]?.find(r=>r.id===id),mealIndex})).filter(meal=>meal.recipe);}
function recipesForDate(date){ return plannedMealsForDate(date).map(meal=>meal.recipe); }
function customItemsForMeal(date,mealIndex,recipeId){return (data.customMealItems?.[`${date}-${mealIndex}`]||[]).filter(item=>item.recipeId===recipeId);}
function ingredientId(date,mealIndex,recipeId,ingredient){return `${date}-${mealIndex}-${recipeId}-ingredient-${encodeURIComponent(recipeKey(ingredient?.[0]))}`;}
function mealIngredientItems(date,mealIndex,recipe){const key=`${date}-${mealIndex}`;const items=[...recipe.ingredients.map(x=>({id:ingredientId(date,mealIndex,recipe.id,x),name:x[0],amount:x[1],store:x[2]})),...customItemsForMeal(date,mealIndex,recipe.id).map(x=>({id:x.id,name:x.name,amount:x.amount,store:x.store}))];const order=data.mealIngredientOrder?.[key]||[];return items.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length:ai)-(bi<0?order.length:bi);});}
function moveMealIngredient(date,mealIndex,id,direction){const key=`${date}-${mealIndex}`,recipe=plannedMealsForDate(date).find(meal=>meal.mealIndex===mealIndex)?.recipe;if(!recipe)return;const order=mealIngredientItems(date,mealIndex,recipe).map(item=>item.id),at=order.indexOf(id),next=at+direction;if(next<0||next>=order.length)return;[order[at],order[next]]=[order[next],order[at]];data.mealIngredientOrder??={};data.mealIngredientOrder[key]=order;save();openMealEditor(date,mealIndex);renderList();}
const whoLabel = who => ({both:'Samen',oppie:'Oppie',ienie:'Ienie'}[who]||'Samen');
function renderPlanner(){
  const end = new Date(week); end.setDate(end.getDate()+6);
  $('#weekLabel').textContent=`${fmt.format(week)} – ${fmt.format(end)}`;
  $('#weekTitle').textContent='Weekmenu'; const today=keyFor(new Date()); let html='';
  for(let i=0;i<7;i++){const d=new Date(week);d.setDate(d.getDate()+i);const k=keyFor(d), meals=plannedMealsForDate(k), quick=data.quickMeals[k]||[];const all=[...meals.map(({recipe:r,mealIndex})=>({name:r.name,emoji:r.emoji,index:mealIndex,who:data.mealMeta[k]?.[mealIndex]?.who||'both'})),...quick.map(m=>({name:m.name,emoji:'🍽️',quickId:m.id,who:m.who||'both'}))]; html+=`<article class="week-day ${k===today?'today':''} ${data.dayDone[k]?'complete':''}" data-date="${k}"><div class="day-top"><input class="day-done" type="checkbox" data-day-done="${k}" ${data.dayDone[k]?'checked':''} aria-label="Dag afvinken"/><span class="day-label">${dayFmt.format(d)}</span><span class="date-number">${d.getDate()}</span></div>${all.length?all.map(m=>`<div class="meal-chip" ${m.quickId?`data-edit-quick="${k}" data-quick-id="${m.quickId}"`:`data-edit-meal="${k}" data-edit-index="${m.index}"`}><span>${m.emoji} ${esc(m.name)}</span><small class="meal-for">${whoLabel(m.who)}</small><button class="meal-remove" ${m.quickId?`data-remove-quick="${k}" data-quick-id="${m.quickId}"`:`data-remove-meal="${k}" data-meal-index="${m.index}"`} aria-label="Verwijder ${esc(m.name)}">×</button></div>`).join(''):'<p class="empty-day">Tik om te plannen</p>'}</article>`;}
  $('#weekGrid').innerHTML=html;
}
function renderRecipes(){
  const term=$('#recipeSearch').value.toLowerCase(); const list=data.recipes.filter(r=>r.name.toLowerCase().includes(term));
  $('#recipeList').innerHTML=list.length?list.map(r=>`<article class="recipe-card" draggable="true" data-drag-recipe="${r.id}" data-edit="${r.id}" role="button" tabindex="0">${r.image?`<img class="recipe-thumb" src="${r.image}" alt="" />`:`<div class="recipe-icon">${r.emoji}</div>`}<div><strong>${esc(r.name)}</strong><p class="recipe-meta">${r.ingredients.length} ingrediënten · ${r.servings} porties · gemaakt door ${whoLabel(r.cook)}</p></div><button class="recipe-delete" type="button" data-delete-recipe="${r.id}" aria-label="Verwijder ${esc(r.name)}" title="Verwijder recept">×</button></article>`).join(''):'<p class="muted">Nog geen gerechten gevonden.</p>';
}
function deleteRecipe(id){
  data.recipes=data.recipes.filter(recipe=>recipe.id!==id);
  Object.entries(data.plans).forEach(([date,recipeIds])=>{
    const kept=recipeIds.map((recipeId,index)=>({recipeId,meta:data.mealMeta[date]?.[index]})).filter(item=>item.recipeId!==id);
    if(kept.length){data.plans[date]=kept.map(item=>item.recipeId);data.mealMeta[date]=kept.map(item=>item.meta||{who:'both'});}
    else{delete data.plans[date];delete data.mealMeta[date];}
  });
  Object.entries(data.temporaryRecipes||{}).forEach(([date,recipes])=>{
    data.temporaryRecipes[date]=recipes.filter(recipe=>recipe.id!==id);
    if(!data.temporaryRecipes[date].length)delete data.temporaryRecipes[date];
  });
  save();renderRecipes();renderPlanner();renderList();
}
function weekItems(){
  let items=[]; for(let i=0;i<7;i++){const date=keyFor(new Date(week.getFullYear(),week.getMonth(),week.getDate()+i)),day=dayFmt.format(new Date(`${date}T12:00:00`));plannedMealsForDate(date).forEach(({recipe:r,mealIndex})=>{mealIngredientItems(date,mealIndex,r).forEach(x=>items.push({id:x.id,name:x.name,amount:x.amount,store:data.storeOverrides?.[x.id]||x.store,source:r.name,day}));});(data.quickMeals[date]||[]).forEach(meal=>{const id=`quick-${meal.id}`;items.push({id,name:meal.name,amount:'1',store:data.storeOverrides?.[id]||meal.store||'lidl',source:'Snel ingepland',day});});} return items.concat(data.extras.filter(x=>x.week===keyFor(week))).filter(x=>!data.hidden?.[x.id]);
}
function renderList(){
  const items=weekItems(); $('#listSummary').textContent=items.length?`${items.length} boodschappen uit je weekmenu.`:'Plan een gerecht of voeg een los item toe.';
  const visible=items.filter(x=>activeStore==='stores'?['lidl','jumbo'].includes(x.store):x.store===activeStore); $('#shoppingList').innerHTML=visible.length?visible.map(x=>`<label draggable="true" class="shopping-item ${data.checked[x.id]?'done':''}" data-drag-item="${x.id}"><input type="checkbox" data-check="${x.id}" ${data.checked[x.id]?'checked':''}/><div class="item-main"><strong class="item-name">${esc(x.name)}</strong><div class="item-detail">${x.source?`${esc(x.source)} · ${esc(x.day)}`:esc(x.amount)}</div></div><button class="delete" data-remove-item="${x.id}" aria-label="Verwijder">×</button></label>`).join(''):'<p class="muted">Hier staat nog niets. Voeg een gerecht of los item toe.</p>';
}
function ingredientRow(values=['','1','lidl']){return `<div class="ingredient-row"><label>Product<input required value="${esc(values[0])}" placeholder="Product" /></label><label>Aantal / gram<input value="${esc(values[1])}" placeholder="Bijv. 250 g" /></label><label>Winkel<select><option value="lidl" ${values[2]==='lidl'?'selected':''}>Lidl</option><option value="jumbo" ${values[2]==='jumbo'?'selected':''}>Jumbo</option><option value="home" ${values[2]==='home'?'selected':''}>Thuis</option><option value="online" ${values[2]==='online'?'selected':''}>Online</option><option value="drugstore" ${values[2]==='drugstore'?'selected':''}>Drogist</option></select></label><span class="ingredient-move"><button type="button" data-move-recipe-row="-1" aria-label="Ingrediënt omhoog">↑</button><button type="button" data-move-recipe-row="1" aria-label="Ingrediënt omlaag">↓</button></span><button class="delete remove-row" type="button">×</button></div>`}
function openRecipe(recipe){
  pendingRecipeImage=recipe?.image||'';$('#recipeId').value=recipe?.id||'';$('#recipeName').value=recipe?.name||'';$('#recipeServings').value=recipe?.servings||2;$('#recipeCook').value=recipe?.cook||'both';$('#recipeEmoji').value=recipe?.emoji||'🍽️';$('#recipePhoto').value='';$('#recipePhotoPreview').src=pendingRecipeImage;$('#recipePhotoPreview').hidden=!pendingRecipeImage;$('#emojiPicker').hidden=true;$('#recipeNote').value=recipe?.note||'';$('#recipeInstructions').value=recipe?.instructions||'';$('#recipeDialogEyebrow').textContent=recipe?'RECEPT BEWERKEN':'NIEUW RECEPT';$('#recipeDialogTitle').textContent=recipe?'Gerecht aanpassen':temporaryRecipeDate?'Gerecht voor deze dag maken':'Een gerecht maken';$('#ingredientRows').innerHTML=(recipe?.ingredients||[['','1','lidl']]).map(ingredientRow).join('');$('#recipeDialog').showModal();
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
  $('#quickMealStore').value='lidl';
  $('#mealPickerTitle').textContent=`Gerecht kiezen voor ${dayFmt.format(new Date(`${selectedDate}T12:00:00`))}`;
  document.querySelectorAll('[data-who]').forEach(x=>x.classList.toggle('active',x.dataset.who==='both'));
  renderMealChoices();
  $('#mealDialog').showModal();
}
function openMealEditor(date,mealIndex){
  selectedDate=date;selectedMealIndex=mealIndex; const recipe=plannedMealsForDate(date).find(meal=>meal.mealIndex===mealIndex)?.recipe;if(!recipe)return;const who=data.mealMeta[date]?.[mealIndex]?.who||'both';$('#mealEditTitle').textContent=`${recipe.emoji} ${recipe.name}`;
  const makeIngredient=item=>{if(data.hidden?.[item.id])return '';const store=data.storeOverrides?.[item.id]||item.store;return `<div class="detail-ingredient"><span>${esc(item.name)}<small class="item-detail"> · ${esc(item.amount)}</small></span><select data-detail-store="${item.id}"><option value="lidl" ${store==='lidl'?'selected':''}>Lidl</option><option value="jumbo" ${store==='jumbo'?'selected':''}>Jumbo</option><option value="home" ${store==='home'?'selected':''}>Thuis</option><option value="online" ${store==='online'?'selected':''}>Online</option><option value="drugstore" ${store==='drugstore'?'selected':''}>Drogist</option></select><span class="detail-move"><button type="button" data-detail-move="-1" data-detail-id="${item.id}" aria-label="${esc(item.name)} omhoog">↑</button><button type="button" data-detail-move="1" data-detail-id="${item.id}" aria-label="${esc(item.name)} omlaag">↓</button></span><button type="button" class="delete" data-detail-remove="${item.id}" aria-label="Verwijder ${esc(item.name)}">×</button></div>`};
  const ingredients=mealIngredientItems(date,mealIndex,recipe).map(makeIngredient).join('');
  $('#mealEditDetails').innerHTML=`<section class="detail-meal"><p class="item-detail">Voor ${whoLabel(who)}</p>${ingredients||'<p class="muted">Alle ingrediënten zijn verwijderd.</p>'}<div class="detail-add"><input id="detailAddName" placeholder="Bijv. extra tomaten" /><input id="detailAddAmount" placeholder="Aantal" value="1" /><button type="button" class="secondary" data-detail-add>＋ toevoegen</button></div></section>`;$('#mealEditDialog').showModal();
}
function openQuickEditor(date,id){selectedDate=date;editingQuickId=id;const meal=(data.quickMeals[date]||[]).find(m=>m.id===id);if(!meal)return;$('#quickEditName').value=meal.name;$('#quickEditNote').value=meal.note||'';$('#quickEditDialog').showModal();}
function saveRecipe(e){e.preventDefault();const rows=[...document.querySelectorAll('.ingredient-row')];const ingredients=rows.map(row=>{const x=row.querySelectorAll('input,select');return [x[0].value.trim(),x[1].value.trim(),x[2].value]}).filter(x=>x[0]);if(!ingredients.length)return;const matchingRecipe=data.recipes.find(r=>recipeKey(r.name)===recipeKey($('#recipeName').value));const id=$('#recipeId').value||matchingRecipe?.id||uid();const recipe={id,name:$('#recipeName').value.trim(),servings:+$('#recipeServings').value,cook:$('#recipeCook').value,emoji:$('#recipeEmoji').value||'🍽️',image:pendingRecipeImage,note:$('#recipeNote').value.trim(),instructions:$('#recipeInstructions').value.trim(),ingredients}; const old=data.recipes.findIndex(r=>r.id===id);if(old>-1)data.recipes[old]=recipe;else if(temporaryRecipeDate){data.temporaryRecipes??={};data.temporaryRecipes[temporaryRecipeDate]??=[];data.temporaryRecipes[temporaryRecipeDate].push(recipe);selectedDate=temporaryRecipeDate;temporaryRecipeDate=undefined;addToPlan(id);}else data.recipes.push(recipe);save();renderRecipes();renderPlanner();renderList();$('#recipeDialog').close();}
function addToPlan(id){data.plans[selectedDate]??=[];data.mealMeta[selectedDate]??=[];data.plans[selectedDate].push(id);data.mealMeta[selectedDate].push({who:selectedWho});save();renderPlanner();renderList();if($('#mealDialog').open)$('#mealDialog').close();}
function addQuickMeal(){const name=$('#quickMealName').value.trim();if(!name)return;data.quickMeals[selectedDate]??=[];data.quickMeals[selectedDate].push({id:uid(),name,who:selectedWho,note:'',store:$('#quickMealStore').value});save();renderPlanner();renderList();$('#mealDialog').close();}

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]');if(nav){document.querySelectorAll('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${nav.dataset.view}`).classList.add('active');nav.classList.add('active');}
  const done=e.target.closest('[data-day-done]');if(done){data.dayDone[done.dataset.dayDone]=done.checked;save();renderPlanner();return;}
  const removeMeal=e.target.closest('[data-remove-meal]');if(removeMeal){const date=removeMeal.dataset.removeMeal,index=+removeMeal.dataset.mealIndex;data.plans[date].splice(index,1);data.mealMeta[date]?.splice(index,1);if(!data.plans[date].length){delete data.plans[date];delete data.mealMeta[date];}save();renderPlanner();renderList();return;}
  const removeQuick=e.target.closest('[data-remove-quick]');if(removeQuick){const date=removeQuick.dataset.removeQuick,items=data.quickMeals[date]||[];data.quickMeals[date]=items.filter(m=>m.id!==removeQuick.dataset.quickId);if(!data.quickMeals[date].length)delete data.quickMeals[date];save();renderPlanner();renderList();return;}
  const editQuick=e.target.closest('[data-edit-quick]');if(editQuick){openQuickEditor(editQuick.dataset.editQuick,editQuick.dataset.quickId);return;}
  const editMeal=e.target.closest('[data-edit-meal]');if(editMeal){openMealEditor(editMeal.dataset.editMeal,+editMeal.dataset.editIndex);return;}
  const day=e.target.closest('.week-day');if(day)openMealPicker(day.dataset.date);
  if(e.target.closest('#newRecipeButton')){temporaryRecipeDate=undefined;openRecipe();}
  const deleteRecipeButton=e.target.closest('[data-delete-recipe]');if(deleteRecipeButton){deleteRecipe(deleteRecipeButton.dataset.deleteRecipe);return;}
  const edit=e.target.closest('[data-edit]');if(edit)openRecipe(data.recipes.find(r=>r.id===edit.dataset.edit));const plan=e.target.closest('[data-plan-recipe]');if(plan){selectedDate=keyFor(week);addToPlan(plan.dataset.planRecipe);}
  const pick=e.target.closest('[data-pick]');if(pick)addToPlan(pick.dataset.pick);
  const who=e.target.closest('[data-who]');if(who){selectedWho=who.dataset.who;document.querySelectorAll('[data-who]').forEach(x=>x.classList.toggle('active',x===who));}
  if(e.target.closest('#emojiToggle')){$('#emojiPicker').hidden=!$('#emojiPicker').hidden;return;}const emoji=e.target.closest('[data-emoji]');if(emoji){$('#recipeEmoji').value=emoji.dataset.emoji;$('#emojiPicker').hidden=true;}
  const card=e.target.closest('[data-open-card]');if(card){const cards={lidl:{title:'Lidl Plus',src:'Foto/LIDL.jpg'},jumbo:{title:'Jumbo',src:'Foto/JUMBO.jpg'},ah:{title:'Albert Heijn',src:'Foto/Albert%20Heijn.jpg'}};const selected=cards[card.dataset.openCard];$('#cardDialogTitle').textContent=selected.title;$('#cardDialogImage').src=selected.src;$('#cardDialogImage').alt=`${selected.title} bonuskaart`;$('#cardDialog').showModal();}
  if(e.target.closest('#addQuickMeal'))addQuickMeal();
  if(e.target.closest('#mealNewRecipe')){temporaryRecipeDate=selectedDate;$('#mealDialog').close();openRecipe();} if(e.target.closest('#addIngredient'))$('#ingredientRows').insertAdjacentHTML('beforeend',ingredientRow());const moveRecipeRow=e.target.closest('[data-move-recipe-row]');if(moveRecipeRow){const row=moveRecipeRow.closest('.ingredient-row'),direction=+moveRecipeRow.dataset.moveRecipeRow,sibling=direction<0?row.previousElementSibling:row.nextElementSibling;if(sibling){if(direction<0)sibling.before(row);else sibling.after(row);}return;}if(e.target.closest('.remove-row'))e.target.closest('.ingredient-row').remove();
  const addDetail=e.target.closest('[data-detail-add]');if(addDetail){const name=$('#detailAddName').value.trim();if(name){const key=`${selectedDate}-${selectedMealIndex}`;const recipe=plannedMealsForDate(selectedDate).find(meal=>meal.mealIndex===selectedMealIndex)?.recipe;data.customMealItems??={};data.customMealItems[key]??=[];data.customMealItems[key].push({id:`${selectedDate}-${selectedMealIndex}-custom-${uid()}`,recipeId:recipe?.id,name,amount:$('#detailAddAmount').value.trim()||'1',store:'lidl'});save();openMealEditor(selectedDate,selectedMealIndex);renderList();}return;}
  const removeDetail=e.target.closest('[data-detail-remove]');if(removeDetail){const id=removeDetail.dataset.detailRemove;const key=`${selectedDate}-${selectedMealIndex}`;const custom=data.customMealItems?.[key],customIndex=custom?.findIndex(x=>x.id===id)??-1;if(customIndex>-1)data.customMealItems[key]=custom.filter(x=>x.id!==id);else{data.hidden??={};data.hidden[id]=true;}save();openMealEditor(selectedDate,selectedMealIndex);renderList();}
  const moveDetail=e.target.closest('[data-detail-move]');if(moveDetail){moveMealIngredient(selectedDate,selectedMealIndex,moveDetail.dataset.detailId,+moveDetail.dataset.detailMove);return;}
  const close=e.target.closest('[data-close]');if(close){if(close.dataset.close==='recipeDialog')temporaryRecipeDate=undefined;$(`#${close.dataset.close}`).close();}
  const tab=e.target.closest('.store-tab');if(tab){activeStore=tab.dataset.store;document.querySelectorAll('.store-tab').forEach(x=>x.classList.toggle('active',x===tab));renderList();}
  const del=e.target.closest('[data-remove-item]');if(del){const id=del.dataset.removeItem;const extra=data.extras.find(x=>x.id===id);if(extra)data.extras=data.extras.filter(x=>x.id!==id);else{data.hidden??={};data.hidden[id]=true;}delete data.checked[id];save();renderList();}
  if(e.target.closest('#addItemButton'))$('#itemDialog').showModal();if(e.target.closest('#clearChecked')){const selected=Object.keys(data.checked).filter(id=>data.checked[id]);data.extras=data.extras.filter(x=>!selected.includes(x.id));data.hidden??={};selected.forEach(id=>{if(!data.extras.some(x=>x.id===id))data.hidden[id]=true;delete data.checked[id];});save();renderList();}
  if(e.target.closest('#previousWeek')){week.setDate(week.getDate()-7);renderPlanner();renderList()}if(e.target.closest('#nextWeek')){week.setDate(week.getDate()+7);renderPlanner();renderList()}
});
document.addEventListener('change',e=>{if(e.target.matches('[data-check]')){data.checked[e.target.dataset.check]=e.target.checked;save();renderList();}if(e.target.matches('[data-detail-store]')){data.storeOverrides??={};data.storeOverrides[e.target.dataset.detailStore]=e.target.value;save();renderList();}});
let draggingItem,draggingRecipe;
document.addEventListener('dragstart',e=>{const recipe=e.target.closest('[data-drag-recipe]');if(!recipe)return;draggingRecipe=recipe.dataset.dragRecipe;recipe.classList.add('dragging-recipe');e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragend',e=>{if(!e.target.closest('[data-drag-recipe]'))return;e.target.closest('[data-drag-recipe]').classList.remove('dragging-recipe');document.querySelectorAll('[data-drag-recipe]').forEach(recipe=>recipe.classList.remove('recipe-drop-target'));draggingRecipe=undefined;});
document.addEventListener('dragover',e=>{const recipe=e.target.closest('[data-drag-recipe]');if(!recipe||!draggingRecipe||recipe.dataset.dragRecipe===draggingRecipe)return;e.preventDefault();recipe.classList.add('recipe-drop-target');});
document.addEventListener('dragleave',e=>e.target.closest('[data-drag-recipe]')?.classList.remove('recipe-drop-target'));
document.addEventListener('drop',e=>{const target=e.target.closest('[data-drag-recipe]');if(!target||!draggingRecipe||target.dataset.dragRecipe===draggingRecipe)return;e.preventDefault();const from=data.recipes.findIndex(recipe=>recipe.id===draggingRecipe),to=data.recipes.findIndex(recipe=>recipe.id===target.dataset.dragRecipe);if(from<0||to<0)return;const [recipe]=data.recipes.splice(from,1);data.recipes.splice(to,0,recipe);save();renderRecipes();draggingRecipe=undefined;});
document.addEventListener('dragstart',e=>{const item=e.target.closest('[data-drag-item]');if(!item)return;draggingItem=item.dataset.dragItem;item.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragend',e=>{e.target.closest('[data-drag-item]')?.classList.remove('dragging');document.querySelectorAll('.store-tab').forEach(x=>x.classList.remove('drop-target'));draggingItem=undefined;});
document.addEventListener('dragover',e=>{const tab=e.target.closest('.store-tab');if(!tab||!draggingItem)return;e.preventDefault();tab.classList.add('drop-target');});
document.addEventListener('dragleave',e=>e.target.closest('.store-tab')?.classList.remove('drop-target'));
document.addEventListener('drop',e=>{const tab=e.target.closest('.store-tab');if(!tab||!draggingItem)return;e.preventDefault();const extra=data.extras.find(x=>x.id===draggingItem);if(extra)extra.store=tab.dataset.store;else{data.storeOverrides??={};data.storeOverrides[draggingItem]=tab.dataset.store;}save();activeStore=tab.dataset.store;document.querySelectorAll('.store-tab').forEach(x=>x.classList.toggle('active',x===tab));renderList();});
$('#recipeForm').addEventListener('submit',saveRecipe);$('#recipeSearch').addEventListener('input',renderRecipes);$('#itemForm').addEventListener('submit',e=>{e.preventDefault();data.extras.push({id:uid(),extra:true,week:keyFor(week),name:$('#itemName').value.trim(),amount:$('#itemAmount').value.trim(),store:$('#itemStore').value});save();renderList();e.target.reset();$('#itemDialog').close();});
$('#quickMealName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addQuickMeal();}});
$('#quickEditForm').addEventListener('submit',e=>{e.preventDefault();const meal=(data.quickMeals[selectedDate]||[]).find(m=>m.id===editingQuickId);if(!meal)return;meal.name=$('#quickEditName').value.trim();meal.note=$('#quickEditNote').value.trim();save();renderPlanner();renderList();$('#quickEditDialog').close();});
$('#emojiPicker').innerHTML=['🍝','🍛','🍕','🍲','🥗','🌮','🍔','🥘','🥪','🍜','🥞','🐟','🍗','🍖','🥩','🍤','🍣','🍱','🍙','🍚','🍢','🥟','🍳','🥚','🧀','🥔','🥕','🌽','🍅','🥦','🥬','🍄','🫑','🧅','🧄','🫘','🍞','🥐','🥯','🧇','🍰','🍩','🍪','🍓','🍌','🍉','🍏','🍋','🥑','🫐','🥥','🍨','🍫','☕️','🧃','🥤','🍷'].map(emoji=>`<button type="button" data-emoji="${emoji}" aria-label="Kies ${emoji}">${emoji}</button>`).join('');
$('#recipePhoto').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>700*1024){alert('Kies een foto kleiner dan 700 KB.');event.target.value='';return;}const reader=new FileReader();reader.onload=()=>{pendingRecipeImage=reader.result;$('#recipePhotoPreview').src=pendingRecipeImage;$('#recipePhotoPreview').hidden=false;};reader.readAsDataURL(file);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installButton').hidden=false});$('#installButton').onclick=async()=>{installPrompt.prompt();await installPrompt.userChoice;$('#installButton').hidden=true};
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');renderPlanner();renderRecipes();renderList();

// Kleine, expliciete brug voor losse UI-uitbreidingen in patch.js. De
// gegevens zelf blijven privé in dit bestand; uitbreidingen krijgen alleen
// de acties die ze nodig hebben.
window.oppieApp={get data(){return data;},save,renderRecipes,uid,esc,generateRecipeWithAI};

async function generateRecipeWithAI(pantry,householdCode,mode='voorraad',excludedRecipeName='',bakingFeedback=''){
  if(!supabaseClient)throw new Error('De gedeelde verbinding is nog niet klaar. Probeer het zo nog eens.');
const {data:result,error}=await supabaseClient.functions.invoke('generate-recipe',{body:{pantry,householdCode,mode,excludedRecipeName,bakingFeedback}});
  if(error){const responseError=await error.context?.json?.().catch(()=>null);throw new Error(responseError?.error||'Het recept kon nu niet worden gemaakt.');}
  if(!result?.recipe)throw new Error(result?.error||'Er kwam geen bruikbaar recept terug.');
  return result.recipe;
}

async function connectSharedApp(){
  if(!window.supabase||!window.SUPABASE_URL)return;
  supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
  householdId='bbd151f1-55d1-4e8c-b976-f02a1d5973d5';
  const {data:shared}=await supabaseClient.from('oi_state').select('payload,updated_at').eq('household_id',householdId).single();
  if(shared?.payload&&Object.keys(shared.payload).length){data=shared.payload;const upgraded=upgradeData();lastCloudUpdate=shared.updated_at;lastCloudFingerprint=JSON.stringify(data);localStorage.setItem('samenBoodschappen',JSON.stringify(data));renderPlanner();renderRecipes();renderList();if(upgraded)saveToCloud();}else save();
  supabaseClient.channel(`oi-${householdId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'oi_state',filter:`household_id=eq.${householdId}`},payload=>{data=payload.new.payload;const upgraded=upgradeData();lastCloudUpdate=payload.new.updated_at;lastCloudFingerprint=JSON.stringify(data);localStorage.setItem('samenBoodschappen',JSON.stringify(data));renderPlanner();renderRecipes();renderList();if(upgraded)saveToCloud();}).subscribe();
  // Realtime is snel; deze korte controle vangt ook mobiele browsers op die
  // een realtime verbinding op de achtergrond tijdelijk pauzeren.
  window.setInterval(loadFromCloud,2000);
  window.addEventListener('focus',loadFromCloud);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadFromCloud();});
}
connectSharedApp();
