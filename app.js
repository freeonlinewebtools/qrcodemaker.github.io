const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.tab-panel')];
const canvas = document.getElementById('qrCanvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('statusText');
const sizeInput = document.getElementById('size');
const sizeValue = document.getElementById('sizeValue');

const inputs = [...document.querySelectorAll('input, textarea, select')];
let activeType = 'url';
let lastQr = null;
let lastData = '';

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function escapeWiFi(text) {
  return (text || '').replace(/[\\;,:\"]/g, '\\$&');
}

function getDataByType(type) {
  if (type === 'url') return (document.getElementById('urlInput').value || '').trim();
  if (type === 'text') return document.getElementById('textInput').value || '';
  if (type === 'wifi') {
    const ssid = escapeWiFi(document.getElementById('wifiSsid').value.trim());
    const password = escapeWiFi(document.getElementById('wifiPassword').value.trim());
    const encryption = document.getElementById('wifiEncryption').value;
    if (!ssid) return '';
    if (encryption === 'nopass') return `WIFI:T:nopass;S:${ssid};;`;
    return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
  }
  if (type === 'vcard') {
    const fullName = document.getElementById('vName').value.trim();
    const phone = document.getElementById('vPhone').value.trim();
    const email = document.getElementById('vEmail').value.trim();
    const company = document.getElementById('vCompany').value.trim();
    const website = document.getElementById('vWebsite').value.trim();
    if (!fullName && !phone && !email && !company && !website) return '';
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
      `ORG:${company}`,
      `TEL:${phone}`,
      `EMAIL:${email}`,
      `URL:${website}`,
      'END:VCARD'
    ].join('\n');
  }
  if (type === 'email') {
    const addr = document.getElementById('eAddress').value.trim();
    const subject = encodeURIComponent(document.getElementById('eSubject').value.trim());
    const body = encodeURIComponent(document.getElementById('eBody').value.trim());
    if (!addr) return '';
    return `mailto:${addr}?subject=${subject}&body=${body}`;
  }
  return '';
}

function drawPlaceholder() {
  const size = Number(sizeInput.value);
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#dde3ef';
  ctx.strokeRect(0, 0, size, size);
  statusText.textContent = 'Enter content to generate your QR code.';
  lastQr = null;
  lastData = '';
}

function renderQR() {
  const data = getDataByType(activeType);
  const fg = document.getElementById('fgColor').value;
  const bg = document.getElementById('bgColor').value;
  const ecc = document.getElementById('ecc').value;
  const size = Number(sizeInput.value);
  sizeValue.textContent = `${size}px`;

  if (!data) {
    drawPlaceholder();
    return;
  }

  lastData = data;

  const qr = qrcode(0, ecc);
  qr.addData(data);
  qr.make();

  const count = qr.getModuleCount();
  const cell = size / count;

  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = fg;
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) {
        const x = Math.round(c * cell);
        const y = Math.round(r * cell);
        const w = Math.ceil((c + 1) * cell) - x;
        const h = Math.ceil((r + 1) * cell) - y;
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  lastQr = { qr, fg, bg, size, type: activeType };
  statusText.textContent = 'QR code ready.';
}

const debouncedRender = debounce(renderQR, 300);

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    activeType = tab.dataset.type;
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === activeType));
    renderQR();
  });
});

inputs.forEach((input) => {
  input.addEventListener('input', debouncedRender);
  input.addEventListener('change', renderQR);
});

document.getElementById('downloadPng').addEventListener('click', () => {
  if (!lastQr) return;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrforge-${lastQr.type}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

function buildSvgFromMatrix(qr, fg, bg, size) {
  const count = qr.getModuleCount();
  const cell = size / count;
  let body = `<rect width="100%" height="100%" fill="${bg}"/>`;

  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) {
        const x = c * cell;
        const y = r * cell;
        body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fg}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}

document.getElementById('downloadSvg').addEventListener('click', () => {
  if (!lastQr) return;
  const svg = buildSvgFromMatrix(lastQr.qr, lastQr.fg, lastQr.bg, lastQr.size);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qrforge-${lastQr.type}-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('copyData').addEventListener('click', async () => {
  if (!lastData) return;
  await navigator.clipboard.writeText(lastData);
  statusText.textContent = 'QR data copied to clipboard.';
});

document.getElementById('clearAll').addEventListener('click', () => {
  document.querySelectorAll('input[type="text"], input[type="url"], input[type="tel"], input[type="email"], textarea').forEach((el) => {
    el.value = '';
  });
  renderQR();
});

drawPlaceholder();
