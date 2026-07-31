(() => {
  const localKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const fixToday = () => document.querySelectorAll('.week-day').forEach(day => day.classList.toggle('today',day.dataset.date===localKey()));
  const observer=new MutationObserver(fixToday); observer.observe(document.querySelector('#weekGrid'),{childList:true}); fixToday(); setInterval(fixToday,500);

  // Voorraad en receptvoorstellen blijven in dezelfde gedeelde app-data als
  // boodschappen en recepten, zodat Oppie en Ienie steeds dezelfde kast zien.
  const app=window.oppieApp;
  app.data.pantry=app.data.pantry||[];
  const access=document.createElement('dialog');
  access.id='houseCodeDialog'; access.className='house-code-dialog';
  access.innerHTML=`<form id="houseCodeForm" class="modal small"><div class="house-code-icon">🏠</div><p class="eyebrow">OPPIE EN IENIE</p><h2>Welkom thuis</h2><p class="muted">Voer jullie huiscode in om de gedeelde app te openen.</p><label>Huiscode<input id="houseCodeInput" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="••••••" /></label><p id="houseCodeError" class="house-code-error" hidden>Die code klopt niet. Probeer het nog eens.</p><button class="primary wide" type="submit">Open de app</button></form>`;
  document.body.append(access);
  let householdCode=localStorage.getItem('oiHouseholdCode')||'';
  const showHouseCode=()=>{if(!householdCode)access.showModal();};
  document.querySelector('#houseCodeForm').addEventListener('submit',event=>{event.preventDefault();const code=document.querySelector('#houseCodeInput').value.trim();if(code!=='582267'){document.querySelector('#houseCodeError').hidden=false;return;}householdCode=code;localStorage.setItem('oiHouseholdCode',code);access.close();});
  showHouseCode();
  const pantry=document.createElement('section');
  pantry.id='pantryView'; pantry.className='view';
  pantry.innerHTML=`
    <div class="section-heading"><div><h2>Voorraad</h2></div></div>
    <div class="pantry-intro card"><div><strong>Koken met wat er al is</strong><p>Voeg producten toe die thuis liggen. Daarna bedenken we een passend recept.</p></div></div>
    <form id="pantryForm" class="pantry-form"><input id="pantryName" required autocomplete="off" placeholder="Bijv. pasta, tomaten, kikkererwten" /><input id="pantryAmount" autocomplete="off" placeholder="Hoeveel?" /><button class="secondary" type="submit">Toevoegen</button></form>
    <div id="pantryList" class="pantry-list"></div>
    <button id="generatePantryRecipe" class="primary wide pantry-generate" type="button">Bedenk een recept</button>
    <p id="pantryHint" class="muted pantry-hint">Voeg minimaal twee producten toe voor een voorstel.</p>
    <div id="pantryRecipe" class="pantry-recipe" hidden></div>`;
  document.querySelector('main').append(pantry);
  const nav=document.querySelector('.bottom-nav');
  const pantryButton=document.createElement('button'); pantryButton.className='nav-item'; pantryButton.dataset.view='pantryView'; pantryButton.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 9.5h14l-1 10H6l-1-10Z"/><path d="M8.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5M4 9.5h16"/></svg></span><span class="nav-label">Voorraad</span>';
  nav.append(pantryButton);

  function renderPantry(){
    const list=document.querySelector('#pantryList'), items=app.data.pantry||[];
    list.innerHTML=items.length?items.map(item=>`<div class="pantry-item"><div><strong>${app.esc(item.name)}</strong>${item.amount?`<small>${app.esc(item.amount)}</small>`:''}</div><button type="button" class="delete" data-remove-pantry="${item.id}" aria-label="Verwijder ${app.esc(item.name)}">×</button></div>`).join(''):'<p class="muted pantry-empty">Je voorraad is nog leeg. Begin met een paar producten die je in huis hebt.</p>';
    document.querySelector('#generatePantryRecipe').disabled=items.length<2;
    document.querySelector('#pantryHint').textContent=items.length<2?'Voeg minimaal twee producten toe voor een voorstel.':`${items.length} producten in huis — klaar voor een receptidee.`;
  }
  function recipeSteps(instructions){return String(instructions||'').split(/\s*(?:\d+[.)])\s*/).map(step=>step.trim()).filter(Boolean)}
  function showPantryRecipe(recipe,notice='Receptvoorstel op basis van jullie voorraad'){
    const card=document.querySelector('#pantryRecipe'); card.hidden=false; card.dataset.recipe=JSON.stringify(recipe);
    const steps=recipeSteps(recipe.instructions);const ingredients=(recipe.ingredients||[]).map(item=>`<span>${app.esc(item[0])}${item[1]?` <small>${app.esc(item[1])}</small>`:''}</span>`).join('');
    card.innerHTML=`<p class="eyebrow">${notice.toUpperCase()}</p><h3>${app.esc(recipe.name)}</h3><p class="pantry-recipe-note">${app.esc(recipe.note||'')}</p><div class="pantry-recipe-ingredients">${ingredients}</div><ol class="pantry-steps">${steps.map(step=>`<li>${app.esc(step)}</li>`).join('')}</ol><div class="pantry-recipe-actions"><button type="button" class="secondary" id="savePantryRecipe">Opslaan bij Recepten</button><button type="button" class="secondary" id="otherPantryRecipe">Andere optie</button></div>`;
  }
  function generatePantryRecipe(button){const items=app.data.pantry||[];if(items.length<2)return;button.disabled=true;const originalLabel=button.textContent;button.textContent='Recept wordt bedacht…';app.generateRecipeWithAI(items,householdCode).then(recipe=>{recipe.id=app.uid();recipe.cook=recipe.cook||'both';recipe.image='';showPantryRecipe(recipe,'Recept op basis van jullie voorraad');}).catch(error=>{document.querySelector('#pantryHint').textContent=error.message;}).finally(()=>{button.disabled=false;button.textContent=originalLabel;});}
  document.querySelector('#pantryForm').addEventListener('submit',event=>{event.preventDefault();const name=document.querySelector('#pantryName').value.trim();if(!name)return;app.data.pantry.push({id:app.uid(),name,amount:document.querySelector('#pantryAmount').value.trim()});app.save();event.target.reset();renderPantry();});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="pantryView"]'))renderPantry();
    const remove=event.target.closest('[data-remove-pantry]');if(remove){app.data.pantry=app.data.pantry.filter(item=>item.id!==remove.dataset.removePantry);app.save();renderPantry();return;}
    if(event.target.closest('#generatePantryRecipe')){generatePantryRecipe(event.target.closest('#generatePantryRecipe'));return;}
    if(event.target.closest('#otherPantryRecipe')){generatePantryRecipe(event.target.closest('#otherPantryRecipe'));return;}
    if(event.target.closest('#savePantryRecipe')){const recipe=JSON.parse(document.querySelector('#pantryRecipe').dataset.recipe||'null');if(!recipe)return;app.data.recipes.push(recipe);app.save();app.renderRecipes();document.querySelector('#pantryHint').textContent='Opgeslagen bij Recepten — klaar om in te plannen!';event.target.textContent='✓ Opgeslagen bij Recepten';event.target.disabled=true;}
  });
  renderPantry();

  const game=document.createElement('section');
  game.id='gameView'; game.className='view';
  game.innerHTML=`
    <div class="section-heading"><div><p class="eyebrow">EVEN PAUZE</p><h2>Rendier-sprong</h2></div></div>
    <div class="reindeer-game">
      <p class="game-intro">Spring op tijd over de gansjes. Om de derde sprong komt er een klein eendje aan.</p>
      <div class="game-hud"><span>Score <strong id="gameScore">0</strong></span><span id="gameHighscoreLabel">Highscore <strong id="gameHighscore">0</strong></span></div>
      <div id="gameField" class="game-field" aria-label="Rendier-sprong spel">
        <div class="game-sun">☀️</div><div class="game-cloud cloud-one">☁️</div><div class="game-cloud cloud-two">☁️</div>
        <div class="forest forest-back">🌲　🌲　🌲　🌲</div><div class="forest forest-front">🌲　🌲　🌲</div>
        <div id="reindeer" aria-label="Rendier">🦌</div>
      </div>
      <button id="jumpButton" class="primary wide" type="button">Spring! ↑</button>
      <button id="restartGame" class="secondary wide" type="button" hidden>↻ Opnieuw spelen</button>
      <div id="highscoreForm" class="highscore-form" hidden><strong>🏆 Nieuwe highscore!</strong><label>Jouw naam<input id="highscoreName" maxlength="18" placeholder="Bijv. Oppie" /></label><button id="saveHighscoreName" type="button" class="secondary wide">Naam bewaren</button></div>
      <p id="gameMessage" class="muted game-message">Druk op A, de knop of de spatiebalk om te springen.</p>
    </div>`;
  document.querySelector('main').append(game);
  const b=document.createElement('button'); b.className='nav-item'; b.dataset.view='gameView'; b.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="11" rx="4"/><path d="M8 10v5M5.5 12.5h5M16.5 11h.01M18.5 14h.01"/></svg></span><span class="nav-label">Spel</span>'; nav.append(b);

  const style=document.createElement('style'); style.textContent=`
    .reindeer-game{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px}.game-intro{font-size:14px;color:var(--muted);margin-bottom:12px}.game-hud{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:12px}.game-hud span{background:#f0f7d4;border-radius:11px;padding:8px 10px;color:var(--green)}
    .house-code-dialog .modal{text-align:center}.house-code-dialog h2{margin:3px 0 6px}.house-code-dialog .muted{margin-bottom:18px}.house-code-icon{width:54px;height:54px;display:grid;place-items:center;margin:0 auto 13px;border-radius:18px;background:#f0f7d4;font-size:27px}.house-code-dialog label{text-align:left}.house-code-dialog input{text-align:center;letter-spacing:9px;font-size:24px;font-weight:800}.house-code-error{margin:-4px 0 12px;color:var(--red);font-weight:700}
    .pantry-intro{padding:15px 16px;margin-bottom:12px}.pantry-intro p{font-size:13px;color:var(--muted);margin-top:2px}.pantry-form{display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:7px;margin-bottom:12px}.pantry-form input{min-width:0;border:1px solid var(--line);border-radius:11px;padding:11px;font:14px inherit}.pantry-form .secondary{padding:0 11px;font-size:13px;white-space:nowrap}.pantry-list{display:grid;gap:7px;margin-bottom:14px}.pantry-item{display:flex;align-items:center;padding:11px 13px;background:#fff;border:1px solid var(--line);border-radius:13px}.pantry-item>div{display:grid;flex:1}.pantry-item small{font-size:12px;color:var(--muted)}.pantry-empty{padding:15px 2px}.pantry-generate:disabled{opacity:.45;cursor:not-allowed}.pantry-hint{text-align:center;margin:9px 0 13px}.pantry-recipe{border:1px solid #b9d15f;background:#fbfdf4;border-radius:18px;padding:18px}.pantry-recipe h3{font-size:24px;line-height:1.18;margin:5px 0}.pantry-recipe-note{color:var(--muted);font-size:14px;margin:0 0 14px}.pantry-recipe-ingredients{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}.pantry-recipe-ingredients span{background:#edf6d6;color:var(--green);border-radius:999px;padding:6px 9px;font-size:13px;font-weight:700}.pantry-recipe-ingredients small{font:inherit;font-weight:500;opacity:.8}.pantry-steps{display:grid;gap:11px;margin:0;padding-left:21px;color:#46534d}.pantry-steps li{padding-left:3px;line-height:1.45}.pantry-recipe-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.pantry-recipe-actions .secondary{margin:0;background:#fff;padding:12px 10px;font-size:13px}.pantry-recipe-actions button:disabled{opacity:.55;cursor:not-allowed}
    .game-field{height:290px;position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(#86d7fa 0 65%,#8fca68 65% 100%);margin-bottom:14px;isolation:isolate}.game-field:after{content:'';position:absolute;z-index:-1;inset:auto 0 0;height:35%;background:repeating-linear-gradient(110deg,rgba(71,139,66,.2) 0 24px,transparent 24px 48px);animation:ground-scroll .8s linear infinite}.game-field.snowing:before{content:'❄️　❅　❄️　❅　❄️　❅　❄️';position:absolute;z-index:8;inset:8px -30px auto;font-size:27px;white-space:nowrap;pointer-events:none;animation:snow-fall 2.7s linear infinite}.game-sun{position:absolute;right:18px;top:12px;font-size:48px;filter:drop-shadow(0 0 13px #ffe86e);animation:sun-glow 2s ease-in-out infinite alternate}.game-cloud{position:absolute;top:39px;font-size:34px;opacity:.82;animation:cloud-drift 16s linear infinite}.cloud-one{left:11%}.cloud-two{left:65%;top:78px;animation-duration:22s}.forest{position:absolute;white-space:nowrap;line-height:1;pointer-events:none}.forest-back{left:-3%;right:0;bottom:28px;font-size:112px;opacity:.83;z-index:0}.forest-front{left:-4%;right:0;bottom:26px;font-size:130px;opacity:.94;z-index:2}.game-obstacle{position:absolute;bottom:34px;z-index:3;line-height:1;will-change:transform}.game-obstacle.goose{font-size:43px}.game-obstacle.duck{font-size:28px;bottom:37px}.game-obstacle.bear{font-size:43px;bottom:34px}.game-bonus{position:absolute;z-index:6;font-size:46px;line-height:1;will-change:transform;filter:drop-shadow(0 2px 3px rgba(22,93,61,.22));animation:bonus-float .9s ease-in-out infinite alternate}.game-field #reindeer{position:absolute;left:42%;bottom:34px;z-index:4;font-size:68px;line-height:1;will-change:transform;transform:scaleX(-1);filter:drop-shadow(0 3px 1px rgba(0,0,0,.14))}.game-field #reindeer.jumping{animation:deer-jump .58s cubic-bezier(.3,.08,.55,1) forwards}.highscore-form{margin:12px 0;padding:12px;border:1px solid #b9d15f;border-radius:14px;background:#f0f7d4;color:var(--green)}.highscore-form label{display:block;font-size:13px;font-weight:700;margin:9px 0}.highscore-form input{display:block;width:100%;border:1px solid var(--line);border-radius:9px;padding:9px;margin-top:4px;font:inherit}.game-message{text-align:center;min-height:20px;margin-top:11px}.game-field.game-over{filter:saturate(.7)}
    @keyframes deer-jump{0%,100%{transform:scaleX(-1) translateY(0)}48%{transform:scaleX(-1) translateY(-142px)}58%{transform:scaleX(-1) translateY(-142px)}}@keyframes ground-scroll{to{background-position:-48px 0}}@keyframes cloud-drift{from{transform:translateX(0)}to{transform:translateX(-110px)}}@keyframes bonus-float{to{margin-top:-8px}}@keyframes snow-fall{to{transform:translate(-40px,270px)}}@keyframes sun-glow{to{filter:drop-shadow(0 0 23px #fff09b)}}
  `; document.head.append(style);

  const field=document.querySelector('#gameField'), deer=document.querySelector('#reindeer'), scoreEl=document.querySelector('#gameScore'), highscoreEl=document.querySelector('#gameHighscore'), highscoreLabel=document.querySelector('#gameHighscoreLabel'), highscoreForm=document.querySelector('#highscoreForm'), highscoreName=document.querySelector('#highscoreName'), saveHighscoreName=document.querySelector('#saveHighscoreName'), message=document.querySelector('#gameMessage'), jumpButton=document.querySelector('#jumpButton'), restart=document.querySelector('#restartGame');
  const highscoreKey='oppieEnIenieRendierHighscore', highscoreNameKey='oppieEnIenieRendierHighscoreName'; let highscore=Number(localStorage.getItem(highscoreKey)||0), highscoreOwner=localStorage.getItem(highscoreNameKey)||''; const renderHighscore=()=>{highscoreEl.textContent=highscore;highscoreLabel.firstChild.textContent=highscoreOwner?`${highscoreOwner}: `:'Highscore ';}; renderHighscore();
  let score=0,jumping=false,gameOver=false,lastFrame=0,lastSpawn=0,lastBonus=0,playTime=0,obstacleCount=0,obstacles=[],bonuses=[],rafId;
  const active=()=>document.querySelector('#gameView').classList.contains('active');
  const setScore=value=>{score=value;scoreEl.textContent=score;if(score>highscore){highscore=score;localStorage.setItem(highscoreKey,String(highscore));renderHighscore();highscoreForm.hidden=false;}};
  function spawnObstacle(){
    obstacleCount++; const kind=obstacleCount%10===0?'bear':obstacleCount%3===0?'duck':'goose'; const obstacle=document.createElement('div'); obstacle.className=`game-obstacle ${kind}`; obstacle.textContent=kind==='bear'?'🧸':kind==='duck'?'🦆':'🪿'; obstacle.style.left=`${field.clientWidth+24}px`; field.append(obstacle); obstacles.push({el:obstacle,x:field.clientWidth+24,passed:false});
  }
  function spawnBonus(){
    const amount=1+Math.floor(Math.random()*3);
    for(let i=0;i<amount;i++){
      const bonus=document.createElement('div'); bonus.className='game-bonus'; bonus.textContent='💤'; bonus.style.left=`${field.clientWidth+20+i*54}px`; bonus.style.bottom=`${92+Math.round(Math.random()*86)}px`; field.append(bonus); bonuses.push({el:bonus,x:field.clientWidth+20+i*54});
    }
  }
  function endGame(){gameOver=true;field.classList.add('game-over');restart.hidden=false;message.textContent=`Raak! Je score is ${score}. ${score===highscore&&score>0?'Nieuwe highscore! 🏆':'Probeer nog een keer.'}`;}
  function jump(){if(!active()||jumping||gameOver)return;jumping=true;deer.classList.remove('jumping');void deer.offsetWidth;deer.classList.add('jumping');setTimeout(()=>{jumping=false;deer.classList.remove('jumping');},580);}
  function reset(){obstacles.forEach(item=>item.el.remove());bonuses.forEach(item=>item.el.remove());obstacles=[];bonuses=[];setScore(0);gameOver=false;jumping=false;playTime=0;obstacleCount=0;lastSpawn=0;lastBonus=0;field.classList.remove('game-over','snowing');restart.hidden=true;highscoreForm.hidden=true;message.textContent='Druk op de knop of de spatiebalk om te springen.';}
  function frame(time){
    const delta=Math.min(40,time-lastFrame||16);lastFrame=time;
    if(active()&&!gameOver){
      playTime+=delta; const speed=3.35+Math.min(playTime/1000*.16,7); const spawnGap=Math.max(600,1450-playTime/1000*24);
      if(!lastSpawn||time-lastSpawn>spawnGap){spawnObstacle();lastSpawn=time;}
      if(!lastBonus||time-lastBonus>5000+Math.random()*4500){spawnBonus();lastBonus=time;}
      const deerBox=deer.getBoundingClientRect();
      obstacles=obstacles.filter(item=>{
        item.x-=speed*(delta/16);item.el.style.transform=`translateX(${item.x-field.clientWidth-24}px)`;
        const box=item.el.getBoundingClientRect();
        if(!item.passed&&box.right<deerBox.left){item.passed=true;setScore(score+1);}
        if(!jumping&&box.right>deerBox.left+8&&box.left<deerBox.right-10&&box.bottom>deerBox.top+30){endGame();}
        if(item.x<-100){item.el.remove();return false;}return true;
      });
      bonuses=bonuses.filter(item=>{item.x-=speed*.72*(delta/16);item.el.style.transform=`translateX(${item.x-field.clientWidth-20}px)`;const box=item.el.getBoundingClientRect();if(jumping&&box.right>deerBox.left&&box.left<deerBox.right&&box.bottom>deerBox.top&&box.top<deerBox.bottom){item.el.remove();setScore(score+3);message.textContent='💤 Gevangen! +3 punten';return false;}if(item.x<-80){item.el.remove();return false;}return true;});
      field.classList.toggle('snowing',score>=50);
    }
    rafId=requestAnimationFrame(frame);
  }
  jumpButton.addEventListener('click',jump);restart.addEventListener('click',reset);saveHighscoreName.addEventListener('click',()=>{highscoreOwner=highscoreName.value.trim();localStorage.setItem(highscoreNameKey,highscoreOwner);renderHighscore();highscoreForm.hidden=true;});
  document.addEventListener('keydown',event=>{if((event.code==='Space'||event.code==='ArrowUp')&&active()){event.preventDefault();jump();}});
  document.addEventListener('click',event=>{if(event.target.closest('[data-view="gameView"]')){lastNap=performance.now();}});
  rafId=requestAnimationFrame(frame);
})();
