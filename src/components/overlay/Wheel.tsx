import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PrismaElement, WheelStyle } from "@/lib/types";
import { fontFamilyOf, fontWeightOf } from "@/lib/fonts";
import {
  fitLabelSize,
  resolveWheelStyle,
  segmentAtPointer,
  wheelColors,
  wheelRotationAt,
  wheelSegments,
  WHEEL_SIZE_RANGE,
} from "@/lib/wheel";
import { useCanvasEditing } from "./canvasEditing";
import { shadowStyle } from "./shadow";
import { useElementResize } from "./useElementResize";

// A spin that arrives while the wheel is on screen starts turning when it arrives, give or take
// this much: the server's clock and this one may be seconds apart, and a spin that jumps ahead
// (or waits) by that much looks broken. Wheels opened mid-spin go by the server's clock.
const MAX_LIVE_HEAD_START = 1500;
// How far the pointer flicks back when a segment edge passes it, in degrees.
const POINTER_FLICK = 24;

let measureContext: CanvasRenderingContext2D | null = null;
const textWidth = (text: string, font: string) => {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * 0.6;
  measureContext.font = font;
  return measureContext.measureText(text).width;
};

// Goes up whenever a font finishes loading, so labels measured with a fallback are measured again.
const useFontsLoaded = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    const bump = () => setVersion((v) => v + 1);
    fonts.addEventListener("loadingdone", bump);
    return () => fonts.removeEventListener("loadingdone", bump);
  }, []);
  return version;
};

// A point on the circle of `radius`, `angle` degrees clockwise from the top.
const pointAt = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180;
  return `${radius * Math.sin(rad)} ${-radius * Math.cos(rad)}`;
};

const segmentPath = (index: number, count: number, radius: number) => {
  const start = (index * 360) / count;
  const end = ((index + 1) * 360) / count;
  return `M 0 0 L ${pointAt(start, radius)} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${pointAt(end, radius)} Z`;
};

interface WheelProps {
  element: PrismaElement;
}

