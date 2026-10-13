import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import {
  Search,
  Moon,
  Sun,
  Bell,
  Menu,
  X,
  CreditCard,
  FileText,
  TrendingUp,
  LayoutDashboard,
  CheckSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  LogOut,
  Trash2,
  CheckCheck,
  BellOff,
  AlertCircle,
} from "lucide-react";

export default function Header({ onToggleSidebar, isSidebarOpen }) {
  const { user, isOfficer, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const {
    notifications,
    filteredNotifications,
    unreadCount,
    filter,
    setFilter,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return "Recently";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  const renderNotifIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} className="notif-type-icon success" />;
      case "warning":
        return <Clock size={16} className="notif-type-icon warning" />;
      case "error":
        return <AlertCircle size={16} className="notif-type-icon error" />;
      default:
        return <Sparkles size={16} className="notif-type-icon info" />;
    }
  };


  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchItems = [
    {
      label: "Dashboard Overview",
      category: "Navigation",
      to: "/",
      icon: LayoutDashboard,
      desc: "Portfolio metrics, utilization and active loans summary",
    },
    {
      label: "Loan Repayment & EMI",
      category: "Fintech Service",
      to: "/repay",
      icon: CreditCard,
      desc: "Pay EMI, track balance, or download receipts",
    },
    {
      label: "Apply for Loan",
      category: "Application",
      to: "/apply",
      icon: FileText,
      desc: "Submit a new loan request with instant AI verification",
    },
    {
      label: isOfficer ? "Loan Approvals Queue" : "My Applications",
      category: "Workflow",
      to: "/approvals",
      icon: CheckSquare,
      desc: isOfficer ? "Review, approve, or reject loan applications" : "Track status of submitted loan applications",
    },
    {
      label: "Fund Utilization Tracker",
      category: "Disbursement",
      to: "/utilization",
      icon: TrendingUp,
      desc: "Track milestone disbursements and upload proof invoices",
    },
  ];

  const filteredItems = searchItems.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSearchItem = (to) => {
    navigate(to);
    setSearchOpen(false);
    setSearchQuery("");
  };


  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Portfolio Dashboard";
      case "/apply":
        return "Apply for Loan";
      case "/approvals":
        return isOfficer ? "Loan Approvals & Underwriting" : "My Loan Applications";
      case "/utilization":
        return "Fund Utilization & Proof Tracker";
      case "/repay":
        return "Loan Repayment & Prepayment";
      default:
        return "FundMatrix Loan Portal";
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        {/* Mobile menu trigger */}
        <button
          className="topbar-mobile-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          title="Toggle Navigation"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="topbar-title-wrapper">
          <span className="topbar-crumb">Portal</span>
          <span className="topbar-crumb-sep">/</span>
          <h2 className="topbar-title">{getPageTitle()}</h2>
        </div>
      </div>

      <div className="topbar-center">
        {/* Quick Search trigger button */}
        <button
          className="topbar-search-btn"
          onClick={() => setSearchOpen(true)}
          title="Quick Search (Ctrl + K)"
        >
          <Search size={16} className="topbar-search-icon" />
          <span className="topbar-search-text">Search loans, actions, guides...</span>
          <kbd className="topbar-search-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div className="topbar-right">
        {/* Theme Toggle Button */}
        <button
          className="topbar-icon-btn"
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun size={18} className="theme-icon sun" /> : <Moon size={18} className="theme-icon moon" />}
        </button>

        {/* Notifications Center */}
        <div className="topbar-notif-container" ref={notifRef}>
          <button
            className={`topbar-icon-btn ${unreadCount > 0 ? "has-badge" : ""}`}
            onClick={() => setNotifOpen(!notifOpen)}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="notif-unread-pill">{unreadCount} new</span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {notifications.length} total alert{notifications.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {unreadCount > 0 && (
                    <button
                      className="notif-mark-btn"
                      onClick={markAllAsRead}
                      title="Mark all notifications as read"
                    >
                      <CheckCheck size={13} style={{ marginRight: 3 }} /> Mark read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className="notif-clear-btn"
                      onClick={clearAllNotifications}
                      title="Clear all notifications"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="notif-filter-tabs">
                <button
                  className={`notif-tab ${filter === "all" ? "active" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All ({notifications.length})
                </button>
                <button
                  className={`notif-tab ${filter === "unread" ? "active" : ""}`}
                  onClick={() => setFilter("unread")}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <div className="notif-list">
                {filteredNotifications.length === 0 ? (
                  <div className="notif-empty-state">
                    <BellOff size={26} className="notif-empty-icon" />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                      {filter === "unread" ? "No unread alerts" : "All caught up!"}
                    </p>
                    <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
                      {filter === "unread" ? "You have read all notifications." : "No active alerts in your inbox."}
                    </span>
                  </div>
                ) : (
                  filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? "read" : "unread"}`}
                      onClick={() => {
                        if (!n.read) markAsRead(n.id);
                        setNotifOpen(false);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <div className="notif-icon-col">
                        {renderNotifIcon(n.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="notif-title-row">
                          <span className="notif-item-title">{n.title}</span>
                          {!n.read && <span className="notif-unread-dot" title="Unread" />}
                        </div>
                        <div className="notif-item-desc">{n.desc}</div>
                        <div className="notif-item-time">{formatRelativeTime(n.createdAt)}</div>
                      </div>
                      <button
                        className="notif-item-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        title="Dismiss notification"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="notif-footer">
                <button
                  className="notif-footer-action"
                  onClick={() => {
                    setNotifOpen(false);
                    navigate(isOfficer ? "/approvals" : "/repay");
                  }}
                >
                  {isOfficer ? "View Loan Approvals Queue" : "View Repayment Schedule"} <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        {user && (
          <div className="topbar-user-pill">
            <div
              className="topbar-avatar"
              style={{
                background: isOfficer
                  ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
              }}
            >
              {user.name ? user.name.slice(0, 1).toUpperCase() : "U"}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{user.name || "User"}</span>
              <span className="topbar-user-role">
                {isOfficer ? "Officer" : "Customer"}
              </span>
            </div>
          </div>
        )}

        {/* Topbar Sign Out Button */}
        {user && (
          <button
            className="topbar-signout-btn"
            onClick={handleLogout}
            title="Sign out of account"
            aria-label="Sign Out"
          >
            <LogOut size={15} />
            <span className="topbar-signout-text">Sign Out</span>
          </button>
        )}
      </div>

      {/* Global Command Palette Modal */}
      {searchOpen && (
        <div className="cmd-overlay" onClick={() => setSearchOpen(false)}>
          <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-search-bar">
              <Search size={20} className="cmd-icon" />
              <input
                type="text"
                autoFocus
                placeholder="Type a page, loan ID, or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cmd-input"
              />
              <button className="cmd-close" onClick={() => setSearchOpen(false)}>
                <kbd>ESC</kbd>
              </button>
            </div>

            <div className="cmd-results">
              {filteredItems.length === 0 ? (
                <div className="cmd-empty">
                  <p>No results found for "{searchQuery}"</p>
                  <span>Try searching "Repay", "Loan", "Dashboard", or "Apply"</span>
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="cmd-result-item"
                      onClick={() => handleSelectSearchItem(item.to)}
                    >
                      <div className="cmd-item-icon">
                        <Icon size={18} />
                      </div>
                      <div className="cmd-item-content">
                        <div className="cmd-item-title-row">
                          <span className="cmd-item-title">{item.label}</span>
                          <span className="cmd-item-badge">{item.category}</span>
                        </div>
                        <span className="cmd-item-desc">{item.desc}</span>
                      </div>
                      <ArrowRight size={14} className="cmd-item-arrow" />
                    </div>
                  );
                })
              )}
            </div>

            <div className="cmd-footer">
              <div className="cmd-shortcuts">
                <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
                <span><kbd>↵</kbd> to select</span>
                <span><kbd>ESC</kbd> to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
