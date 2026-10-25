import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ShareNetwork,
  X,
  Warning,
  Check,
  ArrowLeft,
  ImageSquare,
} from "@phosphor-icons/react";
import {
  api,
  publicLink,
  navigatePage,
  musicTracks,
  isCollectionAward,
  publicSite,
  readerTarget,
  orderedAwards,
} from "./lib.js";
import { MusicPlayer } from "./MusicPlayer.jsx";
import { Wordmark, AwardLabel, awardKind } from "./Typography.jsx";
import { Cover } from "./Cover.jsx";
import { isCoverRoute, yearAccent } from "../shared/cover.js";
import { posterStyle } from "../shared/poster.js";
const Editor = publicSite ? null : lazy(() => import("./Editor.jsx"));
function isSampleYear(year) {
  return (
    year.example &&
    year.entries.every(
      (entry) =>
        entry.id === "edgerunners-demo" &&
        entry.title === "赛博朋克：边缘行者" &&
        entry.image === "/assets/edgerunners.jpg" &&
        entry.score == null,
    )
  );
}

export function Modal({ title, children, close, wide = false }) {
  const dialog = useRef();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const d = dialog.current;
    d.showModal();
    const onClick = (e) => {
      const rect = d.getBoundingClientRect();
      if (
        e.target === d &&
        (e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom)
      )
        closeRef.current();
    };
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("click", onClick);
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="关闭">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function App() {
  const [error, setError] = useState("");
  const [page, setPage] = useState({
    path: location.pathname.replace(/\/$/, "") || "/",
    key: 0,
  });
  const [publicData, setPublicData] = useState(null);
  const cover = isCoverRoute(page.path, location.search);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api(publicSite ? "/content.json" : "/api/public")
        .then((r) => {
          if (active) {
            setPublicData(r.data);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    const commitNavigation = () => {
      refresh();
      setError("");
      setPage((p) => ({
        path: location.pathname.replace(/\/$/, "") || "/",
        key: p.key + 1,
      }));
      window.scrollTo(0, 0);
    };
    const navigate = () => {
      const request = new CustomEvent("xgn:before-navigate", {
        cancelable: true,
        detail: { resume: commitNavigation },
      });
      if (window.dispatchEvent(request)) commitNavigation();
    };
    const click = (e) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const link = e.target.closest("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        (!["/", "/edit", "/preview"].includes(url.pathname) &&
          !/^\/year\/\d{4}(?:\/|$)/.test(url.pathname))
      )
        return;
      e.preventDefault();
      navigatePage(url.href);
    };
    refresh();
    window.addEventListener("xgn:navigate", navigate);
    window.addEventListener("popstate", navigate);
    window.addEventListener("xgn:published", refresh);
    document.addEventListener("click", click);
    return () => {
      active = false;
      window.removeEventListener("xgn:navigate", navigate);
      window.removeEventListener("popstate", navigate);
      window.removeEventListener("xgn:published", refresh);
      document.removeEventListener("click", click);
    };
  }, []);
  return (
    <div
      className={`xgn-app ${cover ? "on-cover" : ""} ${musicTracks(publicData?.music).length ? "with-music" : ""}`}
    >
      {!publicSite && page.path === "/edit" ? (
        <Suspense fallback={<Loading />}>
          <Editor key={page.key} />
        </Suspense>
      ) : cover ? (
        <Cover key={page.key} data={publicData} error={error} />
      ) : (
        <Reader
          key={page.key}
          publicData={publicData}
          onError={setError}
          error={error}
        />
      )}
      {musicTracks(publicData?.music).length ? (
        <MusicPlayer
          key={musicTracks(publicData.music)
            .map((track) => track.src)
            .join("|")}
          music={publicData.music}
        />
      ) : null}
    </div>
  );
}
function Loading() {
  return (
    <main className="loading">
      <span className="small-logo">XGN</span>
      <p>加载中</p>
      <span className="loading-line" />
    </main>
  );
}

