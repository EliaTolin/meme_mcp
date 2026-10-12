const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface LoginPageOptions {
  request: string;
  clientName?: string;
  error?: string;
  username?: string;
}

/** Imgflip sign-in form shown during the OAuth authorization step. No scripts, so CSP can forbid them. */
export function loginPage({ request, clientName, error, username }: LoginPageOptions): string {
  const client = clientName ? `<strong>${escape(clientName)}</strong>` : "An MCP client";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Imgflip</title>
<style>
  :root { --bg:#f6f6f4; --card:#fff; --text:#1d1d1b; --muted:#6b6b66; --line:#e2e2dd; --accent:#1d1d1b; --error:#b42318; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#141413; --card:#1f1f1d; --text:#f2f2ee; --muted:#a3a39c; --line:#33332f; --accent:#f2f2ee; --error:#f97066; }
  }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--text);
         font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width:100%; max-width:420px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px; }
  h1 { font-size:1.35rem; margin:0 0 6px; }
  p { margin:0 0 18px; color:var(--muted); }
  fieldset { border:1px solid var(--line); border-radius:10px; padding:14px 16px 4px; margin:0 0 14px; }
  legend { padding:0 6px; font-weight:600; font-size:.95rem; }
  label { display:block; font-size:.9rem; margin-bottom:12px; }
  input { display:block; width:100%; margin-top:4px; padding:10px 12px; font:inherit; color:var(--text); background:var(--bg);
          border:1px solid var(--line); border-radius:8px; }
  input:focus { outline:2px solid var(--accent); outline-offset:1px; }
  .or { text-align:center; color:var(--muted); font-size:.85rem; margin:-4px 0 10px; }
  button { width:100%; padding:11px; font:inherit; font-weight:600; color:var(--card); background:var(--accent); border:0;
           border-radius:8px; cursor:pointer; }
  .error { color:var(--error); background:color-mix(in srgb, var(--error) 10%, transparent); padding:10px 12px;
           border-radius:8px; margin:0 0 16px; }
  small { display:block; margin-top:16px; color:var(--muted); font-size:.8rem; }
</style>
</head>
<body>
<main>
  <h1>Connect your Imgflip account</h1>
  <p>${client} wants to create memes with your Imgflip account.</p>
  ${error ? `<div class="error" role="alert">${escape(error)}</div>` : ""}
  <form method="post" action="authorize">
    <input type="hidden" name="request" value="${escape(request)}">
    <fieldset>
      <legend>API key (recommended)</legend>
      <label>Imgflip API key<input name="api_key" type="password" autocomplete="off"></label>
    </fieldset>
    <div class="or">or</div>
    <fieldset>
      <legend>Username and password</legend>
      <label>Username<input name="username" autocomplete="username" value="${escape(username ?? "")}"></label>
      <label>Password<input name="password" type="password" autocomplete="current-password"></label>
    </fieldset>
    <button type="submit">Connect</button>
  </form>
  <small>Your credentials are checked with Imgflip and stored only inside your encrypted access token. This server keeps no copy.</small>
</main>
</body>
</html>`;
}

export function errorPage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorization error</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;background:#f6f6f4;color:#1d1d1b}
@media (prefers-color-scheme: dark){body{background:#141413;color:#f2f2ee}}</style></head>
<body><h1>Authorization error</h1><p>${escape(message)}</p></body></html>`;
}
