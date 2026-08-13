"use client";

import { useState } from "react";
import NotificationsList from "@/components/notifications-list";
import NotificationComposer from "@/components/notification-composer";

export default function AdminNotificationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <NotificationComposer onSent={() => setRefreshKey((k) => k + 1)} />
      <div key={refreshKey}>
        <NotificationsList />
      </div>
    </div>
  );
}
