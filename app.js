// All processing happens in this browser. No network calls with card data. No storage.
(() => {
  const $ = id => document.getElementById(id);
  const video = $('video'), canvas = $('canvas'), statusEl = $('status');
  let stream = null, worker = null, busy = false, timer = null, result = null, masked = false;

  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const setStatus = (t, cls) => { statusEl.textContent = t; $('scanner').className = 'panel ' + (cls || ''); };
  const err = t => { $('error').textContent = t; show('error', !!t); };

  function luhn(n) { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; }
  function brand(n) {
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^35(2[89]|[3-8])/.test(n)) return 'JCB';
    if (/^3(0[0-5]|[689])/.test(n)) return 'Diners Club';
    if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
    if (/^62/.test(n)) return 'UnionPay';
    return '카드';
  }
  function parse(text) {
    const t = text.replace(/[Oo]/g, m => m).replace(/\r/g, '');
    let pan = null;
    const cands = t.replace(/[^\d \n]/g, ' ').match(/\d[\d ]{11,24}\d/g) || [];
    for (const c of cands) { const d = c.replace(/ /g, ''); for (let L = 19; L >= 13; L--) { for (let i = 0; i + L <= d.length; i++) { const s = d.substr(i, L); if (luhn(s) && /^[2-6]/.test(s)) { pan = s; break; } } if (pan) break; } if (pan) break; }
    const em = t.match(/\b(0[1-9]|1[0-2])\s?[\/\-]\s?(\d{2})\b/);
    let name = null;
    for (const line of t.split('\n')) { const l = line.trim(); if (/^[A-Z][A-Z .'-]{3,26}$/.test(l) && l.split(/\s+/).length >= 2 && !/VALID|THRU|GOOD|MONTH|YEAR|DEBIT|CREDIT|BANK|CARD/.test(l)) { name = l; break; } }
    return { pan, exp: em ? em[1] + '/' + em[2] : null, name };
  }
  function fmt(p) { return p.length === 15 ? p.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3') : p.replace(/(\d{4})(?=\d)/g, '$1 '); }
  function maskP(p) { return fmt(p.slice(0, 4) + '•'.repeat(p.length - 8) + p.slice(-4)); }

  function grab() {
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
    // map overlay (88% width of displayed box, ratio 1.586, centered) to video pixels with object-fit:cover
    const box = video.getBoundingClientRect(); const scale = Math.max(box.width / vw, box.height / vh);
    const fw = box.width * 0.88, fh = fw / 1.586;
    const sx = (vw - box.width / scale) / 2 + (box.width - fw) / 2 / scale, sy = (vh - box.height / scale) / 2 + (box.height - fh) / 2 / scale;
    const sw = fw / scale, sh = fh / scale, W = 1200, H = Math.round(W / 1.586);
    canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128)); d[i] = d[i + 1] = d[i + 2] = g; }
    ctx.putImageData(img, 0, 0); return canvas;
  }
  let partial = {};
  async function scanOnce(manual) {
    if (busy || !worker) return; busy = true; setStatus('인식 중…', 'scanning');
    try {
      const c = grab(); if (!c) return;
      const { data } = await worker.recognize(c);
      const r = parse(data.text || '');
      if (r.exp) partial.exp = r.exp; if (r.name) partial.name = r.name;
      if (r.pan) { done({ pan: r.pan, exp: r.exp || partial.exp, name: r.name || partial.name }); return; }
      setStatus(manual ? '번호를 찾지 못했어요. 빛 반사를 피하고 다시 시도해 주세요' : '카드를 틀 안에 맞춰 주세요');
    } catch (e) { console.warn('OCR error'); /* redacted: no data logged */ }
    finally { busy = false; }
  }
  function done(r) {
    result = r; masked = false; stopCam(); setStatus('인식 완료', 'done');
    $('rBrand').textContent = brand(r.pan); $('rPan').textContent = fmt(r.pan);
    $('rExp').textContent = r.exp || '인식 안 됨'; $('rName').textContent = r.name || '인식 안 됨';
    $('toggle').textContent = '번호 가리기'; show('scanner', false); show('result', true);
  }
  function stopCam() { clearInterval(timer); timer = null; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; }
  async function startCam() {
    err(''); partial = {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err('이 브라우저에서는 카메라를 사용할 수 없어요. 최신 Safari 또는 Chrome에서 HTTPS 주소로 열어 주세요.'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') err('카메라 권한이 거부되었어요. 브라우저 설정에서 이 사이트의 카메라를 허용한 뒤 다시 시도해 주세요.');
      else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') err('사용할 수 있는 카메라를 찾지 못했어요.');
      else err('카메라를 시작하지 못했어요. 다른 앱이 카메라를 사용 중인지 확인해 주세요.');
      return;
    }
    video.srcObject = stream; show('intro', false); show('result', false); show('scanner', true);
    setStatus('인식 준비 중…');
    if (!worker) {
      try { worker = await Tesseract.createWorker('eng'); await worker.setParameters({ tessedit_char_whitelist: '0123456789/ ABCDEFGHIJKLMNOPQRSTUVWXYZ.-\'' }); }
      catch (e) { err('인식 엔진을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.'); return; }
    }
    setStatus('카드를 틀 안에 맞춰 주세요');
    timer = setInterval(() => scanOnce(false), 1200);
  }
  $('start').onclick = startCam; $('retry').onclick = () => { result = null; $('rPan').textContent = '-'; startCam(); };
  $('capture').onclick = () => scanOnce(true);
  $('stop').onclick = () => { stopCam(); show('scanner', false); show('intro', true); };
  $('toggle').onclick = () => { if (!result) return; masked = !masked; $('rPan').textContent = masked ? maskP(result.pan) : fmt(result.pan); $('toggle').textContent = masked ? '번호 보기' : '번호 가리기'; };
  window.addEventListener('pagehide', stopCam);
})();