// A wheel of fortune. Its labels are drawn at one size along their segments, coloured along an
// OKLCH gradient (src/lib/wheel.ts). A spin turns it from where it stood to where the server
// decided it stops, and once it does, the label it landed on pops up big in the middle.
const Wheel: React.FC<WheelProps> = ({ element }) => {
  const { wheel } = element;
  const resolved = useMemo(() => resolveWheelStyle(element.style as WheelStyle | null), [element.style]);
  const editing = useCanvasEditing();
  const { dragSize, handle } = useElementResize(element, WHEEL_SIZE_RANGE.min, {
    width: true,
    height: false,
  });

  const size = dragSize?.width ?? resolved.width;
  const radius = size / 2;
  const border = Math.min(resolved.borderWidth, radius / 4);
  const hubRadius = Math.max(8, size * 0.065);

  const fields = wheel?.fields;
  const segments = useMemo(() => wheelSegments(fields), [fields]);
  const count = segments.length;
  const colors = useMemo(() => wheelColors(count, resolved), [count, resolved]);

  const fontFamily = fontFamilyOf(resolved);
  const fontWeight = fontWeightOf(resolved);
  const fontsLoaded = useFontsLoaded();
  const innerRadius = hubRadius + size * 0.035;
  const outerRadius = radius - border - size * 0.06;
  const labelSize = useMemo(
    () =>
      fitLabelSize({
        labels: segments,
        widthAt1px: (label) => textWidth(label, `${fontWeight} 100px "${fontFamily}"`) / 100,
        innerRadius,
        outerRadius,
        maxSize: resolved.fontSize,
      }),
    // `fontsLoaded` measures again once the font is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, fontFamily, fontWeight, innerRadius, outerRadius, resolved.fontSize, fontsLoaded]
  );

  // --- The spin ---
  const spunAt = wheel?.spunAt ?? null;
  const fromRotation = wheel?.fromRotation ?? 0;
  const rotation = wheel?.rotation ?? 0;
  const duration = wheel?.duration ?? 0;
  const rotorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  // When the spin shown started on this clock. Kept per spin, so a new one can be told apart from
  // the one the wheel was opened at, and other changes during a spin don't move it.
  const spinStart = useRef<{ spin: string | null; start: number } | null>(null);
  // The spin that has stopped, and when (on this clock), which is when its result shows.
  const [stopped, setStopped] = useState(() => {
    const end = spunAt ? Date.parse(spunAt) + duration : 0;
    return { spin: spunAt && Date.now() >= end ? spunAt : null, at: end };
  });

  // Turns the wheel frame by frame, straight on the DOM, so React doesn't render 60 times a second.
  // A layout effect, so the wheel never shows at the end of a spin before it starts turning.
  useLayoutEffect(() => {
    const rotor = rotorRef.current;
    if (!rotor) return;
    if (spinStart.current?.spin !== spunAt) {
      const now = Date.now();
      const serverStart = spunAt ? Date.parse(spunAt) : 0;
      const live = spinStart.current !== null;
      spinStart.current = {
        spin: spunAt,
        start: live
          ? now - Math.min(MAX_LIVE_HEAD_START, Math.max(0, now - serverStart))
          : serverStart,
      };
    }
    const { start } = spinStart.current;
    const spin = { fromRotation, rotation, duration };

    let frame = 0;
    const draw = () => {
      const current = wheelRotationAt(spin, start, Date.now());
      rotor.style.transform = `rotate(${current.rotation}deg)`;
      const pointer = pointerRef.current;
      if (pointer) {
        // A segment edge just went past: the pointer flicks back, then settles until the next one.
        const segment = 360 / Math.max(1, count);
        const past = (((current.rotation % segment) + segment) % segment) / segment;
        const flick = current.turning && count > 1 ? Math.max(0, 1 - past / 0.35) : 0;
        pointer.style.transform = `translateX(-50%) rotate(${-POINTER_FLICK * flick}deg)`;
      }
      if (current.turning) {
        frame = requestAnimationFrame(draw);
      } else if (spunAt) {
        setStopped((last) =>
          last.spin === spunAt ? last : { spin: spunAt, at: start + duration }
        );
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [spunAt, fromRotation, rotation, duration, count]);

  // Hides the result again after `resultDuration` seconds, if it should.
  const [expired, setExpired] = useState<string | null>(null);
  const resultMs = resolved.resultDuration * 1000;
  useEffect(() => {
    if (!stopped.spin || resultMs <= 0) return;
    const spin = stopped.spin;
    const timeout = window.setTimeout(
      () => setExpired(spin),
      Math.max(0, stopped.at + resultMs - Date.now())
    );
    return () => window.clearTimeout(timeout);
  }, [stopped, resultMs]);

  const result = wheel?.result ?? null;
  const landed = segmentAtPointer(rotation, count);
  // The segment it stopped on, unless its labels have been changed since.
  const winner = result !== null && segments[landed] === result ? landed : -1;
  const revealed =
    resolved.showResult &&
    result !== null &&
    spunAt !== null &&
    stopped.spin === spunAt &&
    expired !== spunAt;

  const pointerWidth = Math.max(14, size * 0.075);
  const pointerHeight = Math.max(16, size * 0.09);

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{ width: `${size}px`, height: `${size}px`, ...shadowStyle(resolved, { box: true }) }}
    >
      <div ref={rotorRef} className="absolute inset-0" style={{ willChange: "transform" }}>
        <svg
          width={size}
          height={size}
          viewBox={`${-radius} ${-radius} ${size} ${size}`}
          className="block overflow-visible"
          style={{ fontFamily, fontWeight }}
        >
          {count === 0 ? (
            <circle r={radius} fill="#ffffff1a" />
          ) : count === 1 ? (
            <circle r={radius} fill={colors[0]} />
          ) : (
            segments.map((_, index) => (
              <path
                key={index}
                d={segmentPath(index, count, radius)}
                fill={colors[index]}
                stroke={border > 0 ? resolved.borderColor : "none"}
                strokeWidth={Math.max(1, border / 3)}
                strokeLinejoin="round"
                style={{
                  opacity: revealed && winner !== -1 && index !== winner ? 0.35 : 1,
                  transition: "opacity 400ms ease",
                }}
              />
            ))
          )}
          {segments.map((label, index) => (
            <text
              key={index}
              x={outerRadius}
              y={0}
              textAnchor="end"
              dominantBaseline="central"
              fill={resolved.color}
              fontSize={labelSize}
              // Along the middle of its segment, reading from the hub out to the rim.
              transform={`rotate(${((index + 0.5) * 360) / count - 90})`}
              style={{
                opacity: revealed && winner !== -1 && index !== winner ? 0.35 : 1,
                transition: "opacity 400ms ease",
              }}
            >
              {label}
            </text>
          ))}
          {count === 0 && editing && (
            <text
              y={radius / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffffaa"
              fontSize={Math.max(10, size * 0.05)}
            >
              No entries yet
            </text>
          )}
        </svg>
      </div>
      {border > 0 && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ border: `${border}px solid ${resolved.borderColor}` }}
        />
      )}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
        style={{
          width: hubRadius * 2,
          height: hubRadius * 2,
          transform: "translate(-50%, -50%)",
          backgroundColor: resolved.pointerColor,
          boxShadow: "0 1px 4px rgb(0 0 0 / 0.35)",
        }}
      />
      <div
        ref={pointerRef}
        className="pointer-events-none absolute top-0 left-1/2"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "50% 15%",
          transition: "transform 60ms linear",
          filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.4))",
        }}
      >
        <svg width={pointerWidth} height={pointerHeight} viewBox="0 0 20 24" className="block">
          <path
            d="M 2 2 H 18 L 10 22 Z"
            fill={resolved.pointerColor}
            stroke={resolved.pointerColor}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {revealed && (
        <WheelResult
          key={spunAt}
          text={result}
          background={colors[winner === -1 ? 0 : winner] ?? resolved.colorFrom}
          resolved={resolved}
          maxWidth={size * 0.9}
        />
      )}
      {handle}
    </div>
  );
};

// What the wheel landed on, in big over its middle. It pops in when it appears.
const WheelResult: React.FC<{
  text: string;
  background: string;
  resolved: ReturnType<typeof resolveWheelStyle>;
  maxWidth: number;
}> = ({ text, background, resolved, maxWidth }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.08)", opacity: 1, offset: 0.65 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      ],
      { duration: 500, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }, []);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-1/2 left-1/2 w-max text-center"
      style={{
        maxWidth,
        transform: "translate(-50%, -50%)",
        padding: "0.25em 0.6em",
        borderRadius: "0.35em",
        backgroundColor: background,
        border: resolved.borderWidth > 0 ? `3px solid ${resolved.borderColor}` : undefined,
        boxShadow: "0 10px 30px rgb(0 0 0 / 0.45)",
        color: resolved.color,
        fontFamily: fontFamilyOf(resolved),
        fontWeight: fontWeightOf(resolved),
        fontSize: resolved.resultFontSize,
        lineHeight: 1.15,
        overflowWrap: "anywhere",
      }}
    >
      {text}
    </div>
  );
};

export default Wheel;
