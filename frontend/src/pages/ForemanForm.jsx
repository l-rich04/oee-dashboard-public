import { Helmet } from "react-helmet-async";
import IssueForm from "../components/IssueForm";

export default function ForemanForm() {
  return (
    <>
      <Helmet><title>Foreman Issue Ticket</title></Helmet>
      <main style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
          Foreman Issue Ticket
        </h1>
        <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
          Fill in the details below. This takes under a minute.
        </p>
        <IssueForm />
      </main>
    </>
  );
}