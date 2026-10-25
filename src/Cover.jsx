import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Wordmark } from "./Typography.jsx";
import { YearOrbit } from "./YearOrbit.jsx";
import { publicLink, publicSite, navigatePage } from "./lib.js";
import {
  coverEntries,
  coverLogoPalette,
  coverPrimaryEntry,
  coverYears,
  yearAccent,
} from "../shared/cover.js";
import "./cover.css";

let coverSeen = false;

export function Cover({ data, error }) {
  const [intro] = useState(() => !coverSeen);
  const [selected, setSelected] = useState(
    () => history.state?.coverYear || null,
  );
  const [leaving, setLeaving] = useState(false);
  const departure = useRef(null);
  const years = coverYears(data);
  const year = years.find((item) => item.id === selected) || years[0];
  const entries = coverEntries(year);
  const poster = coverPrimaryEntry(year);
  const palette = coverLogoPalette(year, data);
  useEffect(() => {
    coverSeen = true;
    document.title = "XGN · 年度档案";
    return () => clearTimeout(departure.current);
  }, []);

  function choose(id) {
    setSelected(id);
    history.replaceState({ ...history.state, coverYear: id }, "");
  }
  function enter(event) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (leaving) return;
    history.replaceState({ ...history.state, coverYear: year.id }, "");
    setLeaving(true);
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 320;
    departure.current = setTimeout(
      () => navigatePage(publicLink(year.id)),
      duration,
    );
  }

  return (
    <main
      className={`cover-page ${intro ? "cover-intro" : "cover-return"} ${leaving ? "is-leaving" : ""}`}
      style={{
        "--accent": yearAccent(year),
        "--logo-c1": palette[0],
        "--logo-c2": palette[1],
        "--logo-c3": palette[2],
        "--logo-c4": palette[3],
      }}
    >
      <div className="cover-atmosphere" aria-hidden="true">
        <div className="cover-ambient" />
        {poster?.image ? (
          <div
            key={year.id}
            className="cover-poster-light"
            style={{ backgroundImage: `url("${poster.image}")` }}
          />
        ) : null}
        <div className="cover-light-current" />
        <div className="cover-vignette" />
      </div>
      <div className="cover-stage">
        <header className="cover-header">
          <p>年度档案</p>
          {!publicSite ? (
            <a href="/edit" className="cover-edit">
              编辑
            </a>
          ) : null}
        </header>
        <div className="cover-center">
          <h1 className="cover-logo">
            <span className="sr-only">XGN</span>
            <Wordmark prism />
          </h1>
          <div className="cover-entry" aria-busy={leaving}>
            {years.length ? (
              <>
                <YearOrbit
                  years={years}
                  year={year}
                  onChange={choose}
                  disabled={leaving}
                />
                {entries.length ? (
                  <a
                    className="cover-enter"
                    href={publicLink(year.id)}
                    onClick={enter}
                    aria-label={`进入 ${year.id} 年度评选`}
                  >
                    <span>进入年度</span>
                    <ArrowRight size={21} weight="light" />
                  </a>
                ) : (
                  <p className="cover-empty">这一年尚未收录</p>
                )}
              </>
            ) : data ? (
              <p className="cover-empty">暂无公开年度</p>
            ) : null}
            {error ? (
              <div className="cover-error">
                <p role="alert">{error}</p>
                <a href="/">重新加载</a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
