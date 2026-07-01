const BASE = "http://localhost:8000";

export async function submitIssue(data) {
  const res = await fetch(`${BASE}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getIssues(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/issues${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateIssue(id, data) {
  const res = await fetch(`${BASE}/issues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSummary(period = "") {
  const qs = period ? `?period=${period}` : "";
  const res = await fetch(`${BASE}/issues/summary/counts${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getIssueUpdates(issueId) {
  const res = await fetch(`${BASE}/issues/${issueId}/updates`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addIssueUpdate(issueId, note) {
  const res = await fetch(`${BASE}/issues/${issueId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteIssue(id) {
  const res = await fetch(`${BASE}/issues/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function bulkCreateIssues(data) {
  const res = await fetch(`${BASE}/issues/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markIssueRead(id) {
  const res = await fetch(`${BASE}/issues/${id}/read`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getOEESummary() {
  const res = await fetch(`${BASE}/oee/summary`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWorkOrders() {
  const res = await fetch(`${BASE}/work-orders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorkOrder(data) {
  const res = await fetch(`${BASE}/work-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorkOrder(id) {
  const res = await fetch(`${BASE}/work-orders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function getDowntime() {
  const res = await fetch(`${BASE}/downtime`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createDowntime(data) {
  const res = await fetch(`${BASE}/downtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteDowntime(id) {
  const res = await fetch(`${BASE}/downtime/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function getOEEGoals() {
  const res = await fetch(`${BASE}/oee/goals`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateOEEGoals(data) {
  const res = await fetch(`${BASE}/oee/goals`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRework() {
  const res = await fetch(`${BASE}/rework`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveRework(data) {
  const res = await fetch(`${BASE}/rework`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteRework(id) {
  const res = await fetch(`${BASE}/rework/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function getForemen() {
  const res = await fetch(`${BASE}/foremen`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGoalHistory() {
  const res = await fetch(`${BASE}/oee/goal-history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createForeman(name) {
  const res = await fetch(`${BASE}/foremen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteForeman(id) {
  const res = await fetch(`${BASE}/foremen/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function getIndirectLabor() {
  const res = await fetch(`${BASE}/indirect-labor`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveIndirectLabor(data) {
  const res = await fetch(`${BASE}/indirect-labor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteIndirectLabor(id) {
  const res = await fetch(`${BASE}/indirect-labor/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}