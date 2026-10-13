'use strict';
(() => {
  const CACHE = 'deadlight-background-v1';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const input = document.getElementById('background-file');
  const status = document.getElementById('background-status');
  const slider = document.getElementById('ground-level');
  const controls = document.getElementById('ground-control');
  let image = null, url = null, ground = 350, generation = 0;
  function setGround(next) {
    const previous = ground; ground = next;
    window.dispatchEvent(new CustomEvent('deadlight-background-change', { detail: { previous, next } }));
  }
  function adjustGround() {
    document.getElementById('ground-value').value = `${slider.value}%`;
    setGround(Math.round(canvas.height * Number(slider.value) / 100));
  }
  function save() {
    try {
      localStorage.setItem(CACHE, JSON.stringify({ url, level: Number(slider.value) }));
      return true;
    } catch {
      status.textContent = '背景已套用，但瀏覽器儲存空間不足；下次開啟請重新匯入。';
      return false;
    }
  }
  async function load(source, level, remember) {
    const ticket = ++generation;
    const next = new Image();
    await new Promise((resolve,reject)=>{
      next.onload=resolve;next.onerror=()=>reject(new Error('無法讀取圖片，請使用 PNG、JPG 或 WebP。'));next.src=source;
    });
    const w = next.naturalWidth, h = next.naturalHeight, ratio = w / h;
    if (w < 320 || ratio < 1.5 || ratio > 4 || w > 8192 || h > 8192) {
      throw new Error('請選擇橫向背景，建議 1200 × 460 或 1200 × 640。');
    }
    // Normalize once, retaining the entire image and its original aspect ratio.
    const normalized = document.createElement('canvas'); normalized.width = 1200; normalized.height = Math.round(1200 / ratio);
    const c = normalized.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(next, 0, 0, normalized.width, normalized.height);
    const normalizedURL = normalized.toDataURL('image/png');
    const normalizedImage = new Image();
    await new Promise((resolve,reject)=>{normalizedImage.onload=resolve;normalizedImage.onerror=reject;normalizedImage.src=normalizedURL;});
    if (ticket !== generation) return;
    image = normalizedImage; url = normalizedURL;
    canvas.height = normalized.height; canvas.style.aspectRatio = `1200 / ${canvas.height}`;
    slider.value = Number.isFinite(level) ? Math.max(50, Math.min(90, level)) : (canvas.height > 520 ? 69 : 76);
    controls.hidden = false; adjustGround();
    status.textContent = `背景已套用 · ${w} × ${h} · 可調整角色站立高度`;
    if (remember) save();
  }
  document.getElementById('import-background').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file = input.files[0]; input.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { status.textContent = '背景圖片請小於 8 MB。'; return; }
    status.textContent = '正在載入背景…';
    try {
      const source = await new Promise((resolve,reject)=>{
        const reader = new FileReader(); reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);
      });
      await load(source, undefined, true);
    } catch (e) { status.textContent = e.message || '載入失敗，請重新選擇背景圖。'; }
  });
  slider.addEventListener('input',adjustGround);
  slider.addEventListener('change',save);
  document.getElementById('restore-background').addEventListener('click',()=>{
    generation++; image = null; url = null;
    canvas.height = 460; canvas.style.aspectRatio = '1200 / 460';
    setGround(350); controls.hidden = true;
    status.textContent = '已恢復原背景。';
    try { localStorage.removeItem(CACHE); }
    catch { status.textContent += '瀏覽器無法清除保存的背景。'; }
  });
  window.deadlightScene = {
    groundY: () => ground,
    draw() {
      if (!image) return false;
      ctx.save();ctx.imageSmoothingEnabled = false;ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.restore();return true;
    }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE));
    if (saved && typeof saved.url === 'string' && saved.url.startsWith('data:image/png') && Number.isFinite(saved.level)) {
      load(saved.url,saved.level,false).catch(()=>{status.textContent='保存的背景無法讀取，請重新匯入。';});
    }
  } catch { /* Game remains available without browser storage. */ }
})();
