import { useState, useMemo } from "react";
import {
  Sparkles,
  TrendingDown,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  Percent,
  Sliders,
  DollarSign,
  Calendar,
} from "lucide-react";

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

export default function RepaymentSavingsSimulator({
  outstanding = 0,
  interestRate = 12,
  tenureMonths = 24,
  currentEmi = 0,
  onApplyExtraPayment,
}) {
  const [simType, setSimType] = useState("monthly"); // "monthly" | "lumpsum"
  const [extraMonthly, setExtraMonthly] = useState(2000);
  const [lumpSumAmount, setLumpSumAmount] = useState(
    Math.round(Math.min(outstanding * 0.25, 25000))
  );

  const monthlyRate = interestRate / 12 / 100;

  // Baseline remaining calculation
  const baseline = useMemo(() => {
    if (outstanding <= 0 || monthlyRate <= 0) {
      return { totalInterest: 0, monthsRemaining: 0 };
    }

    let bal = outstanding;
    let totalInt = 0;
    let m = 0;
    const emi = currentEmi > 0 ? currentEmi : (outstanding * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);

    while (bal > 1 && m < 360) {
      const intPart = bal * monthlyRate;
      const prinPart = emi - intPart;
      if (prinPart <= 0) break;
      totalInt += intPart;
      bal -= prinPart;
      m++;
    }

    return {
      totalInterest: Math.round(totalInt),
      monthsRemaining: m,
      emi: Math.round(emi),
    };
  }, [outstanding, interestRate, tenureMonths, currentEmi, monthlyRate]);

  // Accelerated calculation
  const simulation = useMemo(() => {
    if (outstanding <= 0 || monthlyRate <= 0) {
      return { totalInterest: 0, monthsRemaining: 0, interestSaved: 0, monthsSaved: 0 };
    }

    let bal = outstanding;
    if (simType === "lumpsum") {
      bal = Math.max(0, bal - lumpSumAmount);
    }

    let totalInt = 0;
    let m = 0;
    const effEmi = baseline.emi + (simType === "monthly" ? extraMonthly : 0);

    while (bal > 1 && m < 360) {
      const intPart = bal * monthlyRate;
      const prinPart = effEmi - intPart;
      if (prinPart <= 0) break;
      totalInt += intPart;
      bal -= prinPart;
      m++;
    }

    const interestSaved = Math.max(0, baseline.totalInterest - Math.round(totalInt));
    const monthsSaved = Math.max(0, baseline.monthsRemaining - m);

    return {
      totalInterest: Math.round(totalInt),
      monthsRemaining: m,
      interestSaved,
      monthsSaved,
    };
  }, [outstanding, monthlyRate, baseline, simType, extraMonthly, lumpSumAmount]);

  if (outstanding <= 0) {
    return null;
  }

  const maxSliderMonthly = Math.max(15000, Math.round(baseline.emi * 1.5));
  const maxSliderLumpSum = Math.max(50000, Math.round(outstanding * 0.9));

  return (
    <div className="savings-simulator-card">
      <div className="sim-header">
        <div className="sim-title-group">
          <div className="sim-badge">
            <Sparkles size={14} /> Smart Prepayment Simulator
          </div>
          <h3>Accelerate Loan Payoff & Save Interest</h3>
          <p>
            See in real-time how micro-prepayments drastically reduce total interest and shorten your debt timeline.
          </p>
        </div>

        {/* Strategy Switcher */}
        <div className="sim-type-tabs">
          <button
            type="button"
            className={`sim-tab ${simType === "monthly" ? "active" : ""}`}
            onClick={() => setSimType("monthly")}
          >
            Monthly Extra EMI
          </button>
          <button
            type="button"
            className={`sim-tab ${simType === "lumpsum" ? "active" : ""}`}
            onClick={() => setSimType("lumpsum")}
          >
            One-Time Lump Sum
          </button>
        </div>
      </div>

      <div className="sim-body">
        {/* Controls */}
        <div className="sim-control-pane">
          {simType === "monthly" ? (
            <div>
              <div className="sim-slider-label">
                <span>Extra Monthly Contribution</span>
                <span className="sim-value-highlight">+{fmt(extraMonthly)}/mo</span>
              </div>
              <input
                type="range"
                min={500}
                max={maxSliderMonthly}
                step={500}
                value={extraMonthly}
                onChange={(e) => setExtraMonthly(Number(e.target.value))}
                className="sim-slider"
              />
              <div className="sim-quick-chips">
                {[1000, 2500, 5000, 10000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sim-chip ${extraMonthly === v ? "active" : ""}`}
                    onClick={() => setExtraMonthly(v)}
                  >
                    +{fmt(v)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="sim-slider-label">
                <span>Lump Sum Prepayment Amount</span>
                <span className="sim-value-highlight">{fmt(lumpSumAmount)}</span>
              </div>
              <input
                type="range"
                min={5000}
                max={maxSliderLumpSum}
                step={5000}
                value={lumpSumAmount}
                onChange={(e) => setLumpSumAmount(Number(e.target.value))}
                className="sim-slider"
              />
              <div className="sim-quick-chips">
                {[
                  Math.round(outstanding * 0.1),
                  Math.round(outstanding * 0.25),
                  Math.round(outstanding * 0.5),
                ].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sim-chip ${lumpSumAmount === v ? "active" : ""}`}
                    onClick={() => setLumpSumAmount(v)}
                  >
                    {fmt(v)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Savings Metrics Display */}
        <div className="sim-metrics-grid">
          <div className="sim-metric-box highlight-emerald">
            <div className="sim-metric-icon">
              <TrendingDown size={20} />
            </div>
            <div>
              <span className="sim-metric-label">Total Interest Saved</span>
              <div className="sim-metric-value">{fmt(simulation.interestSaved)}</div>
              <span className="sim-metric-sub">Direct reduction in financing cost</span>
            </div>
          </div>

          <div className="sim-metric-box highlight-indigo">
            <div className="sim-metric-icon">
              <Clock size={20} />
            </div>
            <div>
              <span className="sim-metric-label">Tenure Shortened By</span>
              <div className="sim-metric-value">
                {simulation.monthsSaved} Month{simulation.monthsSaved === 1 ? "" : "s"}
              </div>
              <span className="sim-metric-sub">
                From {baseline.monthsRemaining} mos → {simulation.monthsRemaining} mos
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar Comparison */}
        <div className="sim-visual-comparison">
          <div className="sim-bar-label-row">
            <span>Interest Burden Comparison</span>
            <span>
              Save {baseline.totalInterest > 0 ? Math.round((simulation.interestSaved / baseline.totalInterest) * 100) : 0}% of interest
            </span>
          </div>

          <div className="sim-dual-progress">
            <div
              className="sim-bar-fill baseline"
              style={{ width: "100%" }}
              title={`Regular Interest: ${fmt(baseline.totalInterest)}`}
            >
              <span>Regular Interest: {fmt(baseline.totalInterest)}</span>
            </div>
            <div
              className="sim-bar-fill accelerated"
              style={{
                width: `${baseline.totalInterest > 0 ? Math.max(10, Math.round((simulation.totalInterest / baseline.totalInterest) * 100)) : 100}%`,
              }}
              title={`Accelerated: ${fmt(simulation.totalInterest)}`}
            >
              <span>With Prepayment: {fmt(simulation.totalInterest)}</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="sim-action-row">
          <div className="sim-action-tip">
            <ShieldCheck size={16} /> Zero prepayment penalties apply on standard reducing-balance facilities.
          </div>
          {onApplyExtraPayment && (
            <button
              type="button"
              className="btn btn-accent sim-apply-btn"
              onClick={() =>
                onApplyExtraPayment(
                  simType === "monthly" ? baseline.emi + extraMonthly : lumpSumAmount,
                  simType === "monthly" ? "emi" : "principal"
                )
              }
            >
              Apply to Payment Form <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
