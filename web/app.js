// Unsilo business UI — uses the existing FastAPI endpoints.
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
const NAMES = {
  gmail: "Gmail",
  drive: "Google Drive",
  whatsapp: "Site conversation",
  whatsapp_summary: "WhatsApp summary",
};
const TONE = {
  sales: "green",
  marketing: "amber",
  other: "slate",
  verification: "violet",
  office: "blue",
  accounts: "amber",
};
const badge = (t, tone = "") => `<span class="badge ${tone}">${esc(t)}</span>`;
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
  } catch {
    throw new Error(
      "Cannot reach Unsilo. Check that the FastAPI server is running.",
    );
  }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.detail || `Request failed (${r.status})`);
  return b;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 5000);
}
const titles = {
  ask: "Ask your operations data",
  sources: "Connect your business data",
  gmail: "Gmail intelligence",
  drive: "Business documents",
  whatsapp: "Site conversations",
  outputs: "Reports & exports",
};
let current = "ask",
  health = null,
  lastAnswer = null;
const loaders = {};
function show(tab) {
  current = tab;
  document
    .querySelectorAll("#tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll("[data-view]")
    .forEach((v) => (v.hidden = v.dataset.view !== tab));
  $("#pageTitle").textContent = titles[tab] || "Unsilo";
  loaders[tab]?.();
}
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) show(b.dataset.tab);
});

async function loadHealth() {
  try {
    health = await api("/api/health");
    $("#status").innerHTML =
      `<span class="status-pill"><i class="live-dot"></i> ${health.google_connected ? "Google connected" : "Google not connected"}</span><span class="status-pill">${health.ai === "gemini" ? "✦ AI enabled" : "Rule-based mode"}</span>`;
    renderSetup();
  } catch {
    $("#status").innerHTML =
      '<span class="status-pill offline">● Backend offline</span>';
  }
}
const SETUP_ICON = {
  gmail: "Gmail",
  drive: "Drive",
  whatsapp: "WhatsApp",
  ai: "AI",
  dates: "Dates",
};
function renderSetup() {
  const items = health?.setup || [];
  $("#setup").innerHTML = items.length
    ? `<div class="card setup"><h3>Connection checklist</h3><ul>${items.map((p) => `<li><b>${esc(SETUP_ICON[p.source] || p.source)}</b> ${esc(p.text)}</li>`).join("")}</ul><p class="muted small">Update your local configuration and restart the backend. Never share credentials in the browser.</p></div>`
    : "";
}

// Ask
const EXAMPLES = [
  "Which excavators are available for rental next week?",
  "Show overdue rental contracts and pending customer follow-ups.",
  "Which machines need maintenance before the next site deployment?",
  "Find the latest quotation for a 20-ton excavator.",
  "What did the site team decide about the crusher delivery?",
  "Which invoices or purchase orders are pending approval?",
];
$("#examples").innerHTML = EXAMPLES.map(
  (q) => `<button type="button" class="chip">${esc(q)}</button>`,
).join("");
$("#examples").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (b) ask(b.textContent);
});
$("#askForm").addEventListener("submit", (e) => {
  e.preventDefault();
  ask($("#q").value);
});

