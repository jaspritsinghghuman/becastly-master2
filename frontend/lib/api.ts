const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

// Auth
export const authAPI = {
  register: (data: { email: string; password: string; name?: string }) =>
    fetchAPI("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  login: (data: { email: string; password: string }) =>
    fetchAPI("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  logout: () => fetchAPI("/auth/logout", { method: "POST" }),
  
  me: () => fetchAPI("/auth/me"),
};

// Contacts
export const contactsAPI = {
  getAll: (params?: { search?: string; tags?: string[]; page?: number; limit?: number }) =>
    fetchAPI(`/contacts?${new URLSearchParams(params as any)}`),
  
  getStats: () => fetchAPI("/contacts/stats"),
  
  create: (data: any) =>
    fetchAPI("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: any) =>
    fetchAPI(`/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchAPI(`/contacts/${id}`, { method: "DELETE" }),
  
  import: (file: File, tags: string[]) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tags", JSON.stringify(tags));
    
    return fetch(`${API_URL}/contacts/import`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then((res) => res.json());
  },
};

// Campaigns
export const campaignsAPI = {
  getAll: (params?: { status?: string; channel?: string; page?: number }) =>
    fetchAPI(`/campaigns?${new URLSearchParams(params as any)}`),
  
  get: (id: string) => fetchAPI(`/campaigns/${id}`),
  
  create: (data: any) =>
    fetchAPI("/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: any) =>
    fetchAPI(`/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchAPI(`/campaigns/${id}`, { method: "DELETE" }),
  
  start: (id: string) =>
    fetchAPI(`/campaigns/${id}/start`, { method: "POST" }),
  
  pause: (id: string) =>
    fetchAPI(`/campaigns/${id}/pause`, { method: "POST" }),
  
  resume: (id: string) =>
    fetchAPI(`/campaigns/${id}/resume`, { method: "POST" }),
  
  getStats: (id: string) => fetchAPI(`/campaigns/${id}/stats`),
};

// Integrations
export const integrationsAPI = {
  getAll: () => fetchAPI("/integrations"),
  
  create: (data: any) =>
    fetchAPI("/integrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: any) =>
    fetchAPI(`/integrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchAPI(`/integrations/${id}`, { method: "DELETE" }),
  
  toggle: (id: string) =>
    fetchAPI(`/integrations/${id}/toggle`, { method: "POST" }),
  
  test: (id: string) =>
    fetchAPI(`/integrations/${id}/test`, { method: "POST" }),
};

// Stats
export const statsAPI = {
  getDashboard: () => fetchAPI("/api/v1/stats"),
};

// API Keys
export const apiKeysAPI = {
  getAll: () => fetchAPI("/api/v1/keys"),
  
  create: (data: { name: string; permissions?: string[] }) =>
    fetchAPI("/api/v1/keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  revoke: (id: string) =>
    fetchAPI(`/api/v1/keys/${id}`, { method: "DELETE" }),
};
