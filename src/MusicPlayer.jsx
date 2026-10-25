import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SlidersHorizontal,
  MusicNotes,
  SpeakerHigh,
  SpeakerSlash,
  SkipForward,
} from "@phosphor-icons/react";

import { musicTracks, pickInitialTrackIndex } from "./lib.js";

function rememberedVolume() {
  try {
    const value = localStorage.getItem("xgn-volume-v1");
    if (value !== null && Number.isFinite(Number(value)))
      return Math.max(0, Math.min(1, Number(value)));
  } catch {
    /* Private browsing can deny local storage. */
  }
  return 0.35;
}

function selectInitialTrack(count) {
  let previous = null;
  try {
    const saved = localStorage.getItem("xgn-initial-track-v1");
    if (saved !== null && Number.isInteger(Number(saved))) {
      previous = Number(saved);
    }
  } catch {
    /* Private browsing can deny local storage. */
  }
  const next = pickInitialTrackIndex(count, previous);
  try {
    localStorage.setItem("xgn-initial-track-v1", String(next));
  } catch {
    /* Optional preference only. */
  }
  return next;
}

export function MusicPlayer({ music }) {
  const audio = useRef(null);
  const wantsPlay = useRef(true);
  const playingRef = useRef(false);
  const tracks = musicTracks(music);
  const [trackIndex, setTrackIndex] = useState(() =>
    selectInitialTrack(tracks.length),
  );
  const safeIndex = trackIndex < tracks.length ? trackIndex : 0;
  const track = tracks[safeIndex] || tracks[0];
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [volume, setVolume] = useState(rememberedVolume);
  useEffect(() => {
    audio.current.volume = volume;
    try {
      localStorage.setItem("xgn-volume-v1", String(volume));
    } catch {
      /* Optional preference only. */
    }
  }, [volume]);
  useEffect(() => {
    const element = audio.current;
    return () => element.pause();
  }, []);
  useEffect(() => {
    const unlock = (event) => {
      if (event?.target?.closest?.(".music-play")) return;
      const element = audio.current;
      if (!element || !wantsPlay.current || playingRef.current) return;
      setError("");
      element.play().catch((e) => {
        if (e.name !== "NotAllowedError" && e.name !== "AbortError") {
          setError("音乐暂时无法播放，点此重试");
        }
      });
    };
    const events = ["click", "pointerup", "touchend", "keydown"];
    events.forEach((type) =>
      window.addEventListener(type, unlock, { capture: true, passive: true }),
    );
    window.addEventListener("xgn:navigate", unlock);
    return () => {
      events.forEach((type) =>
        window.removeEventListener(type, unlock, { capture: true }),
      );
      window.removeEventListener("xgn:navigate", unlock);
    };
  }, []);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    setError("");
    playingRef.current = false;
    setPlaying(false);
    if (!wantsPlay.current) return;
    element.volume = volume;
    element.play().catch((e) => {
      if (e.name !== "NotAllowedError" && e.name !== "AbortError") {
        setError("音乐暂时无法播放，请重试或切换下一首");
      }
    });
  }, [track.src]);
  async function toggle() {
    const element = audio.current;
    if (playingRef.current) {
      wantsPlay.current = false;
      playingRef.current = false;
      element.pause();
      setPlaying(false);
      setLoading(false);
      return;
    }
    wantsPlay.current = true;
    setLoading(true);
    setError("");
    try {
      if (element.error) element.load();
      await element.play();
    } catch (e) {
      if (e.name !== "AbortError") setError("音乐暂时无法播放，点此重试");
    } finally {
      setLoading(false);
    }
  }
  function nextTrack() {
    wantsPlay.current = true;
    setTrackIndex((i) => ((i < tracks.length ? i : 0) + 1) % tracks.length);
  }
  return (
    <aside
      className={`music-dock ${playing ? "is-playing" : ""} ${expanded ? "is-expanded" : ""} ${error ? "has-error" : ""}`}
      aria-label="背景音乐"
    >
      <audio
        ref={audio}
        src={track.src}
        autoPlay
        loop={tracks.length === 1}
        onEnded={() =>
          setTrackIndex(
            (i) => ((i < tracks.length ? i : 0) + 1) % tracks.length,
          )
        }
        preload="auto"
        onPlaying={() => {
          playingRef.current = true;
          setPlaying(true);
          setLoading(false);
        }}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
          setLoading(false);
        }}
        onWaiting={() => {
          if (playingRef.current) setLoading(true);
        }}
        onError={() => {
          playingRef.current = false;
          setError("音乐暂时无法播放，点此重试");
          setPlaying(false);
          setLoading(false);
        }}
      />
      {expanded ? (
        <div className="music-volume">
          <label htmlFor="music-volume">
            <SpeakerHigh size={15} />
            音量 <span>{Math.round(volume * 100)}%</span>
          </label>
          <input
            id="music-volume"
            aria-label="音乐音量"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <button
            className="text-button"
            onClick={() => setVolume(volume > 0 ? 0 : 0.35)}
          >
            {volume > 0 ? (
              <SpeakerSlash size={14} />
            ) : (
              <SpeakerHigh size={14} />
            )}
            {volume > 0 ? "静音" : "恢复声音"}
          </button>
        </div>
      ) : null}
      <div className="music-compact">
        <button
          className="music-play"
          onClick={toggle}
          aria-label={
            loading
              ? "停止加载音乐"
              : playing
                ? "暂停音乐"
                : error
                  ? "重试播放音乐"
                  : "播放音乐"
          }
          aria-pressed={playing}
        >
          {playing || loading ? (
            <Pause size={18} weight="fill" />
          ) : (
            <Play size={18} weight="fill" />
          )}
        </button>
        <div className="music-label">
          <small>
            <MusicNotes size={10} />
            {loading
              ? "正在加载"
              : playing
                ? volume === 0
                  ? "静音中"
                  : "播放中"
                : "背景音乐"}
          </small>
          <span title={track.title}>{error || track.title || "背景音乐"}</span>
        </div>
        {tracks.length > 1 ? (
          <button
            className="icon-button music-next"
            aria-label="下一首"
            onClick={nextTrack}
          >
            <SkipForward size={16} />
          </button>
        ) : null}
        <span className="music-wave" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <button
          className="icon-button music-options"
          onClick={() => setExpanded((v) => !v)}
          aria-label="音乐音量设置"
          aria-expanded={expanded}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      {error ? (
        <span className="sr-only" role="status">
          {error}
        </span>
      ) : null}
    </aside>
  );
}
