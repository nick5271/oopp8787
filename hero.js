'use strict';
// Uses the official Spine 4.3 Canvas runtime. See vendor/spine/LICENSE.
(() => {
  const CACHE = 'deadlight-hero-texture-v1';
  const status = document.getElementById('hero-status');
  const input = document.getElementById('hero-texture');
  const ctx = document.getElementById('game').getContext('2d');
  const SCALE = .8, X = 193;
  const groundY = () => window.deadlightScene.groundY();
  let actor = null, generation = 0;
  function build(texture) {
    const atlas = new spine.TextureAtlas(window.DEADLIGHT_HERO_DATA.atlas);
    for (const page of atlas.pages) page.setTexture(new spine.CanvasTexture(texture));
    const reader = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas));
    const data = reader.readSkeletonData(window.DEADLIGHT_HERO_DATA.skeleton);
    const skeleton = new spine.Skeleton(data);
    // The weapon attachment lives in a separate skin in this export.
    const skin = new spine.Skin('survivor');
    skin.addSkin(data.findSkin('default'));
    skin.addSkin(data.findSkin('w_b_m1911'));
    skeleton.setSkin(skin);
    skeleton.setupPose();
    const animation = new spine.AnimationState(new spine.AnimationStateData(data));
    animation.setAnimation(0, '待機', true);
    const renderer = new spine.SkeletonRenderer(ctx);
    return { skeleton, animation, renderer, firing: 0 };
  }
  function pose() {
    if (!actor) return;
    actor.animation.apply(actor.skeleton);
    // The export leaves the flash attached in the setup pose; hide it during idle.
    const flash = actor.skeleton.findSlot('fire_w_e_01');
    if (actor.firing <= 0 && flash) flash.pose.color.a = 0;
    actor.skeleton.updateWorldTransform(spine.Physics.update);
  }
  async function load(url, remember) {
    const ticket = ++generation;
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('無法讀取圖片，請選擇原始 PNG。'));
      image.src = url;
    });
    if (image.naturalWidth !== 128 || image.naturalHeight !== 128) {
      throw new Error('貼圖尺寸須為 128 × 128，請使用 human_01.png 原始檔。');
    }
    // The atlas declares pma:true. Canvas needs straight-alpha RGB values.
    const surface = document.createElement('canvas'); surface.width = surface.height = 128;
    const c = surface.getContext('2d', { willReadFrequently: true }); c.drawImage(image, 0, 0);
    const pixels = c.getImageData(0, 0, 128, 128);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const alpha = pixels.data[i+3];
      if (alpha > 0 && alpha < 255) for (let channel = 0; channel < 3; channel++) {
        pixels.data[i+channel] = Math.min(255, Math.round(pixels.data[i+channel] * 255 / alpha));
      }
    }
    c.putImageData(pixels, 0, 0);
    const texture = await createImageBitmap(surface);
    const next = build(texture);
    if (ticket !== generation) { texture.close(); return; }
    if (actor) actor.texture.close();
    actor = { ...next, texture }; pose();
    status.textContent = 'Spine 主角已啟用 · 待機／射擊';
    if (remember) {
      try { localStorage.setItem(CACHE, url); }
      catch { status.textContent += '（瀏覽器無法保存貼圖，下次請重新匯入）'; }
    }
  }
  document.getElementById('import-hero').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0]; input.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) { status.textContent = '請選擇 512 KB 以下的原始 128 × 128 PNG 貼圖。'; return; }
    status.textContent = '正在載入角色…';
    try {
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i] === b)) throw new Error('請選擇 PNG 格式的原始貼圖。');
      const url = await new Promise((resolve,reject)=>{
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await load(url, true);
    } catch (e) { status.textContent = e.message || '貼圖載入失敗，請重新選擇。'; }
  });
  window.deadlightHero = {
    update(dt) {
      if (!actor) return;
      if (actor.firing > 0) {
        actor.firing = Math.max(0, actor.firing - dt);
        if (!actor.firing) actor.animation.setAnimation(0, '待機', true);
      }
      actor.skeleton.update(dt); actor.animation.update(dt); pose();
    },
    fire() {
      if (!actor) return { x:235, y:groundY()-30 };
      actor.firing = .4; actor.animation.setAnimation(0, '射擊', false); pose();
      const muzzle = actor.skeleton.findBone('fire_w_e_01').appliedPose;
      return { x: X + muzzle.worldX * SCALE, y: groundY() - muzzle.worldY * SCALE };
    },
    draw() {
      if (!actor) return false;
      ctx.save(); ctx.translate(X,groundY()); ctx.scale(SCALE,-SCALE); ctx.imageSmoothingEnabled = false;
      actor.renderer.draw(actor.skeleton); ctx.restore(); return true;
    }
  };
  try {
    const cached = localStorage.getItem(CACHE);
    if (cached) load(cached, false).catch(()=>{status.textContent = '保存的貼圖無法讀取，請重新匯入 human_01.png。';});
  } catch { /* Import still works if browser storage is unavailable. */ }
})();
