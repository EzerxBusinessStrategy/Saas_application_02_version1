"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hub: boolean;
  phase: number;
  pulseEvery: number;
  offsetX: number;
  offsetY: number;
};

type Connection = { from: Node; to: Node; strength: number };
type Signal = Connection & { startedAt: number; duration: number };

const CONNECTION_DISTANCE = 138;
const MAX_CONNECTIONS_PER_NODE = 3;

export function OperationalNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = canvas?.parentElement;
    const context = canvas?.getContext("2d");

    if (!canvas || !panel || !context) return;

    const nodes: Node[] = [];
    const signals: Signal[] = [];
    const pointer = { x: -999, y: -999, active: false };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let lastFrame = 0;
    let entranceStartedAt = 0;
    let nextSignalAt = 0;
    let visible = !document.hidden;

    const random = (minimum: number, maximum: number) =>
      minimum + Math.random() * (maximum - minimum);

    const createNodes = () => {
      const count = width >= 560 ? 22 : 14;
      nodes.splice(0, nodes.length);

      for (let index = 0; index < count; index += 1) {
        const hub = index < (width >= 560 ? 5 : 4);
        nodes.push({
          x: random(18, Math.max(19, width - 18)),
          y: random(18, Math.max(19, height - 18)),
          vx: random(-13, 13),
          vy: random(-13, 13),
          radius: hub ? random(3, 4) : random(1.5, 2.5),
          hub,
          phase: random(0, Math.PI * 2),
          pulseEvery: random(5, 9),
          offsetX: 0,
          offsetY: 0,
        });
      }
    };

    const resize = () => {
      const bounds = panel.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width));
      const nextHeight = Math.max(1, Math.round(bounds.height));
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

      if (nodes.length && width && height) {
        nodes.forEach((node) => {
          node.x = (node.x / width) * nextWidth;
          node.y = (node.y / height) * nextHeight;
        });
      }

      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      if (!nodes.length) createNodes();
      render(performance.now(), true);
    };

    const readability = (x: number, y: number) =>
      x < width * 0.86 && y > height * 0.2 && y < height * 0.78 ? 0.34 : 1;

    const connectionsFor = () => {
      const candidates: Array<Connection & { distance: number }> = [];
      const degrees = new Map<Node, number>();

      nodes.forEach((node, fromIndex) => {
        for (let toIndex = fromIndex + 1; toIndex < nodes.length; toIndex += 1) {
          const to = nodes[toIndex];
          const distance = Math.hypot(node.x - to.x, node.y - to.y);
          if (distance < CONNECTION_DISTANCE) {
            candidates.push({
              from: node,
              to,
              distance,
              strength: 1 - distance / CONNECTION_DISTANCE,
            });
          }
        }
      });

      return candidates
        .sort((left, right) => left.distance - right.distance)
        .filter((connection) => {
          const fromDegree = degrees.get(connection.from) ?? 0;
          const toDegree = degrees.get(connection.to) ?? 0;
          if (fromDegree >= MAX_CONNECTIONS_PER_NODE || toDegree >= MAX_CONNECTIONS_PER_NODE) {
            return false;
          }
          degrees.set(connection.from, fromDegree + 1);
          degrees.set(connection.to, toDegree + 1);
          return true;
        });
    };

    const updateNodes = (delta: number, now: number) => {
      nodes.forEach((node) => {
        node.vx += Math.sin(now / 7000 + node.phase) * delta * 0.8;
        node.vy += Math.cos(now / 7600 + node.phase) * delta * 0.8;
        node.vx = Math.max(-13, Math.min(13, node.vx));
        node.vy = Math.max(-13, Math.min(13, node.vy));
        node.x += node.vx * delta;
        node.y += node.vy * delta;

        if (node.x < 10 || node.x > width - 10) node.vx *= -0.92;
        if (node.y < 10 || node.y > height - 10) node.vy *= -0.92;
        node.x = Math.max(10, Math.min(width - 10, node.x));
        node.y = Math.max(10, Math.min(height - 10, node.y));

        const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
        const force = pointer.active && distance < 132 ? (1 - distance / 132) * 5 : 0;
        const targetX = force && distance ? ((node.x - pointer.x) / distance) * force : 0;
        const targetY = force && distance ? ((node.y - pointer.y) / distance) * force : 0;
        node.offsetX += (targetX - node.offsetX) * Math.min(1, delta * 4);
        node.offsetY += (targetY - node.offsetY) * Math.min(1, delta * 4);
      });
    };

    const render = (now: number, staticRender = false) => {
      context.clearRect(0, 0, width, height);
      const intro = Math.min(1, Math.max(0, (now - entranceStartedAt) / 1000));
      const connections = connectionsFor();

      connections.forEach((connection) => {
        const midpointX = (connection.from.x + connection.to.x) / 2;
        const midpointY = (connection.from.y + connection.to.y) / 2;
        context.beginPath();
        context.strokeStyle = `rgb(112 139 235 / ${(connection.strength * 0.14 * readability(midpointX, midpointY) * intro).toFixed(3)})`;
        context.lineWidth = 0.65;
        context.moveTo(connection.from.x + connection.from.offsetX, connection.from.y + connection.from.offsetY);
        context.lineTo(connection.to.x + connection.to.offsetX, connection.to.y + connection.to.offsetY);
        context.stroke();
      });

      if (!staticRender && now >= nextSignalAt && signals.length < 3 && connections.length) {
        const connection = connections[Math.floor(Math.random() * connections.length)];
        signals.push({ ...connection, startedAt: now, duration: random(900, 1600) });
        nextSignalAt = now + random(1800, 3500);
      }

      for (let index = signals.length - 1; index >= 0; index -= 1) {
        const signal = signals[index];
        const progress = (now - signal.startedAt) / signal.duration;
        if (progress >= 1 || staticRender) {
          signals.splice(index, 1);
          continue;
        }
        const eased = progress * progress * (3 - 2 * progress);
        const x = signal.from.x + (signal.to.x - signal.from.x) * eased;
        const y = signal.from.y + (signal.to.y - signal.from.y) * eased;
        const alpha = Math.sin(Math.PI * progress) * 0.7 * readability(x, y);
        const glow = context.createRadialGradient(x, y, 0, x, y, 7);
        glow.addColorStop(0, `rgb(180 198 255 / ${alpha})`);
        glow.addColorStop(1, "rgb(180 198 255 / 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, 7, 0, Math.PI * 2);
        context.fill();
      }

      nodes.forEach((node) => {
        const x = node.x + node.offsetX;
        const y = node.y + node.offsetY;
        const nodeOpacity = readability(x, y) * intro;
        const glow = context.createRadialGradient(x, y, 0, x, y, node.hub ? 12 : 8);
        glow.addColorStop(0, `rgb(${node.hub ? "164 184 255" : "132 158 255"} / ${(node.hub ? 0.85 : 0.65) * nodeOpacity})`);
        glow.addColorStop(1, "rgb(79 110 230 / 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, node.hub ? 12 : 8, 0, Math.PI * 2);
        context.fill();

        const intensity = (node.hub ? 0.85 : 0.65) * nodeOpacity;
        context.fillStyle = `rgb(${node.hub ? "164 184 255" : "132 158 255"} / ${intensity})`;
        context.beginPath();
        context.arc(x, y, node.radius * (0.7 + intro * 0.3), 0, Math.PI * 2);
        context.fill();

        if (!staticRender && node.hub) {
          const pulse = ((now / 1000 + node.phase) % node.pulseEvery) / node.pulseEvery;
          if (pulse < 0.32) {
            context.strokeStyle = `rgb(145 166 255 / ${((1 - pulse / 0.32) * 0.18 * nodeOpacity).toFixed(3)})`;
            context.lineWidth = 0.8;
            context.beginPath();
            context.arc(x, y, node.radius + (pulse / 0.32) * 22, 0, Math.PI * 2);
            context.stroke();
          }
        }
      });
    };

    const animate = (now: number) => {
      if (!visible || reducedMotion.matches) return;
      frame = requestAnimationFrame(animate);
      if (now - lastFrame < 22) return;
      const delta = Math.min(0.04, (now - lastTime) / 1000 || 0);
      lastFrame = now;
      updateNodes(delta, now);
      render(now);
      lastTime = now;
    };

    const start = () => {
      cancelAnimationFrame(frame);
      lastTime = performance.now();
      lastFrame = 0;
      entranceStartedAt = lastTime;
      nextSignalAt = lastTime + random(1800, 3500);
      if (reducedMotion.matches) render(lastTime, true);
      else frame = requestAnimationFrame(animate);
    };
    const onVisibilityChange = () => {
      visible = !document.hidden;
      if (visible) start();
      else cancelAnimationFrame(frame);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches) return;
      const bounds = panel.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onMotionChange = () => start();
    const observer = new ResizeObserver(resize);

    observer.observe(panel);
    panel.addEventListener("pointermove", onPointerMove);
    panel.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionChange);
    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      panel.removeEventListener("pointermove", onPointerMove);
      panel.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="login-operational-network" aria-hidden="true" tabIndex={-1} />;
}
