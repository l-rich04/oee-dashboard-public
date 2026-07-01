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
import DowntimePanel from "../components/DowntimePanel";
import ReworkPanel from "../components/ReworkPanel";
import ForemanManagePanel from "../components/ForemanManagePanel";
import IndirectLaborPanel from "../components/IndirectLaborPanel";

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

export default function SupervisorDashboard() {
  const [authed, setAuthed]                   = useState(sessionStorage.getItem("supervisor_auth") === "true");
  const [activeTab, setActiveTab]             = useState("issues");
  const [activeOeeTab, setActiveOeeTab]       = useState("overview");
  const [issues, setIssues]                   = useState([]);
  const [summary, setSummary]                 = useState(null);
  const [oeeSummary, setOeeSummary]           = useState(null);
  const [foremen, setForemen]                 = useState([]);
  const [filter, setFilter]                   = useState({ status: "", category: "" });
  const [period, setPeriod]                   = useState("ytd");
  const [updating, setUpdating]               = useState(null);
  const [editing, setEditing]                 = useState(null);
  const [checkedIds, setCheckedIds]           = useState(new Set());
  const [toDelete, setToDelete]               = useState(null);
  const [deleteMsg, setDeleteMsg]             = useState(false);
  const [massAdding, setMassAdding]           = useState(false);
  const [expandedForemen, setExpandedForemen] = useState({});
  const [showSolved, setShowSolved]           = useState(false);

  async function load() {
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.category) params.category = filter.category;
    const [data, sum] = await Promise.all([getIssues(params), getSummary(period)]);
    setIssues(data);
    setSummary(sum);
    setCheckedIds(new Set());
  }

  async function loadOEE() {
    try {
      const data = await getOEESummary();
      setOeeSummary(data);
    } catch (err) {
      console.error("OEE error:", err);
    }
  }

  async function loadForemen() {
    try {
      const data = await getForemen();
      setForemen(data.map(f => f.name));
    } catch (err) {
      console.error("Foremen error:", err);
    }
  }

  useEffect(() => {
    if (authed) {
      load();
      loadOEE();
      loadForemen();
    }
  }, [filter.status, filter.category, authed, period]);

  function toggleForeman(key) {
    setExpandedForemen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  const activeIssues = issues.filter(i => i.status !== "solved");
  const solvedIssues = issues.filter(i => i.status === "solved");
  const unreadCount  = activeIssues.filter(i => !i.is_read).length;

  const grouped = activeIssues.reduce((acc, issue) => {
    const key = issue.foreman_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  const solvedGrouped = solvedIssues.reduce((acc, issue) => {
    const key = issue.foreman_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  const sortForemen = (keys) => [...keys].sort((a, b) => {
    const aIdx = foremen.indexOf(a);
    const bIdx = foremen.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const sortedForemen       = sortForemen(Object.keys(grouped));
  const sortedSolvedForemen = sortForemen(Object.keys(solvedGrouped));

  return (
    <>
      <Helmet>
        <title>Supervisor Dashboard</title>
      </Helmet>
      <main style={{ maxWidth: 1600, margin: "40px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
          Supervisor Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 20, marginTop: 0 }}>
          Overall Equipment Effectiveness and Production Metrics
        </p>

        {/* MAIN TAB BAR */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #eee", marginBottom: 28 }}>
          {["issues", "oee"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 500,
              border: "none", background: "none", cursor: "pointer",
              fontFamily: "inherit",
              color: activeTab === tab ? "#1D9E75" : "#888",
              borderBottom: `2px solid ${activeTab === tab ? "#1D9E75" : "transparent"}`,
              marginBottom: -1,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab === "issues" ? "Issues" : "OEE & Production"}
              {tab === "issues" && unreadCount > 0 && (
                <span style={{
                  background: "#E24B4A", color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 10,
                  lineHeight: "16px",
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ISSUES TAB */}
        {activeTab === "issues" && (
          <>
            <SummaryCharts
              summary={summary}
              issues={issues}
              onPeriodChange={(p) => setPeriod(p)}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All Issues</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <ForemanManagePanel onChanged={loadForemen} />
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

            {sortedForemen.length === 0 && (
              <p style={{ textAlign: "center", color: "#999", marginTop: 40 }}>No Active Issues Found.</p>
            )}

            {sortedForemen.map(foremanName => {
              const foremanIssues = grouped[foremanName].filter(i => {
                if (filter.status   && i.status   !== filter.status)   return false;
                if (filter.category && i.category !== filter.category) return false;
                return true;
              });

              if (foremanIssues.length === 0) return null;

              const isOpen     = expandedForemen[foremanName];
              const newCount   = foremanIssues.filter(i => !i.is_read).length;

              const counts = foremanIssues.reduce((acc, i) => {
                acc[i.status] = (acc[i.status] ?? 0) + 1;
                return acc;
              }, {});

              return (
                <div key={foremanName} style={{ border: "0.5px solid #eee", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", background: "#fafafa",
                    borderBottom: isOpen ? "0.5px solid #eee" : "none",
                  }}>
                    <button type="button" onClick={() => toggleForeman(foremanName)} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{foremanName}</span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>{foremanIssues.length} issue{foremanIssues.length !== 1 ? "s" : ""}</span>
                      {newCount > 0 && (
                        <span style={{
                          background: "#E24B4A", color: "#fff",
                          fontSize: 10, fontWeight: 700,
                          padding: "1px 6px", borderRadius: 10,
                        }}>
                          {newCount} new
                        </span>
                      )}
                      {counts.open > 0 && <span style={{ fontSize: 11, color: "#854F0B" }}>{counts.open} open</span>}
                      {counts.in_progress > 0 && <span style={{ fontSize: 11, color: "#854F0B" }}>{counts.in_progress} in progress</span>}
                      <span onClick={() => toggleForeman(foremanName)} style={{
                        fontSize: 12, color: "#555", fontWeight: 500,
                        background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                      }}>
                        {isOpen ? "▲ Hide" : "▼ Show"}
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                          <th style={{ padding: "7px 12px", width: 30 }}></th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>ID</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Type</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Category</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Description</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Status</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Age</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Created</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Updates</th>
                          <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foremanIssues.map(issue => (
                          <tr key={issue.id} style={{
                            borderBottom: "0.5px solid #f5f5f5",
                            background: checkedIds.has(issue.id) ? "#FFF5F5" : !issue.is_read ? "#FFFBF0" : "white",
                          }}>
                            <td style={{ padding: "8px 12px" }}>
                              <input type="checkbox" checked={checkedIds.has(issue.id)}
                                onChange={() => toggleCheck(issue.id)}
                                style={{ cursor: "pointer", accentColor: "#E24B4A" }} />
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                #{issue.id}
                                {!issue.is_read && (
                                  <span style={{
                                    background: "#E24B4A", color: "#fff",
                                    fontSize: 9, fontWeight: 700,
                                    padding: "1px 5px", borderRadius: 8,
                                  }}>
                                    NEW
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}>{issue.issue_type === "part" ? "Part Issue" : "Process Issue"}</td>
                            <td style={tdStyle}>{titleCase(issue.category)}</td>
                            <td style={{ ...tdStyle, maxWidth: 140 }}>{issue.description}</td>
                            <td style={tdStyle}><IssueStatusBadge status={issue.status} /></td>
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
                            <td style={tdStyle}>{new Date(issue.created_at + "Z").toLocaleDateString()}</td>
                            <td style={{ ...tdStyle, fontSize: 12, color: "#888" }}>
                              {issue.update_count ?? 0} / 3
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                                {!issue.is_read && (
                                  <button onClick={async () => { await markIssueRead(issue.id); load(); }} style={{
                                    padding: "3px 8px", fontSize: 11,
                                    border: "1px solid #D4A017", background: "#FAEEDA",
                                    color: "#854F0B", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                                  }}>
                                    Mark Read
                                  </button>
                                )}
                                <button onClick={() => { setUpdating(issue); setEditing(null); setToDelete(null); setMassAdding(false); }}
                                  style={{ ...btnBase, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>
                                  Update
                                </button>
                                <button onClick={() => { setEditing(issue); setUpdating(null); setToDelete(null); setMassAdding(false); }}
                                  style={{ ...btnBase, border: "1px solid #378ADD", background: "#E6F1FB", color: "#0C447C", fontWeight: 500 }}>
                                  Edit
                                </button>
                                <button onClick={() => confirmDelete([issue.id])}
                                  style={{ ...btnBase, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D" }}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

            {/* SOLVED / ARCHIVED SECTION */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setShowSolved(prev => !prev)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", background: "#fafafa",
                  border: "0.5px solid #eee", borderRadius: 8,
                  fontSize: 13, fontWeight: 500, color: "#555",
                  cursor: "pointer", fontFamily: "inherit",
                  marginBottom: showSolved ? 16 : 0,
                }}>
                {showSolved ? "▲" : "▼"} View Solved
                <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>
                  ({solvedIssues.length} issue{solvedIssues.length !== 1 ? "s" : ""})
                </span>
              </button>

              {showSolved && (
                <div style={{ marginTop: 8 }}>
                  {sortedSolvedForemen.length === 0 && (
                    <p style={{ textAlign: "center", color: "#999", padding: 24, fontSize: 13 }}>No solved issues yet.</p>
                  )}
                  {sortedSolvedForemen.map(foremanName => {
                    const foremanSolved = solvedGrouped[foremanName];
                    const isOpen        = expandedForemen[foremanName + "_solved"];

                    return (
                      <div key={foremanName} style={{ border: "0.5px solid #eee", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", background: "#fafafa",
                          borderBottom: isOpen ? "0.5px solid #eee" : "none",
                        }}>
                          <button type="button" onClick={() => toggleForeman(foremanName + "_solved")} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: "none", border: "none", cursor: "pointer",
                            fontFamily: "inherit", padding: 0, flex: 1, textAlign: "left",
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{foremanName}</span>
                            <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              Solved
                            </span>
                          </button>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ fontSize: 12, color: "#888" }}>{foremanSolved.length} issue{foremanSolved.length !== 1 ? "s" : ""}</span>
                            <span onClick={() => toggleForeman(foremanName + "_solved")} style={{
                              fontSize: 12, color: "#555", fontWeight: 500,
                              background: "#eee", borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                            }}>
                              {isOpen ? "▲ Hide" : "▼ Show"}
                            </span>
                          </div>
                        </div>

                        {isOpen && (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "0.5px solid #f0f0f0", textAlign: "left" }}>
                                <th style={{ padding: "7px 12px", width: 30 }}></th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>ID</th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Type</th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Category</th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Description</th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Created</th>
                                <th style={{ padding: "7px 12px", fontWeight: 500, color: "#555" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {foremanSolved.map(issue => (
                                <tr key={issue.id} style={{
                                  borderBottom: "0.5px solid #f5f5f5",
                                  background: checkedIds.has(issue.id) ? "#FFF5F5" : "#fafafa",
                                }}>
                                  <td style={{ padding: "8px 12px" }}>
                                    <input type="checkbox" checked={checkedIds.has(issue.id)}
                                      onChange={() => toggleCheck(issue.id)}
                                      style={{ cursor: "pointer", accentColor: "#E24B4A" }} />
                                  </td>
                                  <td style={tdStyle}>#{issue.id}</td>
                                  <td style={tdStyle}>{issue.issue_type === "part" ? "Part Issue" : "Process Issue"}</td>
                                  <td style={tdStyle}>{titleCase(issue.category)}</td>
                                  <td style={{ ...tdStyle, maxWidth: 140 }}>{issue.description}</td>
                                  <td style={tdStyle}>{new Date(issue.created_at + "Z").toLocaleDateString()}</td>
                                  <td style={tdStyle}>
                                    <div style={{ display: "flex", gap: 5 }}>
                                      <button onClick={() => { setUpdating(issue); setEditing(null); setToDelete(null); setMassAdding(false); }}
                                        style={{ ...btnBase, border: "1px solid #1D9E75", background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>
                                        Update
                                      </button>
                                      <button onClick={() => confirmDelete([issue.id])}
                                        style={{ ...btnBase, border: "1px solid #E24B4A", background: "#FCEBEB", color: "#A32D2D" }}>
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* OEE TAB */}
        {activeTab === "oee" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {["overview", "workorders", "downtime"].map(tab => (
                  <button key={tab} onClick={() => setActiveOeeTab(tab)} style={{
                    padding: "7px 16px", fontSize: 13, fontWeight: 500,
                    border: `1px solid ${activeOeeTab === tab ? "#1D9E75" : "#eee"}`,
                    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                    background: activeOeeTab === tab ? "#E1F5EE" : "#fff",
                    color: activeOeeTab === tab ? "#0F6E56" : "#888",
                  }}>
                    {tab === "overview" ? "Overview" : tab === "workorders" ? "Work Orders" : "Downtime"}
                  </button>
                ))}
              </div>
              <OEEGoalsPanel onSaved={loadOEE} />
            </div>

            {activeOeeTab === "overview" && (
              <OEEMetrics summary={oeeSummary} />
            )}

            {activeOeeTab === "workorders" && (
              <WorkOrderPanel onSaved={loadOEE} />
            )}

          {activeOeeTab === "downtime" && (
  <>
    <IndirectLaborPanel onSaved={loadOEE} />
    <div style={{ height: 1, background: "#eee", margin: "24px 0" }} />
    <ReworkPanel onSaved={loadOEE} />
  </>
)}
          </>
        )}

      </main>
    </>
  );
}

const tdStyle     = { padding: "9px 12px", verticalAlign: "top" };
const selectStyle = { padding: "8px 12px", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" };
const btnBase     = { padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#333" };