"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statsAPI, contactsAPI } from "@/lib/api";
import { Users, Send, CheckCircle, XCircle, Mail } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [contactStats, setContactStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dashboardStats, contactData] = await Promise.all([
          statsAPI.getDashboard(),
          contactsAPI.getStats(),
        ]);
        setStats(dashboardStats.stats);
        setContactStats(contactData.stats);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Contacts",
      value: contactStats?.total || 0,
      icon: Users,
      description: `${contactStats?.active || 0} active`,
    },
    {
      title: "Total Campaigns",
      value: stats?.totalCampaigns || 0,
      icon: Send,
      description: "All time",
    },
    {
      title: "Messages Sent",
      value: stats?.messagesSent || 0,
      icon: Mail,
      description: "Successfully delivered",
    },
    {
      title: "Delivery Rate",
      value: stats?.totalMessages
        ? Math.round(((stats?.messagesDelivered || 0) / stats.totalMessages) * 100) + "%"
        : "0%",
      icon: CheckCircle,
      description: `${formatNumber(stats?.messagesDelivered || 0)} delivered`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your marketing campaigns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {typeof card.value === "number" ? formatNumber(card.value) : card.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get started with your first campaign in a few simple steps:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Import your contacts or add them manually</li>
              <li>Configure your channel integrations (WhatsApp, Email, etc.)</li>
              <li>Create and launch your first campaign</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.totalMessages === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity. Create your first campaign to get started!
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Messages sent</span>
                    <span className="font-medium">{formatNumber(stats?.messagesSent || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Successfully delivered</span>
                    <span className="font-medium text-green-600">
                      {formatNumber(stats?.messagesDelivered || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed</span>
                    <span className="font-medium text-red-600">
                      {formatNumber(stats?.messagesFailed || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