async function ask(q) {
  if (!q.trim()) return;
  $("#q").value = q;
  $("#askBtn").disabled = true;
  $("#askBtn").innerHTML = "Searching…";
  $("#answer").innerHTML =
    '<div class="loading-card"><span class="spinner"></span><div><b>Checking your business records</b><p class="muted small">Searching connected emails, documents and site conversations…</p></div></div>';
  try {
    const a = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question: q }),
    });
    lastAnswer = a;
    const citations = a.citations || [],
      ids = citations.map((c) => c.source_id);
    const answerText = esc(a.answer || "No answer returned.").replace(
      /\[([a-z_]+:[^\]]+)\]/g,
      (m, id) => {
        const n = ids.indexOf(id) + 1;
        return n ? `<sup class="cite">${n}</sup>` : "";
      },
    );
    $("#answer").innerHTML =
      `<article class="answer-card ${a.answerable ? "" : "not-found"}">
      <div class="answer-top"><div><span class="eyebrow">UNSILO RESPONSE</span><h3>${a.answerable ? "Here’s what I found" : "No supported answer found"}</h3></div>${badge(a.answerable ? (a.mode === "ai" ? "AI answer · sourced" : "Relevant records") : "Needs more data", a.answerable ? "green" : "amber")}</div>
      <div class="question-echo">${esc(a.question)}</div><div class="answer-text">${answerText}</div>
      ${citations.length ? `<div class="evidence-title"><span>SUPPORTING RECORDS</span><span>${citations.length} source${citations.length === 1 ? "" : "s"}</span></div><div class="evidence-list">${citations.map((c, i) => `<a class="evidence" ${c.url ? `href="${esc(c.url)}" target="_blank" rel="noreferrer"` : ""}><span class="evidence-num">${String(i + 1).padStart(2, "0")}</span><span class="evidence-main"><b>${esc(c.title || "Untitled record")}</b><small>${esc(NAMES[c.type] || c.type)} ${c.from ? "· " + esc(c.from) : ""} ${c.date ? "· " + esc(when(c.date)) : ""}</small><span>${esc(c.excerpt || "Open the source to review the original record.")}</span></span><span class="external">↗</span></a>`).join("")}</div>` : '<p class="muted small">Try syncing Gmail or Drive, or check that WhatsApp messages are reaching the system.</p>'}
      <div class="answer-actions"><button class="btn primary" id="emailAnswer" ${a.answerable ? "" : "disabled"}>✉ Add to Gmail <span>→</span></button><button class="btn secondary" id="copyAnswer">Copy answer</button><span class="muted small action-note">Opens a Gmail draft for you to review and send.</span></div>
    </article>`;
  } catch (e) {
    lastAnswer = null;
    $("#answer").innerHTML = `<div class="problem">${esc(e.message)}</div>`;
  } finally {
    $("#askBtn").disabled = false;
    $("#askBtn").innerHTML = "Ask Unsilo <span>→</span>";
  }
}
$("#answer").addEventListener("click", (e) => {
  if (e.target.closest("#copyAnswer") && lastAnswer) {
    navigator.clipboard
      ?.writeText(emailBody(lastAnswer))
      .then(() => toast("Answer copied."))
      .catch(() => toast("Could not access clipboard."));
  }
  if (e.target.closest("#emailAnswer") && lastAnswer) {
    const subject = `Unsilo result: ${(lastAnswer.question || "Business query").slice(0, 70)}`;
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1&su=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(emailBody(lastAnswer));
    window.open(url, "_blank", "noopener");
    toast("Gmail draft opened. Review the recipient and content, then send.");
  }
});
function emailBody(a) {
  const c = a.citations || [];
  return `Unsilo business intelligence result\n\nQuestion: ${a.question}\n\nAnswer:\n${a.answer}\n\nSupporting records:\n${c.map((x, i) => `${i + 1}. ${x.title || "Untitled"} (${NAMES[x.type] || x.type})${x.date ? " — " + when(x.date) : ""}${x.url ? "\n   " + x.url : ""}`).join("\n") || "No citations returned."}\n\nGenerated by Unsilo. Please verify the source records before acting.`;
}

