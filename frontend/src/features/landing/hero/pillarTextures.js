import * as THREE from 'three';

export function makeTextPillTexture(text, { color = '#a7f3d0', stroke = 'rgba(16,185,129,0.9)', bg = 'rgba(4,36,26,0.75)' } = {}) {
  const w = 640;
  const h = 128;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const r = h / 2 - 6;
  ctx.beginPath();
  ctx.moveTo(6 + r, 6);
  ctx.lineTo(w - 6 - r, 6);
  ctx.arc(w - 6 - r, h / 2, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(6 + r, h - 6);
  ctx.arc(6 + r, h / 2, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.font = 'bold 46px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeComplianceBadge(text) {
  const w = 560;
  const h = 180;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(15,23,42,0.92)');
  grad.addColorStop(1, 'rgba(8,14,30,0.92)');
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 34);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(103,232,249,0.55)';
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(14, 14, w - 28, 30, 20);
  ctx.fillStyle = 'rgba(148,163,184,0.08)';
  ctx.fill();

  const icx = 88;
  const icy = h / 2;
  ctx.beginPath();
  ctx.arc(icx, icy, 42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34,211,238,0.14)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(103,232,249,0.8)';
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.moveTo(icx - 16, icy + 2);
  ctx.lineTo(icx - 4, icy + 14);
  ctx.lineTo(icx + 18, icy - 12);
  ctx.stroke();

  ctx.font = 'bold 56px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(text, 158, h / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSealTexture() {
  const s = 512;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = s * dpr;
  canvas.height = s * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = s / 2;
  const cy = s / 2 - 30;

  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
  glow.addColorStop(0, 'rgba(139,92,246,0.22)');
  glow.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);

  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(167,139,250,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(167,139,250,0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, 150, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 136, cy + Math.sin(a) * 136);
    ctx.lineTo(cx + Math.cos(a) * 144, cy + Math.sin(a) * 144);
    ctx.stroke();
  }

  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#c4b5fd';
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy + 6);
  ctx.lineTo(cx - 10, cy + 48);
  ctx.lineTo(cx + 62, cy - 40);
  ctx.stroke();

  const bw = 400;
  const bh = 62;
  const by = s - 84;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, by, bw, bh, 31);
  ctx.fillStyle = 'rgba(17,24,51,0.92)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(139,92,246,0.7)';
  ctx.stroke();
  ctx.font = 'bold 30px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ede9fe';
  ctx.fillText('SECURE · COMPLIANT', cx, by + bh / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeOutputTexture(kind) {
  const w = 256;
  const h = 320;
  const dpr = 3;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#111a33';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(139,92,246,0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  const LABEL_H = 46;
  const bodyH = h - LABEL_H;

  if (kind === 'report') {

    ctx.fillStyle = 'rgba(139,92,246,0.85)';
    ctx.fillRect(22, 20, 128, 15);
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(22, 52 + i * 20, (w - 44) * (i === 3 ? 0.6 : 1), 7);

    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 148);
    ctx.lineTo(28, 250);
    ctx.lineTo(w - 24, 250);
    ctx.stroke();

    const pts = [[36, 236], [76, 200], [112, 216], [150, 176], [190, 188], [224, 154]];
    ctx.strokeStyle = 'rgba(34,211,238,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,1)';
    pts.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (kind === 'mindmap') {

    const cx = w / 2;
    const cy = bodyH / 2 + 6;
    const branches = [
      [-82, -84], [82, -78], [-92, 10], [92, 16], [-64, 96], [70, 100],
    ];
    ctx.lineWidth = 3;
    branches.forEach(([dx, dy], i) => {
      ctx.strokeStyle = i % 2 ? 'rgba(34,211,238,0.7)' : 'rgba(139,92,246,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + dx * 0.5, cy + dy * 0.9, cx + dx, cy + dy);
      ctx.stroke();
    });
    const pill = (px, py, pw, ph, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(px - pw / 2, py - ph / 2, pw, ph, ph / 2);
      ctx.fill();
    };
    branches.forEach(([dx, dy], i) => {
      pill(cx + dx, cy + dy, 56, 20, i % 2 ? 'rgba(34,211,238,0.9)' : 'rgba(139,92,246,0.9)');

      ctx.fillStyle = 'rgba(5,10,25,0.75)';
      ctx.fillRect(cx + dx - 18, cy + dy - 3, 36, 6);
    });
    pill(cx, cy, 84, 30, 'rgba(233,213,255,0.95)');
    ctx.fillStyle = 'rgba(76,29,149,0.9)';
    ctx.fillRect(cx - 26, cy - 4, 52, 8);
  } else {

    const dcx = 76;
    const dcy = 84;
    ctx.lineWidth = 20;
    ctx.strokeStyle = 'rgba(139,92,246,0.95)';
    ctx.beginPath();
    ctx.arc(dcx, dcy, 42, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34,211,238,0.95)';
    ctx.beginPath();
    ctx.arc(dcx, dcy, 42, Math.PI * 0.75, Math.PI * 1.5);
    ctx.stroke();
    ctx.font = 'bold 24px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText('72%', dcx, dcy + 1);

    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.fillRect(150, 52, 82, 9);
    ctx.fillRect(150, 74, 60, 9);
    ctx.fillStyle = 'rgba(233,213,255,0.9)';
    ctx.fillRect(150, 96, 44, 12);

    const bars = [0.85, 0.62, 0.44];
    bars.forEach((b, i) => {
      const by = 158 + i * 38;
      ctx.fillStyle = 'rgba(148,163,184,0.22)';
      ctx.beginPath();
      ctx.roundRect(28, by, w - 56, 16, 8);
      ctx.fill();
      ctx.fillStyle = i === 1 ? 'rgba(34,211,238,0.9)' : 'rgba(139,92,246,0.9)';
      ctx.beginPath();
      ctx.roundRect(28, by, (w - 56) * b, 16, 8);
      ctx.fill();
    });
  }

  const LABELS = { report: 'REPORT', mindmap: 'MIND MAP', infographic: 'INFOGRAPHIC' };
  ctx.fillStyle = 'rgba(76,29,149,0.55)';
  ctx.fillRect(6, h - LABEL_H, w - 12, LABEL_H - 6);
  ctx.font = 'bold 26px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText(LABELS[kind] || kind.toUpperCase(), w / 2, h - LABEL_H / 2 - 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