export function Reader({ error, onError, publicData, framingPreview }) {
  const preview =
    !framingPreview &&
    !publicSite &&
    window.location.pathname.replace(/\/$/, "") === "/preview";
  const target =
    framingPreview || readerTarget(location.pathname, location.search);
  const [data, setData] = useState(null),
    [selectedYear, setYear] = useState(target.year);
  const [selectedEntry, setEntry] = useState(target.entry);
  const [selectedAward, setSelectedAward] = useState(target.award);
  const [awardIndex, setAwardIndex] = useState(0),
    [archive, setArchive] = useState(false),
    [reading, setReading] = useState(false),
    [revealed, setRevealed] = useState(false),
    [sharing, setSharing] = useState(false),
    [toast, setToast] = useState("");
  const sharedLink = useRef("");
  useEffect(() => {
    if (!preview) {
      if (publicData) setData(publicData);
      return;
    }
    api("/api/draft")
      .then((r) => setData(r.data))
      .catch((e) => onError(e.message));
  }, [preview, publicData]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const years = data
    ? [...data.years].sort((a, b) => b.id.localeCompare(a.id))
    : [];
  const selectedYearData = years.find((y) => y.id === selectedYear) || years[0];
  const year = selectedYearData
    ? { ...selectedYearData, awards: orderedAwards(selectedYearData.awards) }
    : null;
  const visibleYears = years.slice(0, 4);
  if (year && !visibleYears.some((y) => y.id === year.id))
    visibleYears[3] = year;
  const missingYear =
    !!selectedYear && !years.some((y) => y.id === selectedYear);
  const deepEntry = year?.entries.find((e) => e.id === selectedEntry);
  const activeAward =
    deepEntry?.award ||
    (year?.awards.includes(selectedAward) ? selectedAward : null) ||
    year?.awards[awardIndex] ||
    year?.awards[0];
  const group = year?.entries.filter((e) => e.award === activeAward) || [];
  const entry = deepEntry || group.find((e) => !e.nominee) || group[0];
  const collection = isCollectionAward(year, activeAward);
  const accent = entry?.accent || (collection ? "#c0c9c3" : "#b5afb8");
  const awardNav = useRef(null);
  const readerRef = useRef(null);
  const [navEdges, setNavEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const nav = awardNav.current;
    const active = nav?.querySelector('[aria-current="true"]');
    if (!active) return;
    const measure = () => {
      const next = {
        left: nav.scrollLeft > 2,
        right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2,
      };
      setNavEdges((previous) =>
        previous.left === next.left && previous.right === next.right
          ? previous
          : next,
      );
    };
    const reveal = () => {
      const item = active.getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      const delta =
        item.left < bounds.left + 34
          ? item.left - bounds.left - 34
          : item.right > bounds.right - 34
            ? item.right - bounds.right + 34
            : 0;
      if (delta) nav.scrollBy({ left: delta, behavior: "auto" });
      measure();
    };
    reveal();
    nav.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    let mounted = true;
    document.fonts.ready.then(() => {
      if (mounted) reveal();
    });
    return () => {
      mounted = false;
      observer.disconnect();
      nav.removeEventListener("scroll", measure);
    };
  }, [year?.id, activeAward]);
  function scrollAwards(direction) {
    const nav = awardNav.current;
    nav?.scrollBy({
      left: nav.clientWidth * 0.65 * direction,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  useEffect(() => {
    if (year && !framingPreview)
      document.title = `XGN ${year.id} · ${activeAward || "年度评选"}`;
  }, [year?.id, activeAward, framingPreview]);
  useEffect(() => {
    if (collection && deepEntry) {
      setReading(true);
      setRevealed(!deepEntry.spoiler);
    }
  }, [collection, deepEntry?.id]);
  function navigate(y, idx = 0, e = null) {
    const yr = data.years.find((yr) => yr.id === y);
    const awards = orderedAwards(yr?.awards);
    setYear(y);
    setAwardIndex(idx);
    setEntry(e);
    setSelectedAward(awards[idx] || null);
    setRevealed(false);
    setReading(false);
    setArchive(false);
    const url = publicSite ? new URL(publicLink(y, e)) : new URL(location.href);
    url.search = "";
    url.searchParams.set("year", y);
    if (e) url.searchParams.set("entry", e);
    else {
      const first = yr?.entries.find(
        (en) => en.award === awards[idx] && !en.nominee,
      );
      if (first && !isCollectionAward(yr, awards[idx]))
        url.searchParams.set("entry", first.id);
      if (awards[idx]) url.searchParams.set("award", awards[idx]);
    }
    history.pushState({}, "", url);
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }
  async function share(link) {
    const target = typeof link === "string" ? link : shareLink();
    sharedLink.current = target;
    try {
      await navigator.clipboard.writeText(target);
      setToast(
        location.hostname === "localhost" || location.hostname === "127.0.0.1"
          ? "本地链接已复制，仅这台电脑可打开"
          : preview
            ? "公开链接已复制，草稿需发布后才能看到"
            : "分享链接已复制",
      );
    } catch {
      setSharing(true);
    }
  }
  function shareLink() {
    if (!collection || reading) return publicLink(year.id, entry?.id);
    const url = new URL(publicLink(year.id));
    url.searchParams.set("award", activeAward);
    return url.toString();
  }
  if (error)
    return (
      <main className="loading">
        <span className="small-logo">XGN</span>
        <p role="alert">{error}</p>
        <a className="outline-button" href={preview ? "/edit" : "/"}>
          {preview ? "返回编辑台" : "重新加载"}
          <ArrowRight />
        </a>
      </main>
    );
  if (!data) return <Loading />;
  return (
    <div ref={readerRef} className="reader" style={{ "--accent": accent }}>
      <header className="site-header">
        <a href="/" className="brand" aria-label="XGN 首页">
          <Wordmark />
        </a>
        <button className="archive-toggle" onClick={() => setArchive(true)}>
          <span />
          年度档案
          <span />
        </button>
        {!publicSite ? (
          <a
            href={`/edit${year ? `?year=${year.id}` : ""}`}
            className="editor-link"
          >
            编辑
          </a>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>
      {preview ? (
        <div className="preview-banner">
          <span>草稿预览 · 仅你可见</span>
          <a href={`/edit${year ? `?year=${year.id}` : ""}`}>
            <ArrowLeft size={14} />
            返回编辑台
          </a>
        </div>
      ) : null}
      {!year || missingYear ? (
        <main className="empty-site">
          <div className="display-word">XGN</div>
          <h1>{missingYear ? "该年份尚未发布" : "暂无公开评选"}</h1>
          {!publicSite || missingYear ? (
            <a href={missingYear ? "/" : "/edit"} className="outline-button">
              {missingYear ? "返回年度档案" : "进入编辑台"}
              <ArrowRight />
            </a>
          ) : null}
        </main>
      ) : (
        <>
          <main>
            <section
              className={`hero ${collection ? "collection-hero" : ""} ${!group.length ? "is-empty" : ""} hero--${awardKind(activeAward)}`}
              aria-label={`${year.id} ${activeAward || ""}`}
            >
              {entry?.image && !collection ? (
                <div
                  key={`${year.id}-${entry.id}`}
                  className="poster-plane"
                  style={posterStyle(entry)}
                >
                  <img
                    className="poster-image"
                    src={entry.image}
                    alt={`${entry.title}海报`}
                    fetchPriority="high"
                    onError={(e) => {
                      e.currentTarget.style.opacity = ".08";
                    }}
                  />
                  <div className="poster-shade" />
                </div>
              ) : null}
              <div className="hero-content">
                <nav className="year-tabs" aria-label="选择年份">
                  {visibleYears.map((y) => (
                    <button
                      key={y.id}
                      className={y.id === year.id ? "active" : ""}
                      style={{ "--year-accent": yearAccent(y, accent) }}
                      aria-current={y.id === year.id ? "page" : undefined}
                      onClick={() => navigate(y.id)}
                    >
                      {y.id}
                    </button>
                  ))}
                  {years.length > 4 ? (
                    <button onClick={() => setArchive(true)}>全部年份</button>
                  ) : null}
                </nav>
                {year.intro &&
                ![
                  "记录这一年，留在心里的作品与片段。",
                  "这一年的故事，等待重新翻开。",
                  "从记忆里，补回这一年的答案。",
                ].includes(year.intro) ? (
                  <p className="year-intro">{year.intro}</p>
                ) : null}
                <div
                  className="award-content"
                  key={`${year.id}-${activeAward}-${entry?.id || "empty"}`}
                >
                  {(entry && isSampleYear(year)) || entry?.nominee ? (
                    <div className="award-kicker">
                      {isSampleYear(year) ? "示例" : "提名"}
                    </div>
                  ) : null}
                  <h1
                    className="award-title"
                    aria-label={activeAward || "年度评选"}
                  >
                    <AwardLabel name={activeAward || "年度评选"} />
                  </h1>
                  {collection && group.length ? (
                    <>
                      <p className="collection-description">
                        {group.length} 部 · 不分先后
                      </p>
                      <button
                        className="text-button collection-share"
                        onClick={share}
                      >
                        分享
                        <ShareNetwork size={18} />
                      </button>
                    </>
                  ) : entry ? (
                    <>
                      <h2>{entry.title || "尚未命名的作品"}</h2>
                      {entry.source && entry.source !== entry.title ? (
                        <p className="entry-scope">所属作品：{entry.source}</p>
                      ) : null}
                      {entry.scope && entry.scope !== "完整作品 · 示例" ? (
                        <p className="entry-scope">评选范围：{entry.scope}</p>
                      ) : null}
                      <div
                        className={`score ${entry.score == null ? "unrated" : ""}`}
                      >
                        <strong className="score-value">
                          {entry.score == null
                            ? "未评分"
                            : Number(entry.score).toFixed(1)}
                        </strong>
                        {entry.score != null ? <span>/ 10</span> : null}
                      </div>
                      {entry.teaser &&
                      entry.teaser !== "在这里写下你的获奖理由与评语。" ? (
                        <p className="entry-teaser">{entry.teaser}</p>
                      ) : null}
                      <div className="hero-actions">
                        <button
                          className="outline-button"
                          onClick={() => {
                            setReading(true);
                            setRevealed(!entry.spoiler);
                          }}
                        >
                          阅读颁奖词
                          <ArrowRight size={24} />
                        </button>
                        <button
                          className="icon-button share-button"
                          onClick={share}
                          aria-label="分享这个奖项"
                        >
                          <ShareNetwork size={21} />
                        </button>
                        {entry.spoiler ? (
                          <span className="spoiler-label">
                            <Warning size={16} />
                            含剧透
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="award-empty">
                      <h2>暂无作品</h2>
                      {preview ? (
                        <a href="/edit">
                          回编辑台添加作品
                          <ArrowUpRight />
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              {collection && group.length ? (
                <div
                  className={`pearl-gallery ${group.length === 1 ? "single" : ""}`}
                  aria-label="年度遗珠作品"
                >
                  {group.map((e) => (
                    <button
                      className="pearl-card"
                      key={e.id}
                      style={{ "--card-accent": e.accent }}
                      onClick={() => {
                        navigate(
                          year.id,
                          year.awards.indexOf(activeAward),
                          e.id,
                        );
                        setReading(true);
                        setRevealed(!e.spoiler);
                      }}
                      aria-label={`阅读 ${e.title || "尚未命名的作品"} 的颁奖词`}
                    >
                      <div className="pearl-art">
                        {e.image ? (
                          <img
                            src={e.image}
                            alt={`${e.title}海报`}
                            className="framed-poster"
                            style={posterStyle(e, {
                              x: 50,
                              y: 50,
                              fit: "cover",
                            })}
                            loading="lazy"
                          />
                        ) : (
                          <span className="pearl-no-image">
                            <ImageSquare size={42} weight="light" />
                          </span>
                        )}
                        <span className="pearl-read">
                          阅读颁奖词
                          <ArrowUpRight size={19} />
                        </span>
                      </div>
                      <div className="pearl-caption">
                        <strong>{e.title || "尚未命名的作品"}</strong>
                        <span>
                          {e.score == null
                            ? "未评分"
                            : Number(e.score).toFixed(1)}
                          {e.score != null ? <small> / 10</small> : null}
                        </span>
                      </div>
                      {e.spoiler ? (
                        <small className="pearl-spoiler">
                          <Warning size={12} />
                          颁奖词含剧透
                        </small>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              <div
                className={`award-nav-wrap ${navEdges.left ? "can-scroll-left" : ""} ${navEdges.right ? "can-scroll-right" : ""}`}
              >
                {navEdges.left ? (
                  <button
                    className="award-scroll award-scroll-prev"
                    aria-label="向左查看奖项"
                    onClick={() => scrollAwards(-1)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                ) : null}
                <nav ref={awardNav} className="award-nav" aria-label="年度奖项">
                  {year.awards.map((a, i) => (
                    <button
                      className={`${a === activeAward ? "active" : ""} award-choice--${awardKind(a)}`}
                      aria-label={a.replace(/^年度/, "")}
                      aria-current={a === activeAward ? "true" : undefined}
                      key={a}
                      onClick={() => navigate(year.id, i)}
                    >
                      <AwardLabel name={a} compact context="nav" />
                    </button>
                  ))}
                </nav>
                {navEdges.right ? (
                  <button
                    className="award-scroll award-scroll-next"
                    aria-label="向右查看奖项"
                    onClick={() => scrollAwards(1)}
                  >
                    <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            </section>
            <section className="annual-notes" id="annual-notes">
              <div className="notes-heading">
                <h2>全部奖项</h2>
                <button
                  className="text-button"
                  onClick={() => share(publicLink(year.id))}
                >
                  分享年度
                  <ShareNetwork size={18} />
                </button>
              </div>
              {group.length > 1 && !collection ? (
                <div className="honours">
                  {group.map((e) => (
                    <button
                      key={e.id}
                      className={`honour ${e.id === entry?.id ? "selected" : ""}`}
                      onClick={() =>
                        navigate(year.id, year.awards.indexOf(e.award), e.id)
                      }
                    >
                      {e.image ? (
                        <img src={e.image} alt="" loading="lazy" />
                      ) : null}
                      <span>
                        <small>
                          {e.nominee
                            ? "提名"
                            : group.filter((g) => !g.nominee).length > 1
                              ? "并列获奖"
                              : "获奖"}
                        </small>
                        <strong>{e.title}</strong>
                        <em>{e.scope}</em>
                      </span>
                      <ArrowUpRight />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="annual-index">
                {year.awards.map((a, i) => {
                  const winners = year.entries.filter(
                    (e) => e.award === a && !e.nominee,
                  );
                  return (
                    <button
                      key={a}
                      className={`award-index--${awardKind(a)} ${!winners.length ? "is-unfilled" : ""}`}
                      style={{
                        "--row-accent": winners[0]?.accent || "#b5afb8",
                      }}
                      aria-label={a}
                      onClick={() => navigate(year.id, i)}
                    >
                      <span className="index-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <AwardLabel name={a} compact context="index" />
                      <small>
                        {winners.map((e) => e.title).join(" / ") || "—"}
                      </small>
                      <ArrowUpRight size={21} />
                    </button>
                  );
                })}
              </div>
            </section>
          </main>
          <footer className="site-footer">
            <button onClick={() => setArchive(true)}>
              全部年份
              <ArrowRight />
            </button>
          </footer>
        </>
      )}
      {archive ? (
        <Modal title="年度档案" close={() => setArchive(false)}>
          <div className="archive-list">
            {years.length ? (
              years.map((y) => (
                <button key={y.id} onClick={() => navigate(y.id)}>
                  <strong>{y.id}</strong>
                  <span>
                    {isSampleYear(y)
                      ? "示例年度"
                      : `${y.entries.filter((e) => !e.nominee).length} 条评选`}
                  </span>
                  <ArrowUpRight />
                </button>
              ))
            ) : (
              <p>暂未发布年度评选。</p>
            )}
          </div>
        </Modal>
      ) : null}
      {reading && entry ? (
        <Modal
          wide
          title={entry.title || "未命名作品"}
          close={() => setReading(false)}
        >
          <div className="review-meta">
            <span>
              {year.id} / {entry.award}
            </span>
            {entry.scope && entry.scope !== "完整作品 · 示例" ? (
              <span>{entry.scope}</span>
            ) : null}
            {entry.score != null ? (
              <span className="review-score">
                {Number(entry.score).toFixed(1)} / 10
              </span>
            ) : null}
          </div>
          {entry.spoiler && !revealed ? (
            <div className="spoiler-gate">
              <Warning size={32} />
              <h3>这段颁奖词包含剧情内容</h3>
              <p>确认读过或不介意剧透后，再继续阅读。</p>
              <button
                className="outline-button"
                onClick={() => setRevealed(true)}
              >
                展开颁奖词
                <ArrowRight />
              </button>
            </div>
          ) : (
            <div className="review-body">
              {entry.review || entry.teaser || "暂无颁奖词。"}
            </div>
          )}
          <button className="text-button review-share" onClick={share}>
            分享这条评选
            <ShareNetwork />
          </button>
        </Modal>
      ) : null}
      {sharing ? (
        <Modal title="分享链接" close={() => setSharing(false)}>
          <p className="modal-description">
            {location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
              ? "这是本地链接，只能在这台电脑打开。网站上线后，可在这里复制公开链接。"
              : "复制下面的链接即可分享这条已公开的评选。"}
            {preview ? " 草稿修改需要先发布，访客才能看到。" : ""}
          </p>
          <input
            aria-label="分享链接"
            className="share-input"
            readOnly
            value={sharedLink.current || shareLink()}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
