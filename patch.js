(() => {
  const localKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const fixToday = () => document.querySelectorAll('.week-day').forEach(day => day.classList.toggle('today',day.dataset.date===localKey()));
  const observer=new MutationObserver(fixToday); observer.observe(document.querySelector('#weekGrid'),{childList:true}); fixToday(); setInterval(fixToday,500);

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
  const nav=document.querySelector('.bottom-nav'); const b=document.createElement('button'); b.className='nav-item'; b.dataset.view='gameView'; b.innerHTML='<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="11" rx="4"/><path d="M8 10v5M5.5 12.5h5M16.5 11h.01M18.5 14h.01"/></svg></span><span class="nav-label">Spel</span>'; nav.append(b);

  const style=document.createElement('style'); style.textContent=`
    .reindeer-game{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px}.game-intro{font-size:14px;color:var(--muted);margin-bottom:12px}.game-hud{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:12px}.game-hud span{background:#f0f7d4;border-radius:11px;padding:8px 10px;color:var(--green)}
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
