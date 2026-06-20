"use client";

import { useEffect, useState } from "react";
import { crmApi } from "@/lib/api";
import type { ActivityRecord, DashboardData } from "@/lib/types";
import { DashboardView } from "./dashboard-view";

type DashboardLoaderProps = {
  initialData: DashboardData;
  initialActivity: ActivityRecord[];
  initialFrom: string;
  initialTo: string;
};

export function DashboardLoader({ initialData, initialActivity, initialFrom, initialTo }: DashboardLoaderProps) {
  const [data, setData] = useState(initialData);
  const [activity, setActivity] = useState(initialActivity);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([crmApi.dashboard(), crmApi.activities()])
      .then(([nextData, nextActivity]) => {
        if (!controller.signal.aborted) {
          setData(nextData);
          setActivity(nextActivity);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <DashboardView data={data} activity={activity} initialFrom={initialFrom} initialTo={initialTo} />;
}
