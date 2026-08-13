import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VELA — The Business Operating System for African SMEs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand colors + "Double Horizon" mark construction from
// Vela_Logo_Identity_System.pdf — kept in sync with components/brand/VelaLogo.tsx.
const MIDNIGHT = "#0D1B2A";
const GOLD = "#C9A84C";

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: MIDNIGHT,
        backgroundImage: `radial-gradient(circle at 18% 20%, rgba(201,168,76,0.16), transparent 45%), radial-gradient(circle at 85% 75%, rgba(201,168,76,0.10), transparent 40%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: 16,
            background: MIDNIGHT,
            border: `2px solid ${GOLD}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 10,
            padding: "0 17px",
          }}
        >
          <div style={{ width: "100%", height: 13, background: GOLD, borderRadius: 2 }} />
          <div style={{ width: "68%", height: 13, background: GOLD, borderRadius: 2 }} />
          <div
            style={{ width: "100%", height: 5, background: GOLD, opacity: 0.4, borderRadius: 2 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: 8,
            color: "#FFFFFF",
          }}
        >
          VELA
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 40,
          fontSize: 32,
          color: GOLD,
          letterSpacing: 1,
        }}
      >
        The Business Operating System for African SMEs
      </div>
    </div>,
    { ...size },
  );
}
