export default function StatCard({ icon, label, value, sub, color = "#0F172A", bg }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="icon" style={{ background: bg || `${color}18`, color }}>
        {icon}
      </div>
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
