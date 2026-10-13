'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const KEY = 'deadlight-save-v1';
  const fresh = () => ({ coins: 0, kills: 0, wave: 1, power: 0, speed: 0, wall: 0, savedAt: Date.now() });
  let state = fresh(), storageOK = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && ['coins','kills','wave','power','speed','wall','savedAt'].every(k => Number.isSafeInteger(saved[k]) && saved[k] >= 0) && saved.wave >= 1 && saved.speed <= 20 && saved.power <= 100 && saved.wall <= 100) {
      state = saved;
      const seconds = Math.min(28800, Math.max(0, (Date.now() - saved.savedAt) / 1000));
      const income = Math.floor(seconds * .25 * (1 + state.power * .15));
      state.coins += income;
      if (income) $('message').textContent = `離線補給已抵達：獲得 ${income.toLocaleString()} 金幣。`;
    }
  } catch { storageOK = false; }
  const damage = () => 14 + state.power * 8;
  const interval = () => Math.max(.12, .85 * Math.pow(.88, state.speed));
  const maxHealth = () => 100 + state.wall * 60;
  const cost = kind => Math.floor(({ power: 20, speed: 35, wall: 30 })[kind] * Math.pow(1.55, state[kind]));
  const limit = kind => kind === 'speed' ? 20 : 100;
  const waveSize = () => 7 + Math.min(state.wave, 50);
  let health = maxHealth(), enemies = [], bullets = [], particles = [], spawned = 0, defeated = 0;
  let spawnTimer = .6, shootTimer = 0, supportTimer = 0, flash = 0, recovery = 0, elapsed = 0;
  function save() {
    state.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { storageOK = false; }
  }
  function updateUI() {
    $('wave').textContent = String(state.wave).padStart(2,'0');
    $('coins').textContent = Math.floor(state.coins).toLocaleString();
    $('kills').textContent = state.kills.toLocaleString();
    $('dps').textContent = Math.round(damage() / interval());
    $('progress').textContent = recovery > 0 ? '防線修復中…' : `波次進度 ${defeated} / ${waveSize()}`;
    $('health').textContent = `${Math.ceil(health)} / ${maxHealth()}`;
    $('health-bar').style.width = `${100 * health / maxHealth()}%`;
    $('cooldown').textContent = supportTimer > 0 ? `${Math.ceil(supportTimer)} 秒` : '準備就緒';
    $('skill').disabled = supportTimer > 0 || recovery > 0;
    for (const kind of ['power','speed','wall']) {
      $(`${kind}-detail`).textContent = `Lv.${state[kind]} · ` + (kind === 'power' ? `傷害 ${damage()}` : kind === 'speed' ? `每秒 ${(1 / interval()).toFixed(1)} 發` : `耐久 ${maxHealth()}`);
      $(`${kind}-cost`).textContent = state[kind] >= limit(kind) ? '已達最高等級' : `◈ ${cost(kind).toLocaleString()} 金幣 / 升級`;
      document.querySelector(`[data-upgrade="${kind}"]`).disabled = state.coins < cost(kind) || state[kind] >= limit(kind);
    }
  }
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    const kind = button.dataset.upgrade, price = cost(kind);
    if (state.coins < price || state[kind] >= limit(kind)) return;
    state.coins -= price; state[kind]++;
    if (kind === 'wall') health = Math.min(maxHealth(), health + 60);
    $('message').textContent = `${{power:'武器',speed:'射速',wall:'防線'}[kind]}升級完成。火力就是希望。`;
    save(); updateUI();
  }));
  function burst(x,y,color,count = 8) {
    for (let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*130,vy:-Math.random()*100,life:.6,color});
  }
  function eliminate(enemy) {
    state.kills++; state.coins += 5 + Math.floor(state.wave * 1.5); defeated++;
    burst(enemy.x, enemy.y - 27, '#a2ac63');
  }
  $('skill').addEventListener('click', () => {
    if (supportTimer > 0 || recovery > 0) return;
    for (const enemy of enemies) eliminate(enemy);
    enemies = []; supportTimer = 25; flash = .35;
    $('message').textContent = '空中支援已抵達！眼前威脅已清除。';
    save(); updateUI();
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('確定要清除所有金幣、升級與波次，重新開始嗎？')) return;
    state = fresh(); health = maxHealth(); enemies = []; bullets = []; particles = [];
    spawned = defeated = 0; spawnTimer = .6; shootTimer = supportTimer = flash = recovery = 0;
    $('message').textContent = '新的黎明。守住防線，收集補給。'; save(); updateUI();
  });
  function tick(dt) {
    elapsed += dt; supportTimer = Math.max(0,supportTimer-dt); flash = Math.max(0,flash-dt);
    if (recovery > 0) {
      recovery = Math.max(0,recovery-dt);
      if (!recovery) { health = maxHealth(); spawned = defeated = 0; spawnTimer = 1; }
      return;
    }
    spawnTimer -= dt; shootTimer -= dt;
    if (spawned < waveSize() && spawnTimer <= 0) {
      const hp = 28 + state.wave * 9;
      enemies.push({x:1230,y:350,hp,max:hp,speed:18+Math.min(40,state.wave*1.2)+Math.random()*12,phase:Math.random()*6});
      spawned++; spawnTimer = Math.max(.45, 2.4-state.wave*.06);
    }
    if (enemies.length && shootTimer <= 0) {
      bullets.push({x:235,y:320,damage:damage()}); shootTimer = interval();
      burst(235,320,'#f4cd79',2);
    }
    for (const b of bullets) {
      b.x += 720 * dt;
      const target = enemies.filter(e => e.x >= b.x-720*dt-15 && e.x <= b.x+15).sort((a,c)=>a.x-c.x)[0];
      if (target) { target.hp -= b.damage; b.x = 1400; burst(target.x,320,'#d6c484',3); }
    }
    bullets = bullets.filter(b=>b.x < 1250);
    enemies = enemies.filter(e => { if (e.hp <= 0) { eliminate(e); return false; } return true; });
    for (const e of enemies) {
      if (e.x > 285) e.x -= e.speed*dt;
      else health = Math.max(0, health-(4+state.wave*.7)*dt);
    }
    if (health <= 0) {
      recovery = 4; enemies = []; bullets = [];
      $('message').textContent = '防線失守！4 秒後重新挑戰本波，保留金幣與升級。';
      save();
    } else if (spawned === waveSize() && !enemies.length) {
      state.coins += state.wave*15; state.wave++; health = Math.min(maxHealth(),health+maxHealth()*.3);
      spawned = defeated = 0; spawnTimer = 2.5;
      $('message').textContent = `第 ${state.wave-1} 波已守住！補給到貨，防線恢復 30%。`; save();
    }
  }
  function rect(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
  function person(x,y,zombie,phase) {
    const step = Math.sin(elapsed*5+phase)*3;
    rect(x-9,y-25,8,25+step,zombie?'#465247':'#404c3a'); rect(x+3,y-25,8,25-step,zombie?'#465247':'#404c3a');
    rect(x-12,y-49,27,28,zombie?'#69785a':'#8b9871'); rect(x-8,y-67,20,19,zombie?'#a5ab7c':'#c6b08a');
    rect(x-9,y-70,22,7,zombie?'#53634e':'#4c5c42');
    rect(x+(zombie?-22:13),y-44,24,7,zombie?'#a5ab7c':'#b8a481');
    if (!zombie) { rect(x+22,y-44,29,6,'#303a33'); rect(x+43,y-45,13,4,'#7c8271'); }
    else rect(x-7,y-60,3,3,'#d9c581');
  }
  function draw() {
    const sky=ctx.createLinearGradient(0,0,0,460);sky.addColorStop(0,'#152426');sky.addColorStop(1,'#555a3a');ctx.fillStyle=sky;ctx.fillRect(0,0,1200,460);
    ctx.fillStyle='#c9d39c';ctx.beginPath();ctx.arc(920,84,27,0,Math.PI*2);ctx.fill();
    for(let i=0;i<17;i++) { const x=i*83-25,h=70+(i*37%115);rect(x,290-h,62,h,'#23302c');rect(x+10,290-h+14,5,8,'#657053');rect(x+32,290-h+35,6,8,'#556347'); }
    rect(0,293,1200,70,'#303a2c');rect(0,354,1200,106,'#252d23');rect(0,354,1200,4,'#697250');
    for(let i=0;i<38;i++){rect(i*37,370+(i*19%73),10+(i%4)*5,2,'#3c4631');}
    rect(0,230,155,125,'#3d4a38');rect(12,241,125,75,'#1d2924');rect(20,250,75,52,'#97a16c');rect(27,257,60,38,'#536348');
    rect(0,220,168,12,'#6e7c50');rect(153,234,12,120,'#65724b');
    ctx.fillStyle='#bbcca0';ctx.font='11px monospace';ctx.fillText('SAFE ZONE 07',18,339);
    rect(270,285,15,70,'#7e8158');rect(261,303,31,9,'#a29460');rect(261,329,31,9,'#a29460');
    person(193,350,false,0);
    for(const e of enemies){person(e.x,e.y,true,e.phase);rect(e.x-17,e.y-84,35,3,'#3d4736');rect(e.x-17,e.y-84,35*e.hp/e.max,3,'#b1bd72');}
    for(const b of bullets)rect(b.x,b.y,12,2,'#f5d995');
    for(const p of particles)rect(p.x,p.y,3,3,p.color);
    if(flash>0){ctx.fillStyle=`rgba(225,234,184,${flash})`;ctx.fillRect(0,0,1200,460);}
    if(recovery>0){rect(0,0,1200,460,'#18221bbb');ctx.fillStyle='#ecdca5';ctx.font='26px system-ui';ctx.textAlign='center';ctx.fillText(`防線修復中 · ${Math.ceil(recovery)} 秒`,600,225);ctx.textAlign='left';}
    ctx.fillStyle='#a0b38a';ctx.font='10px monospace';ctx.fillText('EAST PERIMETER // AUTOMATED DEFENSE',24,419);
  }
  let last=performance.now(),uiTime=0,saveTime=0;
  function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;tick(dt);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    draw();uiTime+=dt;saveTime+=dt;if(uiTime>.15){updateUI();uiTime=0;}if(saveTime>5){save();saveTime=0;}requestAnimationFrame(frame);
  }
  // Browsers suspend animation in hidden tabs. Award the same capped supply as a closed tab.
  let hiddenAt = null;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();save();}
    else {if(hiddenAt){const seconds=Math.min(28800,Math.max(0,(Date.now()-hiddenAt)/1000));state.coins+=Math.floor(seconds*.25*(1+state.power*.15));hiddenAt=null;save();updateUI();}last=performance.now();}
  });
  window.addEventListener('pagehide',save);
  if(!storageOK)$('message').textContent='瀏覽器存檔不可用；可繼續遊玩，但進度可能無法保存。';
  updateUI();requestAnimationFrame(frame);
})();
