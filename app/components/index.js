"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import HowToModal from "./HowToModal";
import UserMenu from "./UserMenu";
import SettingsModal from "./SettingsModal";
import Link from "next/link";

export default function Main() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const startGameRef = useRef(null);
  const animFrameRef = useRef(null);
  const [howOpen, setHowOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gameStateRef = useRef(null);
  const [gameMode, setGameMode] = useState(null);
  const settingsRef = useRef({ fahOnSpace: true, fahVolume: 50 });

  // load user settings once (used by in-game audio/behavior)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const s = data?.settings;
        if (s) {
          settingsRef.current = { fahOnSpace: typeof s.fahOnSpace === 'boolean' ? s.fahOnSpace : true, fahVolume: typeof s.fahVolume === 'number' ? s.fahVolume : 50 };
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Listen for live settings changes (dispatched by SettingsModal)
  useEffect(() => {
    function onSettingsChange(e) {
      const d = e?.detail;
      if (!d) return;
      settingsRef.current = {
        fahOnSpace: typeof d.fahOnSpace === 'boolean' ? d.fahOnSpace : settingsRef.current.fahOnSpace,
        fahVolume: typeof d.fahVolume === 'number' ? d.fahVolume : settingsRef.current.fahVolume,
      };
    }
    window.addEventListener('fah-settings-changed', onSettingsChange);
    return () => window.removeEventListener('fah-settings-changed', onSettingsChange);
  }, []);

  const initGame = useCallback((canvas) => {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    /* ─── Assets ─── */
    const dragonImg = new Image();
    dragonImg.src = "/dragon.png";

    const pulseSound = new Audio("/fah.mp3");
    pulseSound.volume = (settingsRef.current?.fahVolume ?? 50) / 100;

    /* ─── State ─── */
    const STATE = {
      mode: "START",
      score: 0,
      highScore: 0,
      submitted: false,
      crashTimer: 0,
      crashDuration: 80,
      pauseSelection: 0, // 0 = Resume, 1 = Restart, 2 = Main Menu
    };

    // expose state object so React component can read current mode
    gameStateRef.current = STATE;

    // helper to set mode and notify React so UI can react to mode changes
    function setMode(newMode) {
      STATE.mode = newMode;
      setGameMode(newMode);
      if (newMode === 'PLAY') setHowOpen(false);
    }

    // expose startGame to React layer
    startGameRef.current = startGame;
    // initialize react-visible mode
    setGameMode(STATE.mode);

    /* ─── Delta Time (frame-rate independence) ─── */
    const TARGET_FPS = 60;
    const TARGET_FRAME_TIME = 1000 / TARGET_FPS; // ~16.67ms
    let lastTime = performance.now();

    /* ─── Player ─── */
    const player = {
      x: W * 0.22,
      y: H / 2,
      vy: 0,
      vx: 0,
      baseSpeed: 4.5, // HARDER (was 3.2)
      width: 56,
      height: 32,
      gravity: 0.13,
      lift: -0.48,
      drag: 0.96,
      dragX: 0.93,
    };

    /* ─── Pulse ─── */
    const pulse = {
      energy: 100,
      max: 100,
      cost: 22,
      rechargeBase: 0.09,
      rechargeFast: 0.22,
    };
    const pulses = [];

    /* ─── World ─── */
    let obstacles = [];
    let scrollX = 0;
    const GAP = 220; // HARDER (was 270)
    let nextObs = W + 250;
    const particles = [];
    const shake = { i: 0, decay: 0.86 };
    const sonar = { bars: new Array(48).fill(0), energy: 0 };
    const keys = {};

    /* ─── Powerups ─── */
    const powerups = [];
    let nextPowerup = W + 500;
    const activePowerups = {
      immunity: { active: false, timer: 0, duration: 180 },
      fireball: { active: false, timer: 0 },
    };
    const POWERUP_TYPES = {
      IMMUNITY: { type: 'immunity', color: '#39ff14', symbol: '◆', duration: 180 },
      FIREBALL: { type: 'fireball', color: '#ff4444', symbol: '◉', duration: 0 },
      PLASMA: { type: 'plasma', color: '#44aaff', symbol: '◈', duration: 0 },
    };

    /* ─── Input ─── */
    function onKeyDown(e) {
      keys[e.code] = true;

      // ESC for pause/resume
      if (e.code === "Escape") {
        e.preventDefault();
        if (STATE.mode === "PLAY") {
          setMode("PAUSED");
          STATE.pauseSelection = 0;
        } else if (STATE.mode === "PAUSED") {
          setMode("PLAY");
        }
        return;
      }

      // Pause menu navigation
      if (STATE.mode === "PAUSED") {
        if (e.code === "ArrowUp" || e.code === "KeyW") {
          STATE.pauseSelection = (STATE.pauseSelection - 1 + 3) % 3;
        } else if (e.code === "ArrowDown" || e.code === "KeyS") {
          STATE.pauseSelection = (STATE.pauseSelection + 1) % 3;
        } else if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (STATE.pauseSelection === 0) {
            // Resume
            setMode("PLAY");
          } else if (STATE.pauseSelection === 1) {
            // Restart
            startGame();
          } else if (STATE.pauseSelection === 2) {
            // Main Menu
            goToMainMenu();
          }
        }
        return;
      }

      // Crash menu navigation (after crash animation finished)
      if (STATE.mode === "CRASH" && STATE.crashTimer <= 0) {
        if (e.code === "ArrowUp" || e.code === "KeyW") {
          STATE.pauseSelection = (STATE.pauseSelection - 1 + 2) % 2;
          return;
        } else if (e.code === "ArrowDown" || e.code === "KeyS") {
          STATE.pauseSelection = (STATE.pauseSelection + 1) % 2;
          return;
        } else if (e.code === "Enter") {
          e.preventDefault();
          if (STATE.pauseSelection === 0) startGame();
          else if (STATE.pauseSelection === 1) goToMainMenu();
          return;
        }
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (STATE.mode === "START") startGame();
        else if (STATE.mode === "PLAY") firePulse();
        else if (STATE.mode === "CRASH" && STATE.crashTimer <= 0) startGame();
      }
    }
    function onKeyUp(e) { keys[e.code] = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Mouse interaction for pause menu: hover to select, click to activate
    function isInMenuBox(mx, my, i) {
      const menuY = H * 0.48;
      const menuSpacing = 50;
      const y = menuY + i * menuSpacing;
      const boxW = 220;
      const boxH = 36;
      const left = (W - boxW) / 2;
      const top = y - 22;
      return mx >= left && mx <= left + boxW && my >= top && my <= top + boxH;
    }

    function onMouseMove(e) {
      if (STATE.mode !== "PAUSED" && !(STATE.mode === "CRASH" && STATE.crashTimer <= 0)) return;
      // canvas client coords map directly to canvas width/height here
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hovered = -1;
      const count = STATE.mode === "PAUSED" ? 3 : 2;
      for (let i = 0; i < count; i++) {
        if (isInMenuBox(mx, my, i)) { hovered = i; break; }
      }
      if (hovered !== -1) {
        STATE.pauseSelection = hovered;
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = '';
      }
    }

    function onMouseDown(e) {
      if (STATE.mode !== "PAUSED" && !(STATE.mode === "CRASH" && STATE.crashTimer <= 0)) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const count = STATE.mode === "PAUSED" ? 3 : 2;
      for (let i = 0; i < count; i++) {
        if (isInMenuBox(mx, my, i)) {
          // Activate selection (for PAUSED: 0=Resume,1=Restart,2=Main Menu)
          if (STATE.mode === "PAUSED") {
            if (i === 0) setMode("PLAY");
            else if (i === 1) startGame();
            else if (i === 2) goToMainMenu();
          } else {
            // CRASH: 0=Restart,1=Main Menu
            if (i === 0) startGame();
            else if (i === 1) goToMainMenu();
          }
          return;
        }
      }
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);

    /* ─── Obstacle Generation ─── */
    function makePillar(x, isTop, pairH = 0) {
      const minH = 60; // HARDER: Taller min obstacles
      const maxH = pairH > 0
        ? Math.max(minH, H - pairH - player.height * 3.8) // HARDER: Tighter gap (was 4.5)
        : H * 0.6;
      const h = minH + Math.random() * (maxH - minH);
      const w = 55 + Math.random() * 70;
      const segs = 10;
      const pts = [];

      if (isTop) {
        pts.push({ x, y: 0 });
        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const bulge = Math.sin(f * Math.PI) * w * 0.15;
          const noise = Math.sin(f * 11 + x * 0.01) * 8;
          pts.push({
            x: x + f * w + bulge + noise,
            y: f * h * 0.85 + Math.random() * h * 0.15,
          });
        }
        pts.push({ x: x + w, y: 0 });
      } else {
        pts.push({ x, y: H });
        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const bulge = Math.sin(f * Math.PI) * w * 0.15;
          const noise = Math.sin(f * 13 + x * 0.02) * 8;
          pts.push({
            x: x + f * w + bulge + noise,
            y: H - (f * h * 0.85 + Math.random() * h * 0.15),
          });
        }
        pts.push({ x: x + w, y: H });
      }

      return { x, w, h, points: pts, opacity: 0, revealT: 0, isTop };
    }

    /* ─── Start / Reset ─── */
    function startGame() {
      setMode("PLAY");
      STATE.score = 0;
      STATE.submitted = false;
      STATE.crashTimer = 0;
      player.x = W * 0.22;
      player.y = H / 2;
      player.vy = 0;
      player.vx = 0;
      pulse.energy = pulse.max;
      pulses.length = 0;
      particles.length = 0;
      obstacles = [];
      scrollX = 0;
      nextObs = W + 250;
      nextPowerup = W + 500;
      powerups.length = 0;
      activePowerups.immunity.active = false;
      activePowerups.immunity.timer = 0;
      activePowerups.fireball.active = false;
      activePowerups.fireball.timer = 0;
      shake.i = 0;

      for (let i = 0; i < 6; i++) {
        const top = Math.random() > 0.5;
        const ob = makePillar(nextObs, top);
        obstacles.push(ob);
        // HARDER: More frequent pairs (40% -> 60%)
        if (Math.random() > 0.4) {
          const pair = makePillar(nextObs, !top, ob.h);
          if (pair.h > 40) obstacles.push(pair);
        }
        nextObs += GAP + Math.random() * 80; // HARDER: Less variance in gap
      }
    }

    /* ─── Go to Main Menu ─── */
    function goToMainMenu() {
      setMode("START");
      STATE.score = 0;
      STATE.submitted = false;
      STATE.crashTimer = 0;
      STATE.pauseSelection = 0;
      player.x = W * 0.22;
      player.y = H / 2;
      player.vy = 0;
      player.vx = 0;
      pulse.energy = pulse.max;
      pulses.length = 0;
      particles.length = 0;
      obstacles = [];
      scrollX = 0;
      nextObs = W + 250;
      nextPowerup = W + 500;
      powerups.length = 0;
      activePowerups.immunity.active = false;
      activePowerups.immunity.timer = 0;
      activePowerups.fireball.active = false;
      activePowerups.fireball.timer = 0;
      shake.i = 0;
    }

    /* ─── Fire Pulse ─── */
    function firePulse() {
      if (pulse.energy < pulse.cost) return;
      pulse.energy -= pulse.cost;

      const isFireball = activePowerups.fireball.active;

      // Always fire a normal pulse for visibility
      pulses.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        r: 80,  // Start larger for instant visibility
        maxR: 650,
        a: 1,
        // New high-fidelity properties
        w: 4, // width
        hue: isFireball ? 0 : 260 + Math.random() * 40,
        isFireball: isFireball,
      });

      if (isFireball) {
        pulses.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          r: 60,
          maxR: 400,
          a: 1,
          w: 6,
          hue: 0,
          isFireball: true,
        });
        activePowerups.fireball.active = false;
        shake.i = 8;
      } else {
        shake.i = 4;
      }

      sonar.energy = 1;

      // Play sound only if `fahOnSpace` is enabled (defaults to true)
      pulseSound.currentTime = 0;
      try {
        const enabled = settingsRef.current?.fahOnSpace ?? true;
        pulseSound.volume = (settingsRef.current?.fahVolume ?? 50) / 100;
        if (enabled) pulseSound.play().catch(() => { });
      } catch (err) {
        // ignore errors and still attempt to play
        pulseSound.play().catch(() => { });
      }
    }

    /* ─── Collision ─── */
    function ptInPoly(px, py, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x - scrollX, yi = poly[i].y;
        const xj = poly[j].x - scrollX, yj = poly[j].y;
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    }

    function checkCollision() {
      // Immunity powerup prevents collision
      if (activePowerups.immunity.active) return false;

      const cx = player.x + player.width / 2;
      const cy = player.y + player.height / 2;
      const tests = [
        { x: cx, y: player.y + 2 },
        { x: cx, y: player.y + player.height - 2 },
        { x: player.x + player.width - 2, y: cy },
        { x: player.x + 4, y: cy },
      ];
      for (const ob of obstacles) {
        const sx = ob.x - scrollX;
        if (sx > W + 80 || sx + ob.w < -80) continue;
        // Skip destroyed obstacles
        if (ob.destroyed) continue;
        for (const t of tests) {
          if (ptInPoly(t.x, t.y, ob.points)) return true;
        }
      }
      if (player.y < -5 || player.y + player.height > H + 5) return true;
      return false;
    }

    /* ─── Crash ─── */
    function triggerCrash() {
      setMode("CRASH");
      STATE.crashTimer = STATE.crashDuration;
      STATE.pauseSelection = 0;
      if (STATE.score > STATE.highScore) STATE.highScore = STATE.score;
      shake.i = 14;

      // submit the score once (prevents double-submit during crash loop)
      if (!STATE.submitted) {
        STATE.submitted = true;
        submitScore(STATE.score).catch(() => {});
      }
    }

    // Submit score to server and update user's best from response
    async function submitScore(score) {
      try {
        const resp = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score, gameMode: STATE.mode || 'classic' }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const best = data?.score?.bestScore;
        if (typeof best === 'number' && best > STATE.highScore) {
          STATE.highScore = best;
        }
      } catch (err) {
        // ignore
      }
    }

    /* ─── Draw Dragon ─── */
    function drawDragon() {
      ctx.save();
      ctx.translate(player.x + player.width / 2, player.y + player.height / 2);

      const pitch = Math.max(-0.4, Math.min(0.4, player.vy * 0.08));
      ctx.rotate(pitch);

      const sw = player.width + 16;
      const sh = player.height + 12;

      if (dragonImg.complete && dragonImg.naturalWidth > 0) {
        ctx.save();
        ctx.scale(-1, 1); // flip to face right
        ctx.drawImage(dragonImg, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
      } else {
        // Fallback: simple shape
        ctx.fillStyle = "#1a0b2e";
        ctx.shadowColor = "#7c3aed";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#39ff14";
        ctx.fillStyle = "#39ff14";
        ctx.beginPath();
        ctx.arc(16, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    /* ─── Update ─── */
    function update(dt) {
      if (STATE.mode === "PLAY") {
        const up = keys["ArrowUp"] || keys["KeyW"];
        const dn = keys["ArrowDown"] || keys["KeyS"];
        const rt = keys["ArrowRight"] || keys["KeyD"];
        const lt = keys["ArrowLeft"] || keys["KeyA"];

        // Apply dt to velocity changes for frame-rate independence
        if (up) player.vy += player.lift * dt;
        if (dn) player.vy -= player.lift * 0.7 * dt;
        if (rt) player.vx += 0.22 * dt;
        if (lt) player.vx -= 0.14 * dt;

        player.vy += player.gravity * dt;
        // Use Math.pow for exponential decay with dt
        player.vy *= Math.pow(player.drag, dt);
        player.vx *= Math.pow(player.dragX, dt);
        player.y += player.vy * dt;
        player.x += player.vx * dt;
        player.x = Math.max(40, Math.min(W * 0.65, player.x));

        const speedF = 1 + (player.x / W) * 3.5; // HARDER: Faster scaler
        scrollX += player.baseSpeed * speedF * dt;
        STATE.score = Math.floor(scrollX / 10);

        // Recharge (scaled by dt)
        const rr = speedF > 2 ? pulse.rechargeFast : pulse.rechargeBase;
        pulse.energy = Math.min(pulse.max, pulse.energy + rr * dt);

        // Update pulses (scaled by dt)
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.r += (p.isFireball ? 14 : 12) * dt;  // Faster expansion
          p.a = 1 - p.r / p.maxR;
          if (p.r >= p.maxR) { pulses.splice(i, 1); continue; }
          for (const ob of obstacles) {
            const ox = ob.x - scrollX + ob.w / 2;
            const oy = ob.isTop ? ob.h / 2 : H - ob.h / 2;
            const dist = Math.hypot(ox - p.x, oy - p.y);
            if (dist < p.r + ob.w / 2) {
              ob.opacity = 1;
              ob.revealT = 100;
              // Fireball destroys obstacles
              if (p.isFireball && dist < p.r) {
                ob.destroyed = true;
                ob.opacity = 0;
              }
            }
          }
        }

        // Update powerup timers (scaled by dt)
        if (activePowerups.immunity.active) {
          activePowerups.immunity.timer -= dt;
          if (activePowerups.immunity.timer <= 0) {
            activePowerups.immunity.active = false;
          }
        }

        // Check powerup collection
        for (let i = powerups.length - 1; i >= 0; i--) {
          const pu = powerups[i];
          const dx = (player.x + player.width / 2) - (pu.x - scrollX);
          const dy = (player.y + player.height / 2) - pu.y;
          if (Math.hypot(dx, dy) < 30) {
            // Collect powerup
            if (pu.powerupType === 'immunity') {
              activePowerups.immunity.active = true;
              activePowerups.immunity.timer = activePowerups.immunity.duration;
            } else if (pu.powerupType === 'fireball') {
              activePowerups.fireball.active = true;
            } else if (pu.powerupType === 'plasma') {
              pulse.energy = pulse.max;
            }
            powerups.splice(i, 1);
            shake.i = 4;
            continue;
          }
        }

        // Obstacle fade (scaled by dt)
        for (const ob of obstacles) {
          if (ob.revealT > 0) {
            ob.revealT -= dt;
            ob.opacity = ob.revealT / 100;
          } else {
            ob.opacity = Math.max(0, ob.opacity - 0.004 * dt);
          }
        }

        // Generate obstacles
        while (nextObs - scrollX < W + 400) {
          const top = Math.random() > 0.5;
          const ob = makePillar(nextObs, top);
          obstacles.push(ob);
          // HARDER frequency
          if (Math.random() > 0.25) {
            const pair = makePillar(nextObs, !top, ob.h);
            if (pair.h > 50) obstacles.push(pair);
          }
          nextObs += GAP + Math.random() * 80;
        }

        obstacles = obstacles.filter(ob => ob.x - scrollX > -150);

        // Generate powerups in safe but challenging positions
        while (nextPowerup - scrollX < W + 200) {
          const types = Object.values(POWERUP_TYPES);
          const selectedType = types[Math.floor(Math.random() * types.length)];

          // Find obstacles near this X position to avoid placing inside them
          const nearbyObs = obstacles.filter(ob =>
            Math.abs(ob.x - nextPowerup) < ob.w + 60
          );

          // Calculate safe Y range
          let safeMinY = 80;
          let safeMaxY = H - 80;

          for (const ob of nearbyObs) {
            if (ob.isTop) {
              // Top obstacle - don't place in upper area
              safeMinY = Math.max(safeMinY, ob.h + 50);
            } else {
              // Bottom obstacle - don't place in lower area
              safeMaxY = Math.min(safeMaxY, H - ob.h - 50);
            }
          }

          // Ensure valid range exists
          if (safeMaxY - safeMinY > 60) {
            // Place slightly off-center (not in the middle, makes it more challenging)
            const centerY = (safeMinY + safeMaxY) / 2;
            const offset = (Math.random() - 0.5) * (safeMaxY - safeMinY) * 0.6;
            const puY = Math.max(safeMinY + 30, Math.min(safeMaxY - 30, centerY + offset));

            powerups.push({
              x: nextPowerup,
              y: puY,
              powerupType: selectedType.type,
              color: selectedType.color,
              symbol: selectedType.symbol,
              pulse: 0,
            });
          }
          nextPowerup += 600 + Math.random() * 400;
        }

        // Update powerups (scaled by dt)
        powerups.forEach(pu => {
          pu.pulse += 0.08 * dt;
        });
        powerups.splice(0, powerups.filter(pu => pu.x - scrollX < -100).length);

        // Trail particles (spawn rate adjusted, but not dt-dependent as it's probability-based)
        if (Math.random() > Math.pow(0.3, dt)) {
          particles.push({
            x: player.x + 4,
            y: player.y + player.height / 2 + (Math.random() - 0.5) * 8,
            a: 0.5, s: 1.5 + Math.random() * 2,
            vx: -0.8 - Math.random() * 0.5,
            vy: (Math.random() - 0.5) * 0.4,
          });
        }
        if (particles.length > 80) particles.splice(0, particles.length - 80);
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.a -= 0.01 * dt; p.s *= Math.pow(0.997, dt);
          if (p.a <= 0) particles.splice(i, 1);
        }

        if (checkCollision()) triggerCrash();
      }

      if (STATE.mode === "CRASH") {
        STATE.crashTimer -= dt;
        // Reveal walls on crash
        for (const ob of obstacles) {
          ob.opacity = Math.min(1, ob.opacity + 0.025 * dt);
        }
      }

      // Sonar bar decay (exponential decay with dt)
      sonar.energy *= Math.pow(0.94, dt);
      for (let i = 0; i < sonar.bars.length; i++) {
        sonar.bars[i] = sonar.bars[i] * Math.pow(0.87, dt) +
          sonar.energy * Math.sin(i * 0.5 + Date.now() * 0.005) *
          (0.3 + Math.random() * 0.6) * 0.1 * dt;
      }

      shake.i *= Math.pow(shake.decay, dt);
      if (shake.i < 0.2) shake.i = 0;
    }

    /* ─── Draw ─── */
    function draw() {
      ctx.save();

      // Screen shake
      if (shake.i > 0) {
        ctx.translate(
          (Math.random() - 0.5) * shake.i * 1.5,
          (Math.random() - 0.5) * shake.i * 1.5
        );
      }

      // Background
      ctx.fillStyle = "#08081a";
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Subtle grid
      ctx.strokeStyle = "rgba(100, 50, 160, 0.04)";
      ctx.lineWidth = 0.5;
      for (let x = (-scrollX * 0.3) % 60; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (STATE.mode === "START") {
        drawStart();
      } else if (STATE.mode === "PAUSED") {
        drawGame();
        drawPause();
      } else {
        drawGame();
      }

      ctx.restore();
    }

    function drawGame() {
      // Obstacles
      for (const ob of obstacles) {
        if (ob.opacity < 0.01 || ob.destroyed) continue;
        ctx.save();
        ctx.globalAlpha = ob.opacity;

        // Fill
        ctx.fillStyle = `rgba(30, 10, 60, ${ob.opacity * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(ob.points[0].x - scrollX, ob.points[0].y);
        for (let i = 1; i < ob.points.length; i++) {
          ctx.lineTo(ob.points[i].x - scrollX, ob.points[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = `rgba(120, 50, 200, ${ob.opacity * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#7c3aed";
        ctx.shadowBlur = 10 * ob.opacity;
        ctx.stroke();
        ctx.restore();
      }

      // Powerups
      for (const pu of powerups) {
        const px = pu.x - scrollX;
        if (px < -50 || px > W + 50) continue;

        ctx.save();
        const scale = 1 + Math.sin(pu.pulse) * 0.15;
        const alpha = 0.7 + Math.sin(pu.pulse * 2) * 0.3;

        ctx.globalAlpha = alpha;
        ctx.translate(px, pu.y);
        ctx.scale(scale, scale);

        // Outer glow
        const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 25);
        const r = parseInt(pu.color.slice(1, 3), 16);
        const g = parseInt(pu.color.slice(3, 5), 16);
        const b = parseInt(pu.color.slice(5, 7), 16);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.67)`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        // Symbol
        ctx.fillStyle = pu.color;
        ctx.shadowColor = pu.color;
        ctx.shadowBlur = 15;
        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.symbol, 0, 0);

        ctx.restore();
      }

      // Pulse rings (Subtle Warp Style)
      for (const p of pulses) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        // Multiple thin rings for warp effect
        const ringCount = 4;
        for (let i = 0; i < ringCount; i++) {
          const ringOffset = i * 6;
          const ringR = Math.max(0, p.r - ringOffset);
          const ringAlpha = p.a * (1 - i * 0.2) * 0.6; // More subtle opacity

          if (ringR > 5 && ringAlpha > 0.01) {
            // Outer glow ring
            ctx.strokeStyle = `hsla(${p.hue + i * 10}, 80%, 60%, ${ringAlpha * 0.4})`;
            ctx.lineWidth = 3 - i * 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
            ctx.stroke();

            // Inner sharp ring
            ctx.strokeStyle = `hsla(${p.hue + i * 15}, 100%, 75%, ${ringAlpha * 0.7})`;
            ctx.lineWidth = 1.5 - i * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ringR - 1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Subtle center glow (only for fresh pulses)
        if (p.r < 80) {
          const centerAlpha = Math.max(0, (1 - p.r / 80)) * p.a * 0.3;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 85%, ${centerAlpha})`);
          g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Trail particles
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.fillStyle = "#6d3bbd";
        ctx.shadowColor = "#6d3bbd";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Dragon with immunity effect
      if (activePowerups.immunity.active) {
        ctx.save();
        const shimmer = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 20 * shimmer;
        ctx.globalAlpha = 0.3 + shimmer * 0.4;
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawDragon();

      // HUD
      drawHUD();

      // Sonar
      drawSonar();

      // Crash overlay
      if (STATE.mode === "CRASH") drawCrash();
    }

    function drawHUD() {
      ctx.save();
      const distY = 40;
      const spacing = 24; // vertical spacing between HUD lines
      ctx.fillStyle = "#9b7cc8";
      ctx.font = "bold 28px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`DIST: ${STATE.score}`, 18, distY);

      // Always show BEST line — show '-' when no high score recorded
      const bestValue = STATE.highScore > 0 ? STATE.highScore : "-";
      ctx.fillStyle = "#9b7cc8";
      ctx.font = "24px 'Courier New', monospace";
      ctx.fillText(`BEST: ${bestValue}`, 18, distY + spacing);

      // Plasma bar (center top to avoid overlapping right-side UI)
      const bw = 240, bh = 10, bx = (W - bw) / 2, by = 36;
      ctx.fillStyle = "#12081e";
      ctx.fillRect(bx, by, bw, bh);
      const fill = pulse.energy / pulse.max;
      ctx.fillStyle = "#5c2d91";
      ctx.fillRect(bx, by, bw * fill, bh);
      ctx.strokeStyle = "#5c2d9133";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#9b7cc8";
      ctx.font = "20px 'Courier New', monospace";
      ctx.textAlign = "center";
      // Draw label above the bar so it doesn't overlap the fill
      const labelY = by - 8; // above the bar
      ctx.fillText("PLASMA", bx + bw / 2, labelY);

      // Speed
      const sf = 1 + (player.x / W) * 2.2;
      const sl = Math.min(3, Math.floor(sf));
      ctx.fillStyle = sl >= 3 ? "#c44" : sl >= 2 ? "#b98030" : "#9b7cc8";
      ctx.font = "20px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SPD ${"▮".repeat(sl)}${"▯".repeat(3 - sl)}`, 18, 88);

      // Active powerups display
      let pyOffset = 106;
      if (activePowerups.immunity.active) {
        const timeLeft = Math.ceil(activePowerups.immunity.timer / 60);
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText(`◆ IMMUNITY ${timeLeft}s`, 18, pyOffset);
        pyOffset += 16;
      }
      if (activePowerups.fireball.active) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText(`◉ FIREBALL READY`, 18, pyOffset);
        pyOffset += 16;
      }

      ctx.restore();
    }

    function drawSonar() {
      ctx.save();
      const n = sonar.bars.length;
      const bw = W / n;
      const base = H - 22;
      for (let i = 0; i < n; i++) {
        const h = Math.abs(sonar.bars[i]) * 16;
        const a = 0.1 + Math.abs(sonar.bars[i]) * 3;
          ctx.fillStyle = `rgba(100, 50, 170, ${Math.min(0.7, a)})`;
          ctx.fillRect(i * bw + 1, base - h / 2, bw - 2, h);
        }
        ctx.fillStyle = "#5c2d9122";
        ctx.font = "10px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("◈ SONAR ◈", W / 2, H - 8);
      ctx.restore();
    }

    function drawStart() {
      const t = Date.now() * 0.001;
      const p = 0.5 + 0.5 * Math.sin(t * 2);

      // Animated background particles
      ctx.save();
      for (let i = 0; i < 30; i++) {
        const px = (W * 0.2 + i * 37 + t * 20) % W;
        const py = (H * 0.3 + i * 23 + Math.sin(t + i) * 30) % H;
        const size = 1 + Math.sin(t * 2 + i) * 0.5;
        const alpha = 0.1 + Math.sin(t + i * 0.5) * 0.1;
        ctx.fillStyle = `rgba(140, 80, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();

      // Title with glow effect (renamed to Fah Dragon)
      const titleY = H * 0.20;
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 40 + p * 25;
      ctx.fillStyle = "#c084fc";
      ctx.font = "900 80px 'Teko', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FAH DRAGON", W / 2, titleY);

      // Subtitle
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#7c3aed";
      ctx.fillStyle = "#a78bfa";

      // Tagline
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#6b5b9566";
      ctx.font = "italic 22px 'Courier New', monospace";
      ctx.fillText("◈ fly blind. pulse to see. ◈", W / 2, titleY + 94);

      // Dragon preview with floating animation
      if (dragonImg.complete && dragonImg.naturalWidth > 0) {
        ctx.save();
        const dragonY = H * 0.40 + Math.sin(t * 1.5) * 8;
        const dragonScale = 1 + Math.sin(t * 2) * 0.03;
        ctx.translate(W / 2, dragonY);
        ctx.scale(-dragonScale, dragonScale);

        // Glow behind dragon
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 25;
        ctx.drawImage(dragonImg, -55, -30, 110, 60);
        ctx.restore();
      }

      ctx.restore();
    }

    function drawPause() {
      const t = Date.now() * 0.001;

      ctx.save();

      // Darken background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, W, H);

      // Pause title
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#c084fc";
      ctx.font = "bold 48px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", W / 2, H * 0.28);

      // Current score
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9b7cc888";
      ctx.font = "18px 'Courier New', monospace";
      ctx.fillText(`DISTANCE: ${STATE.score}`, W / 2, H * 0.36);

      // Menu options (use a plain home symbol instead of colorful emoji)
      const options = ["▶  RESUME", "↻  RESTART", "⌂  MAIN MENU"];
      const menuY = H * 0.48;
      const menuSpacing = 50;

      for (let i = 0; i < options.length; i++) {
        const isSelected = STATE.pauseSelection === i;
        const y = menuY + i * menuSpacing;

        if (isSelected) {
          // Selection highlight box
          const boxW = 220;
          const boxH = 36;
          ctx.fillStyle = "rgba(140, 80, 220, 0.2)";
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect((W - boxW) / 2, y - 22, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          // Selected text
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#e9d5ff";
          ctx.font = "bold 20px 'Courier New', monospace";
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#7c6b9a88";
          ctx.font = "16px 'Courier New', monospace";
        }

        ctx.fillText(options[i], W / 2, y);
      }

      // Navigation hint
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#5a4d7a55";
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillText("[↑↓] Navigate   [SPACE/ENTER] Select   [ESC] Resume", W / 2, H * 0.88);

      ctx.restore();
    }

    function drawCrash() {
      const t = STATE.crashTimer / STATE.crashDuration;

      if (STATE.crashTimer > 20) {
        ctx.save();
        ctx.globalAlpha = t * 0.25;
        ctx.fillStyle = "#c44";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = t;
        ctx.fillStyle = "#c44";
        ctx.shadowColor = "#c44";
        ctx.shadowBlur = 16;
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.textAlign = "center";
        const jx = (Math.random() - 0.5) * 6 * t;
        const jy = (Math.random() - 0.5) * 6 * t;
        ctx.fillText("CRASH", W / 2 + jx, H / 2 + jy);
        ctx.restore();
      }

      if (STATE.crashTimer <= 20 && STATE.crashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 1 - STATE.crashTimer / 20;
        ctx.fillStyle = "#9b7cc8";
        ctx.font = "16px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.font = "12px 'Courier New', monospace";
        ctx.fillStyle = "#9b7cc888";
        ctx.fillText("[ SPACE TO RETRY ]", W / 2, H / 2 + 14);
        ctx.restore();
      }
      else if (STATE.crashTimer <= 0) {
        // Post-crash menu: Restart / Main Menu
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#9b7cc8";
        ctx.font = "18px 'Courier New', monospace";
        ctx.textAlign = "center";
        // distance text omitted to prevent overlapping the menu

        const options = ["↻  RESTART", "⌂  MAIN MENU"];
        const menuY = H * 0.48;
        const menuSpacing = 50;

        for (let i = 0; i < options.length; i++) {
          const isSelected = STATE.pauseSelection === i;
          const y = menuY + i * menuSpacing;

          if (isSelected) {
            const boxW = 220;
            const boxH = 36;
            ctx.fillStyle = "rgba(140, 80, 220, 0.2)";
            ctx.strokeStyle = "#a855f7";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect((W - boxW) / 2, y - 22, boxW, boxH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = "#a855f7";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#e9d5ff";
            ctx.font = "bold 20px 'Courier New', monospace";
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#7c6b9a88";
            ctx.font = "16px 'Courier New', monospace";
          }

          ctx.fillText(options[i], W / 2, y);
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#5a4d7a55";
        ctx.font = "12px 'Courier New', monospace";
        ctx.fillText("[↑↓] Navigate   [ENTER] Select   [SPACE] Restart", W / 2, H * 0.88);

        ctx.restore();
      }
    }

    /* ─── Loop ─── */
    function loop(currentTime) {
      // Calculate delta time (dt = 1.0 at 60fps)
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;
      // Clamp dt to prevent huge jumps (e.g., after tab switch)
      const dt = Math.min(elapsed / TARGET_FRAME_TIME, 3);

      update(dt);
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    }
    // Start the loop with initial timestamp
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      // clear exposed start handler
      if (startGameRef) startGameRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const cleanup = initGame(canvas);
    gameRef.current = cleanup;

    // hydrate high score from authenticated user (if any)
    (async () => {
      try {
        const resp = await fetch('/api/auth/me');
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await resp.json();
          const best = data?.user?.bestScore;
          if (typeof best === 'number' && gameStateRef.current) {
            gameStateRef.current.highScore = best;
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      window.removeEventListener("resize", resize);
      if (gameRef.current) gameRef.current();
    };
  }, [initGame]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#08081a",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* User Menu - Top Right */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 100 }}>
        <UserMenu />
      </div>
      {/* Centered start UI overlay (visible on START) */}
      {(gameMode === null || gameMode === 'START') && (
        <div
          style={{
            position: 'absolute',
            zIndex: 95,
            top: 'calc(50% + 150px)',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0,
            pointerEvents: 'auto',
            background: 'rgba(8,8,26,0.85)',
            border: '2px solid rgba(124,58,237,0.4)',
            borderRadius: 8,
            padding: 12,
            minWidth: 420,
            maxWidth: 780,
          }}
        >
          {/* Play */}
          <button
            onClick={() => {
              if (startGameRef.current) startGameRef.current();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '16px 20px',
              background: 'rgba(124,58,237,0.25)',
              border: '1px solid rgba(124,58,237,0.28)',
              color: '#e9d5ff',
              borderRadius: 6,
              textDecoration: 'none',
              fontFamily: 'Courier New, monospace',
              fontWeight: 700,
              fontSize: 20,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            ▶ Play
          </button>

          {/* Create / Join Party row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.28)',
                color: '#e9d5ff',
                borderRadius: 6,
                fontFamily: 'Courier New, monospace',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 18,
                marginBottom: 0,
              }}
            >
              Create Party
            </button>
            <button
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.28)',
                color: '#e9d5ff',
                borderRadius: 6,
                fontFamily: 'Courier New, monospace',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 18,
                marginBottom: 0,
              }}
            >
              Join Party
            </button>
          </div>

          {/* Leaderboard */}
          <Link
            href="/leaderboard"
            style={{
              display: 'block',
              width: '100%',
              padding: '16px 20px',
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.28)',
              color: '#e9d5ff',
              borderRadius: 6,
              textDecoration: 'none',
              fontFamily: 'Courier New, monospace',
              fontWeight: 700,
              textAlign: 'center',
              fontSize: 18,
              marginBottom: 6,
              boxSizing: 'border-box',
            }}
          >
            Leaderboard
          </Link>

          {/* How to play / Settings row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setHowOpen(true)}
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.28)',
                color: '#e9d5ff',
                borderRadius: 6,
                fontFamily: 'Courier New, monospace',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 18,
                marginBottom: 0,
              }}
            >
              How to play
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.28)',
                color: '#e9d5ff',
                borderRadius: 6,
                fontFamily: 'Courier New, monospace',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 18,
                marginBottom: 0,
              }}
            >
              Settings
            </button>
          </div>
        </div>
      )}
      <HowToModal isOpen={howOpen} onClose={() => setHowOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
        }}
      />
    </div>
  );
}
