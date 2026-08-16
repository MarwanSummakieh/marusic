// Shared script for login.html and invite.html (kept external so the CSP can
// stay script-src 'self' with no 'unsafe-inline').
"use strict";

const err = document.getElementById("err");

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return res;
}

// Don't leave until the session cookie is actually live (some browsers commit
// Set-Cookie a beat after the fetch resolves — same trick as animeMarwan).
async function enterApp() {
  for (let i = 0; i < 15; i++) {
    const me = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (me.ok) { location.replace("/"); return; }
    await new Promise((r) => setTimeout(r, 200));
  }
  location.replace("/");
}

/* ---- login page ---- */
const loginForm = document.getElementById("login-form");
if (loginForm) {
  const btn = loginForm.querySelector("button");
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    btn.disabled = true;
    try {
      const res = await post("/api/login", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        err.textContent = j.error || "Invalid credentials";
        btn.disabled = false;
        return;
      }
      await enterApp();
    } catch {
      err.textContent = "Network error — please try again.";
      btn.disabled = false;
    }
  });
}

/* ---- invite page ---- */
const inviteForm = document.getElementById("invite-form");
if (inviteForm) {
  const hello = document.getElementById("invite-hello");
  const token = new URLSearchParams(location.search).get("token") || "";

  (async () => {
    const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) {
      hello.textContent = "This invite link is invalid or has already been used.";
      return;
    }
    const inv = await res.json();
    hello.textContent = `Hi ${inv.name}! Set a password for ${inv.email}.`;
    inviteForm.classList.remove("hidden");
  })();

  const btn = inviteForm.querySelector("button");
  inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    btn.disabled = true;
    try {
      const res = await post(`/api/invite/${encodeURIComponent(token)}`, {
        password: document.getElementById("password").value,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        err.textContent = j.error || "Could not create the account.";
        btn.disabled = false;
        return;
      }
      await enterApp();
    } catch {
      err.textContent = "Network error — please try again.";
      btn.disabled = false;
    }
  });
}
