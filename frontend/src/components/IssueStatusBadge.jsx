const COLORS = {
  open:        { background: "#FCEBEB", color: "#A32D2D" },
  in_progress: { background: "#FAEEDA", color: "#854F0B" },
  solved:      { background: "#E1F5EE", color: "#0F6E56" },
};

const LABELS = {
  open:        "Open",
  in_progress: "In Progress",
  solved:      "Solved",
};

export default function IssueStatusBadge({ status }) {
  const style = COLORS[status] ?? COLORS.open;
  return (
    <span style={{
      ...style,
      padding: "3px 10px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 500,
    }}>
      {LABELS[status] ?? status}
    </span>
  );
}