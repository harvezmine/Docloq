// Guilloche ribbons: the fine interlaced line work used on banknotes, passports and
// certificates as anti-counterfeit print. Each ribbon is a centre line drifting across
// the width, with `strands` lines twisting around it half a turn apart.
//
// Ribbon fields (all in px at a 1440px-wide canvas, scaled down on narrow screens):
//   bottom   distance of the centre line from the canvas bottom
//   swing    vertical drift of the centre line
//   drift    centre-line waves across the width
//   width    half-height of the ribbon
//   twist    twists across the width
//   strands  number of lines in the ribbon
//   alpha    line opacity
//   phase    offset so ribbons do not move in lockstep

const TAU = Math.PI * 2;
const STEP = 3; // px between samples; finer adds cost without visible gain

export function drawRibbons(ctx, w, h, ribbons, rgb = '110, 165, 240') {
  const span = Math.max(w / 1440, 0.5);
  const size = Math.max(Math.min(w / 1440, 1), 0.6);

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';

  for (const r of ribbons) {
    ctx.lineWidth = r.lineWidth ?? 0.6;
    ctx.strokeStyle = `rgba(${rgb}, ${r.alpha})`;
    const base = h - r.bottom * size;
    const swing = r.swing * size;
    const width = r.width * size;
    const drift = r.drift * Math.max(span, 0.7);
    const twist = r.twist * span;

    for (let s = 0; s < r.strands; s++) {
      const offset = (Math.PI * s) / r.strands;
      ctx.beginPath();
      for (let x = -STEP; x <= w + STEP; x += STEP) {
        const u = x / w;
        const centre = base + swing * Math.sin(TAU * drift * u + r.phase);
        const breathe = 0.65 + 0.35 * Math.sin(TAU * 1.3 * u + r.phase);
        const y = centre + width * breathe * Math.sin(TAU * twist * u + offset);
        if (x === -STEP) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