// Connections
loaders.sources = async () => {
  await loadHealth();
  if (!health)
    return ($("#sources").innerHTML =
      '<div class="problem">Backend offline.</div>');
  const h = health;
  $("#sources").innerHTML =
    `<div class="section-intro"><span class="eyebrow">DATA CONNECTIONS</span><h2>Your business, connected.</h2><p class="muted">Bring rental enquiries, equipment documents and site updates into one searchable workspace.</p></div>
  <div class="connection-grid">
    <div class="connection-card"><div class="connection-icon gmail-icon">✉</div><div class="connection-head"><h3>Gmail</h3>${badge(h.google_connected ? "Connected" : "Not connected", h.google_connected ? "green" : "amber")}</div><p>Customer enquiries, rental quotations, invoices and supplier correspondence.</p><div class="connection-count"><b>${h.counts.emails}</b><span>emails indexed</span></div>${h.google_connected ? '<button class="btn secondary" data-sync="gmail">Sync Gmail</button>' : h.google_configured ? '<a class="btn primary" href="/api/oauth/google/start">Connect Google →</a>' : '<p class="small warning">Google OAuth needs to be configured on the backend.</p>'}</div>
    <div class="connection-card"><div class="connection-icon drive-icon">▤</div><div class="connection-head"><h3>Google Drive</h3>${badge(h.drive_mode === "none" ? "Not connected" : h.drive_mode === "api_key" ? "Public folder mode" : "Connected", h.drive_mode === "none" ? "amber" : "green")}</div><p>Equipment specifications, rental agreements, work orders, safety files and project reports.</p><div class="connection-count"><b>${h.counts.documents}</b><span>documents indexed</span></div><button class="btn secondary" data-sync="drive">Sync Drive</button></div>
    <div class="connection-card"><div class="connection-icon wa-icon">◉</div><div class="connection-head"><h3>WhatsApp / Site updates</h3>${badge(`${h.selected_groups} groups selected`, "blue")}</div><p>Site coordination, delivery confirmations, breakdown updates and team decisions.</p><div class="connection-count"><b>${h.counts.whatsapp_messages}</b><span>messages received</span></div><button class="btn secondary" id="reanalyse">Re-analyse records</button></div>
  </div><div class="card setup"><h3>Integration setup</h3><p class="muted">Google uses OAuth permissions. WhatsApp messages arrive through the configured webhook and selected group filter. Check backend logs if messages are not appearing.</p></div>`;
};
$("#sources").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  b.disabled = true;
  const old = b.textContent;
  b.textContent = "Working…";
  try {
    if (b.dataset.sync) {
      const r = await api(`/api/sync/${b.dataset.sync}`, { method: "POST" });
      toast(`${NAMES[r.source]}: ${r.imported} records imported and analysed.`);
    } else if (b.id === "reanalyse") {
      const r = await api("/api/analyse", { method: "POST" });
      toast(
        `Analysis complete: ${r.emails} emails, ${r.documents} documents, ${r.groups} groups.`,
      );
    }
  } catch (err) {
    toast("⚠ " + err.message);
  } finally {
    b.disabled = false;
    b.textContent = old;
    loaders.sources();
  }
});

// Gmail
let gmailFilter = "all";
loaders.gmail = async () => {
  try {
    const d = await api("/api/outputs/gmail"),
      pending = new Map(
        (d.unanswered || []).map((u) => [u.message_id, u.days_without_reply]),
      );
    const rows = (d.emails || [])
      .filter(
        (e) =>
          gmailFilter === "all" ||
          (gmailFilter === "unanswered"
            ? pending.has(e.message_id)
            : gmailFilter === "attachments"
              ? e.important_attachment
              : e.classification === gmailFilter),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    $("#gmail").innerHTML =
      `<div class="section-intro"><span class="eyebrow">CUSTOMER & SUPPLIER COMMUNICATION</span><h2>Gmail intelligence</h2><p class="muted">Find rental enquiries, quotations, invoices and follow-ups that need attention.</p></div>
    <div class="metric-row"><div class="metric"><b>${d.emails.length}</b><span>Emails indexed</span></div><div class="metric"><b>${d.unanswered.length}</b><span>Potentially unanswered</span></div><div class="metric"><b>${d.important_attachments.length}</b><span>Important attachments</span></div></div>
    <div class="chips">${["all", "sales", "marketing", "other", "unanswered", "attachments"].map((f) => `<button class="chip ${f === gmailFilter ? "on" : ""}" data-f="${f}">${f === "all" ? "All mail" : f}</button>`).join("")}</div>
    ${!rows.length ? '<div class="empty">No matching emails. Connect Google and sync Gmail.</div>' : rows.map((e) => `<div class="record-card"><div class="record-main"><b>${esc(e.subject)}</b><small>${esc(e.from)} · ${when(e.date)}</small><p>${esc(e.classification_reason || "")}</p>${(e.attachment_flags || []).map((a) => `<p class="warning small">📎 ${esc(a.filename)} · ${esc(a.kind)}</p>`).join("")}</div><div class="record-badges">${badge(e.classification, TONE[e.classification])}${pending.has(e.message_id) ? badge(`${pending.get(e.message_id)}d pending`, "amber") : ""}</div></div>`).join("")}`;
  } catch (e) {
    $("#gmail").innerHTML = `<div class="problem">${esc(e.message)}</div>`;
  }
};
$("#gmail").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (b) {
    gmailFilter = b.dataset.f;
    loaders.gmail();
  }
});

