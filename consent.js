// Client-side only. No network requests, no storage. Data lives in memory until refresh.
(() => {
  const $ = id => document.getElementById(id), f = $('f'), c = $('sig'), ctx = c.getContext('2d');
  let drawn = false, drawing = false;
  f.date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  function fit() { const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; const img = drawn ? c.toDataURL() : null;
    c.width = r.width * dpr; c.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 2.5; ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    if (img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height); im.src = img; } }
  fit(); window.addEventListener('resize', fit);
  const pt = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', e => { drawing = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pt(e)); });
  c.addEventListener('pointermove', e => { if (!drawing) return; ctx.lineTo(...pt(e)); ctx.stroke(); drawn = true; });
  ['pointerup', 'pointercancel'].forEach(t => c.addEventListener(t, () => drawing = false));
  $('clear').onclick = () => { ctx.clearRect(0, 0, c.width, c.height); drawn = false; };
  f.pan.addEventListener('input', () => { f.pan.value = f.pan.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); });
  f.exp.addEventListener('input', () => { let v = f.exp.value.replace(/\D/g, '').slice(0, 4); f.exp.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v; });
  function luhn(n) { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; }
  const err = t => { $('err').textContent = t; $('err').classList.toggle('hidden', !t); };
  f.addEventListener('submit', e => {
    e.preventDefault(); err('');
    const pan = f.pan.value.replace(/\D/g, '');
    if (pan.length < 13 || !luhn(pan)) return err('카드 번호를 확인해 주세요. · Please check the card number.');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp.value)) return err('유효기간을 MM/YY 형식으로 입력해 주세요. · Enter expiry as MM/YY.');
    if (!drawn) return err('서명해 주세요. · Please sign.');
    for (const k of ['biz', 'cust', 'contact', 'holder', 'exp', 'purpose', 'date']) $('d_' + k).textContent = f[k].value;
    $('d_pan').textContent = f.pan.value; $('d_sig').src = c.toDataURL('image/png');
    $('formView').classList.add('hidden'); $('docView').classList.remove('hidden'); scrollTo(0, 0);
  });
  $('edit').onclick = () => { $('docView').classList.add('hidden'); $('formView').classList.remove('hidden'); };
  $('print').onclick = $('pdf').onclick = () => window.print();
})();
