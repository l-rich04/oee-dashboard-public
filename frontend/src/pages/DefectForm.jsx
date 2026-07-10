import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { getForemen, getTruckTypes, getDefectTypes, createWorkOrder, addWorkOrderDefect } from "../api/issues";

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split("T")[0];
}

let nextId = 1;

function emptyWORow(id) {
  return { id, work_order_num: "", truck_type_id: "", defect_rows: [{ id: nextId++, defect_type_id: "", quantity: "" }] };
}

function emptyDefectRow() {
  return { id: nextId++, defect_type_id: "", quantity: "" };
}

export default function DefectForm() {
  const [foremen, setForemen]           = useState([]);
  const [truckTypes, setTruckTypes]     = useState([]);
  const [defectTypes, setDefectTypes]   = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [weekStart, setWeekStart]       = useState(getWeekStart());
  const [woRows, setWoRows]             = useState([emptyWORow(nextId++)]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [submitted, setSubmitted]       = useState(false);

  useEffect(() => {
    Promise.all([getForemen(), getTruckTypes(), getDefectTypes()]).then(([f, t, d]) => {
      setForemen(f.map(x => x.name));
      setTruckTypes(t);
      setDefectTypes(d);
    });
  }, []);

  function updateWORow(id, field, value) {
    setWoRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value }));
  }

  function addDefectRow(woId) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: [...r.defect_rows, emptyDefectRow()],
    }));
  }

  function removeDefectRow(woId, defectRowId) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: r.defect_rows.filter(d => d.id !== defectRowId),
    }));
  }

  function updateDefectRow(woId, defectRowId, field, value) {
    setWoRows(prev => prev.map(r => r.id !== woId ? r : {
      ...r, defect_rows: r.defect_rows.map(d => d.id !== defectRowId ? d : { ...d, [field]: value }),
    }));
  }

  function addWORow() {
    setWoRows(prev => [...prev, emptyWORow(nextId++)]);
  }

  function removeWORow(id) {
    if (woRows.length === 1) return;
    setWoRows(prev => prev.filter(r => r.id !== id));
  }

  function calcTotal(defect_rows) {
    return defect_rows.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  }

  function isValidWO(row) {
    return row.work_order_num.length === 6 && row.truck_type_id !== "";
  }

  const validRows           = woRows.filter(isValidWO);
  const readyCount          = validRows.length;
  const totalDefectsPreview = woRows.reduce((sum, r) => sum + calcTotal(r.defect_rows), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (readyCount === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const row of validRows) {
        const total     = calcTotal(row.defect_rows);
        const truckName = truckTypes.find(t => t.id === Number(row.truck_type_id))?.name ?? "n/a";
        const wo = await createWorkOrder({
          work_order_num:  row.work_order_num,
          truck_type:      truckName,
          units_completed: 1,
          total_defects:   total,
          week_start:      weekStart,
        });
        for (const d of row.defect_rows) {
          if (d.defect_type_id && Number(d.quantity) > 0) {
            await addWorkOrderDefect(wo.id, Number(d.defect_type_id), Number(d.quantity));
          }
        }
      }
      setSubmitted(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const s = {
    input: {
      width: "100%", padding: "10px 12px", fontSize: 14,
      border: "1px solid #ddd", borderRadius: 8, outline: "none",
      fontFamily: "inherit", boxSizing: "border-box", background: "#fff",
    },
    label: { display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 },
  };

  if (submitted) {
    return (
      <>
        <Helmet><title>Defect Report</title></Helmet>
        <main style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#E1F5EE", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 28,
          }}>✓</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 500 }}>Report Submitted</h2>
          <p style={{ color: "#666", margin: "0 0 28px", fontSize: 14 }}>
            {readyCount} work order{readyCount !== 1 ? "s" : ""} and {totalDefectsPreview} defect{totalDefectsPreview !== 1 ? "s" : ""} recorded.
          </p>
          <button onClick={() => {
            setWoRows([emptyWORow(nextId++)]);
            setWeekStart(getWeekStart());
            setSubmitted(false);
            setError(null);
          }} style={{
            width: "100%", padding: 13, background: "#1D9E75",
            border: "none", borderRadius: 8, color: "#fff",
            fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            Submit Another Report
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Defect Report</title></Helmet>
      <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Defect Report</h1>
        <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>Report defects found during production.</p>

        {!selectedName ? (
          <div style={{ marginBottom: 28 }}>
            <label style={s.label}>Select your name to get started</label>
            <select value={selectedName} onChange={e => setSelectedName(e.target.value)} style={s.input}>
              <option value="">Select your name…</option>
              {foremen.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, padding: "10px 14px",
              background: "#f0faf6", border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#0F6E56" }}>{selectedName}</span>
              <button onClick={() => setSelectedName("")} style={{
                background: "none", border: "none", fontSize: 12,
                color: "#888", cursor: "pointer", fontFamily: "inherit",
              }}>Change ↩</button>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "10px 14px", background: "#f0faf6",
              border: "0.5px solid #1D9E75", borderRadius: 8,
            }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56", whiteSpace: "nowrap" }}>Week starting</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#888" }}>All entries saved under this week</span>
            </div>

            <form onSubmit={handleSubmit}>
              {woRows.map(row => (
                <div key={row.id} style={{
                  border: "0.5px solid #eee", borderRadius: 10,
                  overflow: "hidden", marginBottom: 12,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: "#fafafa",
                    borderBottom: "0.5px solid #eee",
                  }}>
                    <input
                      type="text" maxLength={6} value={row.work_order_num}
                      onChange={e => updateWORow(row.id, "work_order_num", e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="Work order #"
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <select
                      value={row.truck_type_id}
                      onChange={e => updateWORow(row.id, "truck_type_id", e.target.value)}
                      style={{ ...inputStyle, width: 140 }}>
                      <option value="">Truck type…</option>
                      {truckTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span style={{
                      marginLeft: "auto", fontSize: 11, fontWeight: 500,
                      background: "#E6F1FB", color: "#0C447C",
                      padding: "2px 8px", borderRadius: 8,
                    }}>
                      {calcTotal(row.defect_rows)} defects
                    </span>
                    {woRows.length > 1 && (
                      <button type="button" onClick={() => removeWORow(row.id)} style={{
                        background: "none", border: "none", fontSize: 16,
                        cursor: "pointer", color: "#aaa", lineHeight: 1,
                      }}>✕</button>
                    )}
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11 }}>Defect type</th>
                        <th style={{ padding: "6px 14px", fontWeight: 500, color: "#555", textAlign: "left", fontSize: 11, width: 90 }}>Quantity</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.defect_rows.map(dr => (
                        <tr key={dr.id} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                          <td style={{ padding: "6px 14px" }}>
                            <select
                              value={dr.defect_type_id}
                              onChange={e => updateDefectRow(row.id, dr.id, "defect_type_id", e.target.value)}
                              style={{ ...inputStyle, width: "100%" }}>
                              <option value="">Select defect type…</option>
                              {defectTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            <input
                              type="number" min="0" value={dr.quantity}
                              onChange={e => updateDefectRow(row.id, dr.id, "quantity", e.target.value)}
                              placeholder="0"
                              style={{ ...inputStyle, width: 70 }}
                            />
                          </td>
                          <td style={{ padding: "6px 14px" }}>
                            {row.defect_rows.length > 1 && (
                              <button type="button" onClick={() => removeDefectRow(row.id, dr.id)} style={{
                                background: "none", border: "none", fontSize: 14,
                                cursor: "pointer", color: "#aaa",
                              }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={() => addDefectRow(row.id)} style={{
                    margin: "8px 14px", padding: "4px 10px", fontSize: 11,
                    border: "0.5px dashed #ddd", borderRadius: 6,
                    background: "transparent", color: "#888",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    + add defect type
                  </button>
                </div>
              ))}

              <button type="button" onClick={addWORow} style={{
                width: "100%", padding: "8px", fontSize: 12,
                border: "0.5px dashed #ddd", borderRadius: 8,
                background: "transparent", color: "#888",
                cursor: "pointer", fontFamily: "inherit", marginBottom: 16,
              }}>
                + add another work order
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "0.5px solid #eee" }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  {readyCount === 0 ? "Complete work order # and truck type to submit" : `${readyCount} work order${readyCount !== 1 ? "s" : ""} · ${totalDefectsPreview} defects`}
                </span>
                <button type="submit" disabled={readyCount === 0 || saving} style={{
                  padding: "8px 20px",
                  background: readyCount > 0 && !saving ? "#1D9E75" : "#ccc",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  cursor: readyCount > 0 ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}>
                  {saving ? "Submitting…" : `Submit ${readyCount > 0 ? readyCount : ""} Work Order${readyCount !== 1 ? "s" : ""}`}
                </button>
              </div>
              {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
            </form>
          </>
        )}
      </main>
    </>
  );
}

const inputStyle = { padding: "6px 8px", fontSize: 12, border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" };