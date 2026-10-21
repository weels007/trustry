"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Mode = "dark" | "light";
type ModePreference = Mode | "auto";

type GatewayFlowProps = {
  mode?: ModePreference;
  speed?: number;
  size?: number;
  density?: number;
  opacity?: number;
  /** 0 to 1. How much of the seal has been impressed. */
  seal?: number;
  className?: string;
  style?: CSSProperties;
};

const DEFAULTS = {
  mode: "dark" as Mode,
  speed: 1,
  size: 1,
  density: 1,
  opacity: 1,
  seal: 1,
} as const;

const LIGHT_PAPER = "#eef1f6";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scaleCount(base: number, density: number, minimum = 1) {
  return Math.max(minimum, Math.round(base * density));
}

/**
 * The flow is the consensus. Every path is one validator reading the same
 * page, and they all arrive at the same point. The seal at that point fills
 * in as the agreement comes in.
 */
const flowSource = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trustry</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet">
</head>
<body class="antialiased" style="margin:0;background:#07080b;font-family:'IBM Plex Mono',monospace;">

    <div class="fixed inset-0 z-0 overflow-hidden bg-black">
        <div class="absolute inset-0 z-0 opacity-10" style="background: radial-gradient(circle at 50% 50%, rgba(233,228,218,0.05) 0%, rgba(0,0,0,0) 70%);"></div>
        <canvas id="flow-canvas" class="absolute inset-0 w-full h-full z-10"></canvas>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('flow-canvas');
            const ctx = canvas.getContext('2d');

            let width, height;
            let seals = [];

            function resize() {
                const dpr = window.devicePixelRatio || 1;
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                ctx.scale(dpr, dpr);
            }
            window.addEventListener('resize', resize);
            resize();

            // A seal impression happens where the paths meet.
            window.addEventListener('click', (e) => {
                seals.push({ x: e.clientX, y: e.clientY, radius: 0, life: 1 });
            });

            const paths = [];
            const numPaths = __NUM_PATHS__;

            for (let i = 0; i < numPaths; i++) {
                paths.push({
                    isLeft: i % 2 === 0,
                    startY: (i / numPaths) * height * 1.4 - height * 0.2,
                    particles: [{
                        t: Math.random(),
                        speed: 0.0015 + Math.random() * 0.002
                    }]
                });
            }

            function getBezierPoint(t, p0, p1, p2, p3) {
                const u = 1 - t;
                return {
                    x: u**3 * p0.x + 3 * u**2 * t * p1.x + 3 * u * t**2 * p2.x + t**3 * p3.x,
                    y: u**3 * p0.y + 3 * u**2 * t * p1.y + 3 * u * t**2 * p2.y + t**3 * p3.y
                };
            }

            function drawSeal(x, y, radius, alpha, warmth) {
                ctx.save();
                ctx.translate(x, y);

                // A soft glow so the meeting point is the focal point.
                const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.6);
                glow.addColorStop(0, warmth ? 'rgba(200, 69, 47, 0.16)' : 'rgba(233, 228, 218, 0.06)');
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(0, 0, radius * 2.6, 0, Math.PI * 2);
                ctx.fill();

                // The ring of the seal.
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.strokeStyle = warmth ? 'rgba(200, 69, 47, 0.9)' : 'rgba(233, 228, 218, 0.55)';
                ctx.lineWidth = 1.1;
                ctx.stroke();

                // The impression, filled in as the agreement comes in.
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
                ctx.fillStyle = warmth ? 'rgba(200, 69, 47, 0.18)' : 'rgba(233, 228, 218, 0.08)';
                ctx.fill();

                // The cross of the seal.
                ctx.beginPath();
                ctx.moveTo(-radius * 0.34, 0);
                ctx.lineTo(radius * 0.34, 0);
                ctx.moveTo(0, -radius * 0.34);
                ctx.lineTo(0, radius * 0.34);
                ctx.strokeStyle = warmth ? 'rgba(200, 69, 47, 0.95)' : 'rgba(233, 228, 218, 0.65)';
                ctx.lineWidth = 1.1;
                ctx.stroke();

                ctx.restore();
            }

            function render() {
                ctx.clearRect(0, 0, width, height);
                const centerX = width / 2;
                // On a narrow screen the text sits in the middle, so the seal
                // moves down where it does not cover anything.
                const centerY = width < 640 ? height * 0.8 : height / 2;

                seals.forEach(seal => {
                    seal.radius += 15;
                    seal.life -= 0.015;
                });
                seals = seals.filter(seal => seal.life > 0);

                paths.forEach(path => {
                    const p0 = { x: path.isLeft ? 0 : width, y: path.startY };
                    const p1 = { x: path.isLeft ? centerX * 0.5 : width - centerX * 0.5, y: path.startY };
                    const p2 = { x: path.isLeft ? centerX * 0.8 : width - centerX * 0.8, y: centerY };
                    const p3 = { x: centerX, y: centerY };

                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
                    ctx.strokeStyle = 'rgba(233, 228, 218, 0.28)';
                    ctx.lineWidth = __LINE_WIDTH__;
                    ctx.setLineDash([2, 6]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    path.particles.forEach(p => {
                        p.t += p.speed * ((window.__SF_CONTROLS && window.__SF_CONTROLS.speed) || 1);
                        if (p.t > 1) {
                            p.t = 0;
                            path.startY += (Math.random() - 0.5) * 10;
                        }

                        const pos = getBezierPoint(p.t, p0, p1, p2, p3);

                        let dxTotal = 0, dyTotal = 0;
                        seals.forEach(seal => {
                            const dx = pos.x - seal.x;
                            const dy = pos.y - seal.y;
                            const dist = Math.hypot(dx, dy);
                            if (dist < seal.radius + 120 && dist > seal.radius - 120) {
                                const force = (1 - Math.abs(dist - seal.radius) / 120) * seal.life;
                                dxTotal += (dx / dist) * force * 80;
                                dyTotal += (dy / dist) * force * 80;
                            }
                        });

                        pos.x += dxTotal;
                        pos.y += dyTotal;

                        // The closer a particle is to the meeting point, the
                        // more the seal has been agreed on.
                        const closeness = 1 - Math.min(1, Math.hypot(pos.x - centerX, pos.y - centerY) / (width * 0.42));
                        const warmth = closeness > 0.55;

                        ctx.fillStyle = warmth ? 'rgba(200, 69, 47, 0.95)' : 'rgba(233, 228, 218, 0.6)';
                        ctx.fillRect(pos.x - 1.6, pos.y - 1.6, 3.2, 3.2);
                    });
                });

                // The seal at the point where the paths meet.
                const sealProgress = (window.__SF_CONTROLS && window.__SF_CONTROLS.seal) || 1;
                drawSeal(centerX, centerY, 52, sealProgress, sealProgress > 0.5);

                seals.forEach(seal => {
                    drawSeal(seal.x, seal.y, Math.max(4, seal.radius * 0.3), seal.life, true);
                });

                requestAnimationFrame(render);
            }

            render();
        });
    </script>
