"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { integrationsAPI, apiKeysAPI } from "@/lib/api";
import { Plus, Trash2, CheckCircle, XCircle, Key, MessageSquare, Mail, Smartphone, Bot, Copy, Check } from "lucide-react";

const channelConfig: Record<string, { name: string; icon: any; fields: string[] }> = {
  WHATSAPP: {
    name: "WhatsApp",
    icon: MessageSquare,
    fields: ["phoneNumberId", "accessToken"],
  },
  EMAIL: {
    name: "Email (SMTP)",
    icon: Mail,
    fields: ["host", "port", "user", "pass", "secure"],
  },
  SMS: {
    name: "SMS (Twilio)",
    icon: Smartphone,
    fields: ["accountSid", "authToken", "phoneNumber"],
  },
  TELEGRAM: {
    name: "Telegram Bot",
    icon: Bot,
    fields: ["botToken"],
  },
};

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("WHATSAPP");
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, string>>({});
  const [apiKeyName, setApiKeyName] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    try {
      const [integrationsRes, apiKeysRes] = await Promise.all([
        integrationsAPI.getAll(),
        apiKeysAPI.getAll(),
      ]);
      setIntegrations(integrationsRes.integrations);
      setApiKeys(apiKeysRes.keys);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddIntegration = async () => {
    try {
      await integrationsAPI.create({
        channel: selectedChannel,
        provider: selectedChannel.toLowerCase(),
        config: integrationConfig,
      });
      setIsIntegrationOpen(false);
      setIntegrationConfig({});
      fetchData();
    } catch (error: any) {
      alert(error.message || "Failed to add integration");
    }
  };

  const handleTestIntegration = async (id: string) => {
    try {
      const result = await integrationsAPI.test(id);
      alert(result.success ? "Integration test successful!" : `Test failed: ${result.error}`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleToggleIntegration = async (id: string) => {
    try {
      await integrationsAPI.toggle(id);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm("Are you sure you want to delete this integration?")) return;
    try {
      await integrationsAPI.delete(id);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const result = await apiKeysAPI.create({ name: apiKeyName });
      setNewApiKey(result.apiKey);
      setApiKeyName("");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;
    try {
      await apiKeysAPI.revoke(id);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your integrations and API keys</p>
      </div>

      {/* Integrations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Integrations</h2>
          <Dialog open={isIntegrationOpen} onOpenChange={setIsIntegrationOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Integration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={selectedChannel}
                    onChange={(e) => {
                      setSelectedChannel(e.target.value);
                      setIntegrationConfig({});
                    }}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email (SMTP)</option>
                    <option value="SMS">SMS (Twilio)</option>
                    <option value="TELEGRAM">Telegram Bot</option>
                  </select>
                </div>
                {channelConfig[selectedChannel].fields.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                    </Label>
                    <Input
                      id={field}
                      type={field.includes("pass") || field.includes("token") || field.includes("secret") ? "password" : "text"}
                      value={integrationConfig[field] || ""}
                      onChange={(e) =>
                        setIntegrationConfig({ ...integrationConfig, [field]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleAddIntegration}>Add Integration</Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => {
            const config = channelConfig[integration.channel];
            const Icon = config.icon;
            
            return (
              <Card key={integration.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">
                          {integration.provider}
                        </p>
                      </div>
                    </div>
                    <Badge variant={integration.isActive ? "default" : "secondary"}>
                      {integration.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestIntegration(integration.id)}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleIntegration(integration.id)}
                    >
                      {integration.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteIntegration(integration.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {integrations.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No integrations configured</p>
            <p className="text-sm text-muted-foreground">
              Add an integration to start sending messages
            </p>
          </Card>
        )}
      </div>

      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">API Keys</h2>
          <Dialog open={isApiKeyOpen} onOpenChange={setIsApiKeyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="w-4 h-4 mr-2" />
                Generate API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!newApiKey ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Key Name</Label>
                      <Input
                        id="keyName"
                        value={apiKeyName}
                        onChange={(e) => setApiKeyName(e.target.value)}
                        placeholder="My App"
                      />
                    </div>
                    <Button onClick={handleCreateApiKey} disabled={!apiKeyName}>
                      Generate
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Copy this API key now. You won&apos;t be able to see it again!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-background rounded text-sm break-all">
                          {newApiKey}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(newApiKey)}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={() => { setNewApiKey(null); setIsApiKeyOpen(false); }}>
                      Done
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No API keys generated
              </div>
            ) : (
              <div className="divide-y">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeApiKey(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
