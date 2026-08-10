"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
};

type GravityWellLoaderProps = {
  label?: string;
  className?: string;
  particleCount?: number;
  compact?: boolean;
};

type ThemeColors = {
  particle: string;
  particleBright: string;
  core: string;
  glow: string;
  ring: string;
};

export function GravityWellLoader({
  label = "Preparing your workspace...",
  className = "",
  particleCount = 75,
  compact = false,
}: GravityWellLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) return;
    if (window.navigator.userAgent.toLowerCase().includes("jsdom")) return;

    let ctx: CanvasRenderingContext2D | null = null;

    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }

    if (!ctx) return;

    const canvasElement = canvas;
    const wrapperElement = wrapper;
    const context = ctx;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];

    const pointer = {
      x: 0,
      y: 0,
      active: false,
      strength: 0,
      targetStrength: 0,
    };

    let colors: ThemeColors = getThemeColors();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function getThemeColors(): ThemeColors {
      const html = document.documentElement;
      const darkFromClass = html.classList.contains("dark");
      const darkFromDataAttribute = html.dataset.theme === "dark";
      const darkFromScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const computed = getComputedStyle(html);
      const colorScheme = computed.colorScheme;
      const dark =
        darkFromClass ||
        darkFromDataAttribute ||
        (!html.classList.contains("light") &&
          (colorScheme === "dark" || darkFromScheme));

      if (dark) {
        return {
          particle: "99, 102, 241",
          particleBright: "165, 180, 252",
          core: "129, 140, 248",
          glow: "79, 70, 229",
          ring: "129, 140, 248",
        };
      }

      return {
        particle: "79, 70, 229",
        particleBright: "99, 102, 241",
        core: "67, 56, 202",
        glow: "99, 102, 241",
        ring: "79, 70, 229",
      };
    }

    function createParticle(): Particle {
      const centerX = width / 2;
      const centerY = height / 2;
      const minimumRadius = Math.min(width, height) * 0.18;
      const maximumRadius = Math.max(width, height) * 0.62;
      const angle = Math.random() * Math.PI * 2;
      const radius =
        minimumRadius + Math.random() * Math.max(1, maximumRadius - minimumRadius);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const speed = 0.25 + Math.random() * 0.7;

      return {
        x,
        y,
        previousX: x,
        previousY: y,
        vx: tangentX * speed,
        vy: tangentY * speed,
        size: 0.7 + Math.random() * 1.5,
        opacity: 0.25 + Math.random() * 0.65,
        life: 400 + Math.random() * 900,
      };
    }

    function resize() {
      const rect = wrapperElement.getBoundingClientRect();

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasElement.width = Math.round(width * dpr);
      canvasElement.height = Math.round(height * dpr);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        particles = Array.from({ length: particleCount }, () => createParticle());
      }
    }

    function respawnParticle(particle: Particle) {
      const replacement = createParticle();

      particle.x = replacement.x;
      particle.y = replacement.y;
      particle.previousX = replacement.x;
      particle.previousY = replacement.y;
      particle.vx = replacement.vx;
      particle.vy = replacement.vy;
      particle.size = replacement.size;
      particle.opacity = replacement.opacity;
      particle.life = replacement.life;
    }

    function applyGravity(
      particle: Particle,
      gravityX: number,
      gravityY: number,
      force: number,
      softening: number,
      maximumAcceleration: number,
    ) {
      const dx = gravityX - particle.x;
      const dy = gravityY - particle.y;
      const distanceSquared = dx * dx + dy * dy + softening;
      const distance = Math.sqrt(distanceSquared);

      if (distance === 0) return;

      const acceleration = Math.min(force / distanceSquared, maximumAcceleration);
      particle.vx += (dx / distance) * acceleration;
      particle.vy += (dy / distance) * acceleration;
    }

    function drawCore(time: number) {
      const centerX = width / 2;
      const centerY = height / 2;
      const scale = compact ? Math.max(0.28, Math.min(width, height) / 120) : 1;
      const pulse = Math.sin(time * 0.0025) * 2 * scale;
      const outerRadius = 42 * scale + pulse;
      const gradient = context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        outerRadius,
      );

      gradient.addColorStop(0, `rgba(${colors.core}, 0.30)`);
      gradient.addColorStop(0.22, `rgba(${colors.glow}, 0.16)`);
      gradient.addColorStop(0.6, `rgba(${colors.glow}, 0.06)`);
      gradient.addColorStop(1, `rgba(${colors.glow}, 0)`);

      context.beginPath();
      context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();

      context.beginPath();
      context.arc(centerX, centerY, 13 * scale + pulse * 0.2, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${colors.ring}, 0.18)`;
      context.lineWidth = 1;
      context.stroke();

      const coreGradient = context.createRadialGradient(
        centerX - 3 * scale,
        centerY - 3 * scale,
        0,
        centerX,
        centerY,
        10 * scale,
      );

      coreGradient.addColorStop(0, `rgba(${colors.particleBright}, 0.95)`);
      coreGradient.addColorStop(0.45, `rgba(${colors.core}, 0.9)`);
      coreGradient.addColorStop(1, `rgba(${colors.glow}, 0.15)`);

      context.beginPath();
      context.arc(centerX, centerY, 8 * scale, 0, Math.PI * 2);
      context.fillStyle = coreGradient;
      context.fill();
    }

    function drawPointerGravity() {
      if (compact || pointer.strength < 0.02) return;

      const radius = 26 + pointer.strength * 14;
      const gradient = context.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        radius,
      );

      gradient.addColorStop(
        0,
        `rgba(${colors.particleBright}, ${0.08 * pointer.strength})`,
      );
      gradient.addColorStop(1, `rgba(${colors.particle}, 0)`);

      context.beginPath();
      context.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
    }

    function updateParticle(particle: Particle) {
      const centerX = width / 2;
      const centerY = height / 2;

      particle.previousX = particle.x;
      particle.previousY = particle.y;

      applyGravity(particle, centerX, centerY, 46, 600, 0.06);

      if (pointer.strength > 0.001) {
        applyGravity(particle, pointer.x, pointer.y, 190 * pointer.strength, 850, 0.11);
      }

      const dx = centerX - particle.x;
      const dy = centerY - particle.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const swirl = 0.0026;

      particle.vx += (-dy / distance) * swirl;
      particle.vy += (dx / distance) * swirl;
      particle.vx *= 0.996;
      particle.vy *= 0.996;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= 1;

      const distanceFromCore = Math.hypot(particle.x - centerX, particle.y - centerY);
      const outside =
        particle.x < -100 ||
        particle.x > width + 100 ||
        particle.y < -100 ||
        particle.y > height + 100;

      if (distanceFromCore < 10 || outside || particle.life <= 0) {
        respawnParticle(particle);
      }
    }

    function drawParticle(particle: Particle) {
      const speed = Math.hypot(particle.vx, particle.vy);
      const trailAlpha = Math.min(
        0.42,
        particle.opacity * (0.12 + speed * 0.12),
      );

      context.beginPath();
      context.moveTo(particle.previousX, particle.previousY);
      context.lineTo(particle.x, particle.y);
      context.strokeStyle = `rgba(${colors.particle}, ${trailAlpha})`;
      context.lineWidth = Math.max(0.5, particle.size * 0.7);
      context.stroke();

      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(${colors.particleBright}, ${particle.opacity})`;
      context.fill();
    }

    function animate(time: number) {
      context.clearRect(0, 0, width, height);
      pointer.strength += (pointer.targetStrength - pointer.strength) * 0.075;
      drawPointerGravity();

      for (const particle of particles) {
        updateParticle(particle);
        drawParticle(particle);
      }

      drawCore(time);
      animationFrame = requestAnimationFrame(animate);
    }

    function drawReducedMotion() {
      context.clearRect(0, 0, width, height);

      particles.slice(0, 26).forEach((particle) => {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(${colors.particle}, ${particle.opacity * 0.65})`;
        context.fill();
      });

      drawCore(0);
    }

    function startAnimation() {
      cancelAnimationFrame(animationFrame);

      if (reducedMotion.matches) {
        drawReducedMotion();
      } else {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = wrapperElement.getBoundingClientRect();

      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      pointer.targetStrength = 1;
    }

    function handlePointerEnter(event: PointerEvent) {
      handlePointerMove(event);
    }

    function handlePointerLeave() {
      pointer.active = false;
      pointer.targetStrength = 0;
    }

    function handlePointerDown() {
      pointer.targetStrength = 1.75;
      window.setTimeout(() => {
        pointer.targetStrength = pointer.active ? 1 : 0;
      }, 180);
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      startAnimation();
    });

    const themeObserver = new MutationObserver(() => {
      colors = getThemeColors();

      if (reducedMotion.matches) {
        drawReducedMotion();
      }
    });

    const handleReducedMotionChange = () => {
      startAnimation();
    };

    resizeObserver.observe(wrapperElement);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    wrapperElement.addEventListener("pointermove", handlePointerMove);
    wrapperElement.addEventListener("pointerenter", handlePointerEnter);
    wrapperElement.addEventListener("pointerleave", handlePointerLeave);
    wrapperElement.addEventListener("pointerdown", handlePointerDown);
    reducedMotion.addEventListener("change", handleReducedMotionChange);

    resize();
    startAnimation();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      wrapperElement.removeEventListener("pointermove", handlePointerMove);
      wrapperElement.removeEventListener("pointerenter", handlePointerEnter);
      wrapperElement.removeEventListener("pointerleave", handlePointerLeave);
      wrapperElement.removeEventListener("pointerdown", handlePointerDown);
      reducedMotion.removeEventListener("change", handleReducedMotionChange);
    };
  }, [compact, particleCount]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        compact
          ? "relative isolate size-12 shrink-0 overflow-hidden rounded-full bg-transparent"
          : "relative isolate flex min-h-[280px] w-full select-none items-center justify-center overflow-hidden bg-transparent",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        aria-hidden="true"
      />

      {!compact ? (
        <div className="pointer-events-none relative z-10 mt-24 text-center">
          <p className="text-sm font-medium text-foreground">
            {label}
          </p>
        </div>
      ) : null}
    </div>
  );
}
