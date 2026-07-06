import { useState, useEffect } from "react";
import { getIssueUpdates, addIssueUpdate, updateIssue, editIssueUpdate, deleteIssueUpdate, getSupervisors } from "../api/issues";

function formatDateTime(ts) {
  return new Date(ts + "Z").toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLES = {
  open:        { border: "#E24B4A", bg: "#FCEBEB", color: "#A32D2D" },
  in_progress: { border: "#EF9F27", bg: "#FAEEDA", color: "#854F0B" },
  solved:      { border: "#1D9E75", bg: "#E1F5EE", color: "#0F6E56" },
};

export default function IssueUpdatePanel({ issue, onClose, onSaved }) {
  const [updates, setUpdates]         = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [status, setStatus]           = useState(issue.status);
  const [note, setNote]               = useState("");
  const [madeBy, setMadeBy]           = useState("");
  const [solvedBy, setSolvedBy]       = useState(issue.solved_by ?? "");
  const [resolution, setResolution]   = useState(issue.resolution_note ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editText, setEditText]       = useState("");
  const [editMadeBy, setEditMadeBy]   = useState("");

  useEffect(() => {
    getIssueUpdates(issue.id).then(setUpdates);
    getSupervisors().then(data => setSupervisorList(data.map(s => s.name)));
  }, [issue.id]);

  const isReady =
    status === "open" ||
    (status === "in_progress" && note.trim() && madeBy) ||
    (status === "solved" && resolution.trim() && solvedBy);

  async function handleSave() {
    if (!isReady) return;
    setSaving(true);
    setError(null);
    try {
      await updateIssue(issue.id, {
        status,
        resolution_note: status === "solved" ? resolution.trim() : issue.resolution_note,
        solved_by:       status === "solved" ? solvedBy : issue.solved_by,
      });
      if (status === "in_progress" && note.trim()) {
        await addIssueUpdate(issue.id, { note: note.trim(), made_by: madeBy });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(u) {
    if (!editText.trim()) return;
    try {
      await editIssueUpdate(issue.id, u.id, editText.trim(), editMadeBy || u.made_by);
      setEditingId(null);
      setEditText("");
      setEditMadeBy("");
      reloadUpdates();
    } catch (err) {
      setError("Could not save edit.");
    }
  }

  async function handleDelete(u) {
    try {
      await deleteIssueUpdate(issue.id, u.id);
      reloadUpdates();
      onSaved();
    } catch (err) {
      setError("Could not delete update.");
    }
  }

  async function reloadUpdates() {
    const data = await getIssueUpdates(issue.id);
    setUpdates(data);
  }

  function renderUpdate(u, idx) {
    const isEditing = editingId === u.id;
    return (
      <div key={u.id ?? idx} style={{
        border: `0.5px solid ${isEditing ? "#378ADD" : "#eee"}`,
        borderRadius: 8, padding: 12, marginBottom: 8,
        background: isEditing ? "#EEF5FC" : "#fafafa",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
            Update {idx + 1}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {u.made_by && (
              <span style={{
                fontSize: 11, background: "#f0f0f0", color: "#555",
                padding: "1px 7px", borderRadius: 8, fontWeight: 500,
              }}>
                {u.made_by}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#888" }}>
              {formatDateTime(u.created_at)}
            </span>
            {!isEditing && (
              <>
                <button onClick={() => { setEditingId(u.id); setEditText(u.note); setEditMadeBy(u.made_by ?? ""); }} style={{
                  padding: "2px 8px", fontSize: 11,
                  border: "1px solid #378ADD", background: "#E6F1FB",
                  color: "#0C447C", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                }}>Edit</button>
                <button onClick={() => handleDelete(u)} style={{
                  padding: "2px 8px", fontSize: 11,
                  border: "1px solid #E24B4A", background: "#FCEBEB",
                  color: "#A32D2D", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                }}>Delete</button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <>
            <select
              value={editMadeBy}
              onChange={e => setEditMadeBy(e.target.value)}
              style={{ ...selectStyle, marginBottom: 6 }}>
              <option value="">Who made this update?</option>
              {supervisorList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={2}
              style={textareaStyle}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={() => handleEditSave(u)} style={{
                padding: "4px 12px", fontSize: 11, border: "none",
                background: "#1D9E75", color: "#fff", borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit",
              }}>Save</button>
              <button onClick={() => { setEditingId(null); setEditText(""); setEditMadeBy(""); }} style={{
                padding: "4px 10px", fontSize: 11,
                border: "0.5px solid #ddd", background: "#fff",
                color: "#888", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#333", lineHeight: 1.5 }}>{u.note}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 24, padding: 24,
      border: "0.5px solid #eee", borderRadius: 12,
      background: "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          Issue #{issue.id} — {issue.category.replace(/_/g, " ")}
        </p>
        <button onClick={onClose} style={{
          background: "none", border: "none", fontSize: 18,
          cursor: "pointer", color: "#aaa", lineHeight: 1,
        }}>✕</button>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
        {issue.foreman_name} &nbsp;·&nbsp; {new Date(issue.created_at + "Z").toLocaleDateString()}
      </p>

      <div style={divider} />

      <p style={sectionLabel}>Status</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { key: "open",        label: "Open" },
          { key: "in_progress", label: "In Progress" },
          { key: "solved",      label: "Solved" },
        ].map(({ key, label }) => {
          const active = status === key;
          const st = STATUS_STYLES[key];
          return (
            <button key={key} onClick={() => setStatus(key)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 8,
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", textAlign: "center",
              border: `1.5px solid ${active ? st.border : "#ddd"}`,
              background: active ? st.bg : "#fff",
              color: active ? st.color : "#999",
              transition: "all .15s",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={divider} />

      {status === "open" && (
        <p style={{ fontSize: 13, color: "#999", fontStyle: "italic", margin: "0 0 16px" }}>
          No further details needed for open issues.
        </p>
      )}

      {status === "in_progress" && (
        <>
          <p style={sectionLabel}>Updates ({updates.length} logged)</p>
          {updates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {[...updates].reverse().map((u, idx) => renderUpdate(u, updates.length - 1 - idx))}
            </div>
          )}
          <div style={{
            border: "0.5px solid #1D9E75", borderRadius: 8,
            padding: 12, background: "#f0faf6", marginBottom: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
                Add update #{updates.length + 1}
              </span>
              <span style={{ fontSize: 11, color: "#1D9E75", fontWeight: 500 }}>Today</span>
            </div>
            <select
              value={madeBy}
              onChange={e => setMadeBy(e.target.value)}
              style={{ ...selectStyle, marginBottom: 8 }}>
              <option value="">Who is making this update?</option>
              {supervisorList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="What is the current status of this issue?"
              style={textareaStyle}
            />
          </div>
        </>
      )}

      {status === "solved" && (
        <>
          {updates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={sectionLabel}>Previous updates</p>
              {[...updates].reverse().map((u, idx) => renderUpdate(u, updates.length - 1 - idx))}
              <div style={divider} />
            </div>
          )}

          <p style={sectionLabel}>Solved by</p>
          <select
            value={solvedBy}
            onChange={e => setSolvedBy(e.target.value)}
            style={{ ...selectStyle, marginBottom: 16 }}>
            <option value="">Who solved this issue?</option>
            {supervisorList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          <p style={sectionLabel}>Resolution note</p>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
            Describe how this issue was resolved.
          </p>
          <textarea
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            rows={3}
            placeholder="e.g. Replaced faulty conveyor belt. Machine back in operation."
            style={textareaStyle}
          />

          {issue.solved_by && status === "solved" && (
            <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0" }}>
              Previously solved by: <span style={{ fontWeight: 500, color: "#555" }}>{issue.solved_by}</span>
            </p>
          )}
        </>
      )}

      {error && (
        <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={handleSave} disabled={!isReady || saving} style={{
          padding: "9px 20px", background: isReady && !saving ? "#1D9E75" : "#ccc",
          border: "none", borderRadius: 8, color: "#fff",
          fontSize: 13, fontWeight: 500, cursor: isReady ? "pointer" : "not-allowed",
          fontFamily: "inherit",
        }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} style={{
          padding: "9px 14px", background: "#fff",
          border: "0.5px solid #ddd", borderRadius: 8,
          fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#666",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const divider       = { height: "0.5px", background: "#eee", margin: "0 0 16px" };
const sectionLabel  = { fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 8px" };
const textareaStyle = {
  width: "100%", padding: "8px 10px", fontSize: 13,
  border: "0.5px solid #ddd", borderRadius: 8,
  fontFamily: "inherit", resize: "none", outline: "none",
  boxSizing: "border-box", background: "#fff",
};
const selectStyle = {
  width: "100%", padding: "7px 10px", fontSize: 12,
  border: "0.5px solid #ddd", borderRadius: 8,
  fontFamily: "inherit", background: "#fff", boxSizing: "border-box",
};