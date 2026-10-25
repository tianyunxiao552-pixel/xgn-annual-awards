import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Desktop,
  DeviceMobile,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { Reader } from "./App.jsx";
import { posterFrame } from "../shared/poster.js";
import { isCollectionAward } from "../shared/awards.js";

const PREVIEW_DOCUMENT =
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>海报页面预览</title></head><body><div id="preview-root"></div></body></html>';
const ignoreError = () => {};

export function PosterFraming({ entry, year, updateEntry }) {
  const [device, setDevice] = useState(() =>
    matchMedia("(max-width: 800px)").matches ? "mobile" : "desktop",
  );
  const [previewDocument, setPreviewDocument] = useState(null);
  const [scale, setScale] = useState(0);
  const box = useRef(null);
  const width = device === "desktop" ? 1440 : 390;
  const height = device === "desktop" ? 900 : 844;
  const label = device === "desktop" ? "电脑" : "手机";
  const frame = posterFrame(
    isCollectionAward(year, entry.award)
      ? { ...entry, x: 50, y: 50, fit: "cover" }
      : entry,
    device,
  );
  const previewData = useMemo(
    () => ({
      years: [
        {
          ...year,
          entries: year.entries.some((item) => item.id === entry.id)
            ? year.entries.map((item) => (item.id === entry.id ? entry : item))
            : [...year.entries, entry],
        },
      ],
    }),
    [year.id, year.awards.join("|"), year.entries, entry],
  );
  const target = useMemo(
    () => ({ year: year.id, entry: entry.id }),
    [year.id, entry.id],
  );

  useEffect(() => {
    const element = box.current;
    const measure = () => setScale(element.clientWidth / width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  function change(values) {
    updateEntry({
      posterFraming: {
        ...entry.posterFraming,
        [device]: { ...frame, ...values },
      },
    });
  }

  return (
    <section className="poster-framing" aria-label="分设备海报设置">
      <div className="poster-device-tabs" role="tablist" aria-label="预览设备">
        {[
          ["desktop", "电脑", Desktop],
          ["mobile", "手机", DeviceMobile],
        ].map(([value, name, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={device === value}
            onClick={() => setDevice(value)}
          >
            <Icon size={17} />
            {name}
          </button>
        ))}
      </div>
      <div
        ref={box}
        className={`poster-preview-box is-${device}`}
        style={{ height: height * scale }}
      >
        <iframe
          title={`${label}海报页面预览`}
          tabIndex={-1}
          srcDoc={PREVIEW_DOCUMENT}
          style={{ width, height, transform: `scale(${scale})` }}
          onLoad={(event) => {
            const doc = event.currentTarget.contentDocument;
            // Use the real reader and its existing CSS inside a real device-width viewport.
            document
              .querySelectorAll('style, link[rel="stylesheet"]')
              .forEach((node) => {
                const copy = node.cloneNode(true);
                if (node.tagName === "LINK") copy.href = node.href;
                doc.head.append(copy);
              });
            const style = doc.createElement("style");
            style.textContent =
              "html,body{margin:0;overflow:hidden;pointer-events:none}*{animation:none!important;transition:none!important;scrollbar-width:none!important}";
            doc.head.append(style);
            setPreviewDocument(doc);
          }}
        />
        {previewDocument
          ? createPortal(
              <div className="xgn-app with-music" inert>
                <Reader
                  publicData={previewData}
                  framingPreview={target}
                  onError={ignoreError}
                />
                <div className="music-dock" />
              </div>,
              previewDocument.getElementById("preview-root"),
            )
          : null}
      </div>
      <div
        className="poster-frame-controls"
        role="tabpanel"
        aria-label={`${label}取景设置`}
      >
        {[
          ["x", "左右位置", "水平构图", 0, 100, 1],
          ["y", "上下位置", "垂直构图", 0, 100, 1],
          ["zoom", "缩放", "海报缩放", 0.75, 2, 0.01],
        ].map(([key, text, aria, min, max, step]) => (
          <label key={key}>
            <span>
              {text}
              <output>
                {key === "zoom"
                  ? `${Math.round(frame[key] * 100)}%`
                  : `${Math.round(frame[key])}%`}
              </output>
            </span>
            <input
              type="range"
              aria-label={`${label}${aria}`}
              min={min}
              max={max}
              step={step}
              value={frame[key]}
              onChange={(event) =>
                change({ [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <label className="poster-fit-control">
          海报显示
          <select
            aria-label={`${label}图片适配`}
            value={frame.fit}
            onChange={(event) => change({ fit: event.target.value })}
          >
            <option value="cover">铺满画面</option>
            <option value="contain">保留完整海报</option>
          </select>
        </label>
        <button
          type="button"
          className="text-button"
          disabled={!entry.posterFraming?.[device]}
          onClick={() => {
            const next = { ...entry.posterFraming };
            delete next[device];
            updateEntry({
              posterFraming: Object.keys(next).length ? next : undefined,
            });
          }}
        >
          <ArrowCounterClockwise size={15} />
          重置{label}取景
        </button>
      </div>
    </section>
  );
}
