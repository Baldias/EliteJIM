import { anteriorData, posteriorData } from 'react-body-highlighter/src/assets/index.ts';
import { SCIENCE_GLOWS } from './theme';

const MUSCLES = {
  Petto: ['chest'], Dorso: ['upper-back', 'lower-back', 'trapezius'],
  Quadricipiti: ['quadriceps'], Femorali: ['hamstring'], Glutei: ['gluteal'],
  Polpacci: ['calves'], Spalle: ['front-deltoids', 'back-deltoids'],
  Bicipiti: ['biceps'], Tricipiti: ['triceps'], Addome: ['abs', 'obliques'],
  Avambracci: ['forearm'], Collo: ['neck'], Gambe: ['quadriceps', 'hamstring', 'gluteal', 'calves'],
};
const BACK = ['Dorso', 'Femorali', 'Glutei', 'Tricipiti', 'Polpacci'];

export function progressReportPalette(theme, glow) {
  const minimal = theme !== 'og';
  return { minimal, bg: minimal ? '#0A0610' : '#080B10', panel: minimal ? '#101010' : '#111821', border: minimal ? '#262329' : '#263645', text:'#F5F7FA', muted:'#96939E', cyan:'#00B4E6', green: minimal ? '#E6CF00' : '#30D158', yellow:'#E6CF00', purple:'#BF5AF2', red:'#FF453A',
    glow: minimal ? (SCIENCE_GLOWS.find(g => g.id === glow) || SCIENCE_GLOWS[0]).rgb : '0, 180, 230' };
}

// Reuse the same anatomical polygons as the muscle map in the app. No image
// requests, raster screenshots or guessed name matching enter the export.
export function progressMuscleIcon(group) {
  const selected = MUSCLES[group] || [];
  return { group, selected, posterior: BACK.includes(group), polygons: (BACK.includes(group) ? posteriorData : anteriorData).flatMap(part =>
    part.svgPoints.map(points => ({ selected: selected.includes(part.muscle), points: points.trim().split(/\s+/).map(Number) }))) };
}

export function drawProgressMuscle(ctx, group, x, y, width, height, palette) {
  const icon = progressMuscleIcon(group);
  const highlighted = icon.polygons.filter(p => p.selected).flatMap(p => p.points);
  const xs = highlighted.filter((_,i) => i % 2 === 0), ys = highlighted.filter((_,i) => i % 2 === 1);
  const bounds = highlighted.length ? { x:Math.min(...xs)-10, y:Math.min(...ys)-10, width:Math.max(...xs)-Math.min(...xs)+20, height:Math.max(...ys)-Math.min(...ys)+20 } : {x:0,y:0,width:100,height:200};
  const scale = Math.min(width / bounds.width, height / bounds.height);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x,y,width,height,20); ctx.clip();
  ctx.fillStyle=palette.panel; ctx.fillRect(x,y,width,height);
  ctx.translate(x + (width - bounds.width * scale) / 2 - bounds.x * scale, y + (height - bounds.height * scale) / 2 - bounds.y * scale); ctx.scale(scale, scale);
  for (const part of icon.polygons) {
    ctx.beginPath();
    for (let i = 0; i < part.points.length; i += 2) {
      if (i === 0) ctx.moveTo(part.points[i], part.points[i + 1]);
      else ctx.lineTo(part.points[i], part.points[i + 1]);
    }
    ctx.closePath(); ctx.fillStyle = part.selected ? palette.cyan : palette.minimal ? '#34313B' : '#354354'; ctx.fill();
  }
  ctx.restore();
}