// Drive
loaders.drive = async () => {
  try {
    const d = await api("/api/outputs/drive");
    $("#drive").innerHTML =
      `<div class="section-intro"><span class="eyebrow">OPERATIONAL DOCUMENTS</span><h2>Business documents</h2><p class="muted">Specifications, rental contracts, purchase orders, safety documents and project files.</p></div>
  <div class="metric-row">${["sales", "marketing", "verification", "office", "accounts"].map((c) => `<div class="metric"><b>${d.documents.filter((x) => x.category === c).length}</b><span>${esc(c)}</span></div>`).join("")}</div>
  ${!d.documents.length ? '<div class="empty">No documents indexed yet. Connect and sync Google Drive.</div>' : `<div class="doc-grid">${d.documents.map((x) => `<a class="doc-card" ${x.url ? `href="${esc(x.url)}" target="_blank" rel="noreferrer"` : ""}>${badge(x.category, TONE[x.category])}<h3>${esc(x.name)}</h3><p>${esc(x.reason || "")}</p>${x.extraction_error ? `<small class="warning">Could not extract text: ${esc(x.extraction_error)}</small>` : '<span class="doc-link">Open document ↗</span>'}</a>`).join("")}</div>`}`;
  } catch (e) {
    $("#drive").innerHTML = `<div class="problem">${esc(e.message)}</div>`;
  }
};

// WhatsApp / site conversations
let waActive = null;
loaders.whatsapp = async () => {
  try {
    const groups = await api("/api/whatsapp/groups"),
      g = groups.find((x) => x.group_id === waActive) || groups[0];
    if (!groups.length)
      return ($("#whatsapp").innerHTML =
        '<div class="section-intro"><span class="eyebrow">FIELD COMMUNICATION</span><h2>Site conversations</h2></div><div class="empty">No selected groups or messages available yet. Check the WhatsApp webhook and selected group configuration.</div>');
    waActive = g.group_id;
    const i = g.interpretation || {};
    $("#whatsapp").innerHTML =
      `<div class="section-intro"><span class="eyebrow">FIELD COMMUNICATION</span><h2>Site conversations</h2><p class="muted">Follow delivery updates, equipment breakdowns, approvals and site commitments.</p></div>
    <div class="wa-layout"><aside class="wa-groups">${groups.map((x) => `<button class="wa-group ${x.group_id === g.group_id ? "active" : ""}" data-g="${esc(x.group_id)}"><b>${esc(x.name)}</b><small>${x.messages.length} messages · ${x.participants.length} people</small></button>`).join("")}</aside>
    <div class="wa-content"><div class="card"><div class="answer-top"><div><span class="eyebrow">GROUP OVERVIEW</span><h3>${esc(g.name)}</h3></div>${badge(i.method === "ai" ? "AI summary" : i.method === "rules" ? "Rule-based summary" : "Not analysed", "violet")}</div><p>${esc(i.summary || "No summary available yet.")}</p>${(i.decisions || []).length ? `<h4>Decisions</h4><ul>${i.decisions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${(i.action_items || []).length ? `<h4>Action items</h4><ul>${i.action_items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
    <div class="card"><h3>Recent messages</h3>${
      g.messages
        .slice(-30)
        .reverse()
        .map(
          (m) =>
            `<div class="message"><b>${esc(m.sender_name || m.sender || "Team member")}</b><small>${when(m.timestamp || m.date)}</small><p>${esc(m.text || m.body || "")}</p></div>`,
        )
        .join("") || '<p class="muted">No messages in this group.</p>'
    }</div></div></div>`;
  } catch (e) {
    $("#whatsapp").innerHTML = `<div class="problem">${esc(e.message)}</div>`;
  }
};
$("#whatsapp").addEventListener("click", (e) => {
  const b = e.target.closest("[data-g]");
  if (b) {
    waActive = b.dataset.g;
    loaders.whatsapp();
  }
});

// Outputs
document.querySelectorAll("[data-out]").forEach((b) =>
  b.addEventListener("click", async () => {
    try {
      const d = await api(`/api/outputs/${b.dataset.out}`);
      $("#json").textContent = JSON.stringify(d, null, 2);
      $("#json").hidden = false;
    } catch (e) {
      toast("⚠ " + e.message);
    }
  }),
);
$("#exportBtn").addEventListener("click", async () => {
  const b = $("#exportBtn");
  b.disabled = true;
  b.textContent = "Generating…";
  try {
    const r = await api("/api/export", { method: "POST" });
    toast("Reports generated: " + r.written.join(", "));
  } catch (e) {
    toast("⚠ " + e.message);
  } finally {
    b.disabled = false;
    b.textContent = "Generate reports →";
  }
});
loadHealth();
