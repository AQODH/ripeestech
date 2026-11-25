export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background: "#ecf1f7",
        color: "#161b22",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <p style={{ letterSpacing: 2, fontSize: 12, fontWeight: 700, color: "#163976", margin: 0 }}>ERROR 404</p>
        <h1 style={{ fontSize: "clamp(36px,6vw,56px)", lineHeight: 1.1, letterSpacing: -1.5, margin: "14px 0" }}>
          This page has moved or never existed.
        </h1>
        <p style={{ color: "#3d4654", lineHeight: 1.7, margin: "0 0 28px" }}>
          Let&rsquo;s get you back to the RIPEES Technologies website.
        </p>
        <a
          href="/website"
          style={{
            display: "inline-block",
            background: "#1d2334",
            color: "#ffffff",
            padding: "16px 26px",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to the website
        </a>
      </div>
    </main>
  );
}
