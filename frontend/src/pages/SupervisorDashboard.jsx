import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { getIssues, getSummary, deleteIssue, getOEESummary, getForemen, markIssueRead } from "../api/issues";
import IssueStatusBadge from "../components/IssueStatusBadge";
import SummaryCharts from "../components/SummaryCharts";
import IssueUpdatePanel from "../components/IssueUpdatePanel";
import IssueEditPanel from "../components/IssueEditPanel";
import MassAddPanel from "../components/MassAddPanel";
import SupervisorLogin from "../components/SupervisorLogin";
import OEEMetrics from "../components/OEEMetrics";
import OEEGoalsPanel from "../components/OEEGoalsPanel";
import WorkOrderPanel from "../components/WorkOrderPanel";
import WeeklyLaborPanel from "../components/WeeklyLaborPanel";
import ForemanManagePanel from "../components/ForemanManagePanel";

function daysOld(createdAt) {
  const created = new Date(createdAt + "Z");
  const now = new Date();
  const diff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Today";
  return `${diff}d`;
}

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const SORTABLE_COLUMNS = ["ID", "Type", "Category", "Description", "Foreman", "Status", "Age", "Created"];

function sortIssues(issues, key, dir) {
  const sorted = [...issues].sort((a, b) => {
    let valA, valB;
    switch (key) {
      case "ID":          valA = a.id;                         valB = b.id;                         break;
      case "Type":        valA = a.issue_type;                 valB = b.issue_type;                 break;
      case "Category":    valA = a.category;                   valB = b.category;                   break;
      case "Description": valA = a.description.toLowerCase();  valB = b.description.toLowerCase();  break;
      case "Foreman":     valA = a.foreman_name.toLowerCase(); valB = b.foreman_name.toLowerCase(); break;
      case "Status":      valA = a.status;                     valB = b.status;                     break;
      case "Age":         valA = new Date(a.created_at + "Z"); valB = new Date(b.created_at + "Z"); break;
      case "Created":     valA = new Date(a.created_at + "Z"); valB = new Date(b.created_at + "Z"); break;
      default:            return 0;
    }
    if (valA < valB) return dir === "asc" ? -1 : 1;
    if (valA > valB) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

export default function SupervisorDashboard() {
  const [authed, setAuthed]         = useState(
    sessionStorage.getItem("supervisor_auth") === "true"
  );
  const [issues, setIssues]         = useState([]);
  const [summary, setSummary]       = useState(null);
  const [filter, setFilter]         = useState({ status: "", category: "" });
  const [updating, setUpdating]     = useState(null);
  const [editing, setEditing]       = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [toDelete, setToDelete]     = useState(null);
  const [deleteMsg, setDeleteMsg]   = useState(false);
  const [massAdding, setMassAdding] = useState(false);
  const [sortKey, setSortKey]       = useState("ID");
  const [sortDir, setSortDir]       = useState("asc");

  async function load() {
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.category) params.category = filter.category;
    const [data, sum] = await Promise.all([getIssues(params), getSummary()]);
    setIssues(data);
    setSummary(sum);
    setCheckedIds(new Set());
  }

  useEffect(() => {
    if (authed) load();
  }, [filter, authed]);

  function handleSort(col) {
    if (!SORTABLE_COLUMNS.includes(col)) return;
    if (sortKey === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(e) {
    setCheckedIds(e.target.checked ? new Set(issues.map(i => i.id)) : new Set());
  }

  function confirmDelete(ids) {
    setToDelete(ids);
    setUpdating(null);
    setEditing(null);
    setMassAdding(false);
  }

  async function handleDelete() {
    if (!toDelete) return;
    await Promise.all(toDelete.map(id => deleteIssue(id)));
    setToDelete(null);
    setDeleteMsg(true);
    setTimeout(() => setDeleteMsg(false), 3000);
    load();
  }

  if (!authed) {
    return <SupervisorLogin onSuccess={() => setAuthed(true)} />;
  }

  const allChecked   = issues.length > 0 && checkedIds.size === issues.length;
  const sortedIssues = sortIssues(issues, sortKey, sortDir);

  function SortIcon({ col }) {
    if (sortKey !== col) return <span style={{ color: "#ccc", marginLeft: 4, fontSize: 10 }}>↕</span>;
    return <span style={{ color: "#1D9E75", marginLeft: 4, fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <>
      <Helmet><title>Supervisor Dashboard</title></Helmet>
      <main style={{ maxWidth: 1060, margin: "40px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 28 }}>
          Supervisor Dashboard
        </h1>

        <SummaryCharts summary={summary} issues={issues} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All Issues</h2>
          <button
            onClick={() => {
              setMassAdding(prev => !prev);
              setUpdating(null);
              setEditing(null);
              setToDelete(null);
            }}
            style={{
              padding: "8px 16px", background: "#1D9E75", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13,
              fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>
            + Add Multiple Issues
          </button>
        </div>

        {massAdding && (
          <MassAddPanel
            onClose={() => setMassAdding(false)}
            onSaved={() => { setMassAdding(false); load(); }}
          />
        )}

        {updating && (
          <IssueUpdatePanel
            issue={updating}
            onClose={() => setUpdating(null)}
            onSaved={load}
          />
        )}

        {editing && (
          <IssueEditPanel
            issue={editing}
            onClose={() => setEditing(null)}
            onSaved={load}
          />
        )}

        {toDelete && (
          <div style={{
            marginTop: 16, padding: 20,
            border: "1px solid #E24B4A", borderRadius: 12, background: "#fff",
            marginBottom: 16,
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 500, color: "#A32D2D" }}>
              Delete {toDelete.length} Issue{toDelete.length > 1 ? "s" : ""}?
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
              The following will be permanently deleted. This cannot be undone.
            </p>
            <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 13, color: "#333" }}>
              {toDelete.map(id => {
                const issue = issues.find(i => i.id === id);
                return issue ? (
                  <li key={id} style={{ marginBottom: 4 }}>
                    Issue #{id} — {titleCase(issue.category)} ({issue.foreman_name})
                  </li>
                ) : null;
              })}
            </ul>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} style={{
                padding: "8px 20px", background: "#E24B4A", color: "#fff",
                border: "none", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500, fontFamily: "inherit",
              }}>
                Yes, Delete
              </button>
              <button onClick={() => setToDelete(null)} style={{
                padding: "8px 16px", background: "#fff", border: "1px solid #ddd",
                borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteMsg && (
          <div style={{
            padding: "12px 16px", background: "#E1F5EE", borderRadius: 8,
            fontSize: 13, color: "#0F6E56", marginBottom: 12,
          }}>
            Issues deleted successfully.
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <select value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            style={selectStyle}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="solved">Solved</option>
          </select>
          <select value={filter.category}
            onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
            style={selectStyle}>
            <option value="">All Categories</option>
            <option value="defective_part">Defective Part</option>
            <option value="wrong_spec">Wrong Specification</option>
            <option value="missing_part">Missing Part</option>
            <option value="supplier_issue">Supplier Issue</option>
            <option value="in_house_damage">In House Damage</option>
            <option value="machine_breakdown">Machine Breakdown</option>
            <option value="setup_error">Setup Error</option>
            <option value="quality_check_fail">Quality Check Fail</option>
            <option value="safety_stop">Safety Stop</option>
            <option value="lack_of_process">Lack Of Process</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: "#888" }}>
            {checkedIds.size > 0 ? `${checkedIds.size} issue${checkedIds.size > 1 ? "s" : ""} selected` : ""}
          </span>
          <button
            disabled={checkedIds.size === 0}
            onClick={() => confirmDelete([...checkedIds])}
            style={{
              padding: "7px 16px", fontSize: 13, borderRadius: 8,
              cursor: checkedIds.size > 0 ? "pointer" : "not-allowed",
              border: "1px solid #E24B4A",
              background: checkedIds.size > 0 ? "#FCEBEB" : "#f5f5f5",
              color: checkedIds.size > 0 ? "#A32D2D" : "#bbb",
              fontWeight: 500, fontFamily: "inherit",
            }}>
            Delete Selected
          </button>
        </div>

        <div style={{ border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                <th style={{ padding: "9px 12px", width: 36 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    style={{ cursor: "pointer", accentColor: "#E24B4A" }} />
                </th>
                {["ID", "Type", "Category", "Description", "Foreman", "Status", "Age", "Created", "Updates", "Action"].map(h => (
                  <th key={h}
                    onClick={() => handleSort(h)}
                    style={{
                      padding: "9px 12px", fontWeight: 500, color: "#555",
                      cursor: SORTABLE_COLUMNS.includes(h) ? "pointer" : "default",
                      userSelect: "none", whiteSpace: "nowrap",
                    }}>
                    {h}{SORTABLE_COLUMNS.includes(h) && <SortIcon col={h} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map(issue => (
                <tr key={issue.id} style={{
                  borderBottom: "0.5px solid #f0f0f0",
                  background: checkedIds.has(issue.id) ? "#FFF5F5" : "white",
                }}>
                  <td style={{ padding: "9px 12px" }}>
                    <input type="checkbox" checked={checkedIds.has(issue.id)}
                      onChange={() => toggleCheck(issue.id)}
                      style={{ cursor: "pointer", accentColor: "#E24B4A" }} />
                  </td>
                  <td style={tdStyle}>#{issue.id}</td>
                  <td style={tdStyle}>
                    {issue.issue_type === "part" ? "Part Issue" : "Process Issue"}
                  </td>
                  <td style={tdStyle}>{titleCase(issue.category)}</td>
                  <td style={{ ...tdStyle, maxWidth: 140 }}>{issue.description}</td>
                  <td style={tdStyle}>{issue.foreman_name}</td>
                  <td style={tdStyle}>
                    <IssueStatusBadge status={issue.status} />
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: daysOld(issue.created_at) === "Today" ? "#E1F5EE" :
                        parseInt(daysOld(issue.created_at)) > 7 ? "#FCEBEB" : "#FAEEDA",
                      color: daysOld(issue.created_at) === "Today" ? "#0F6E56" :
                        parseInt(daysOld(issue.created_at)) > 7 ? "#A32D2D" : "#854F0B",
                      padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500,
                    }}>
                      {daysOld(issue.created_at)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {new Date(issue.created_at + "Z").toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#888" }}>
                    {issue.update_count ?? 0} / 3
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        onClick={() => {
                          setUpdating(issue);
                          setEditing(null);
                          setToDelete(null);
                          setMassAdding(false);
                        }}
                        style={{
                          ...btnBase,
                          border: "1px solid #1D9E75",
                          background: "#E1F5EE",
                          color: "#0F6E56",
                          fontWeight: 500,
                        }}>
                        Update
                      </button>
                      <button
                        onClick={() => {
                          setEditing(issue);
                          setUpdating(null);
                          setToDelete(null);
                          setMassAdding(false);
                        }}
                        style={{
                          ...btnBase,
                          border: "1px solid #378ADD",
                          background: "#E6F1FB",
                          color: "#0C447C",
                          fontWeight: 500,
                        }}>
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete([issue.id])}
                        style={{
                          ...btnBase,
                          border: "1px solid #E24B4A",
                          background: "#FCEBEB",
                          color: "#A32D2D",
                        }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {issues.length === 0 && (
          <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>
            No Issues Found.
          </p>
        )}

      </main>
    </>
  );
}

const tdStyle     = { padding: "9px 12px", verticalAlign: "top" };
const selectStyle = { padding: "8px 12px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" };
const btnBase     = { padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#333" };