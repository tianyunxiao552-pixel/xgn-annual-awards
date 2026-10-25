import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  UploadSimple,
  Eye,
  SignOut,
  Trash,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  LockKey,
  GearSix,
  DownloadSimple,
  ArrowCounterClockwise,
  Image as ImageIcon,
  MusicNotes,
  X,
} from "@phosphor-icons/react";
import {
  api,
  send,
  DEFAULT_AWARDS,
  newEntry,
  preparePoster,
  publicLink,
  navigatePage,
  refreshPublished,
  musicTracks,
  isCollectionAward,
  orderedAwards,
} from "./lib.js";
import { Modal } from "./App.jsx";
import { Wordmark, AwardLabel, awardKind } from "./Typography.jsx";
import { PosterFraming } from "./PosterFraming.jsx";
import "./editor.css";

function isBlankEntry(entry) {
  return (
    !entry.title?.trim() &&
    !entry.review?.trim() &&
    !entry.teaser?.trim() &&
    !entry.image &&
    entry.score == null &&
    !entry.source?.trim() &&
    !entry.scope?.trim()
  );
}

function hasCustomContent(year) {
  return year.entries.some(
    (entry) =>
      entry.id !== "edgerunners-demo" ||
      entry.title !== "赛博朋克：边缘行者" ||
      entry.image !== "/assets/edgerunners.jpg" ||
      entry.score != null,
  );
}

