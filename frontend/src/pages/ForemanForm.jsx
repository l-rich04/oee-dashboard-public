import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { submitIssue, getForemen, getIssues, getIssueUpdates, addIssueUpdate, updateIssue } from "../api/issues";

const CATEGORIES = {
  part: [
    { value: "defective_part",  label: "Defective Part" },
    { value: "wrong_spec",      label: "Wrong Specification" },
    { value: "missing_part",    label: "Missing Part" },
    { value: "supplier_issue",  label: "Supplier Issue" },
    { value: "in_house_damage", label: "In House Damage" },
  ],
  process: [
    { value: "machine_breakdown",  label: "Machine Breakdown" },
    { value: "setup_error",        label: "Setup Error" },
    { value: "quality_check_fail", label: "Quality Check Fail" },
    { value: "safety_stop",        label: "Safety Stop" },
    { value: "lack_of_process",    label: "Lack Of Process" },
  ],
};

const EMPTY_FORM = { issue_type: "", category: "", description: "", foreman_name: "" };

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function daysOld(createdAt) {
  const diff = Math.floor((new Date() - new Date(createdAt + "Z")) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Today";
  return `${diff}d old`;
}

function getLastSeen(name) {
  try {
    const val = localStorage.getItem(`foreman_last_seen_${name}`);
    return val ? new Date(val) : null;
  } catch { return null; }
}

function setLastSeen(name) {
  try { localStorage.setItem(`foreman_last_seen_${name}`, new Date().toISOString()); } catch {}
}

const STATUS_COLORS = {
  open:        { bg: "#FCEBEB", color: "#A32D2D", label: "Open" },
  in_progress: { bg: "#FAEEDA", color: "#854F0B", label: "In Progress" },
  solved:      { bg: "#E1F5EE", color: "#0F6E56", label: "Solved" },
};

export default function ForemanForm() {
  const [foremen, setForemen]               = useState([]);
  const [selectedName, setSelectedName]     = useState("");
  const [tab, setTab]                       = useState("submit");
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [submitted, setSubmitted]           = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState(null);
  const [issues, setIssues]                 = useState([]);
  const [loadingIssues, setLoadingIssues]   = useState(false);
  const [activeIssue, setActiveIssue]       = useState(null);
  const [issueUpdates, setIssueUpdates]     = useState([]);
  const [updateNote, setUpdateNote]         = useState("");
  const [resolution, setResolution]         = useState("");
  const [updateMode, setUpdateMode]         = useState("update");
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState(null);
  const [saveError, setSaveError]           = useState(null);
  const [newUpdateCount, setNewUpdateCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    getForemen().then(data => setForemen(data.map(f => f.name)));
  }, []);

  useEffect(() => {
    if (!selectedName || tab !== "myissues") return;
    loadIssues();
  }, [selectedName, tab]);

  useEffect(() => {
    if (tab === "myissues" && selectedName) {
      intervalRef.current = setInterval(loadIssues, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [tab, selectedName]);

  // Favicon badge — shows when supervisor has updated an issue
  useEffect(() => {
    const canvas  = document.createElement("canvas");
    canvas.width  = 32;
    canvas.height = 32;
    const ctx     = canvas.getContext("2d");
    const svgData = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#1D9E75"/>
      <rect x="4" y="20" width="4" height="8" rx="1" fill="white" opacity="0.9"/>
      <rect x="10" y="14" width="4" height="14" rx="1" fill="white" opacity="0.9"/>
      <rect x="16" y="9" width="4" height="19" rx="1" fill="white" opacity="0.9"/>
      <rect x="22" y="16" width="4" height="12" rx="1" fill="white" opacity="0.9"/>
      <polyline points="6,18 12,12 18,7 24,14" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    </svg>`;
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.src    = url;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      URL.revokeObjectURL(url);
      if (newUpdateCount > 0) {
        ctx.beginPath();
        ctx.arc(22, 10, 11, 0, 2 * Math.PI);
        ctx.fillStyle = "#E24B4A";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font      = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(newUpdateCount > 9 ? "9+" : String(newUpdateCount), 22, 10);
      }
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
    };
  }, [newUpdateCount]);

  async function loadIssues() {
    setLoadingIssues(true);
    try {
      const data = await getIssues({});
      const mine = data.filter(i => i.foreman_name === selectedName);
      setIssues(mine);

      const lastSeen = getLastSeen(selectedName);
      if (lastSeen) {
        const newCount = mine.filter(i => {
          const updated = new Date(i.updated_at + "Z");
          return updated > lastSeen;
        }).length;
        setNewUpdateCount(newCount);
      }
    } finally {
      setLoadingIssues(false);
    }
  }

  function handleSelectName(name) {
    setSelectedName(name);
    setForm(prev => ({ ...prev, foreman_name: name }));
  }

  function setFormField(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "issue_type") next.category = "";
      return next;
    });
  }

  const isValid = form.issue_type && form.category && form.description.trim() && form.foreman_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitIssue({
        issue_type:   form.issue_type,
        category:     form.category,
        description:  form.description.trim(),
        foreman_name: form.foreman_name,
      });
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openIssue(issue) {
    setActiveIssue(issue);
    setUpdateNote("");
    setResolution("");
    setUpdateMode("update");
    setSaveError(null);
    const updates = await getIssueUpdates(issue.id);
    setIssueUpdates(updates);
    setLastSeen(selectedName);
    setNewUpdateCount(0);
  }

  async function handleSubmitUpdate() {
    if (!updateNote.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addIssueUpdate(activeIssue.id, { note: updateNote.trim(), made_by: selectedName });
      await updateIssue(activeIssue.id, { status: "in_progress" });
      setSaveMsg("Update saved.");
      setTimeout(() => setSaveMsg(null), 3000);
      setUpdateNote("");
      setActiveIssue(null);
      setIssueUpdates([]);
      loadIssues();
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkSolved() {
    if (!resolution.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateIssue(activeIssue.id, { status: "solved", resolution_note: resolution.trim() });
      setSaveMsg("Issue marked as solved.");
      setTimeout(() => setSaveMsg(null), 3000);
      setResolution("");
      setActiveIssue(null);
      setIssueUpdates([]);
      loadIssues();
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const activeIssues = issues.filter(i => i.status !== "solved");
  const solvedIssues = issues.filter(i => i.status === "solved");

  const s = {
    input: {
      width: "100%", padding: "10px 12px", fontSize: 14,
      border: "1px solid #ddd", borderRadius: 8, outline: "none",
      fontFamily: "inherit", boxSizing: "border-box", background: "#fff",
    },
    label: { display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 },
    btn: (bg, disabled) => ({
      width: "100%", padding: 13, background: disabled ? "#ccc" : bg,
      border: "none", borderRadius: 8, color: "#fff", fontSize: 14,
      fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
    }),
  };

  const tabTitle = newUpdateCount > 0
    ? `(${newUpdateCount}) Foreman Issue Ticket`
    : "Foreman Issue Ticket";

  return (
    <>
      <Helmet><title>{tabTitle}</title></Helmet>
      <main style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>

        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Foreman Issue Ticket</h1>
        <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>
          Submit issues or check on your existing ones.
        </p>

        {!selectedName ? (
          <div style={{ marginBottom: 28 }}>
            <label style={s.label}>Select your name to get started</label>
            <select value={selectedName} onChange={e => handleSelectName(e.target.value)} style={s.input}>
              <option value="">Select your name…</option>
              {foremen.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ) : (
          <>
            {/* Name bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, padding: "10px 14px",
              background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#0F6E56" }}>{selectedName}</span>
              <button onClick={() => { setSelectedName(""); setIssues([]); setActiveIssue(null); setTab("submit"); setNewUpdateCount(0); }} style={{
                background: "none", border: "none", fontSize: 12,
                color: "#888", cursor: "pointer", fontFamily: "inherit",
              }}>Change ↩</button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #eee", marginBottom: 24 }}>
              {["submit", "myissues"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 500,
                  border: "none", background: "none", cursor: "pointer",
                  fontFamily: "inherit",
                  color: tab === t ? "#1D9E75" : "#888",
                  borderBottom: `2px solid ${tab === t ? "#1D9E75" : "transparent"}`,
                  marginBottom: -1,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {t === "submit" ? "Submit Issue" : "My Issues"}
                  {t === "myissues" && newUpdateCount > 0 && (
                    <span style={{
                      background: "#E24B4A", color: "#fff",
                      fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 10, lineHeight: "16px",
                    }}>{newUpdateCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* SUBMIT TAB */}
            {tab === "submit" && (
              <>
                {submitted ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: "#E1F5EE", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      margin: "0 auto 16px", fontSize: 28,
                    }}>✓</div>
                    <h2 style={{ margin: "0 0 8px" }}>Issue Submitted</h2>
                    <p style={{ color: "#666", margin: "0 0 24px" }}>The supervisor has been notified.</p>
                    <button onClick={() => { setForm(EMPTY_FORM); setSubmitted(false); setFormField("foreman_name", selectedName); }}
                      style={s.btn("#1D9E75", false)}>
                      Submit Another Issue
                    </button>
                    <button onClick={() => { setTab("myissues"); setSubmitted(false); }}
                      style={{ ...s.btn("#378ADD", false), marginTop: 8 }}>
                      View My Issues
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <label style={s.label}>Issue Type</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {["part", "process"].map(t => (
                          <button key={t} type="button" onClick={() => setFormField("issue_type", t)} style={{
                            padding: "14px 10px",
                            border: `2px solid ${form.issue_type === t ? "#1D9E75" : "#ddd"}`,
                            borderRadius: 8,
                            background: form.issue_type === t ? "#E1F5EE" : "#fff",
                            color: form.issue_type === t ? "#0F6E56" : "#555",
                            fontWeight: 500, cursor: "pointer", fontSize: 14,
                          }}>
                            {t === "part" ? "Part Issue" : "Process Issue"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.issue_type && (
                      <div>
                        <label style={s.label}>Category</label>
                        <select value={form.category} onChange={e => setFormField("category", e.target.value)} style={s.input}>
                          <option value="">Select a category…</option>
                          {CATEGORIES[form.issue_type].map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={s.label}>Description</label>
                      <textarea value={form.description} onChange={e => setFormField("description", e.target.value)}
                        placeholder="Describe what happened…" rows={3}
                        style={{ ...s.input, resize: "vertical" }} />
                    </div>

                    {submitError && <p style={{ color: "#A32D2D", margin: 0 }}>{submitError}</p>}

                    <button type="submit" disabled={!isValid || submitting} style={s.btn("#1D9E75", !isValid || submitting)}>
                      {submitting ? "Submitting…" : "Submit Issue"}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* MY ISSUES TAB */}
            {tab === "myissues" && (
              <>
                {saveMsg && (
                  <div style={{ padding: "12px 16px", background: "#E1F5EE", borderRadius: 8, fontSize: 13, color: "#0F6E56", marginBottom: 16 }}>
                    {saveMsg}
                  </div>
                )}

                {activeIssue && (
                  <div style={{ border: "0.5px solid #eee", borderRadius: 12, padding: 20, marginBottom: 20, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 4px" }}>{titleCase(activeIssue.category)}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>#{activeIssue.id} · {daysOld(activeIssue.created_at)}</p>
                      </div>
                      <button onClick={() => { setActiveIssue(null); setIssueUpdates([]); }} style={{
                        background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#aaa", lineHeight: 1,
                      }}>✕</button>
                    </div>

                    <p style={{ fontSize: 13, color: "#444", marginBottom: 12, lineHeight: 1.5 }}>{activeIssue.description}</p>

                    <div style={{ marginBottom: 16 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 8,
                        background: STATUS_COLORS[activeIssue.status]?.bg,
                        color: STATUS_COLORS[activeIssue.status]?.color,
                      }}>
                        {STATUS_COLORS[activeIssue.status]?.label}
                      </span>
                    </div>

                    {issueUpdates.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 8px" }}>
                          Updates ({issueUpdates.length})
                        </p>
                        {[...issueUpdates].reverse().map((u, idx) => (
                          <div key={u.id} style={{
                            border: "0.5px solid #eee", borderRadius: 8,
                            padding: 10, marginBottom: 8, background: "#fafafa",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>Update {issueUpdates.length - idx}</span>
                                {u.made_by && (
                                  <span style={{ fontSize: 10, background: "#f0f0f0", color: "#555", padding: "1px 6px", borderRadius: 6, fontWeight: 500 }}>
                                    {u.made_by}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: "#aaa" }}>
                                {new Date(u.created_at + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: "#333", lineHeight: 1.4 }}>{u.note}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeIssue.status === "solved" && activeIssue.resolution_note && (
                      <div style={{ background: "#E1F5EE", border: "0.5px solid #1D9E75", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#0F6E56", margin: "0 0 4px" }}>Resolution</p>
                        <p style={{ fontSize: 13, color: "#333", margin: 0 }}>{activeIssue.resolution_note}</p>
                      </div>
                    )}

                    {activeIssue.status !== "solved" && (
                      <>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <button onClick={() => setUpdateMode("update")} style={{
                            flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12,
                            fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                            border: `1.5px solid ${updateMode === "update" ? "#1D9E75" : "#ddd"}`,
                            background: updateMode === "update" ? "#E1F5EE" : "#fff",
                            color: updateMode === "update" ? "#0F6E56" : "#999",
                          }}>Add Update</button>
                          <button onClick={() => setUpdateMode("solve")} style={{
                            flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12,
                            fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                            border: `1.5px solid ${updateMode === "solve" ? "#E24B4A" : "#ddd"}`,
                            background: updateMode === "solve" ? "#FCEBEB" : "#fff",
                            color: updateMode === "solve" ? "#A32D2D" : "#999",
                          }}>Mark Solved</button>
                        </div>

                        {updateMode === "update" && (
                          <>
                            <textarea value={updateNote} onChange={e => setUpdateNote(e.target.value)}
                              rows={3} placeholder="Describe the current status…"
                              style={{ ...s.input, resize: "vertical", marginBottom: 10 }} />
                            <button onClick={handleSubmitUpdate} disabled={!updateNote.trim() || saving}
                              style={s.btn("#1D9E75", !updateNote.trim() || saving)}>
                              {saving ? "Saving…" : "Submit Update"}
                            </button>
                          </>
                        )}

                        {updateMode === "solve" && (
                          <>
                            <textarea value={resolution} onChange={e => setResolution(e.target.value)}
                              rows={3} placeholder="Describe how this was resolved…"
                              style={{ ...s.input, resize: "vertical", marginBottom: 10 }} />
                            <button onClick={handleMarkSolved} disabled={!resolution.trim() || saving}
                              style={s.btn("#E24B4A", !resolution.trim() || saving)}>
                              {saving ? "Saving…" : "Mark as Solved"}
                            </button>
                          </>
                        )}

                        {saveError && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{saveError}</p>}
                      </>
                    )}
                  </div>
                )}

                {loadingIssues && !activeIssue ? (
                  <p style={{ textAlign: "center", color: "#aaa", padding: 40, fontSize: 13 }}>Loading…</p>
                ) : (
                  <>
                    {activeIssues.length === 0 && solvedIssues.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <p style={{ fontSize: 15, color: "#888", margin: "0 0 8px" }}>No issues found</p>
                        <p style={{ fontSize: 13, color: "#bbb", margin: 0 }}>You haven't submitted any issues yet.</p>
                      </div>
                    )}

                    {activeIssues.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 10px" }}>
                          Open & In Progress ({activeIssues.length})
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {activeIssues.map(issue => {
                            const st = STATUS_COLORS[issue.status];
                            const isActive = activeIssue?.id === issue.id;
                            const lastSeen = getLastSeen(selectedName);
                            const hasNew = lastSeen && new Date(issue.updated_at + "Z") > lastSeen;
                            return (
                              <button key={issue.id} onClick={() => openIssue(issue)} style={{
                                width: "100%", textAlign: "left", padding: "14px 16px",
                                border: `1px solid ${isActive ? "#1D9E75" : hasNew ? "#E24B4A" : "#eee"}`,
                                borderRadius: 10, background: isActive ? "#f0faf6" : hasNew ? "#FFF8F8" : "#fff",
                                cursor: "pointer", fontFamily: "inherit",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{titleCase(issue.category)}</span>
                                    {hasNew && (
                                      <span style={{ fontSize: 9, fontWeight: 700, background: "#E24B4A", color: "#fff", padding: "1px 5px", borderRadius: 8 }}>
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 500, background: st.bg, color: st.color, padding: "2px 8px", borderRadius: 8 }}>
                                    {st.label}
                                  </span>
                                </div>
                                <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px", lineHeight: 1.4 }}>{issue.description}</p>
                                <div style={{ display: "flex", gap: 12 }}>
                                  <span style={{ fontSize: 11, color: "#bbb" }}>#{issue.id}</span>
                                  <span style={{ fontSize: 11, color: "#bbb" }}>{daysOld(issue.created_at)}</span>
                                  {issue.update_count > 0 && (
                                    <span style={{ fontSize: 11, color: "#bbb" }}>{issue.update_count} update{issue.update_count !== 1 ? "s" : ""}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {solvedIssues.length > 0 && (
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 10px" }}>
                          Solved ({solvedIssues.length})
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {solvedIssues.map(issue => {
                            const isActive = activeIssue?.id === issue.id;
                            const lastSeen = getLastSeen(selectedName);
                            const hasNew = lastSeen && new Date(issue.updated_at + "Z") > lastSeen;
                            return (
                              <button key={issue.id} onClick={() => openIssue(issue)} style={{
                                width: "100%", textAlign: "left", padding: "14px 16px",
                                border: `1px solid ${isActive ? "#1D9E75" : hasNew ? "#E24B4A" : "#eee"}`,
                                borderRadius: 10, background: isActive ? "#f0faf6" : hasNew ? "#FFF8F8" : "#fafafa",
                                cursor: "pointer", fontFamily: "inherit", opacity: 0.9,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{titleCase(issue.category)}</span>
                                    {hasNew && (
                                      <span style={{ fontSize: 9, fontWeight: 700, background: "#E24B4A", color: "#fff", padding: "1px 5px", borderRadius: 8 }}>
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 500, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 8 }}>
                                    Solved
                                  </span>
                                </div>
                                <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 4px", lineHeight: 1.4 }}>{issue.description}</p>
                                <div style={{ display: "flex", gap: 12 }}>
                                  <span style={{ fontSize: 11, color: "#bbb" }}>#{issue.id}</span>
                                  <span style={{ fontSize: 11, color: "#bbb" }}>{daysOld(issue.created_at)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}