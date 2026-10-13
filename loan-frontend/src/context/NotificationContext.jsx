import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/loanApi";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isOfficer } = useAuth();

  const userKey = useMemo(() => {
    if (user?.email) return user.email.toLowerCase().trim();
    if (isOfficer) return "loan_officer_default";
    return "guest_user";
  }, [user?.email, isOfficer]);

  const storageKeyNotifs = `fm_notifs_${userKey}`;
  const storageKeyReadIds = `fm_read_ids_${userKey}`;
  const storageKeyDeletedIds = `fm_deleted_ids_${userKey}`;

  // Helper to read persistent set from localStorage
  const getStoredSet = (key) => {
    try {
      const data = localStorage.getItem(key);
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  };

  const saveStoredSet = (key, set) => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (_) {}
  };

  // State
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeyNotifs);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const readSet = getStoredSet(storageKeyReadIds);
      const deletedSet = getStoredSet(storageKeyDeletedIds);
      return parsed
        .filter((n) => !deletedSet.has(n.id || n._id))
        .map((n) => ({
          ...n,
          read: readSet.has(n.id || n._id) ? true : !!n.read,
        }));
    } catch {
      return [];
    }
  });

  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const [loading, setLoading] = useState(false);

  // Derive unread count strictly from state
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Sync to localStorage whenever notifications change
  const persistNotifications = useCallback(
    (notifList) => {
      try {
        localStorage.setItem(storageKeyNotifs, JSON.stringify(notifList));
      } catch (_) {}
    },
    [storageKeyNotifs]
  );

  // Generate seed or real loan notifications
  const generateDynamicLoanNotifs = useCallback(
    (apps, readSet, deletedSet) => {
      const list = [];
      const now = new Date();

      if (isOfficer) {
        const pendingApps = apps.filter((a) => a.status === "Pending");
        if (pendingApps.length > 0) {
          const id = `officer_pending_batch`;
          if (!deletedSet.has(id)) {
            list.push({
              id,
              title: "Applications Awaiting Review",
              desc: `${pendingApps.length} loan application${
                pendingApps.length > 1 ? "s" : ""
              } pending underwriting approval.`,
              type: "warning",
              read: readSet.has(id),
              link: "/approvals",
              createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
            });
          }
        }
      } else {
        // Customer notifications
        apps.forEach((app, idx) => {
          const appOid = app._id || `loan_${idx}`;
          const shortId = typeof appOid === "string" ? appOid.slice(-6).toUpperCase() : `LN-${idx + 101}`;
          const amtStr = app.amount_requested
            ? `₹${Number(app.amount_requested).toLocaleString("en-IN")}`
            : "₹1,00,000";

          if (app.status === "Approved") {
            const id = `loan_app_approved_${appOid}`;
            if (!deletedSet.has(id)) {
              list.push({
                id,
                title: "Loan Approved! 🎉",
                desc: `Your ${app.loan_type || "Loan"} application #${shortId} for ${amtStr} has been approved. Ready for disbursement.`,
                type: "success",
                read: readSet.has(id),
                link: "/approvals",
                createdAt: app.updated_at || app.applied_at || now.toISOString(),
              });
            }
          } else if (app.status === "Disbursed") {
            const id = `loan_app_disbursed_${appOid}`;
            if (!deletedSet.has(id)) {
              list.push({
                id,
                title: "Funds Disbursed to Account 💸",
                desc: `${amtStr} has been disbursed for Loan #${shortId}. Ready for utilization and drawdowns.`,
                type: "success",
                read: readSet.has(id),
                link: "/utilization",
                createdAt: app.disbursed_at || app.updated_at || now.toISOString(),
              });
            }

            // Scheduled EMI notification for disbursed loan
            const emiId = `loan_app_emi_${appOid}`;
            if (!deletedSet.has(emiId)) {
              const emiAmt = app.emi
                ? `₹${Number(app.emi).toLocaleString("en-IN")}`
                : "₹12,450";
              list.push({
                id: emiId,
                title: "Upcoming EMI Reminder",
                desc: `Monthly installment of ${emiAmt} is scheduled for active Loan #${shortId}.`,
                type: "warning",
                read: readSet.has(emiId),
                link: "/repay",
                createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
              });
            }
          } else if (app.status === "Pending") {
            const id = `loan_app_pending_${appOid}`;
            if (!deletedSet.has(id)) {
              list.push({
                id,
                title: "Application Under Review",
                desc: `Your loan application #${shortId} for ${amtStr} is currently in underwriting queue.`,
                type: "info",
                read: readSet.has(id),
                link: "/approvals",
                createdAt: app.applied_at || now.toISOString(),
              });
            }
          } else if (app.status === "Rejected") {
            const id = `loan_app_rejected_${appOid}`;
            if (!deletedSet.has(id)) {
              list.push({
                id,
                title: "Application Update",
                desc: `Application #${shortId} was rejected. Note: ${
                  app.approval_notes || "Does not meet policy guidelines."
                }`,
                type: "error",
                read: readSet.has(id),
                link: "/approvals",
                createdAt: app.updated_at || now.toISOString(),
              });
            }
          }
        });

        // Default onboarding notifications if zero or few loans
        if (apps.length === 0) {
          const welcomeId = `welcome_${userKey}`;
          if (!deletedSet.has(welcomeId)) {
            list.push({
              id: welcomeId,
              title: "Welcome to FundMatrix",
              desc: "Your digital loan portal is ready. Apply for fast, paperless personal and business loans.",
              type: "info",
              read: readSet.has(welcomeId),
              link: "/apply",
              createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            });
          }

          const kycId = `kyc_verified_${userKey}`;
          if (!deletedSet.has(kycId)) {
            list.push({
              id: kycId,
              title: "KYC & Identity Active",
              desc: "Digital identity validation completed. You are eligible to apply for instant credit lines.",
              type: "success",
              read: readSet.has(kycId),
              link: "/apply",
              createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }

      return list;
    },
    [isOfficer, userKey]
  );

  // Master fetch & synchronization routine
  const fetchAndSyncNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const readSet = getStoredSet(storageKeyReadIds);
      const deletedSet = getStoredSet(storageKeyDeletedIds);

      // 1. Fetch backend notifications if available
      let backendNotifs = [];
      try {
        const res = await api.getNotifications({
          email: user.email,
          role: isOfficer ? "officer" : "user",
        });
        if (res?.success && Array.isArray(res.notifications)) {
          backendNotifs = res.notifications.map((n) => {
            const notifId = n._id || n.id;
            return {
              id: notifId,
              title: n.title,
              desc: n.desc,
              type: n.type || "info",
              link: n.link || "/",
              read: readSet.has(notifId) ? true : !!n.read,
              createdAt: n.created_at || new Date().toISOString(),
            };
          });
        }
      } catch (_) {
        // Backend optional or offline fallback
      }

      // 2. Fetch user's actual applications to guarantee real loan status alerts
      let userApps = [];
      try {
        const appParams = isOfficer ? {} : { email: user.email };
        const appRes = await api.getApplications(appParams);
        if (appRes?.success && Array.isArray(appRes.applications)) {
          userApps = appRes.applications;
        }
      } catch (_) {}

      // 3. Generate notifications based on real loan events
      const dynamicLoanNotifs = generateDynamicLoanNotifs(userApps, readSet, deletedSet);

      // 4. Merge notifications, removing duplicates by id and respecting deletedSet
      const notifMap = new Map();

      // First add dynamic loan notifs
      dynamicLoanNotifs.forEach((n) => {
        if (!deletedSet.has(n.id)) {
          notifMap.set(n.id, {
            ...n,
            read: readSet.has(n.id) ? true : !!n.read,
          });
        }
      });

      // Overlay backend notifs
      backendNotifs.forEach((n) => {
        if (!deletedSet.has(n.id)) {
          notifMap.set(n.id, {
            ...n,
            read: readSet.has(n.id) ? true : !!n.read,
          });
        }
      });

      // Overlay any local custom added notifications
      try {
        const localSaved = JSON.parse(localStorage.getItem(storageKeyNotifs) || "[]");
        localSaved.forEach((n) => {
          const nId = n.id || n._id;
          if (!deletedSet.has(nId) && !notifMap.has(nId)) {
            notifMap.set(nId, {
              ...n,
              id: nId,
              read: readSet.has(nId) ? true : !!n.read,
            });
          }
        });
      } catch (_) {}

      // Sort by newest first
      const merged = Array.from(notifMap.values()).sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return tB - tA;
      });

      setNotifications(merged);
      persistNotifications(merged);
    } catch (err) {
      console.error("[NotificationContext] Error syncing:", err);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    isOfficer,
    storageKeyReadIds,
    storageKeyDeletedIds,
    storageKeyNotifs,
    generateDynamicLoanNotifs,
    persistNotifications,
  ]);

  // Initial load on user or role change
  useEffect(() => {
    // Read local cache immediately to avoid any flash of unread/empty
    const readSet = getStoredSet(storageKeyReadIds);
    const deletedSet = getStoredSet(storageKeyDeletedIds);
    try {
      const saved = localStorage.getItem(storageKeyNotifs);
      if (saved) {
        const parsed = JSON.parse(saved);
        const valid = parsed
          .filter((n) => !deletedSet.has(n.id || n._id))
          .map((n) => ({
            ...n,
            read: readSet.has(n.id || n._id) ? true : !!n.read,
          }));
        setNotifications(valid);
      }
    } catch (_) {}

    fetchAndSyncNotifications();
  }, [userKey, fetchAndSyncNotifications, storageKeyReadIds, storageKeyDeletedIds, storageKeyNotifs]);

  // Mark single notification as read - GUARANTEED PERSISTENCE
  const markAsRead = useCallback(
    async (id) => {
      if (!id) return;
      const readSet = getStoredSet(storageKeyReadIds);
      readSet.add(id);
      saveStoredSet(storageKeyReadIds, readSet);

      setNotifications((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, read: true } : item
        );
        persistNotifications(updated);
        return updated;
      });

      // Notify backend if online
      try {
        await api.markNotificationRead(id);
      } catch (_) {}
    },
    [storageKeyReadIds, persistNotifications]
  );

  // Mark all notifications as read - GUARANTEED PERSISTENCE
  const markAllAsRead = useCallback(async () => {
    const readSet = getStoredSet(storageKeyReadIds);
    notifications.forEach((n) => {
      if (n.id) readSet.add(n.id);
    });
    saveStoredSet(storageKeyReadIds, readSet);

    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      persistNotifications(updated);
      return updated;
    });

    // Notify backend if online
    try {
      await api.markAllNotificationsRead({
        email: user?.email,
        role: isOfficer ? "officer" : "user",
      });
    } catch (_) {}
  }, [notifications, storageKeyReadIds, persistNotifications, user?.email, isOfficer]);

  // Delete / Dismiss a single notification
  const deleteNotification = useCallback(
    async (id) => {
      if (!id) return;
      const deletedSet = getStoredSet(storageKeyDeletedIds);
      deletedSet.add(id);
      saveStoredSet(storageKeyDeletedIds, deletedSet);

      setNotifications((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistNotifications(updated);
        return updated;
      });

      try {
        await api.deleteNotification(id);
      } catch (_) {}
    },
    [storageKeyDeletedIds, persistNotifications]
  );

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    const deletedSet = getStoredSet(storageKeyDeletedIds);
    notifications.forEach((n) => {
      if (n.id) deletedSet.add(n.id);
    });
    saveStoredSet(storageKeyDeletedIds, deletedSet);

    setNotifications([]);
    persistNotifications([]);

    try {
      await api.clearAllNotifications({
        email: user?.email,
        role: isOfficer ? "officer" : "user",
      });
    } catch (_) {}
  }, [notifications, storageKeyDeletedIds, persistNotifications, user?.email, isOfficer]);

  // Programmatically add a new notification from any UI action
  const addNotification = useCallback(
    async ({ title, desc, type = "info", link = "/", metadata = {} }) => {
      const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notifItem = {
        id: newId,
        title,
        desc,
        type,
        link,
        read: false,
        createdAt: new Date().toISOString(),
        metadata,
      };

      setNotifications((prev) => {
        const updated = [notifItem, ...prev];
        persistNotifications(updated);
        return updated;
      });

      try {
        await api.postNotification({
          email: user?.email || "",
          role: isOfficer ? "officer" : "user",
          title,
          desc,
          type,
          link,
          metadata,
        });
      } catch (_) {}
    },
    [user?.email, isOfficer, persistNotifications]
  );

  // Filtered list based on active tab
  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        filteredNotifications,
        unreadCount,
        filter,
        setFilter,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        addNotification,
        refreshNotifications: fetchAndSyncNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
