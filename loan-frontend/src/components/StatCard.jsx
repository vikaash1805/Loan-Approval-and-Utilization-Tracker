import React from "react";

export default function StatCard({
  icon,
  label,
  value,
  sub,
  color = "#0F172A",
  bg,
  trend,
  trendPositive = true,
}) {
  return (
    <div className="stat-card-modern" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          className="icon-box"
          style={{
            background: bg || `${color}14`,
            color: color,
            border: `1px solid ${color}25`,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 12,
              background: trendPositive ? "#ECFDF5" : "#FEF2F2",
              color: trendPositive ? "#059669" : "#DC2626",
              border: `1px solid ${trendPositive ? "#A7F3D0" : "#FECACA"}`,
            }}
          >
            {trend}
          </span>
        )}
      </div>

      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color }}>
          {value}
        </div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
