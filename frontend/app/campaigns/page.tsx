"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { campaignsAPI } from "@/lib/api";
import { Plus, Play, Pause, RotateCcw, Trash2, BarChart3, MessageSquare, Mail, Smartphone, Bot } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  template: string;
  subject: string | null;
  sentCount: number;
  messageCount: number;
  scheduleType: string;
  scheduledAt: string | null;
}

const channelIcons: Record<string, any> = {
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  SMS: Smartphone,
  TELEGRAM: Bot,
};

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  SCHEDULED: "outline",
  RUNNING: "default",
  PAUSED: "secondary",
  COMPLETED: "default",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    channel: "WHATSAPP",
    template: "",
    subject: "",
    tagFilter: "",
    scheduleType: "IMMEDIATE",
    scheduledAt: "",
    dailyLimit: 50,
    minDelay: 30,
    maxDelay: 120,
  });

  const fetchCampaigns = async () => {
    try {
      const response = await campaignsAPI.getAll();
      setCampaigns(response.campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async () => {
    try {
      await campaignsAPI.create({
        ...formData,
        tagFilter: formData.tagFilter.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setIsCreateOpen(false);
      setStep(1);
      setFormData({
        name: "",
        channel: "WHATSAPP",
        template: "",
        subject: "",
        tagFilter: "",
        scheduleType: "IMMEDIATE",
        scheduledAt: "",
        dailyLimit: 50,
        minDelay: 30,
        maxDelay: 120,
      });
      fetchCampaigns();
    } catch (error: any) {
      alert(error.message || "Failed to create campaign");
    }
  };

  const handleStart = async (id: string) => {
    try {
      await campaignsAPI.start(id);
      fetchCampaigns();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await campaignsAPI.pause(id);
      fetchCampaigns();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await campaignsAPI.delete(id);
      fetchCampaigns();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const progress = campaigns.length > 0 
    ? Math.round((campaigns[0].sentCount / campaigns[0].messageCount) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your marketing campaigns</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Campaign - Step {step} of 3</DialogTitle>
            </DialogHeader>
            
            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Summer Sale 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <select
                    id="channel"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="TELEGRAM">Telegram</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Target Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tagFilter}
                    onChange={(e) => setFormData({ ...formData, tagFilter: e.target.value })}
                    placeholder="customers, vip"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-4">
                {formData.channel === "EMAIL" && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Check out our summer sale!"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="template">Message Template</Label>
                  <Textarea
                    id="template"
                    value={formData.template}
                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    placeholder="Hi {name}! Check out our latest offers..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: {'{name}'}, {'{email}'}, {'{phone}'}
                    {formData.channel === "EMAIL" && ", {{unsubscribe_url}}"}
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule</Label>
                  <select
                    id="schedule"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.scheduleType}
                    onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
                  >
                    <option value="IMMEDIATE">Send Immediately</option>
                    <option value="SCHEDULED">Schedule for Later</option>
                  </select>
                </div>
                {formData.scheduleType === "SCHEDULED" && (
                  <div className="space-y-2">
                    <Label htmlFor="scheduledAt">Schedule Time</Label>
                    <Input
                      id="scheduledAt"
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Daily Limit</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minDelay">Min Delay (seconds)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      value={formData.minDelay}
                      onChange={(e) => setFormData({ ...formData, minDelay: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDelay">Max Delay (seconds)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      value={formData.maxDelay}
                      onChange={(e) => setFormData({ ...formData, maxDelay: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>Next</Button>
              ) : (
                <Button onClick={handleCreate}>Create Campaign</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const Icon = channelIcons[campaign.channel];
          const progress = campaign.messageCount > 0 
            ? Math.round((campaign.sentCount / campaign.messageCount) * 100) 
            : 0;
          
          return (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">
                        {campaign.channel.toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusColors[campaign.status] as any}>
                    {campaign.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">
                    {campaign.sentCount} of {campaign.messageCount} messages sent
                  </p>
                </div>

                <div className="flex gap-2">
                  {campaign.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() => handleStart(campaign.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {campaign.status === "RUNNING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePause(campaign.id)}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {campaign.status === "PAUSED" && (
                    <Button
                      size="sm"
                      onClick={() => handleStart(campaign.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(campaign.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No campaigns yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first campaign to start sending messages
          </p>
        </Card>
      )}
    </div>
  );
}
