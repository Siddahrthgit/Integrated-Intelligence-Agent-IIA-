'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

type Quiz = {
  id: string;
  title: string;
  description?: string;
  questionCount?: number;
  createdAt?: string;
};

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadQuizzes = async () => {
      try {
        const token = window.sessionStorage.getItem("iia_token") || "";
        const response = await fetch("/api/quiz", {
          cache: "no-store",
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload?.message || "Could not load quizzes.");
        }
        const items = Array.isArray(payload) ? payload : Array.isArray(payload?.quizzes) ? payload.quizzes : [];
        if (active) {
          setQuizzes(items.filter((item: unknown): item is Quiz =>
            Boolean(item) && typeof item === "object" &&
            typeof (item as Quiz).id === "string" &&
            typeof (item as Quiz).title === "string"
          ));
          setError("");
        }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Could not load quizzes.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQuizzes();
    return () => { active = false; };
  }, []);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24, maxWidth: 960, margin: "0 auto", color: "#172033" }}>
      <p><Link href="/">← Back to IIA</Link></p>
      <h1>Study dashboard</h1>
      <p>Browse the public sample quiz. Sign in to also see quizzes generated from your own uploaded PDFs.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        <Link href="/quiz/quiz_1" style={{ display: "inline-block", padding: "10px 14px", borderRadius: 8, background: "#172033", color: "#fff", textDecoration: "none" }}>
          Start sample quiz
        </Link>
        <Link href="/" style={{ display: "inline-block", padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", color: "#172033", textDecoration: "none" }}>
          Upload PDF / chat with IIA
        </Link>
      </div>
      {loading ? <p role="status">Loading quizzes…</p> : null}
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {!loading && !error && quizzes.length === 0 ? <p>No quizzes found yet. Open IIA and upload a PDF to generate your first quiz.</p> : null}
      <section aria-label="Available quizzes" style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {quizzes.map((quiz) => (
          <article key={quiz.id} style={{ border: "1px solid #dbe2ea", borderRadius: 12, padding: 18 }}>
            <h2 style={{ margin: "0 0 8px" }}>{quiz.title}</h2>
            <p style={{ margin: "0 0 12px", color: "#526071" }}>{quiz.description || "Practice quiz"}</p>
            <p style={{ fontSize: 14, color: "#526071" }}>{quiz.questionCount ?? 0} questions{quiz.createdAt ? ` · Created ${new Date(quiz.createdAt).toLocaleDateString()}` : ""}</p>
            <Link href={`/quiz/${encodeURIComponent(quiz.id)}`}>Open quiz →</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
