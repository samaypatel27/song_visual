"use client";

import { useEffect, useRef, useState } from "react";

export interface Track {
  trackNumber: number;
  trackName: string;
  durationMs: number;
}

interface TrackListPanelProps {
  albumName: string;
  albumCoverUrl: string;
  tracks: Track[];
  visible: boolean;
  dataReady: boolean;  // true once data has been received (even if 0 tracks)
  onClose?: () => void;
}

interface PaletteColors {
  primary: string;   // "R,G,B"
  secondary: string; // "R,G,B"
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/** Desaturate by 40%, cap lightness [20%, 45%] → returns "R,G,B" string */
function desaturateCap(r: number, g: number, b: number): string {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.max(0, s - 40);
  l = Math.min(45, Math.max(20, l));
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return `${nr},${ng},${nb}`;
}

const DEFAULT_PALETTE: PaletteColors = { primary: "120,120,200", secondary: "100,100,180" };

async function extractPalette(url: string): Promise<PaletteColors> {
  if (!url) return DEFAULT_PALETTE;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);

        let r1 = 0, g1 = 0, b1 = 0, c1 = 0; // top-left quadrant
        let r2 = 0, g2 = 0, b2 = 0, c2 = 0; // bottom-right quadrant

        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (x < 16 && y < 16) { r1 += r; g1 += g; b1 += b; c1++; }
            else if (x >= 16 && y >= 16) { r2 += r; g2 += g; b2 += b; c2++; }
          }
        }

        resolve({
          primary:   desaturateCap(r1 / c1, g1 / c1, b1 / c1),
          secondary: desaturateCap(r2 / c2, g2 / c2, b2 / c2),
        });
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => resolve(DEFAULT_PALETTE);
    img.src = url;
  });
}

export function TrackListPanel({ albumName, albumCoverUrl, tracks, visible, dataReady }: TrackListPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [palette, setPalette] = useState<PaletteColors>(DEFAULT_PALETTE);

  // Two-phase mount for CSS transition
  useEffect(() => {
    if (visible) {
      setMounted(true);
      const t = setTimeout(() => setEntered(true), 20);
      return () => clearTimeout(t);
    } else {
      setEntered(false);
      const t = setTimeout(() => setMounted(false), 360);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Extract palette whenever cover URL changes
  useEffect(() => {
    if (!albumCoverUrl) return;
    extractPalette(albumCoverUrl).then(setPalette);
  }, [albumCoverUrl]);

  if (!mounted) return null;

  const { primary: p1, secondary: p2 } = palette;

  // Dynamic styles driven by extracted palette
  const cardStyle: React.CSSProperties = {
    background: `
      radial-gradient(ellipse at top left, rgba(${p1},0.12) 0%, transparent 60%),
      radial-gradient(ellipse at bottom right, rgba(${p2},0.09) 0%, transparent 55%),
      rgba(255,255,255,0.05)
    `,
    transition: "background 600ms ease",
  };

  const timelineStyle: React.CSSProperties = {
    background: `linear-gradient(to bottom, rgba(${p1},0.15), rgba(${p1},0.9) 50%, rgba(${p1},0.15))`,
  };

  return (
    <>
      <style>{`
        .tlp-outer {
          position: fixed;
          top: 15vh;
          bottom: 15vh;
          right: 3vw;
          width: 32vw;
          z-index: 10;
          display: flex;
          flex-direction: column;
          transform: translateX(110%);
          transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
        }
        .tlp-outer.entered { transform: translateX(0); }
        .tlp-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(24px) saturate(1.4);
          -webkit-backdrop-filter: blur(24px) saturate(1.4);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          box-shadow: 0 8px 48px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .tlp-header {
          padding: 22px 20px 14px 32px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .tlp-album-name {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.82em; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin: 0; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .tlp-track-count {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.68em; font-weight: 300;
          color: rgba(255,255,255,0.22);
          margin-top: 3px; letter-spacing: 0.04em;
        }
        .tlp-body {
          flex: 1; position: relative;
          display: flex; overflow: hidden; min-height: 0;
        }
        .tlp-timeline {
          width: 2px; flex-shrink: 0;
          margin-left: 20px; border-radius: 1px;
          transition: background 600ms ease;
        }
        .tlp-list-wrap {
          flex: 1; overflow-y: auto;
          scrollbar-width: none; -ms-overflow-style: none;
          padding: 8px 20px 8px 0;
          mask-image: linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .tlp-list-wrap::-webkit-scrollbar { display: none; }
        .tlp-row {
          display: flex; align-items: center;
          height: 44px; position: relative; cursor: default;
        }
        .tlp-dash {
          width: 12px; height: 1px;
          flex-shrink: 0; transition: background 600ms ease;
        }
        .tlp-row::before {
          content: '';
          position: absolute; left: 12px;
          top: 50%; transform: translateY(-50%);
          width: 2px; height: 0;
          border-radius: 1px;
          transition: height 120ms ease-out, background-color 600ms ease;
        }
        .tlp-row:hover::before { height: 44px; }
        .tlp-num {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.7em; font-weight: 400;
          color: white; opacity: 0.3;
          min-width: 24px; text-align: right;
          padding-right: 10px; flex-shrink: 0;
        }
        .tlp-title {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.92em; font-weight: 200;
          letter-spacing: 0.08em; color: rgba(255,255,255,0.75);
          flex: 1; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
          transition: opacity 150ms ease-out, transform 150ms ease-out;
        }
        .tlp-row:hover .tlp-title { opacity: 1; transform: translateX(5px); }
        .tlp-dur {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.75em; font-weight: 300;
          color: white; opacity: 0.3;
          flex-shrink: 0; padding-left: 10px;
          transition: opacity 150ms ease-out;
        }
        .tlp-row:hover .tlp-dur { opacity: 0.55; }
        .tlp-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.82em; font-weight: 300;
          letter-spacing: 0.06em; color: rgba(255,255,255,0.25);
        }
      `}</style>

      {/* Per-album dynamic styles: accent color & dash color driven by palette */}
      <style>{`
        .tlp-outer .tlp-row::before { background-color: rgb(${p1}); }
        .tlp-outer .tlp-dash { background: rgba(${p1},0.5); }
      `}</style>

      <div className={`tlp-outer${entered ? " entered" : ""}`}>
        <div className="tlp-card" style={cardStyle}>
          <div className="tlp-header">
            <p className="tlp-album-name">{albumName}</p>
            {tracks.length > 0 && (
              <p className="tlp-track-count">{tracks.length} tracks</p>
            )}
          </div>

          <div className="tlp-body">
            <div className="tlp-timeline" style={timelineStyle} />

            <div className="tlp-list-wrap">
              {!dataReady ? (
                <div className="tlp-loading">Loading tracklist…</div>
              ) : tracks.length === 0 ? (
                <div className="tlp-loading">No tracks in this playlist</div>
              ) : (
                tracks.map((track) => (
                  <div className="tlp-row" key={track.trackNumber}>
                    <div className="tlp-dash" />
                    <span className="tlp-num">{track.trackNumber}</span>
                    <span className="tlp-title">{track.trackName}</span>
                    <span className="tlp-dur">{formatDuration(track.durationMs)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
