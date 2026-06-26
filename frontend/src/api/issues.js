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

export async function getSummary() {
  const res = await fetch(`${BASE}/issues/summary/counts`);
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