export default function Editor() {
  const [session, setSession] = useState(null),
    [data, setData] = useState(null),
    [revision, setRevision] = useState(0),
    [saved, setSaved] = useState(""),
    [published, setPublished] = useState([]);
  const [hosting, setHosting] = useState(null);
  const [yearId, setYearId] = useState(
      new URLSearchParams(location.search).get("year"),
    ),
    [awardName, setAwardName] = useState(null),
    [entryId, setEntryId] = useState(null);
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [dialog, setDialog] = useState("");
  const [newYear, setNewYear] = useState(String(new Date().getFullYear())),
    [newAward, setNewAward] = useState(""),
    [restoreFile, setRestoreFile] = useState(null),
    [removedPearl, setRemovedPearl] = useState(null),
    [scoreDraft, setScoreDraft] = useState({ id: "", value: "" });
  const fileInput = useRef(),
    backupInput = useRef(),
    audioInput = useRef(),
    unsaved = useRef(false),
    beforeLeave = useRef(null);
  const selectedYearData =
    data?.years.find((y) => y.id === yearId) || data?.years[0];
  const year = selectedYearData
    ? { ...selectedYearData, awards: orderedAwards(selectedYearData.awards) }
    : null;
  const award = year?.awards.includes(awardName) ? awardName : year?.awards[0];
  const blank = useMemo(
    () => newEntry(award || DEFAULT_AWARDS[0]),
    [year?.id, award],
  );
  const entries = year?.entries.filter((e) => e.award === award) || [];
  const existing =
    entries.find((e) => e.id === entryId) ||
    entries.find((e) => !e.nominee) ||
    entries[0];
  const entry = existing || blank;
  const scoreText =
    scoreDraft.id === entry.id ? scoreDraft.value : String(entry.score ?? "");
  const scoreInvalid =
    scoreText !== "" &&
    (!/^\d*(?:\.\d*)?$/.test(scoreText) ||
      scoreText === "." ||
      Number(scoreText) > 10 ||
      Number(scoreText) < 0);
  const savedData = useMemo(() => (saved ? JSON.parse(saved) : null), [saved]);
  const savedEntry = savedData?.years
    .find((y) => y.id === year?.id)
    ?.entries.find((e) => e.id === existing?.id);
  const dirty = (!!data && JSON.stringify(data) !== saved) || scoreInvalid;
  const entryDirty =
    JSON.stringify(savedEntry) !== JSON.stringify(existing) || scoreInvalid;
  unsaved.current = dirty;
  const collection = isCollectionAward(year, award);
  const completed =
    year?.awards.filter((a) =>
      year.entries.some((e) => e.award === a && e.title.trim() && !e.nominee),
    ).length || 0;
  const isPublished = published.some((y) => y.id === year?.id);
  const liveEntry = published
    .find((y) => y.id === year?.id)
    ?.entries.find((e) => e.id === existing?.id);
  const entryStatus = !existing
    ? "待填写"
    : entryDirty
      ? "未保存"
      : JSON.stringify(liveEntry) === JSON.stringify(existing)
        ? hosting?.state === "live"
          ? "已发布"
          : "已保存公开版"
        : "已保存，未公开";

  useEffect(() => {
    document.title = "XGN · 填写年度评选";
    initialize();
  }, []);
  useEffect(() => {
    if (hosting?.state !== "publishing") return;
    const timer = setTimeout(() => {
      api("/api/hosting")
        .then(setHosting)
        .catch(() =>
          setHosting({
            state: "failed",
            message: "无法读取发布状态，请确认本地 XGN 仍在运行后重试。",
          }),
        );
    }, 2000);
    return () => clearTimeout(timer);
  }, [hosting]);
  useEffect(() => {
    const handler = (e) => {
      if (!unsaved.current) return;
      e.preventDefault();
      beforeLeave.current?.(e.detail.resume);
    };
    window.addEventListener("xgn:before-navigate", handler);
    return () => window.removeEventListener("xgn:before-navigate", handler);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      if (unsaved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    if (year?.id) history.replaceState({}, "", `/edit?year=${year.id}`);
  }, [year?.id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  async function load() {
    const r = await api("/api/draft");
    setData(r.data);
    setScoreDraft({ id: "", value: "" });
    setSaved(JSON.stringify(r.data));
    setRevision(r.revision);
    setPublished(r.published);
  }
  async function initialize() {
    setError("");
    try {
      const s = await api("/api/session");
      setSession(s);
      if (s.authenticated) {
        await Promise.all([load(), api("/api/hosting").then(setHosting)]);
      }
    } catch (error) {
      setError(error.message);
    }
  }
  function updateYear(patch) {
    setData((d) => ({
      ...d,
      years: d.years.map((y) => {
        if (y.id !== year.id) return y;
        const next = { ...y, example: false, ...patch };
        if (next.collectionAward && !next.awards.includes(next.collectionAward))
          delete next.collectionAward;
        return next;
      }),
    }));
  }
  function updateEntry(patch) {
    const next = { ...entry, ...patch };
    setData((d) => ({
      ...d,
      years: d.years.map((y) =>
        y.id === year.id
          ? {
              ...y,
              example: false,
              entries: y.entries.some((e) => e.id === entry.id)
                ? y.entries.map((e) =>
                    e.id === entry.id ? { ...e, ...patch } : e,
                  )
                : [...y.entries, next],
            }
          : y,
      ),
    }));
  }
  function chooseAward(a) {
    setAwardName(a);
    setEntryId(null);
    setError("");
  }
  async function act(task) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save({ publish = false, quiet = false } = {}) {
    if (scoreInvalid) throw new Error("评分应为 0–10 之间的数字");
    const cleanedYears = data.years.map((y) => {
      const entries = y.entries.filter((e) => !isBlankEntry(e));
      const edited =
        (publish && y.id === year.id) ||
        hasCustomContent({ ...y, entries }) ||
        JSON.stringify(savedData?.years.find((s) => s.id === y.id)) !==
          JSON.stringify(y);
      return {
        ...y,
        entries,
        example: edited ? false : y.example,
      };
    });
    const next = { ...data, years: cleanedYears };
    const yearsToPublish = publish
      ? next.years
          .filter((y) => {
            if (y.id === year.id) return true;
            const pubYear = published.find((p) => p.id === y.id);
            if (pubYear) return JSON.stringify(pubYear) !== JSON.stringify(y);
            const savedYear = savedData?.years.find((s) => s.id === y.id);
            return (
              JSON.stringify(savedYear) !== JSON.stringify(y) ||
              (y.entries.length > 0 && !y.example)
            );
          })
          .map((y) => y.id)
      : [];
    const r = await send("/api/draft", { data: next, revision }, "PUT");
    setData(r.data);
    setSaved(JSON.stringify(r.data));
    setRevision(r.revision);
    unsaved.current = false;
    setScoreDraft({ id: "", value: "" });
    if (publish) {
      const p = await send("/api/publish", {
        year: year.id,
        years: yearsToPublish,
        revision: r.revision,
      });
      setPublished(p.data.years);
      setHosting(p.hosting || { state: "unconnected" });
      refreshPublished();
      setToast(
        p.hosting?.state === "publishing"
          ? "已保存，正在更新分享网站"
          : "公开版本已保存在本机",
      );
    } else if (!quiet) setToast("已保存，暂不公开");
    return r;
  }
  async function upload(file) {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const { blob, accent } = await preparePoster(file);
      const r = await api("/api/upload", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      updateEntry({
        image: r.image,
        accent,
        x: 50,
        y: 50,
        posterFraming: undefined,
      });
      setToast("海报已更新");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function uploadMusic(files) {
    const selected = Array.from(files || []);
    if (!selected.length || uploading) return;
    setUploading(true);
    setError("");
    const tracks = [];
    try {
      if (selected.some((file) => file.size > 30 * 1024 * 1024))
        throw new Error("每首音乐请小于 30 MB");
      for (const file of selected) {
        const r = await api("/api/audio", {
          method: "POST",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        tracks.push({
          src: r.src,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
        });
      }
      setToast("音乐已添加");
    } catch (e) {
      setError(e.message);
    } finally {
      if (tracks.length)
        setData((d) => ({
          ...d,
          music: { tracks: [...musicTracks(d.music), ...tracks] },
        }));
      setUploading(false);
      if (audioInput.current) audioInput.current.value = "";
    }
  }
  function citation(value, spoiler = entry.spoiler) {
    return {
      review: value,
      spoiler,
      teaser: spoiler
        ? "颁奖词含剧透，点击后展开阅读。"
        : value.replace(/\s+/g, " ").trim().slice(0, 160),
    };
  }
  function addYear(e) {
    e.preventDefault();
    if (!/^\d{4}$/.test(newYear) || data.years.some((y) => y.id === newYear)) {
      setError("这个年份已存在，或年份格式不正确");
      return;
    }
    setData((d) => ({
      ...d,
      years: [
        ...d.years,
        {
          id: newYear,
          intro: "",
          example: false,
          awards: [...new Set([...DEFAULT_AWARDS, ...(year?.awards || [])])],
          entries: [],
        },
      ],
    }));
    setYearId(newYear);
    setAwardName(null);
    setEntryId(null);
    setDialog("");
    setError("");
  }
  function reorder(index, offset) {
    const a = [...year.awards];
    if (index + offset < 0 || index + offset >= a.length) return;
    [a[index], a[index + offset]] = [a[index + offset], a[index]];
    updateYear({ awards: a });
  }
  async function restore() {
    if (restoreFile.size > 200 * 1024 * 1024)
      throw new Error("备份文件请小于 200 MB");
    let input;
    try {
      input = JSON.parse(await restoreFile.text());
    } catch {
      throw new Error("这份文件不是有效的备份");
    }
    await send("/api/restore", input);
    await load();
    refreshPublished();
    setDialog("");
    setToast("已恢复，可以在备份设置撤销");
  }
  function addAnother() {
    if (existing && !entry.title.trim()) {
      setToast("请先填写当前作品的名字");
      return;
    }
    const item = newEntry(award);
    updateYear({ entries: [...year.entries, item] });
    setEntryId(item.id);
    setDialog("");
  }
  beforeLeave.current = (resume) =>
    act(async () => {
      try {
        await save({ quiet: true });
        resume();
      } catch (error) {
        history.pushState({}, "", `/edit${year ? `?year=${year.id}` : ""}`);
        throw error;
      }
    });
  if (!session)
    return (
      <main className="loading">
        <span className="small-logo">XGN</span>
        <p role={error ? "alert" : undefined}>{error || "加载中"}</p>
        {error ? (
          <button className="outline-button" onClick={initialize}>
            重试
          </button>
        ) : null}
      </main>
    );
  if (!session.authenticated)
    return (
      <Auth
        session={session}
        success={async () => {
          setSession({ ...session, authenticated: true, setup: false });
          await load();
        }}
      />
    );
  if (!data)
    return (
      <main className="loading">
        <span className="small-logo">XGN</span>
        <p role={error ? "alert" : undefined}>{error || "加载中"}</p>
        {error ? (
          <button className="outline-button" onClick={initialize}>
            重试
          </button>
        ) : null}
      </main>
    );
  return (
    <div
      className="editor-app simple-editor"
      style={{ "--accent": entry.accent }}
    >
      <header className="simple-header">
        <a
          className="brand"
          aria-label="XGN 首页"
          href="/"
          onClick={(e) => {
            if (dirty) {
              e.preventDefault();
              act(async () => {
                await save({ quiet: true });
                navigatePage("/");
              });
            }
          }}
        >
          <Wordmark />
        </a>
        <div className="simple-year-picker">
          <select
            aria-label="选择年份"
            value={year?.id || ""}
            disabled={busy || uploading}
            onChange={(e) => {
              setYearId(e.target.value);
              setAwardName(null);
              setEntryId(null);
            }}
          >
            {[...data.years]
              .sort((a, b) => b.id.localeCompare(a.id))
              .map((y) => (
                <option key={y.id} value={y.id}>
                  {y.id} 年
                </option>
              ))}
          </select>
          <button
            className="icon-button"
            aria-label="新建年度"
            disabled={busy || uploading}
            onClick={() => setDialog("year")}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="simple-header-actions">
          {year ? (
            <button
              className="text-button"
              disabled={busy || uploading}
              onClick={() =>
                act(async () => {
                  await save({ quiet: true });
                  navigatePage(
                    `/preview?year=${year.id}&award=${encodeURIComponent(award || "")}${existing && !collection ? `&entry=${entry.id}` : ""}`,
                  );
                })
              }
            >
              <Eye size={18} />
              看看效果
            </button>
          ) : null}
          <button
            className="icon-button"
            aria-label="设置"
            disabled={busy || uploading}
            onClick={() => setDialog("settings")}
          >
            <GearSix size={21} />
          </button>
        </div>
      </header>
      <main className="simple-main" inert={busy || uploading || undefined}>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")}>关闭</button>
          </div>
        ) : null}
        {!year ? (
          <div className="editor-empty">
            <h1>从某一年开始。</h1>
            <button
              className="primary-button"
              onClick={() => setDialog("year")}
            >
              <Plus />
              新建年度
            </button>
          </div>
        ) : (
          <>
            <div className="simple-page-heading">
              <div>
                <h1>{year.id} 年度评选</h1>
              </div>
              <span className="simple-progress">
                已填 <strong>{completed}</strong> / {year.awards.length} 个奖项
              </span>
            </div>
            <div className="simple-workspace">
              <aside className="simple-awards">
                <nav aria-label="选择奖项">
                  {year.awards.map((a, i) => {
                    const filled = year.entries.some(
                      (e) => e.award === a && e.title.trim() && !e.nominee,
                    );
                    return (
                      <button
                        key={a}
                        className={`${a === award ? "active" : ""} award-choice--${awardKind(a)}`}
                        aria-label={a.replace(/^年度/, "")}
                        aria-current={a === award ? "true" : undefined}
                        disabled={uploading}
                        onClick={() => chooseAward(a)}
                      >
                        <span className="award-ordinal">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <AwardLabel name={a} compact context="edit-nav" />
                        {filled ? (
                          <Check size={15} />
                        ) : (
                          <span className="award-unfilled" />
                        )}
                      </button>
                    );
                  })}
                </nav>
                <button
                  className="text-button simple-customize"
                  onClick={() => setDialog("awards")}
                >
                  <Plus size={14} />
                  自己加个奖项
                </button>
              </aside>
              <section className="simple-sheet" aria-label="填写奖项">
                <div className="simple-sheet-heading">
                  <h2>
                    {award ? (
                      <AwardLabel name={award} context="editor" />
                    ) : (
                      "先添加一个奖项"
                    )}
                  </h2>
                  <span>{entryStatus}</span>
                </div>
                {collection ? (
                  <div className="collection-editor-bar">
                    <div className="simple-entry-tabs" aria-label="遗珠作品">
                      {entries.map((e, i) => (
                        <button
                          key={e.id}
                          className={e.id === entry.id ? "active" : ""}
                          aria-pressed={e.id === entry.id}
                          onClick={() => setEntryId(e.id)}
                        >
                          {e.image ? (
                            <img src={e.image} alt="" />
                          ) : (
                            <span className="entry-tab-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          )}
                          {e.title || "待填写"}
                        </button>
                      ))}
                      <button className="add-pearl" onClick={addAnother}>
                        <Plus size={16} />
                        添加作品
                      </button>
                    </div>
                    {existing ? (
                      <button
                        className="text-button pearl-remove"
                        onClick={() => {
                          setRemovedPearl({
                            item: entry,
                            yearId: year.id,
                            index: year.entries.findIndex(
                              (e) => e.id === entry.id,
                            ),
                          });
                          updateYear({
                            entries: year.entries.filter(
                              (e) => e.id !== entry.id,
                            ),
                          });
                          setEntryId(null);
                        }}
                      >
                        <Trash size={13} />
                        移除当前作品
                      </button>
                    ) : null}
                    {removedPearl?.yearId === year.id ? (
                      <div className="pearl-undo" role="status">
                        <span>
                          已移除“{removedPearl.item.title || "未命名作品"}”
                        </span>
                        <button
                          className="text-button"
                          onClick={() => {
                            const items = [...year.entries];
                            if (
                              !items.some((e) => e.id === removedPearl.item.id)
                            )
                              items.splice(
                                removedPearl.index,
                                0,
                                removedPearl.item,
                              );
                            updateYear({ entries: items });
                            setEntryId(removedPearl.item.id);
                            setRemovedPearl(null);
                          }}
                        >
                          撤销移除
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : entries.length > 1 ? (
                  <div className="simple-entry-tabs" aria-label="同奖项作品">
                    {entries.map((e) => (
                      <button
                        key={e.id}
                        className={e.id === entry.id ? "active" : ""}
                        aria-pressed={e.id === entry.id}
                        onClick={() => setEntryId(e.id)}
                      >
                        {e.nominee ? "提名 · " : ""}
                        {e.title || "待填写"}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="simple-form">
                  <div className="simple-poster-column">
                    <button
                      className={`simple-upload ${entry.image ? "has-image" : ""}`}
                      disabled={uploading || !award}
                      aria-label={entry.image ? "更换海报" : "上传海报"}
                      onClick={() => fileInput.current.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        upload(e.dataTransfer.files[0]);
                      }}
                    >
                      {entry.image ? (
                        <>
                          <img
                            src={entry.image}
                            alt="当前作品海报"
                            style={{ objectFit: "contain" }}
                          />
                          <span className="simple-upload-caption">
                            <UploadSimple size={16} />
                            {uploading ? "上传中…" : "点击更换海报"}
                          </span>
                        </>
                      ) : (
                        <>
                          <UploadSimple size={32} weight="light" />
                          <strong>{uploading ? "上传中…" : "上传海报"}</strong>
                          <span>或拖入图片</span>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      className="file-input"
                      aria-label="上传作品海报"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => upload(e.target.files[0])}
                    />
                    <button
                      className="text-button simple-image-settings"
                      onClick={() => setDialog("entry-settings")}
                    >
                      <ImageIcon size={14} />
                      图片与补充设置
                    </button>
                  </div>
                  <div className="simple-fields">
                    <div className="simple-name-score">
                      <label>
                        名字
                        <input
                          aria-label="名字"
                          maxLength="200"
                          disabled={!award || uploading}
                          value={entry.title}
                          placeholder="作品名或剧情段落"
                          onChange={(e) =>
                            updateEntry({ title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        评分 <span>/ 10</span>
                        <input
                          aria-label="评分"
                          type="text"
                          inputMode="decimal"
                          aria-invalid={scoreInvalid}
                          disabled={!award || uploading}
                          value={scoreText}
                          placeholder="可留空"
                          onChange={(e) => {
                            const value = e.target.value;
                            setScoreDraft({ id: entry.id, value });
                            if (
                              value === "" ||
                              (/^\d*(?:\.\d*)?$/.test(value) &&
                                value !== "." &&
                                Number(value) <= 10)
                            )
                              updateEntry({
                                score: value === "" ? null : Number(value),
                              });
                          }}
                          onBlur={() => {
                            if (!scoreInvalid)
                              setScoreDraft({
                                id: entry.id,
                                value:
                                  scoreText === ""
                                    ? ""
                                    : String(Number(scoreText)),
                              });
                          }}
                        />
                      </label>
                    </div>
                    {scoreInvalid ? (
                      <p className="form-error" role="alert">
                        评分应为 0–10 之间的数字
                      </p>
                    ) : null}
                    <label className="simple-citation">
                      颁奖词
                      <textarea
                        aria-label="颁奖词"
                        rows="8"
                        disabled={!award || uploading}
                        maxLength="100000"
                        value={entry.review || entry.teaser || ""}
                        placeholder="填写颁奖词"
                        onChange={(e) => updateEntry(citation(e.target.value))}
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={entry.spoiler}
                        disabled={!award || uploading}
                        onChange={(e) =>
                          updateEntry(
                            citation(
                              entry.review || entry.teaser || "",
                              e.target.checked,
                            ),
                          )
                        }
                      />
                      含剧透
                    </label>
                    <div className="simple-save-row">
                      <button
                        className="primary-button"
                        disabled={busy || uploading || !award || scoreInvalid}
                        onClick={() => act(() => save({ publish: true }))}
                      >
                        {busy ? "正在保存…" : "保存并发布"}
                        <ArrowRight size={18} />
                      </button>
                      <button
                        className="text-button"
                        disabled={busy || uploading || !dirty || scoreInvalid}
                        onClick={() => act(() => save())}
                      >
                        保存草稿
                      </button>
                    </div>
                    {hosting ? (
                      <div className="hosting-status" role="status">
                        <span>
                          {hosting.message ||
                            (hosting.state === "unconnected"
                              ? "分享网站尚未连接"
                              : "")}
                        </span>
                        {hosting.url ? (
                          <a
                            href={hosting.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            查看线上版本 <ArrowUpRight size={14} />
                          </a>
                        ) : null}
                        {hosting.state === "failed" ? (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              act(async () =>
                                setHosting(await send("/api/deploy", {})),
                              )
                            }
                          >
                            重试发布
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
      {dialog === "year" ? (
        <Modal title="添加一个年份" close={() => setDialog("")}>
          <form className="dialog-form" onSubmit={addYear}>
            <label>
              年份
              <input
                aria-label="新年度年份"
                required
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength="4"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
              />
            </label>
            <p className="modal-description">
              包含 {DEFAULT_AWARDS.length} 个默认奖项。
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="submit">
              创建
              <ArrowRight />
            </button>
          </form>
        </Modal>
      ) : null}
      {dialog === "settings" ? (
        <Modal title="设置" close={() => setDialog("")}>
          <div className="simple-settings-list">
            {year ? (
              <>
                <label>
                  年度备注 <span>可不填</span>
                  <textarea
                    rows="3"
                    value={year.intro}
                    onChange={(e) => updateYear({ intro: e.target.value })}
                  />
                </label>
                <button onClick={() => setDialog("awards")}>
                  <GearSix size={18} />
                  调整奖项
                  <ArrowRight size={16} />
                </button>
                <button onClick={() => setDialog("year-settings")}>
                  <GearSix size={18} />
                  管理年份
                  <ArrowRight size={16} />
                </button>
              </>
            ) : null}
            <button onClick={() => setDialog("music")}>
              <MusicNotes size={18} />
              背景音乐
              <ArrowRight size={16} />
            </button>
            <button onClick={() => setDialog("backup")}>
              <DownloadSimple size={18} />
              备份与恢复
              <ArrowRight size={16} />
            </button>
            {dirty ? (
              <button
                onClick={() => {
                  if (window.confirm("撤销还没保存的修改？")) {
                    setData(JSON.parse(saved));
                    setScoreDraft({ id: "", value: "" });
                    setDialog("");
                  }
                }}
              >
                <ArrowCounterClockwise size={18} />
                撤销未保存修改
              </button>
            ) : null}
            <a href="/" target="_blank" rel="noreferrer">
              <ArrowUpRight size={18} />
              打开网站
            </a>
            <button
              onClick={() =>
                act(async () => {
                  if (dirty && !window.confirm("还有未保存修改，确定退出？"))
                    return;
                  await send("/api/logout", {});
                  setSession({ ...session, authenticated: false });
                })
              }
            >
              <SignOut size={18} />
              退出编辑台
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === "music" ? (
        <Modal
          title="背景音乐"
          close={() => {
            if (!uploading && !busy) setDialog("");
          }}
        >
          <div className="dialog-form music-settings">
            <p className="modal-description">全站共用，按顺序循环播放。</p>
            <input
              ref={audioInput}
              type="file"
              className="file-input"
              aria-label="上传背景音乐"
              multiple
              accept=".mp3,.flac,.m4a,.wav,.ogg,audio/*"
              onChange={(e) => uploadMusic(e.target.files)}
            />
            <button
              className="soft-button"
              disabled={uploading || busy}
              onClick={() => audioInput.current.click()}
            >
              <UploadSimple size={18} />
              {uploading ? "上传中…" : "添加音乐"}
            </button>
            <small>支持 MP3、FLAC 等音频，每首最大 30 MB</small>
            {musicTracks(data.music).length ? (
              <ol className="music-track-list">
                {musicTracks(data.music).map((track, i) => (
                  <li key={track.src}>
                    <span>{track.title}</span>
                    <button
                      className="icon-button"
                      disabled={busy || uploading}
                      aria-label={`移除音乐 ${i + 1}`}
                      onClick={() =>
                        setData((d) => {
                          const tracks = musicTracks(d.music).filter(
                            (t) => t.src !== track.src,
                          );
                          return {
                            ...d,
                            music: tracks.length ? { tracks } : null,
                          };
                        })
                      }
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={uploading || busy}
              onClick={() =>
                act(async () => {
                  const r = await save({ quiet: true });
                  const p = await send("/api/publish-music", {
                    revision: r.revision,
                  });
                  setPublished(p.data.years);
                  setHosting(p.hosting || { state: "unconnected" });
                  refreshPublished();
                  setToast(
                    p.hosting?.state === "publishing"
                      ? "音乐已保存，正在更新分享网站"
                      : "音乐公开版本已保存在本机",
                  );
                  setDialog("");
                })
              }
            >
              {busy ? "正在保存…" : "保存音乐"}
              <ArrowRight size={18} />
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === "entry-settings" && year ? (
        <Modal title="图片与补充设置" close={() => setDialog("")} wide>
          <p className="modal-description">同一张海报，电脑与手机分别调整。</p>
          {entry.image ? (
            <div className="simple-focal">
              <PosterFraming
                key={entry.id}
                entry={entry}
                year={year}
                updateEntry={updateEntry}
              />
              <label className="simple-color">
                点缀色
                <input
                  aria-label="点缀色"
                  type="color"
                  value={entry.accent}
                  onChange={(e) => updateEntry({ accent: e.target.value })}
                />
              </label>
            </div>
          ) : null}
          <details className="simple-details">
            <summary>作品信息与更多选项</summary>
            <div className="dialog-form">
              <label>
                所属作品
                <input
                  aria-label="所属作品"
                  value={entry.source || ""}
                  maxLength="200"
                  onChange={(e) => updateEntry({ source: e.target.value })}
                />
              </label>
              <label>
                具体参评范围
                <input
                  aria-label="参评范围"
                  value={entry.scope || ""}
                  maxLength="300"
                  onChange={(e) => updateEntry({ scope: e.target.value })}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={entry.nominee}
                  onChange={(e) => updateEntry({ nominee: e.target.checked })}
                />
                这条作为提名
              </label>
              <button
                className="soft-button"
                onClick={() => setDialog("reuse")}
              >
                <Copy size={16} />
                复用已有作品的海报和名字
              </button>
              <button className="soft-button" onClick={addAnother}>
                <Plus size={16} />
                再加一条并列获奖或提名
              </button>
              {existing ? (
                <button
                  className="text-button subtle-danger"
                  onClick={() => {
                    updateYear({
                      entries: year.entries.filter((e) => e.id !== entry.id),
                    });
                    setEntryId(null);
                    setDialog("");
                    setToast("已从当前草稿移除，发布后更新网站");
                  }}
                >
                  <Trash size={16} />
                  移除这一条
                </button>
              ) : null}
              {entry.image ? (
                <button
                  className="text-button subtle-danger"
                  onClick={() => updateEntry({ image: "" })}
                >
                  移除海报
                </button>
              ) : null}
            </div>
          </details>
          <button className="primary-button" onClick={() => setDialog("")}>
            完成
            <Check />
          </button>
        </Modal>
      ) : null}
      {dialog === "awards" && year ? (
        <Modal title="调整奖项" close={() => setDialog("settings")} wide>
          <p className="modal-description">可改名、排序或移除奖项。</p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="award-manager">
            {year.awards.map((a, i) => (
              <div key={i}>
                <input
                  aria-label={`奖项名称 ${i + 1}`}
                  key={a}
                  defaultValue={a}
                  maxLength="60"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (
                      !name ||
                      year.awards.some((value, j) => j !== i && value === name)
                    ) {
                      e.target.value = a;
                      setError("奖项名称不能重复或为空");
                      return;
                    }
                    if (name === a) return;
                    setError("");
                    if (award === a) setAwardName(name);
                    updateYear({
                      ...(isCollectionAward(year, a)
                        ? { collectionAward: name }
                        : {}),
                      awards: year.awards.map((v, j) => (j === i ? name : v)),
                      entries: year.entries.map((en) =>
                        en.award === a ? { ...en, award: name } : en,
                      ),
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <button
                  className="icon-button"
                  aria-label={`上移奖项 ${i + 1}`}
                  disabled={!i || (i === 1 && year.awards[0] === "年度最爱")}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`下移奖项 ${i + 1}`}
                  disabled={a === "年度最爱" || i === year.awards.length - 1}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`移除奖项 ${i + 1}`}
                  onClick={() => {
                    if (
                      year.entries.some((e) => e.award === a) &&
                      !window.confirm("此奖项的内容也会从草稿移除，继续？")
                    )
                      return;
                    updateYear({
                      awards: year.awards.filter((_, j) => j !== i),
                      entries: year.entries.filter((e) => e.award !== a),
                    });
                  }}
                >
                  <Trash size={15} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const a = newAward.trim();
              if (a && !year.awards.includes(a)) {
                updateYear({ awards: [...year.awards, a] });
                setNewAward("");
              }
            }}
          >
            <input
              aria-label="自定义奖项名称"
              placeholder="自定义奖项"
              maxLength="60"
              value={newAward}
              onChange={(e) => setNewAward(e.target.value)}
            />
            <button className="soft-button" type="submit">
              <Plus />
              添加
            </button>
          </form>
          <button
            className="text-button"
            onClick={() =>
              updateYear({
                awards: [
                  ...year.awards,
                  ...DEFAULT_AWARDS.filter((a) => !year.awards.includes(a)),
                ],
              })
            }
          >
            恢复默认奖项
          </button>
          <div className="management-actions">
            <button className="primary-button" onClick={() => setDialog("")}>
              完成
              <Check />
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === "reuse" ? (
        <Modal title="选一个已有作品" close={() => setDialog("entry-settings")}>
          <p className="modal-description">
            复用名字和海报，颁奖词仍然单独填写。
          </p>
          <div className="reuse-list">
            {data.years.flatMap((y) =>
              y.entries
                .filter((e) => e.title)
                .map((e) => (
                  <button
                    key={`${y.id}-${e.id}`}
                    onClick={() => {
                      updateEntry({
                        title: e.title,
                        image: e.image,
                        accent: e.accent,
                        source: e.source || "",
                        scope: e.scope,
                        x: e.x,
                        y: e.y,
                        fit: e.fit,
                        posterFraming: e.posterFraming
                          ? structuredClone(e.posterFraming)
                          : undefined,
                      });
                      setDialog("");
                    }}
                  >
                    {e.image ? <img src={e.image} alt="" /> : null}
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        {y.id} / {e.award}
                      </small>
                    </span>
                    <Copy size={17} />
                  </button>
                )),
            )}
          </div>
        </Modal>
      ) : null}
      {dialog === "year-settings" && year ? (
        <Modal
          title={`${year.id} 年度设置`}
          close={() => setDialog("settings")}
        >
          <p className="modal-description">
            撤下公开页面后，已经填写的内容仍会保留。示例年度在第一次保存发布后会自动变为你的正式评选。
          </p>
          <div className="management-actions">
            <button
              className="soft-button"
              disabled={busy || !isPublished}
              onClick={() =>
                act(async () => {
                  const r = await send("/api/unpublish", { year: year.id });
                  setPublished(r.data.years);
                  setHosting(r.hosting || { state: "unconnected" });
                  refreshPublished();
                  setDialog("");
                  setToast(
                    r.hosting?.state === "publishing"
                      ? "已本地撤下，正在更新分享网站"
                      : "已从本地公开版本撤下，填写的内容仍保留",
                  );
                })
              }
            >
              从网站撤下这一年
            </button>
            <button
              className="text-button subtle-danger"
              disabled={isPublished}
              onClick={() => {
                if (!window.confirm("从草稿移除此年份？保存前可以撤销。"))
                  return;
                setData((d) => ({
                  ...d,
                  years: d.years.filter((y) => y.id !== year.id),
                }));
                setYearId(null);
                setAwardName(null);
                setEntryId(null);
                setDialog("");
              }}
            >
              移除这一年的草稿
            </button>
          </div>
          <p className="field-hint">已公开的年份请先撤下，再移除。</p>
        </Modal>
      ) : null}
      {dialog === "backup" ? (
        <Modal title="备份与恢复" close={() => setDialog("settings")}>
          <p className="modal-description">
            备份包含评选、海报和音乐，不含密码。
          </p>
          <div className="management-actions">
            <a
              className="primary-button"
              href="/api/backup"
              download="xgn-backup.json"
            >
              <DownloadSimple />
              下载完整备份
            </a>
            <button
              className="soft-button"
              onClick={() => backupInput.current.click()}
            >
              <UploadSimple />
              从备份恢复
            </button>
            <button
              className="text-button"
              onClick={() =>
                act(async () => {
                  await send("/api/undo-restore", {});
                  await load();
                  setDialog("");
                  setToast("已撤销上次恢复");
                })
              }
            >
              <ArrowCounterClockwise />
              撤销上次恢复
            </button>
          </div>
          <input
            ref={backupInput}
            type="file"
            className="file-input"
            accept="application/json,.json"
            aria-label="选择备份文件"
            onChange={(e) => {
              if (e.target.files[0]) {
                setRestoreFile(e.target.files[0]);
                e.target.value = "";
                setDialog("restore");
              }
            }}
          />
        </Modal>
      ) : null}
      {dialog === "restore" ? (
        <Modal title="恢复备份" close={() => setDialog("backup")}>
          <p className="modal-description">
            使用「{restoreFile?.name}
            」替换已保存的评选和海报。恢复后可以撤销一次。
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => act(restore)}
          >
            恢复
            <ArrowRight />
          </button>
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

function Auth({ session, success }) {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (session.setup && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await send(session.setup ? "/api/setup" : "/api/login", { password });
      await success();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <a href="/" className="auth-back">
        <ArrowLeft size={18} />
        返回 XGN
      </a>
      <div className="auth-panel">
        <span className="small-logo">XGN</span>
        <div className="auth-rule" />
        <LockKey size={25} weight="light" />
        <h1>{session.setup ? "设置编辑密码" : "登录编辑台"}</h1>
        <p>
          {session.setup
            ? "首次使用，设置一个只有你知道的编辑密码。"
            : "输入密码后编辑。"}
        </p>
        {session.setup && !session.canSetup ? (
          <div className="error-banner">
            请在服务器本机完成首次设置，或通过 XGN_ADMIN_PASSWORD
            配置管理员密码。
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              编辑密码
              <input
                aria-label="编辑密码"
                type="password"
                minLength={session.setup ? 8 : undefined}
                maxLength="256"
                autoComplete={
                  session.setup ? "new-password" : "current-password"
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={session.setup ? "至少 8 个字符" : "请输入密码"}
              />
            </label>
            {session.setup ? (
              <label>
                再次输入密码
                <input
                  aria-label="再次输入密码"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "正在打开…" : session.setup ? "建立编辑台" : "进入编辑台"}
              <ArrowRight />
            </button>
          </form>
        )}
        <small></small>
      </div>
    </main>
  );
}
