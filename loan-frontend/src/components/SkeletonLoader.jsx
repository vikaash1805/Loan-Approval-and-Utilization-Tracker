export default function SkeletonLoader({ type = "card", count = 1 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (type === "stats") {
    return (
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        {items.map((i) => (
          <div key={i} className="skeleton-card skeleton-stat" />
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="skeleton-card skeleton-table">
        <div className="skeleton-row header" />
        {items.map((i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((i) => (
        <div key={i} className="skeleton-card skeleton-block" />
      ))}
    </div>
  );
}
