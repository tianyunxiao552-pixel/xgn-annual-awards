import { useEffect, useRef } from "react";
import { coverEntries, yearAccent } from "../shared/cover.js";

export function YearOrbit({ years, year, onChange, disabled }) {
  const orbit = useRef(null);
  const gesture = useRef(null);
  const dragged = useRef(false);
  const wheelState = useRef({ distance: 0, last: 0 });
  const index = years.findIndex((item) => item.id === year.id);

  function step(direction) {
    const next = years[index + direction];
    if (next && !disabled) onChange(next.id);
  }

  useEffect(() => {
    const element = orbit.current;
    function wheel(event) {
      if (disabled || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const state = wheelState.current;
      if (Date.now() - state.last < 420) return;
      state.distance += event.deltaX;
      if (Math.abs(state.distance) < 35) return;
      // Older years sit to the left: dragging/scrolling right brings them forward.
      const next = years[index + (state.distance < 0 ? 1 : -1)];
      if (next) onChange(next.id);
      state.distance = 0;
      state.last = Date.now();
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [index, years, disabled, onChange]);

  return (
    <nav
      ref={orbit}
      className="cover-years"
      aria-label="选择封面年份"
      onKeyDown={(event) => {
        if (disabled) return;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? years.length - 1
              : Math.max(
                  0,
                  Math.min(
                    years.length - 1,
                    index + (event.key === "ArrowLeft" ? 1 : -1),
                  ),
                );
        onChange(years[nextIndex].id);
        orbit.current
          .querySelector(`[data-year="${years[nextIndex].id}"]`)
          ?.focus({ preventScroll: true });
      }}
      onPointerDown={(event) => {
        if (disabled || (event.pointerType === "mouse" && event.button !== 0))
          return;
        gesture.current = { x: event.clientX, y: event.clientY };
        dragged.current = false;
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start) return;
        if (
          Math.abs(event.clientX - start.x) > 12 &&
          Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)
        ) {
          dragged.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || !dragged.current) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 36) step(dx > 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        dragged.current = false;
      }}
      onClickCapture={(event) => {
        if (!dragged.current) return;
        event.preventDefault();
        event.stopPropagation();
        dragged.current = false;
      }}
    >
      {years.map((item, itemIndex) => {
        const offset = index - itemIndex;
        const depth = Math.abs(offset);
        return (
          <button
            key={item.id}
            data-year={item.id}
            onClick={() => onChange(item.id)}
            aria-current={offset === 0 ? "true" : undefined}
            aria-hidden={depth > 3 ? "true" : undefined}
            tabIndex={offset === 0 ? 0 : -1}
            className={`${offset === 0 ? "selected" : ""} ${coverEntries(item).length ? "" : "is-uncollected"}`}
            style={{
              "--year-accent": yearAccent(item),
              "--year-offset": Math.max(-4, Math.min(4, offset)),
              "--year-depth": `${-Math.min(depth, 4) * 95}px`,
              "--year-scale": 0.7 ** depth,
              "--year-opacity": depth > 3 ? 0 : [1, 0.58, 0.3, 0.13][depth],
              zIndex: years.length - depth,
              pointerEvents: depth > 3 ? "none" : undefined,
            }}
            aria-label={`${item.id}${coverEntries(item).length ? "" : "，尚未收录"}`}
            disabled={disabled}
          >
            {item.id}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {year.id} 年；左右滑动或使用方向键切换年份
      </span>
    </nav>
  );
}