</body>
</html>`;

function readAutomaticMode(): Mode {
  if (typeof document === "undefined" || typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const declared = root.dataset.scheme ?? root.dataset.theme;
  if (declared === "light" || declared === "dark") return declared;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useAutomaticMode(enabled: boolean) {
  const [mode, setMode] = useState<Mode>(readAutomaticMode);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setMode(readAutomaticMode());
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-scheme", "data-theme"] });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);

  return mode;
}

export type { GatewayFlowProps };

export default function GatewayFlow({
  mode = DEFAULTS.mode,
  speed = DEFAULTS.speed,
  size = DEFAULTS.size,
  density = DEFAULTS.density,
  opacity = DEFAULTS.opacity,
  seal = DEFAULTS.seal,
  className,
  style,
}: GatewayFlowProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestedMode = mode;
  const automaticMode = useAutomaticMode(requestedMode === "auto");
  const resolvedMode: Mode =
    requestedMode === "auto" ? automaticMode : requestedMode === "light" ? "light" : "dark";

  const safeSpeed = clamp(speed, 0, 3);
  const safeSize = clamp(size, 0.05, 200);
  const safeDensity = clamp(density, 0.25, 2.5);
  const safeOpacity = clamp(opacity, 0.05, 1);
  const safeSeal = clamp(seal, 0, 1);

  const source = useMemo(() => {
    let next = flowSource
      .replace("__NUM_PATHS__", String(scaleCount(80, safeDensity, 12)))
      .replace("__LINE_WIDTH__", String(Number((1 * safeSize).toFixed(2))));
    if (resolvedMode === "light") {
      next = next
        .replace("rgba(233, 228, 218, 0.28)", "rgba(26, 31, 42, 0.3)")
        .replace("rgba(233, 228, 218, 0.6)", "rgba(26, 31, 42, 0.65)")
        .replace("rgba(233, 228, 218, 0.55)", "rgba(26, 31, 42, 0.58)")
        .replace("rgba(233, 228, 218, 0.08)", "rgba(26, 31, 42, 0.07)")
        .replace("rgba(233, 228, 218, 0.06)", "rgba(26, 31, 42, 0.05)")
        .replace("rgba(233, 228, 218, 0.65)", "rgba(26, 31, 42, 0.62)")
        .replace("background:#07080b", "background:#eef1f6");
    }
    return next;
  }, [resolvedMode, safeDensity, safeSize]);

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      {
        type: "threeui-controls",
        controls: { speed: safeSpeed, size: safeSize, density: safeDensity, opacity: safeOpacity, seal: safeSeal },
      },
      "*",
    );
  }, [safeDensity, safeOpacity, safeSeal, safeSize, safeSpeed, source]);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      title="Validators converging on a single record"
      srcDoc={source}
      sandbox="allow-scripts"
      loading="eager"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        background: resolvedMode === "light" ? LIGHT_PAPER : "#07080b",
        ...style,
      }}
    />
  );
}
