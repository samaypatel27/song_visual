"use client";

import type { MutableRefObject } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// D-PAD NAVIGATION OVERLAY
// Fixed HTML element — bottom-right corner — z-index 10 (above canvas)
// Sends direction signals via pressedDirection ref to VinylScene's useFrame
// ─────────────────────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right" | "reset";

interface DPadControlsProps {
    pressedDirection: MutableRefObject<Direction | null>;
}

const baseBtn: React.CSSProperties = {
    width: "48px",
    height: "48px",
    background: "radial-gradient(circle at 35% 35%, #64d8ff, #1a9fd4)",
    border: "1px solid rgba(255,255,255,0.3)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "bold",
    userSelect: "none",
    WebkitUserSelect: "none",
    transition: "all 0.08s ease",
    touchAction: "none",
};

const shapeFor: Record<Direction, string> = {
    up: "8px 8px 50% 50%",
    down: "50% 50% 8px 8px",
    left: "8px 50% 50% 8px",
    right: "50% 8px 8px 50%",
    reset: "50%",
};

const iconFor: Record<Direction, string> = {
    up: "▲",
    down: "▼",
    left: "◄",
    right: "►",
    reset: "●",
};

const gridPos: Record<Direction, React.CSSProperties> = {
    up: { gridColumn: 2, gridRow: 1 },
    left: { gridColumn: 1, gridRow: 2 },
    reset: { gridColumn: 2, gridRow: 2 },
    right: { gridColumn: 3, gridRow: 2 },
    down: { gridColumn: 2, gridRow: 3 },
};

export function DPadControls({ pressedDirection }: DPadControlsProps) {
    const press = (dir: Direction) => () => { pressedDirection.current = dir; };
    const release = () => { pressedDirection.current = null; };

    return (
        <div
            style={{
                position: "fixed",
                bottom: "32px",
                right: "32px",
                zIndex: 10,
                display: "grid",
                gridTemplateColumns: "repeat(3, 48px)",
                gridTemplateRows: "repeat(3, 48px)",
                gap: "4px",
            }}
        >
            {(["up", "left", "reset", "right", "down"] as Direction[]).map((dir) => (
                <button
                    key={dir}
                    style={{
                        ...baseBtn,
                        ...gridPos[dir],
                        borderRadius: shapeFor[dir],
                    }}
                    onPointerDown={press(dir)}
                    onPointerUp={release}
                    onPointerLeave={release}
                    // Active press feel via CSS pseudo-class not easily done inline — use onPointerDown opacity
                    onMouseDown={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
                    }}
                    onMouseUp={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = baseBtn.boxShadow as string;
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = baseBtn.boxShadow as string;
                    }}
                >
                    {iconFor[dir]}
                </button>
            ))}
        </div>
    );
}
