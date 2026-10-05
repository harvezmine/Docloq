import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Float } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ARCHIVE,
  ARCHIVE_SCALE,
  ARCHIVE_Z,
  FOLDER,
  PILE,
  PILLAR_BEATS,
  SCATTER,
  SHEET_COUNT,
  beatLocal,
  subPhase,
  backOut,
} from './heroStages';
import { makeTextPillTexture, makeOutputTexture, makeComplianceBadge, makeSealTexture } from './pillarTextures';
import { Folder3D, Vault3D, DokiBotFull, Gavel3D } from './pillarModels';

const SHEET_W = 2.1;
const SHEET_H = 2.97;

const PARK_SHRINK = [0.55, 0.95, 0.95];

const PILLAR_SCALE = [0.92, 1.35, 1.3];

const lerp = THREE.MathUtils.lerp;
const clamp01 = (v) => THREE.MathUtils.clamp(v, 0, 1);
const smooth = (v) => v * v * (3 - 2 * v);
const easeOutCubic = (v) => 1 - (1 - v) ** 3;

function EnvSetup() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      envTex.dispose();
    };
  }, [gl, scene]);
  return null;
}

function makeGlowTexture(rgba) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makeDocTexture(seed) {
  const w = 256;
  const h = 362;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111a33';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = seed % 2 === 0 ? 'rgba(139,92,246,0.55)' : 'rgba(34,211,238,0.45)';
  ctx.fillRect(24, 26, 96 + (seed % 3) * 26, 13);
  for (let i = 0; i < 9; i += 1) {
    const y = 66 + i * 28;
    const frac = 0.45 + (((seed * 7 + i * 13) % 50) / 100);
    ctx.fillStyle = i === 3 ? 'rgba(139,92,246,0.5)' : 'rgba(148,163,184,0.26)';
    ctx.fillRect(24, y, (w - 48) * Math.min(frac, 1), 7);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragPoint = new THREE.Vector3();

function DossierScene({ materialize, spread, gather, condense, prog, camZ, onUserScatter, scatterCtl }) {
  const parallaxRef = useRef(null);
  const sheetRefs = useRef([]);
  const slotMatRefs = useRef([]);
  const frameGroupRef = useRef(null);
  const pillarRefs = useRef([]);

  const folderRef = useRef(null);
  const folderHintRef = useRef(null);
  const folderGlowRef = useRef(null);

  const vaultRootRef = useRef(null);
  const vaultDoorRef = useRef(null);
  const vaultWheelRef = useRef(null);
  const vaultBodyMatRef = useRef(null);
  const vaultSwayRef = useRef(null);

  const orbitGroupRef = useRef(null);
  const orbitSpriteRefs = useRef([]);
  const orbitRingMatRef = useRef(null);

  const robotCoreRef = useRef(null);
  const visorMatRef = useRef(null);
  const aiRing1Ref = useRef(null);
  const armLRef = useRef(null);
  const armRRef = useRef(null);
  const aiDocRefs = useRef([]);
  const aiDocMatRefs = useRef([]);
  const outputRefs = useRef([]);
  const outputMatRefs = useRef([]);

  const gavelArmRef = useRef(null);
  const gavelHeadMatRef = useRef(null);
  const shockRingRef = useRef(null);
  const shockRingMatRef = useRef(null);
  const complianceRefs = useRef([]);
  const complianceMatRefs = useRef([]);
  const verdictRef = useRef(null);
  const verdictMatRefs = useRef([]);

  const courierRef = useRef(null);
  const courierMatRef = useRef(null);

  const inter = useRef({
    cs: 0,
    csVel: 0,
    csTarget: 0,
    drag: -1,
    lastX: 0,
    lastY: 0,
    offsets: Array.from({ length: SHEET_COUNT }, () => ({ x: 0, y: 0 })),
    notified: false,
  });
  const prev = useRef({ m: -1, s: -1, g: -1, c: -1, pr: -1, cz: -1 });

  const sheetGeom = useMemo(() => new THREE.BoxGeometry(SHEET_W, SHEET_H, 0.02), []);
  const violetGlow = useMemo(() => makeGlowTexture('rgba(139,92,246,0.55)'), []);
  const cyanGlow = useMemo(() => makeGlowTexture('rgba(34,211,238,0.45)'), []);
  const indigoGlow = useMemo(() => makeGlowTexture('rgba(99,102,241,0.4)'), []);
  const frameMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0, toneMapped: false }),
    []
  );

  const aesTex = useMemo(() => makeTextPillTexture('AES-256', { color: '#c7d2fe', stroke: 'rgba(129,140,248,0.85)', bg: 'rgba(17,24,51,0.85)' }), []);
  const kemTex = useMemo(() => makeTextPillTexture('ML-KEM', { color: '#a5f3fc', stroke: 'rgba(34,211,238,0.75)', bg: 'rgba(8,35,45,0.85)' }), []);
  const badgeTexes = useMemo(() => ['GDPR', 'UU PDP', 'COMPLY'].map(makeComplianceBadge), []);
  const sealTex = useMemo(() => makeSealTexture(), []);
  const outputTex = useMemo(
    () => ['report', 'mindmap', 'infographic'].map((k) => makeOutputTexture(k)),
    []
  );
  const courierTex = useMemo(() => makeDocTexture(1), []);
  const folderHintTexes = useMemo(() => [makeDocTexture(3), makeDocTexture(4), makeDocTexture(5)], []);
  const aiDocTexes = useMemo(() => [makeDocTexture(0), makeDocTexture(2), makeDocTexture(4)], []);

  const sheetMats = useMemo(() => {
    return [0, 1, 2].map((v) => {
      const side = new THREE.MeshStandardMaterial({ color: '#0b1226', roughness: 0.5, metalness: 0.15 });
      const face = new THREE.MeshStandardMaterial({ map: makeDocTexture(v), roughness: 0.45, metalness: 0.1 });
      return [side, side, side, side, face, side];
    });
  }, []);

  const intersectPointer = (e, z) => {
    dragPlane.constant = -z;
    return e.ray.intersectPlane(dragPlane, dragPoint);
  };

  const onSheetDown = (e, i) => {
    const it = inter.current;
    if (gather.get() > 0.35 || condense.get() > 0.05 || materialize.get() < 0.9) return;
    e.stopPropagation();
    const scattered = Math.max(spread.get(), it.cs) > 0.15;
    if (!scattered) {
      it.csTarget = 1;
      if (!it.notified) {
        it.notified = true;
        onUserScatter?.();
      }
      return;
    }
    it.drag = i;
    e.target.setPointerCapture(e.pointerId);
    const mesh = sheetRefs.current[i];
    if (mesh && intersectPointer(e, mesh.position.z)) {
      it.lastX = dragPoint.x;
      it.lastY = dragPoint.y;
    }
    document.body.style.cursor = 'grabbing';
  };

  const onSheetMove = (e, i) => {
    const it = inter.current;
    if (it.drag !== i) return;
    const mesh = sheetRefs.current[i];
    if (!mesh || !intersectPointer(e, mesh.position.z)) return;
    it.offsets[i].x += dragPoint.x - it.lastX;
    it.offsets[i].y += dragPoint.y - it.lastY;
    it.lastX = dragPoint.x;
    it.lastY = dragPoint.y;
  };

  const onSheetUp = (e, i) => {
    const it = inter.current;
    if (it.drag === i) {
      it.drag = -1;
      e.target.releasePointerCapture?.(e.pointerId);
      document.body.style.cursor = 'grab';
    }
  };

  const onSheetOver = () => {
    const it = inter.current;
    if (it.drag >= 0 || materialize.get() < 0.9 || condense.get() > 0.05) return;
    const scattered = Math.max(spread.get(), it.cs) > 0.15;
    document.body.style.cursor = scattered && gather.get() < 0.35 ? 'grab' : 'pointer';
  };

  const onSheetOut = () => {
    if (inter.current.drag < 0) document.body.style.cursor = '';
  };

  useFrame((state, delta) => {
    const it = inter.current;
    const m = materialize.get();
    const g = clamp01(gather.get());
    const c = smooth(clamp01(condense.get()));
    const pr = prog.get();
    const cz = camZ.get();
    const t = state.clock.elapsedTime;

    if (scatterCtl?.current?.requested) {
      scatterCtl.current.requested = false;
      if (m > 0.9 && g < 0.35 && Math.max(spread.get(), it.cs) < 0.15) {
        it.csTarget = 1;
        if (!it.notified) {
          it.notified = true;
          onUserScatter?.();
        }
      }
    }

    const springActive = Math.abs(it.csTarget - it.cs) > 0.001 || Math.abs(it.csVel) > 0.001;
    if (springActive) {
      const dt = Math.min(delta, 0.033);
      it.csVel += (52 * (it.csTarget - it.cs) - 9 * it.csVel) * dt;
      it.cs += it.csVel * dt;
    }

    if (m < 0.01 && (it.csTarget !== 0 || Math.abs(it.cs) > 0.001)) {
      it.csTarget = 0;
      it.cs = 0;
      it.csVel = 0;
      it.notified = false;
      it.offsets.forEach((o) => { o.x = 0; o.y = 0; });
    }

    const s = Math.max(spread.get(), it.cs);
    const p = prev.current;
    const changed =
      springActive || it.drag >= 0 ||
      Math.abs(m - p.m) > 1e-4 || Math.abs(s - p.s) > 1e-4 ||
      Math.abs(g - p.g) > 1e-4 || Math.abs(c - p.c) > 1e-4 ||
      Math.abs(pr - p.pr) > 1e-4 || Math.abs(cz - p.cz) > 1e-4;

    if (changed) {
      const sRot = smooth(clamp01(s));

      const tSec = beatLocal(pr, PILLAR_BEATS[0].story);
      const parkSec = smooth(beatLocal(pr, PILLAR_BEATS[0].park));
      const tAi = beatLocal(pr, PILLAR_BEATS[1].story);
      const parkAi = smooth(beatLocal(pr, PILLAR_BEATS[1].park));
      const tAud = beatLocal(pr, PILLAR_BEATS[2].story);
      const parkAud = smooth(beatLocal(pr, PILLAR_BEATS[2].park));

      const cRaw = clamp01(condense.get());
      const mergeAll = smooth(subPhase(cRaw, 0, 0.5));

      const send = smooth(subPhase(cRaw, 0.5, 1));

      for (let i = 0; i < SHEET_COUNT; i += 1) {
        const mesh = sheetRefs.current[i];
        if (!mesh) continue;
        const mi = smooth(clamp01(m * 1.9 - i * 0.13));
        mesh.visible = mi > 0.02 && send < 0.96;
        if (!mesh.visible) continue;

        const gi = smooth(clamp01(g * 1.7 - i * 0.05));
        const flight = Math.sin(Math.PI * gi);
        const off = it.offsets[i];

        const mgi = smooth(clamp01(mergeAll * 1.6 - i * 0.055));

        let x = lerp(PILE[i].x, SCATTER[i].x, s) + off.x * (1 - gi);
        let y = lerp(PILE[i].y, SCATTER[i].y, s) + off.y * (1 - gi);
        let z = lerp(-0.3 + i * 0.07, SCATTER[i].z, clamp01(s));
        let rx = SCATTER[i].rx * sRot;
        let ry = SCATTER[i].ry * sRot;
        let rz = lerp(PILE[i].rz, SCATTER[i].rz, sRot);

        x = lerp(x, ARCHIVE[i].x, gi);
        y = lerp(y, ARCHIVE[i].y, gi) + flight * 0.9;
        z = lerp(z, ARCHIVE_Z, gi);
        rx *= 1 - gi;
        ry = ry * (1 - gi) + flight * 0.75 * (i % 2 ? -1 : 1);
        rz *= 1 - gi;

        x = lerp(x, ((i % 3) - 1) * 0.03, mgi);
        y = lerp(y, 0.05 + (i % 2) * 0.03, mgi);
        z = lerp(z, 0.35 + i * 0.014, mgi);
        rx *= 1 - mgi;
        ry *= 1 - mgi;
        rz *= 1 - mgi;

        const sendArc = Math.sin(Math.PI * send);
        x = lerp(x, FOLDER.x + ((i % 3) - 1) * 0.04, send);
        y = lerp(y, FOLDER.y + 0.25, send) + sendArc * 0.6;
        z = lerp(z, FOLDER.z - 0.1, send);

        const entry = subPhase(send, 0.78, 0.96);
        y -= smooth(entry) * 0.5;
        let sc = (0.4 + 0.6 * mi) * lerp(1, ARCHIVE_SCALE, gi);
        sc *= 1 + Math.sin(Math.PI * clamp01((gi - 0.88) / 0.12)) * 0.06;
        sc = lerp(sc, 0.52, mgi);
        sc *= 1 + Math.sin(Math.PI * clamp01((mgi - 0.86) / 0.14)) * 0.08;
        sc = lerp(sc, FOLDER.sheetScale, send);
        sc *= 1 + Math.sin(Math.PI * entry) * 0.18;

        y += (1 - mi) * 1.6;

        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.scale.setScalar(Math.max(sc, 0.001));

        const slotMat = slotMatRefs.current[i];
        if (slotMat) slotMat.opacity = clamp01((gi - 0.85) / 0.15) * 0.4 * (1 - mergeAll);
      }

      if (frameGroupRef.current) {
        const scale = (1 - 0.58 * mergeAll) * (1 - 0.6 * send);
        frameGroupRef.current.scale.setScalar(Math.max(scale, 0.05));
        frameGroupRef.current.position.set(
          lerp(0, FOLDER.x, send),
          lerp(0, FOLDER.y + 0.25, send),
          lerp(ARCHIVE_Z, FOLDER.z - 0.2, send)
        );
        const fo = smooth(g) * (1 - smooth(subPhase(cRaw, 0.78, 0.97)));
        frameGroupRef.current.visible = fo > 0.02;
        frameMat.opacity = fo * 0.5;
      }

      const folder = folderRef.current;
      if (folder) {

        const popT = backOut(smooth(subPhase(cRaw, 0.52, 0.82)));

        const centerT = smooth(subPhase(tSec, 0, 0.2));
        const crossT = smooth(subPhase(tSec, 0.42, 0.62));
        const enterT = smooth(subPhase(tSec, 0.62, 0.76));
        const swallowed = tSec >= 0.77;
        folder.visible = popT > 0.02 && !swallowed && pr < PILLAR_BEATS[0].park[1];
        if (folder.visible) {
          const B = PILLAR_BEATS[0];

          // Hold the folder left of the vault (and further back) so the two read as
          // separate objects while both are on screen, parking it dead-centre at
          // z 1.4 made it loom over the vault with no breathing room.
          const p1x = lerp(FOLDER.x, -0.35, centerT);
          const p1y = lerp(FOLDER.y, 0.0, centerT);
          const p1z = lerp(FOLDER.z, 1.05, centerT);

          const arc = Math.sin(Math.PI * crossT) * 0.35;
          const p2x = lerp(p1x, B.solo.x, crossT);
          const p2y = lerp(p1y, B.solo.y, crossT) + arc;
          const p2z = lerp(p1z, B.solo.z + 0.95, crossT);

          folder.position.set(
            p2x,
            p2y,
            lerp(p2z, B.solo.z - 0.15, enterT)
          );

          // Shrinks in three steps: a little as the vault appears, more while crossing
          // to it, then down to nothing as it is swallowed.
          const fsc =
            0.95 * popT * (1 - 0.22 * centerT) * (1 - 0.58 * crossT) * (1 - 0.92 * enterT);
          folder.scale.setScalar(Math.max(fsc, 0.001));

          if (folderHintRef.current) {
            folderHintRef.current.position.y = -0.55 + 0.55 * send;
          }
        }
        if (folderGlowRef.current) {
          folderGlowRef.current.visible = folder.visible && enterT < 0.5;
          if (folderGlowRef.current.visible) {
            folderGlowRef.current.position.copy(folder.position);
            folderGlowRef.current.position.z -= 0.7;
          }
        }
      }

      for (let k = 0; k < 3; k += 1) {
        const group = pillarRefs.current[k];
        const B = PILLAR_BEATS[k];
        if (!group) continue;
        const enterT = easeOutCubic(clamp01((pr - B.in[0]) / (B.in[1] - B.in[0])));
        const parkT = smooth(clamp01((pr - B.park[0]) / (B.park[1] - B.park[0])));
        const present = k === 0
          ? enterT
          : enterT * (1 - parkT);
        group.visible = present > 0.005 && (k !== 0 || pr < PILLAR_BEATS[1].park[1]);
        if (group.visible) {
          group.position.set(
            lerp(B.solo.x, B.parked.x, parkT),
            lerp(B.solo.y, B.parked.y, parkT) - (1 - enterT) * 4.5,
            lerp(B.solo.z, B.parked.z, parkT)
          );

          const lateExit = k === 0 ? 1 - 0.97 * smooth(beatLocal(pr, PILLAR_BEATS[1].park)) : 1;
          group.scale.setScalar(Math.max(0.001, PILLAR_SCALE[k] * (0.6 + 0.4 * enterT) * (1 - PARK_SHRINK[k] * parkT) * lateExit));
        }
      }

      if (vaultRootRef.current) {

        const pop = backOut(smooth(subPhase(tSec, 0.08, 0.28)));
        vaultRootRef.current.scale.setScalar(Math.max(0.001, pop));
      }

      const doorSec = smooth(subPhase(tSec, 0.30, 0.44)) * (1 - smooth(subPhase(tSec, 0.78, 0.90)));
      const doorAi = smooth(subPhase(tAi, 0, 0.15)) * (1 - smooth(subPhase(tAi, 0.42, 0.55)));
      if (vaultDoorRef.current) {
        vaultDoorRef.current.rotation.y = Math.max(doorSec, doorAi) * 1.85;
      }
      if (vaultWheelRef.current) {

        vaultWheelRef.current.rotation.z = smooth(subPhase(tSec, 0.88, 0.98)) * Math.PI * 1.4;
      }
      const flash = Math.max(0, 1 - Math.abs((tSec - 0.94) / 0.06));
      if (vaultBodyMatRef.current) vaultBodyMatRef.current.emissiveIntensity = 0.06 + flash * 0.6;
      const orbitOpacity = smooth(subPhase(tSec, 0.82, 0.96)) * (1 - parkSec * 0.55) * (pr < PILLAR_BEATS[1].park[0] ? 1 : 1 - parkAi);
      for (let i = 0; i < 2; i += 1) {
        const sp = orbitSpriteRefs.current[i];
        if (sp) sp.material.opacity = orbitOpacity;
      }
      if (orbitRingMatRef.current) orbitRingMatRef.current.opacity = orbitOpacity * 0.35;
      prev.current.orbitOpacity = orbitOpacity;

      for (let i = 0; i < 3; i += 1) {
        const doc = aiDocRefs.current[i];
        const docMat = aiDocMatRefs.current[i];
        if (!doc || !docMat) continue;
        const td = subPhase(tAi, 0.08 + i * 0.07, 0.36 + i * 0.07);
        doc.visible = td > 0 && td < 1;
        if (doc.visible) {
          const fly = smooth(td);
          const arc = Math.sin(Math.PI * fly) * 0.6;
          const from = PILLAR_BEATS[0].parked;
          const to = PILLAR_BEATS[1].solo;
          doc.position.set(
            lerp(from.x, to.x + 0.15 * (i - 1), fly),
            lerp(from.y, to.y + 0.2, fly) + arc,
            lerp(from.z + 0.4, to.z + 0.5, fly)
          );
          doc.scale.setScalar(0.24 * (1 + Math.sin(Math.PI * subPhase(td, 0.82, 1)) * 0.2));
          docMat.opacity = smooth(subPhase(td, 0, 0.2)) * (1 - smooth(subPhase(td, 0.85, 1)));
        }
      }
      const absorbFlash = Math.max(0, 1 - Math.abs((tAi - 0.42) / 0.1));
      if (visorMatRef.current) visorMatRef.current.emissiveIntensity = 0.5 + absorbFlash * 1.6;
      for (let i = 0; i < 3; i += 1) {
        const out = outputRefs.current[i];
        const outMat = outputMatRefs.current[i];
        if (!out || !outMat) continue;
        const popT = subPhase(tAi, 0.5 + i * 0.09, 0.68 + i * 0.09);
        const sc = Math.max(0.001, backOut(smooth(popT)));
        out.scale.setScalar(sc);
        out.position.y = lerp(0.35, 1.05, smooth(popT));
        outMat.opacity = smooth(popT) * (1 - parkAi);
      }

      const courier = courierRef.current;
      if (courier) {
        const tc = subPhase(tAud, 0.12, 0.38);
        courier.visible = tAud > 0.12 && tAud < 0.68;
        if (courier.visible) {
          const fly = smooth(tc);
          const arc = Math.sin(Math.PI * fly) * 0.8;
          const from = PILLAR_BEATS[1].parked;
          const to = PILLAR_BEATS[2].docTarget;
          courier.position.set(
            lerp(from.x, to.x, fly),
            lerp(from.y, to.y, fly) + arc,
            lerp(from.z + 0.4, to.z, fly)
          );

          courier.scale.setScalar(0.26 * (1 + Math.sin(Math.PI * subPhase(tc, 0.85, 1)) * 0.15));
          if (courierMatRef.current) {
            courierMatRef.current.opacity =
              smooth(subPhase(tc, 0, 0.15)) * (1 - smooth(subPhase(tAud, 0.6, 0.68)));
          }
        }
      }
      if (gavelArmRef.current) {

        const raise = smooth(subPhase(tAud, 0.4, 0.54));
        const strike = smooth(subPhase(tAud, 0.55, 0.61));
        const settle = smooth(subPhase(tAud, 0.64, 0.78));
        const angle = 0.15 + 0.45 * raise - (0.68 + 0.45 * raise - 0.15) * strike + 0.2 * settle * strike;
        gavelArmRef.current.rotation.z = angle;
      }
      const impact = Math.max(0, 1 - Math.abs((tAud - 0.615) / 0.06));
      if (gavelHeadMatRef.current) gavelHeadMatRef.current.emissiveIntensity = 0.2 + impact * 1.4;
      if (shockRingRef.current && shockRingMatRef.current) {
        const shock = subPhase(tAud, 0.61, 0.78);
        shockRingRef.current.visible = shock > 0 && shock < 1;
        if (shockRingRef.current.visible) {
          shockRingRef.current.scale.setScalar(0.3 + shock * 1.6);
          shockRingMatRef.current.opacity = (1 - shock) * 0.7;
        }
      }
      for (let i = 0; i < 3; i += 1) {
        const badge = complianceRefs.current[i];
        const badgeMat = complianceMatRefs.current[i];
        if (!badge || !badgeMat) continue;
        const popT = subPhase(tAud, 0.64 + i * 0.07, 0.78 + i * 0.07);
        const k = Math.max(0.001, backOut(smooth(popT)));
        badge.scale.set(1.95 * k, 0.63 * k, 1);
        badgeMat.opacity = smooth(popT) * (1 - parkAud);
      }
      if (verdictRef.current && verdictMatRefs.current[0]) {

        const stamp = smooth(subPhase(tAud, 0.84, 0.97));
        verdictRef.current.visible = stamp > 0.01;
        const k = 2.4 * lerp(1.45, 1, backOut(stamp));
        verdictRef.current.scale.set(k, k, 1);
        verdictMatRefs.current[0].opacity = stamp * (1 - parkAud);
      }

      state.camera.position.z = cz;
      p.m = m; p.s = s; p.g = g; p.c = c; p.pr = pr; p.cz = cz;
    }

    if (vaultSwayRef.current) vaultSwayRef.current.rotation.y = Math.sin(t * 0.5) * 0.14;

    if (orbitGroupRef.current && (prev.current.orbitOpacity ?? 0) > 0.01) {
      const a = t * 0.9;
      for (let i = 0; i < 2; i += 1) {
        const sp = orbitSpriteRefs.current[i];
        if (!sp) continue;
        const phase = a + i * Math.PI;
        sp.position.set(Math.cos(phase) * 2.05, 0.16 * Math.sin(phase * 2), Math.sin(phase) * 2.05);
      }
    }
    if (robotCoreRef.current) {
      robotCoreRef.current.rotation.y = Math.sin(t * 0.6) * 0.24;
      robotCoreRef.current.position.y = Math.sin(t * 1.3) * 0.05;
    }
    if (armLRef.current) armLRef.current.rotation.z = 0.25 + Math.sin(t * 1.2) * 0.07;
    if (armRRef.current) armRRef.current.rotation.z = -0.25 - Math.sin(t * 1.2 + 0.6) * 0.07;
    if (aiRing1Ref.current) aiRing1Ref.current.rotation.z = t * 0.7;
    if (parallaxRef.current) {
      const target = parallaxRef.current.rotation;
      target.y += (state.pointer.x * 0.16 - target.y) * 0.05;
      target.x += (state.pointer.y * -0.1 - target.x) * 0.05;
    }
  });

  return (
    <>
      <EnvSetup />
      <ambientLight intensity={0.3} />
      <pointLight position={[-4, 2, 3]} color="#8b5cf6" intensity={32} />
      <pointLight position={[4, -1, 3]} color="#22d3ee" intensity={26} />

      <group ref={parallaxRef}>

        <mesh position={[-2.3, 1, -5]}>
          <planeGeometry args={[8.5, 8.5]} />
          <meshBasicMaterial map={violetGlow} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh position={[2.5, -1.3, -5.2]}>
          <planeGeometry args={[8, 8]} />
          <meshBasicMaterial map={cyanGlow} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.3}>

          {PILE.map((_, i) => (
            <mesh
              key={i}
              ref={(el) => { sheetRefs.current[i] = el; }}
              geometry={sheetGeom}
              material={sheetMats[i % 3]}
              visible={false}
              onPointerDown={(e) => onSheetDown(e, i)}
              onPointerMove={(e) => onSheetMove(e, i)}
              onPointerUp={(e) => onSheetUp(e, i)}
              onPointerOver={onSheetOver}
              onPointerOut={onSheetOut}
            >
              <Edges scale={1.003} color={i % 2 === 0 ? '#7c5cf0' : '#2ac8e8'} />
            </mesh>
          ))}

          <group ref={frameGroupRef} position={[0, 0, ARCHIVE_Z]} visible={false}>
            {[[-3.3, 2.35], [3.3, 2.35], [-3.3, -2.35], [3.3, -2.35]].map(([cx, cy], i) => (
              <group key={i} position={[cx, cy, 0]}>
                <mesh position={[cx > 0 ? -0.26 : 0.26, 0, 0]} material={frameMat}>
                  <boxGeometry args={[0.58, 0.05, 0.05]} />
                </mesh>
                <mesh position={[0, cy > 0 ? -0.26 : 0.26, 0]} material={frameMat}>
                  <boxGeometry args={[0.05, 0.58, 0.05]} />
                </mesh>
              </group>
            ))}
            {[0.16, -2.04].map((sy) => (
              <mesh key={sy} position={[0, sy, -0.02]} material={frameMat}>
                <boxGeometry args={[6.5, 0.018, 0.018]} />
              </mesh>
            ))}
            {ARCHIVE.map((slot, i) => (
              <mesh key={i} position={[slot.x, slot.y, -0.12]}>
                <planeGeometry args={[1.9, 2.5]} />
                <meshBasicMaterial
                  ref={(el) => { slotMatRefs.current[i] = el; }}
                  map={cyanGlow}
                  transparent
                  opacity={0}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        </Float>

        <mesh ref={folderGlowRef} visible={false}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshBasicMaterial map={violetGlow} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <Folder3D ref={folderRef} hintRef={folderHintRef} docTexes={folderHintTexes} />

        <mesh ref={courierRef} geometry={sheetGeom} visible={false}>
          <meshStandardMaterial
            ref={courierMatRef}
            map={courierTex}
            transparent
            opacity={0}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>

        {aiDocTexes.map((tex, i) => (
          <mesh key={i} ref={(el) => { aiDocRefs.current[i] = el; }} geometry={sheetGeom} visible={false}>
            <meshStandardMaterial
              ref={(el) => { aiDocMatRefs.current[i] = el; }}
              map={tex}
              transparent
              opacity={0}
              roughness={0.45}
              metalness={0.1}
            />
          </mesh>
        ))}

        <group ref={(el) => { pillarRefs.current[0] = el; }} visible={false}>
          <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.3}>
            <group ref={vaultSwayRef}>
              <mesh position={[0, 0.05, -1.2]}>
                <planeGeometry args={[4.2, 4.2]} />
                <meshBasicMaterial map={indigoGlow} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
              <Vault3D
                ref={vaultRootRef}
                doorRef={vaultDoorRef}
                wheelRef={vaultWheelRef}
                bodyMatRef={vaultBodyMatRef}
                glow={indigoGlow}
              />

              <group ref={orbitGroupRef} rotation={[0.35, 0, -0.12]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[2.05, 0.008, 8, 64]} />
                  <meshBasicMaterial ref={orbitRingMatRef} color="#818cf8" transparent opacity={0} toneMapped={false} />
                </mesh>
                {[aesTex, kemTex].map((tex, i) => (
                  <sprite
                    key={i}
                    ref={(el) => { orbitSpriteRefs.current[i] = el; }}
                    scale={[1.7, 0.34, 1]}
                  >
                    <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} />
                  </sprite>
                ))}
              </group>
            </group>
          </Float>
        </group>

        <group ref={(el) => { pillarRefs.current[1] = el; }} visible={false}>
          <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.35}>
            <mesh position={[0, 0, -0.8]}>
              <planeGeometry args={[4.0, 4.0]} />
              <meshBasicMaterial map={violetGlow} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>

            <DokiBotFull
              ref={robotCoreRef}
              visorMatRef={visorMatRef}
              ringRef={aiRing1Ref}
              armLRef={armLRef}
              armRRef={armRRef}
            />

            {[-1.7, 0, 1.7].map((ox, i) => (
              <mesh
                key={i}
                ref={(el) => { outputRefs.current[i] = el; }}
                position={[ox, 1.05, 0.35]}
                scale={0.001}
              >
                <planeGeometry args={[1.05, 1.32]} />
                <meshStandardMaterial
                  ref={(el) => { outputMatRefs.current[i] = el; }}
                  map={outputTex[i]}
                  transparent
                  opacity={0}
                  roughness={0.4}
                  metalness={0.1}
                  emissive="#8b5cf6"
                  emissiveIntensity={0.12}
                />
              </mesh>
            ))}
          </Float>
        </group>

        <group ref={(el) => { pillarRefs.current[2] = el; }} visible={false}>
          <Float speed={1.3} rotationIntensity={0.08} floatIntensity={0.3}>
            <group>
              <mesh position={[0, 0.1, -1]}>
                <planeGeometry args={[3.8, 3.8]} />
                <meshBasicMaterial map={cyanGlow} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>

              <Gavel3D armRef={gavelArmRef} headMatRef={gavelHeadMatRef} />

              <mesh ref={shockRingRef} position={[0.55, -0.7, 0.1]} rotation={[Math.PI / 2.4, 0, 0]} visible={false}>
                <torusGeometry args={[0.5, 0.02, 8, 40]} />
                <meshBasicMaterial ref={shockRingMatRef} color="#67e8f9" transparent opacity={0} toneMapped={false} />
              </mesh>

              {[[-1.55, 1.12], [0, 1.6], [1.55, 1.12]].map(([px, py], i) => (
                <sprite
                  key={i}
                  ref={(el) => { complianceRefs.current[i] = el; }}
                  position={[px, py, 0.45]}
                  scale={0.001}
                >
                  <spriteMaterial
                    ref={(el) => { complianceMatRefs.current[i] = el; }}
                    map={badgeTexes[i]}
                    transparent
                    opacity={0}
                    depthWrite={false}
                  />
                </sprite>
              ))}

              <sprite ref={verdictRef} position={[0, 0.35, 0.6]} scale={0.001} visible={false}>
                <spriteMaterial
                  ref={(el) => { verdictMatRefs.current[0] = el; }}
                  map={sealTex}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </sprite>
            </group>
          </Float>
        </group>
      </group>
    </>
  );
}

export default function HeroScene3D({
  materialize,
  spread,
  gather,
  condense,
  prog,
  camZ,
  paused = false,
  onUserScatter,
  scatterCtl,
  onReady,
  onContextLost,
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 16], fov: 38 }}
      frameloop={paused ? 'never' : 'always'}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost?.();
        });
        onReady?.();
      }}
      className="absolute! inset-0!"
    >
      <DossierScene
        materialize={materialize}
        spread={spread}
        gather={gather}
        condense={condense}
        prog={prog}
        camZ={camZ}
        onUserScatter={onUserScatter}
        scatterCtl={scatterCtl}
      />
    </Canvas>
  );
}
