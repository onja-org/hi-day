<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>URL Tracking Implementation Plan — Extension-Free</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{--ground:#ECF0EF;--surface:#FAFBFB;--surface-2:#E1E8E7;--ink:#14201F;--ink-2:#4A5A59;
--ink-3:#6E8180;--rule:#C9D5D4;--rule-soft:#DCE4E3;--accent:#185E63;--accent-soft:#D5E5E5;
--shadow:0 1px 2px rgba(20,32,31,.05),0 8px 24px -16px rgba(20,32,31,.18);
--display:"Archivo","Helvetica Neue",Arial,sans-serif;
--body:"Source Serif 4",Georgia,"Times New Roman",serif;
--mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;--measure:70ch}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
--ground:#0F1514;--surface:#171F1E;--surface-2:#1E2A29;--ink:#DFE7E6;--ink-2:#A2B2B0;
--ink-3:#7D8F8D;--rule:#2B3837;--rule-soft:#222E2D;--accent:#61B5BA;--accent-soft:#1A3335;
--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px -18px rgba(0,0,0,.6)}}
:root[data-theme="dark"]{--ground:#0F1514;--surface:#171F1E;--surface-2:#1E2A29;--ink:#DFE7E6;
--ink-2:#A2B2B0;--ink-3:#7D8F8D;--rule:#2B3837;--rule-soft:#222E2D;--accent:#61B5BA;
--accent-soft:#1A3335;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px -18px rgba(0,0,0,.6)}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:var(--body);font-size:17px;
line-height:1.65;-webkit-font-smoothing:antialiased;margin:0}
main{max-width:1010px;margin:0 auto;padding:52px 28px 96px}
h1{font-family:var(--display);font-weight:700;font-size:clamp(2rem,5vw,2.9rem);line-height:1.06;
letter-spacing:-.022em;text-wrap:balance;margin:0 0 22px;max-width:26ch;
padding-bottom:22px;border-bottom:2px solid var(--ink)}
h2{font-family:var(--display);font-weight:600;font-size:1.5rem;letter-spacing:-.015em;
line-height:1.18;text-wrap:balance;margin:52px 0 18px;padding-bottom:11px;
border-bottom:1px solid var(--rule)}
h3{font-family:var(--display);font-weight:600;font-size:1.12rem;letter-spacing:-.005em;
margin:34px 0 10px;text-wrap:balance}
h4{font-family:var(--mono);font-weight:600;font-size:.74rem;letter-spacing:.1em;
text-transform:uppercase;color:var(--ink-3);margin:26px 0 8px}
p,ul,ol,blockquote{max-width:var(--measure)}
p{margin:0 0 14px}
ul,ol{margin:0 0 16px;padding-left:1.3em}
li{margin-bottom:7px}
li::marker{color:var(--ink-3)}
strong{font-weight:600}
a{color:var(--accent);text-underline-offset:2px}
code{font-family:var(--mono);font-size:.85em;background:var(--surface-2);padding:.1em .34em;
border-radius:3px;word-break:break-word}
pre{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);
padding:15px 17px;overflow-x:auto;box-shadow:var(--shadow);margin:20px 0;max-width:none}
pre code{background:none;padding:0;font-size:.8rem;line-height:1.55}
blockquote{margin:22px 0;padding:14px 18px;background:var(--surface);
border-left:3px solid var(--accent);box-shadow:var(--shadow)}
blockquote p:last-child{margin-bottom:0}
table{border-collapse:collapse;width:100%;min-width:640px;font-size:.92rem;
font-variant-numeric:tabular-nums}
.tw{overflow-x:auto;margin:24px 0;border:1px solid var(--rule);background:var(--surface);
box-shadow:var(--shadow)}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--rule-soft);
vertical-align:top}
thead th{font-family:var(--mono);font-size:.67rem;font-weight:600;letter-spacing:.09em;
text-transform:uppercase;color:var(--ink-3);background:var(--surface-2);
border-bottom:1px solid var(--rule);white-space:nowrap}
tbody tr:last-child td,tbody tr:last-child th{border-bottom:0}
hr{border:0;border-top:2px solid var(--ink);margin:52px 0 0}
em{font-style:italic}
h1+p em,hr+p em{color:var(--ink-3)}
@media(max-width:620px){body{font-size:16px}main{padding:32px 18px 72px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head><body><main>
<h1>7.3 Website (URL) Tracking — Extension-Free Implementation Plan</h1>
<p><strong>Onja desktop agent · Electron + native side-cars · v2, supersedes v1</strong></p>
<p>Scope: full URL and website tracking on <strong>Windows, macOS and Linux</strong>, across all mainstream browsers, with <strong>no browser add-on of any kind</strong>. Windows capture is written in C#. This is the same architecture Hubstaff ships — their Chrome extension is only a timer, and their docs state plainly that URL tracking is desktop-app only.</p>
<hr />
<h2>7.3.0 Two corrections to what I told you earlier</h2>
<p><strong>Correction 1 — SPA tracking is not lost. It's a sampling-resolution problem, not blindness.</strong></p>
<p>I previously said a whole morning in Gmail would collapse into one session without an extension. That was wrong, and it matters because it was the main argument against going extension-free.</p>
<p>When a single-page app navigates via <code>history.pushState</code>, <strong>the browser's address bar updates</strong>. So <code>URL of active tab</code> over Apple Events, and the omnibox value over UIA or AT-SPI2, both return the <em>new</em> URL. You do not need navigation events to see SPA route changes — you need to <strong>re-read on a heartbeat</strong>.</p>
<p>With a 5-second heartbeat while a browser is focused, you catch SPA navigation at 5-second granularity. What you actually lose is:</p>
<ul>
<li>Sub-heartbeat visits — three pages clicked through in four seconds collapse into one or two rows.</li>
<li>Exact navigation timestamps — session boundaries are heartbeat-quantized, not millisecond-accurate.</li>
<li>Background and non-focused tab activity — which you almost certainly do not want for time attribution anyway.</li>
</ul>
<p>That is a resolution cost, not a capability gap, and for time tracking a 5-second resolution is well below the noise floor of what anyone reports on. <strong>This is the single most important reason extension-free is viable for you.</strong></p>
<p>Heartbeat cost is affordable: one targeted UIA read is roughly 10–50 ms, one <code>osascript</code> call is a process spawn but only every few seconds, and both run only while a browser is actually the focused app.</p>
<p><strong>Correction 2 — Linux is achievable, on GNOME.</strong></p>
<p>I said Wayland made native tracking impossible. Wayland does remove the X11 route, but GNOME exposes <code>org.gnome.Shell.Introspect</code> over D-Bus, and browser accessibility rides AT-SPI2 over D-Bus rather than the display server. Hubstaff's own requirement is the honest version of this: <em>"We only support GNOME display manager for Wayland and all display managers on Xorg."</em></p>
<h3>What extension-free genuinely costs you</h3>
<div class="tw"><table>
<thead>
<tr>
<th></th>
<th>Impact</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Exact URLs on Windows &amp; Linux</strong></td>
<td>You read the <em>rendered</em> address bar — no scheme, sometimes no <code>www.</code>, occasional half-typed queries. Needs a normalization pipeline (Step 21) and honest confidence labelling.</td>
</tr>
<tr>
<td><strong>Firefox on macOS</strong></td>
<td>No AppleScript URL support. Requires the Accessibility permission — a second, heavier prompt.</td>
</tr>
<tr>
<td><strong>Private-mode detection</strong></td>
<td>Reliable on some browsers, heuristic on others, absent on Safari. Needs an explicit policy (Step 23).</td>
</tr>
<tr>
<td><strong>Temporal resolution</strong></td>
<td>Heartbeat-quantized, as above.</td>
</tr>
</tbody>
</table></div>
<h3>What it buys you</h3>
<p>No install friction. No store review cycles. No permanent extension ID blocking your installer. No per-browser add-on to maintain across four engines. It removes the single hardest problem from the v1 plan — <em>getting an extension installed and keeping it installed on unmanaged machines</em>.</p>
<hr />
<h2>7.3.1 Architecture</h2>
<pre><code>Electron main process
  timer state · session engine · SQLite · sync · permission state · coverage UI
        │
        │  spawn once, JSON-lines over stdin/stdout, restart on watchdog failure
        │
        ├── win-resolver.exe        C# / .NET     SetWinEventHook + UI Automation
        ├── mac-resolver            osascript + small Swift helper
        └── linux-resolver          Python or C   GNOME Introspect + AT-SPI2
</code></pre>
<p>Electron never calls a platform API. It spawns a child process, writes a request line, reads a response line. Three rules make this hold up:</p>
<ol>
<li><strong>Side-car, never a native Node addon.</strong> UIA hangs — routinely, on browser start and shutdown. An in-process addon that wedges takes the whole agent down. A child process you can time out, kill and respawn.</li>
<li><strong>One protocol, three interchangeable implementations.</strong> Each resolver is built and tested independently, and the session engine never learns which platform it's on.</li>
<li><strong>The session engine stays pure.</strong> No I/O, no platform code, fully unit-tested. It is where your bugs will live.</li>
</ol>
<hr />
<h1>The steps</h1>
<p>Eight stages, 31 steps. Stage A is platform-free and must come first; B, C and D are independent of each other and can run in parallel if you have the people.</p>
<h2>Stage A — Foundations <em>(2–3 weeks)</em></h2>
<p>Everything here is testable without a single platform API, and it is where most of your eventual bugs get caught cheaply.</p>
<h3>Step 1 — Define the resolver protocol</h3>
<p>Write this before any capture code. It is the highest-value hour in the project.</p>
<pre><code class="language-jsonc">// → request (agent writes to side-car stdin, one JSON object per line)
{ &quot;id&quot;: 41, &quot;op&quot;: &quot;resolve&quot;, &quot;pid&quot;: 8123, &quot;hwnd&quot;: 197426 }
{ &quot;id&quot;: 42, &quot;op&quot;: &quot;ping&quot; }

// ← response (side-car writes to stdout)
{ &quot;id&quot;: 41, &quot;ok&quot;: true,
  &quot;url&quot;: &quot;github.com/onja/agent/issues/42&quot;,
  &quot;title&quot;: &quot;Issue #42&quot;,
  &quot;browser&quot;: &quot;chrome&quot;,
  &quot;private&quot;: false,          // true | false | null (= unknown)
  &quot;source&quot;: &quot;uia&quot;,           // apple-events | ax | uia | atspi | title
  &quot;confidence&quot;: &quot;displayed&quot;, // exact | displayed | guess
  &quot;ms&quot;: 34 }

// ← unsolicited focus event (side-car pushes these)
{ &quot;ev&quot;: &quot;focus&quot;, &quot;pid&quot;: 8123, &quot;hwnd&quot;: 197426,
  &quot;app&quot;: &quot;chrome.exe&quot;, &quot;title&quot;: &quot;Issue #42 · onja/agent&quot;, &quot;ts&quot;: 1757308800123 }

// ← health
{ &quot;ev&quot;: &quot;ready&quot;, &quot;platform&quot;: &quot;win32&quot;, &quot;caps&quot;: [&quot;focus&quot;,&quot;url&quot;,&quot;private&quot;] }
{ &quot;ev&quot;: &quot;error&quot;, &quot;code&quot;: &quot;uia_timeout&quot;, &quot;detail&quot;: &quot;...&quot; }
</code></pre>
<p><code>source</code> and <code>confidence</code> travel with <strong>every</strong> reading, from the first line of code. Adding them later is a migration across every row you will ever have written.</p>
<p><strong>Done when:</strong> a mock resolver that replays a scripted JSON file drives the whole agent end to end.</p>
<h3>Step 2 — Build the browser registry as <em>data</em>, not code</h3>
<p>Browsers ship updates that break element paths and AppleScript dictionaries. Put the knowledge in a JSON table you can update remotely without shipping a binary.</p>
<pre><code class="language-jsonc">{
  &quot;chrome&quot;: {
    &quot;match&quot;: { &quot;darwin&quot;: &quot;com.google.Chrome&quot;, &quot;win32&quot;: &quot;chrome.exe&quot;, &quot;linux&quot;: &quot;google-chrome&quot; },
    &quot;family&quot;: &quot;chromium&quot;,
    &quot;strategy&quot;: { &quot;darwin&quot;: &quot;apple-events&quot;, &quot;win32&quot;: &quot;uia-omnibox&quot;, &quot;linux&quot;: &quot;atspi-omnibox&quot; },
    &quot;privateDetect&quot;: &quot;chromium-window-mode&quot;
  },
  &quot;firefox&quot;: {
    &quot;match&quot;: { &quot;darwin&quot;: &quot;org.mozilla.firefox&quot;, &quot;win32&quot;: &quot;firefox.exe&quot;, &quot;linux&quot;: &quot;firefox&quot; },
    &quot;family&quot;: &quot;gecko&quot;,
    &quot;strategy&quot;: { &quot;darwin&quot;: &quot;ax-omnibox&quot;, &quot;win32&quot;: &quot;uia-omnibox&quot;, &quot;linux&quot;: &quot;atspi-omnibox&quot; },
    &quot;privateDetect&quot;: &quot;firefox-title-marker&quot;
  },
  &quot;safari&quot;: { &quot;…&quot;: &quot;…&quot;, &quot;strategy&quot;: { &quot;darwin&quot;: &quot;apple-events-safari&quot; }, &quot;privateDetect&quot;: &quot;none&quot; }
}
</code></pre>
<p>Cover at minimum: Chrome, Edge, Firefox, Safari, Brave, Opera, Vivaldi, Arc, plus a <code>chromium-generic</code> fallback. <strong>All Chromium browsers share one AppleScript dictionary</strong>, so a single parameterized script covers Chrome, Edge, Brave, Vivaldi and Opera on macOS — genuinely one implementation for five browsers.</p>
<p><strong>Done when:</strong> adding a new browser is a JSON edit, not a code change.</p>
<h3>Step 3 — Build the session engine</h3>
<p>Pure, synchronous, no I/O, exhaustively unit-tested.</p>
<pre><code>UrlSession { id, url, host, path, title, browser, private,
             deviceId, startedAt, endedAt, activeMs, source, confidence }
</code></pre>
<ul>
<li><strong>Opens</strong> when focus lands on a browser window, or the normalized URL in the focused browser changes.</li>
<li><strong>Closes</strong> on focus leaving, URL change, idle threshold crossed, screen lock, sleep, timer stop, agent quit, or the local day boundary.</li>
<li><strong><code>activeMs</code> accumulates only while</strong> timer running <strong>and</strong> window focused <strong>and</strong> user not idle <strong>and</strong> machine awake. All four, every tick.</li>
<li><strong>Merge window:</strong> same URL within <em>N</em> seconds re-opens the previous session rather than creating a new row, or an alt-tab-heavy afternoon produces thousands of two-second rows.</li>
<li><strong>Minimum floor:</strong> drop or bucket sessions under 1–3 s. State the number in the spec.</li>
<li><strong>Clock discipline:</strong> monotonic time for durations, wall clock for timestamps, record the timezone offset. Flag any session whose duration exceeds the wall-clock delta.</li>
</ul>
<p><strong>Done when:</strong> the engine has table-driven tests for every transition, including sleep-during-session and clock-jump-backwards.</p>
<h3>Step 4 — Wire idle, lock and sleep via Electron</h3>
<p>You need no native code for this. Electron's <code>powerMonitor</code> covers all three OSes:</p>
<ul>
<li><code>powerMonitor.getSystemIdleTime()</code> — seconds since last input.</li>
<li>Events: <code>suspend</code>, <code>resume</code>, <code>lock-screen</code>, <code>unlock-screen</code>, <code>shutdown</code>.</li>
</ul>
<p>Make the idle threshold configurable (60–180 s is the usual range) and close the open session when it trips.</p>
<h3>Step 5 — Local store and sync contract</h3>
<p>SQLite via <code>better-sqlite3</code> as a durable queue. Batched upload, idempotent on the client-generated session id so retries cannot double-count. Server clamps every session to the tracked-time window. Include <code>source</code> and <code>confidence</code> in the <strong>first</strong> migration.</p>
<p>Retention and purge enforced locally as well as server-side, so an uninstall does not leave a year of browsing history on disk.</p>
<h3>Step 6 — Build the instrumentation harness</h3>
<p>Before any real resolver, add a debug mode that appends every reading to a local JSONL file: raw value, normalized value, source, confidence, latency, and the decision the engine made. You will use this constantly for the next three months, and on customer machines during support.</p>
<hr />
<h2>Stage B — macOS resolver <em>(1–2 weeks)</em></h2>
<p>Do this platform first. It has the best data quality, the least code, and it forces the signing and permission work that fails silently on customer machines and never on yours.</p>
<h3>Step 7 — Focus detection</h3>
<p>Simplest: poll <code>get-windows</code> every 1–2 s from the main process — it gives app, bundle id, title and window bounds. If you want push instead of poll, a small Swift helper subscribing to <code>NSWorkspace.didActivateApplicationNotification</code> is ~30 lines.</p>
<p>Note <code>get-windows</code> needs <strong>Screen Recording</strong> permission for window <em>titles</em> on macOS, and it does not support Wayland (irrelevant here).</p>
<h3>Step 8 — Apple Events for Safari and the Chromium family</h3>
<p>The core of macOS capture. One parameterized script per family:</p>
<pre><code class="language-applescript">-- Chromium family: Chrome, Edge, Brave, Vivaldi, Opera
tell application &quot;Google Chrome&quot;
  set w to front window
  return (URL of active tab of w) &amp; tab &quot;|&quot; &amp; (title of active tab of w) &amp; tab &quot;|&quot; &amp; (mode of w)
end tell

-- Safari has its own dictionary
tell application &quot;Safari&quot;
  return (URL of current tab of front window) &amp; tab &quot;|&quot; &amp; (name of current tab of front window)
end tell
</code></pre>
<p>You get the <strong>real, complete URL</strong> — scheme, host, path, query. <code>confidence: "exact"</code>.</p>
<p>Chromium's <code>mode of window</code> returns <code>"normal"</code> or <code>"incognito"</code>, which is your private-mode signal for five browsers at once. Safari exposes no equivalent — see Step 23.</p>
<p><strong>Never launch the browser.</strong> Guard every call so it only runs against an already-running, frontmost app, or AppleScript will start Safari for you.</p>
<h3>Step 9 — Heartbeat re-read</h3>
<p>While a browser is the focused app, re-resolve every ~5 s. Stop the heartbeat the moment focus leaves. This is what recovers SPA navigation (see §7.3.0) and it is the difference between usable and useless data on sites like Jira and Notion.</p>
<p>Each <code>osascript</code> invocation spawns a process, so at 5 s intervals it is fine and at 1 s intervals it is not. Consider a long-lived Swift helper instead of repeated <code>osascript</code> shell-outs if profiling shows it matters.</p>
<h3>Step 10 — Swift AX helper for Firefox</h3>
<p>Firefox ships no AppleScript URL support — Mozilla bugs 369901 and 516502 have been open for years. The only native path is the Accessibility API: <code>AXUIElementCopyAttributeValue</code>, walking to the toolbar's text field and reading <code>AXValue</code>.</p>
<p>This yields a <em>displayed</em> string, not an exact URL, so mark it <code>source: "ax", confidence: "displayed"</code> and run it through Step 21. It also requires the <strong>Accessibility</strong> permission, which is a scarier prompt than Automation — so make Firefox support conditional on the user granting it, and degrade to title-only if they decline.</p>
<h3>Step 11 — Permissions, entitlements and Info.plist</h3>
<ul>
<li><code>NSAppleEventsUsageDescription</code> in Info.plist — plain-language, it is shown in the prompt.</li>
<li>Entitlement <code>com.apple.security.automation.apple-events</code> under hardened runtime.</li>
<li>Note this entitlement is <strong>not accepted for Mac App Store distribution</strong> — plan on direct notarized distribution.</li>
<li>Consent is granted <strong>per (your app, target browser) pair</strong>. Detect which browsers are installed and trigger the prompts proactively during onboarding, rather than surprising the user mid-session.</li>
<li>A permanent <em>Don't Allow</em> is only undoable in System Settings. Deep-link there with <code>x-apple.systempreferences:com.apple.preference.security?Privacy_Automation</code>.</li>
<li>Re-signing or moving the <code>.app</code> <strong>resets all of it</strong>. Expect this during development and do not mistake it for a bug.</li>
</ul>
<p><strong>Done when:</strong> a fresh, notarized build on a clean macOS user account walks through the prompts and reports exact URLs for Safari, Chrome and Edge.</p>
<hr />
<h2>Stage C — Windows resolver in C# <em>(2–3 weeks)</em></h2>
<p>The largest chunk of native code in the project. Two jobs, and conflating them is the classic mistake.</p>
<h3>Step 12 — Side-car skeleton</h3>
<p>A console app: read lines from stdin, dispatch, write lines to stdout, log to stderr. Never write anything but protocol JSON to stdout. Respond to <code>ping</code> immediately on a thread that cannot be blocked by UIA work.</p>
<h3>Step 13 — Focus detection via Win32, not UIA</h3>
<pre><code class="language-csharp">SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND,
                IntPtr.Zero, callback, 0, 0, WINEVENT_OUTOFCONTEXT);
</code></pre>
<p>Event-driven, near-free, and reliable. <strong>Do not poll for the foreground window, and do not use UIA's own focus events</strong> — they are slow and leak. Add <code>EVENT_OBJECT_NAMECHANGE</code> filtered to the focused window if you want faster-than-heartbeat title changes.</p>
<h3>Step 14 — Read the address bar with UIA</h3>
<pre><code class="language-csharp">// FlaUI wraps UIA3 sanely; raw UIAutomationClient COM also works and is faster
var window = automation.FromHandle(hwnd);
var edit   = window.FindFirstDescendant(cf =&gt; cf.ByControlType(ControlType.Edit));
var raw    = edit?.Patterns.Value.PatternOrDefault?.Value;
</code></pre>
<p>That is the idea. What makes it production code is the discipline around it:</p>
<ul>
<li><strong>Never match on English names.</strong> Chrome's omnibox <code>Name</code> is "Address and search bar" in English and something else in French or Malagasy. Match on <code>ControlType.Edit</code> plus position in the toolbar subtree.</li>
<li><strong>Do not walk the full tree.</strong> <code>FindFirstDescendant</code> from the window root is slow enough to notice. Narrow the scope to the toolbar, and use a <strong>cache request</strong> so you fetch value, focus state and control type in one cross-process round trip instead of three.</li>
<li><strong>Run UIA on a dedicated MTA thread.</strong> Never the process main thread.</li>
<li><strong>Reject readings while the omnibox has keyboard focus</strong> — check <code>HasKeyboardFocus</code> in the same cache request. This single check eliminates most half-typed-search-query garbage.</li>
<li><strong>Timeouts are your responsibility.</strong> UIA provides none. Do the read on a worker with a hard ~250 ms deadline and abandon it past that.</li>
<li><strong>Never cache elements across calls.</strong> Browser UI trees get rebuilt; stale elements throw.</li>
</ul>
<p><strong>The side effect to disclose internally:</strong> Chromium keeps its accessibility tree off by default and builds it on demand. Querying it switches full accessibility on for that browser process, raising its memory and CPU. Some users will notice and blame your agent. Firefox additionally needs its accessibility service not force-disabled (<code>accessibility.force_disabled</code>), which plenty of users have set on the advice of "speed up Firefox" articles.</p>
<p><strong>One real advantage over macOS:</strong> Windows requires <strong>no user consent</strong> for UIA. Nothing to prompt, nothing to grant. The exception is integrity level — a browser running elevated is invisible to a non-elevated agent. Detect and report that rather than silently returning nothing.</p>
<h3>Step 15 — Per-browser element strategies</h3>
<p>Chromium, Gecko and Edge expose slightly different toolbar structures, and they change between versions. Drive the search from the Step 2 registry, and always keep a generic fallback: <em>first <code>Edit</code> descendant that does not have keyboard focus and whose value normalizes to a valid host.</em></p>
<h3>Step 16 — Watchdog</h3>
<ul>
<li>Side-car answers <code>ping</code> every 5 s. Two misses and Electron kills and respawns it.</li>
<li>Exponential backoff on repeated crashes; after N failures, disable UIA capture for the session and fall back to title-only, reporting the degradation to the coverage screen.</li>
<li>A remote kill switch for the whole UIA path. You will want this the first time a browser update makes it hang on a specific version.</li>
</ul>
<h3>Step 17 — Packaging</h3>
<p>Compile to a <strong>single self-contained executable</strong>. Try NativeAOT first — no runtime for users to install, a few MB, fast startup.</p>
<p><strong>Verify this in week one, not at packaging time:</strong> FlaUI's dynamic COM interop may not be NativeAOT-compatible. If it isn't, either drop to source-generated COM interop (CsWin32), which is AOT-safe, or ship self-contained trimmed at roughly 25–40 MB. A one-hour spike settles it.</p>
<p>Ship via <code>extraResources</code> in electron-builder, and <strong>sign the side-car binary too</strong> — an unsigned child <code>.exe</code> beside a signed app is exactly what EDR flags.</p>
<hr />
<h2>Stage D — Linux resolver <em>(1–2 weeks, optional for v1)</em></h2>
<h3>Step 18 — Focus detection</h3>
<ul>
<li><strong>Xorg:</strong> <code>_NET_ACTIVE_WINDOW</code> plus <code>WM_NAME</code>. Works under any window manager.</li>
<li><strong>GNOME on Wayland:</strong> <code>org.gnome.Shell.Introspect</code> over D-Bus.</li>
</ul>
<pre><code class="language-bash">gdbus call --session --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Introspect \
  --method org.gnome.Shell.Introspect.GetWindows
</code></pre>
<p><code>GetWindows</code> returns the window list with app id, title and which one has focus. <strong>Spike this first</strong> — it is a semi-private API and its availability varies by GNOME version.</p>
<h3>Step 19 — URL via AT-SPI2</h3>
<p>The Linux analogue of UIA. It rides D-Bus, not the display server, so it works under Wayland. Both Firefox and Chromium expose their trees through ATK. <code>pyatspi</code> gets you there in about 40 lines; find the frontmost browser's frame, locate the <code>ENTRY</code> role in the toolbar, read its text.</p>
<p>The accessibility bus must be running, and toolkit accessibility may need enabling:</p>
<pre><code class="language-bash">gsettings set org.gnome.desktop.interface toolkit-accessibility true
</code></pre>
<p>Chromium's own Linux accessibility documentation still describes desktop Linux a11y as "not really supported," so expect this to be the most fragile of the three resolvers and expect per-distro variation.</p>
<h3>Step 20 — Gate the support matrix explicitly</h3>
<p>At startup, detect session type and compositor. <strong>GNOME-on-Wayland or any-WM-on-Xorg → enabled. Anything else → URL tracking off, clearly reported to the user and to the coverage screen.</strong> Adopt Hubstaff's restriction openly rather than shipping something flaky and calling it support.</p>
<p><strong>Verification spike, roughly one hour:</strong> on a target GNOME Wayland box, run the <code>gdbus</code> call above, then install <code>accerciser</code> and check whether Chrome's and Firefox's address bars actually appear as editable text nodes. If they do, Linux is a third resolver. If they don't, cut it from v1.</p>
<hr />
<h2>Stage E — Normalization and trust <em>(1 week)</em></h2>
<h3>Step 21 — The URL normalization pipeline</h3>
<p>Everything from UIA, AX and AT-SPI2 is a <em>rendered string</em>, not a URL. This pipeline is what makes that data storable. Apply in order, and drop the reading at the first failure:</p>
<ol>
<li><strong>Reject if the address bar has keyboard focus</strong> — the user is typing.</li>
<li><strong>Reject strings containing spaces</strong>, unless valid IDN.</li>
<li><strong>Validate the host.</strong> Must have a valid public suffix (use a PSL library such as <code>tldts</code>), or be an IP, or <code>localhost</code>, or start with a known internal scheme (<code>chrome://</code>, <code>edge://</code>, <code>about:</code>, <code>file://</code>). This single rule kills almost all search-query garbage.</li>
<li><strong>Reject known placeholders</strong> — "Search Google or type a URL" and its localizations. Rule 3 usually catches these already.</li>
<li><strong>Re-add the scheme.</strong> Assume <code>https://</code>. You cannot tell from the omnibox, which is exactly why this path is <code>confidence: "displayed"</code> and never <code>"exact"</code>.</li>
<li><strong>Canonicalize:</strong> lowercase the host, strip default ports, strip the fragment always, strip the trailing slash on a bare host.</li>
<li><strong>Apply the query-string policy</strong> (see decision D1). Default: strip.</li>
<li><strong>Truncate the path</strong> at ~512 chars to bound storage.</li>
<li><strong>Apply the sensitive-path denylist</strong> if you implement one — password-reset and token-bearing paths.</li>
<li><strong>Compare with the previous reading for the same window.</strong> Identical → extend the open session; different → close and open.</li>
</ol>
<p>Unit-test this against a fixture file of real captured strings from every browser. Collect those fixtures during Stage C using the Step 6 harness.</p>
<h3>Step 22 — The confidence model</h3>
<div class="tw"><table>
<thead>
<tr>
<th><code>confidence</code></th>
<th>Meaning</th>
<th>Produced by</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>exact</code></td>
<td>Real URL straight from the browser</td>
<td>Apple Events</td>
</tr>
<tr>
<td><code>displayed</code></td>
<td>Normalized from the rendered address bar; scheme assumed</td>
<td>UIA, macOS AX, AT-SPI2</td>
</tr>
<tr>
<td><code>guess</code></td>
<td>Host inferred from a window title</td>
<td>title fallback</td>
</tr>
</tbody>
</table></div>
<p>Surface this to end users on low-confidence rows. A visible <em>"approximate"</em> marker protects the credibility of the whole report far better than silently mixing fidelities.</p>
<h3>Step 23 — Private-mode detection, and a policy for where it fails</h3>
<p>This is the sharpest privacy edge of the extension-free approach, and it deserves a decision rather than a default. An extension is excluded from incognito automatically. <strong>Your native resolver is not</strong> — Apple Events will hand you private-window URLs happily.</p>
<div class="tw"><table>
<thead>
<tr>
<th>Browser</th>
<th>Native signal</th>
<th>Reliability</th>
</tr>
</thead>
<tbody>
<tr>
<td>Chromium family, macOS</td>
<td>AppleScript <code>mode of window</code> → <code>"incognito"</code></td>
<td>Reliable</td>
</tr>
<tr>
<td>Chromium family, Windows</td>
<td>UIA heuristic on the incognito indicator element</td>
<td>Heuristic</td>
</tr>
<tr>
<td>Firefox, all</td>
<td>Window title carries a "Private Browsing" marker</td>
<td>Reliable but <strong>localized</strong> — needs a per-locale table</td>
</tr>
<tr>
<td>Safari</td>
<td>None</td>
<td><strong>No signal at all</strong></td>
</tr>
</tbody>
</table></div>
<p><strong>Recommendation:</strong> where <code>private</code> resolves to <code>true</code>, record the session with the host and path stripped. Where it resolves to <code>null</code> (unknown) for a browser you cannot detect — Safari today — either suppress URL capture for that browser entirely, or disclose in your privacy documentation that private windows are not distinguishable on it. Pick one deliberately; do not let it be an accident of the implementation.</p>
<hr />
<h2>Stage F — Permissions and coverage UX <em>(1 week)</em></h2>
<h3>Step 24 — The permission state machine</h3>
<p>Model each gate as <code>unknown | granted | denied | not-required</code>, probe on launch and on resume, and never assume a granted permission stays granted.</p>
<div class="tw"><table>
<thead>
<tr>
<th>Platform</th>
<th>Gate</th>
<th>Needed for</th>
<th>Consent required</th>
</tr>
</thead>
<tbody>
<tr>
<td>macOS</td>
<td>Automation (per browser)</td>
<td>Apple Events — exact URLs</td>
<td>Yes, one prompt per browser</td>
</tr>
<tr>
<td>macOS</td>
<td>Accessibility</td>
<td>Firefox via AX; <code>get-windows</code> URLs</td>
<td>Yes</td>
</tr>
<tr>
<td>macOS</td>
<td>Screen Recording</td>
<td>Window titles</td>
<td>Yes</td>
</tr>
<tr>
<td>Windows</td>
<td>—</td>
<td>UIA and focus hook</td>
<td><strong>None</strong></td>
</tr>
<tr>
<td>Windows</td>
<td>Matching integrity level</td>
<td>Reading an elevated browser</td>
<td>n/a — detect and report</td>
</tr>
<tr>
<td>Linux</td>
<td>a11y bus + <code>toolkit-accessibility</code></td>
<td>AT-SPI2</td>
<td>No prompt, but may need enabling</td>
</tr>
<tr>
<td>Linux</td>
<td>GNOME-on-Wayland or Xorg</td>
<td>Focus detection</td>
<td>n/a — gate the matrix</td>
</tr>
</tbody>
</table></div>
<p>Build a dedicated permission screen: what is granted, what is missing, what each one unlocks, and a button that either prompts or deep-links to System Settings. Treat it as a feature, not an error state.</p>
<h3>Step 25 — The coverage indicator</h3>
<p>For each installed browser, show whether URL tracking is active, degraded, or off, and <em>why</em> in one sentence. Then upload that same capability report with the agent's heartbeat so support can answer "why do I have no URL data" without a screen-share. This is the single highest-leverage support feature in §7.3.</p>
<hr />
<h2>Stage G — Packaging and distribution <em>(1 week)</em></h2>
<h3>Step 26 — Bundle the side-cars</h3>
<p><code>extraResources</code> per platform target. Resolve paths through <code>process.resourcesPath</code> and make sure they work both packaged and in dev. Set the executable bit on the macOS and Linux helpers in a post-build step.</p>
<h3>Step 27 — Sign and notarize everything</h3>
<ul>
<li><strong>macOS:</strong> Developer ID Application certificate, hardened runtime, the Apple Events entitlement, notarization — and the Swift helper signed too, not just the app bundle. Get any part of this wrong and Apple Events fail <strong>only on customer machines</strong>.</li>
<li><strong>Windows:</strong> OV or EV code-signing certificate on hardware or a cloud HSM. Sign the installer <em>and</em> <code>win-resolver.exe</code>. Signing reputation determines whether SmartScreen blocks your installer for the first few thousand downloads.</li>
<li><strong>Linux:</strong> sign the repo metadata if you ship a <code>.deb</code>/<code>.rpm</code> repository.</li>
</ul>
<h3>Step 28 — Pre-empt antivirus and EDR</h3>
<p>An agent that reads other applications' UI trees, spawns helper processes and phones home is precisely what endpoint protection is built to catch. Submit to the major vendors' allowlisting programs before launch, and write the support playbook for "our AV quarantined your agent" in advance.</p>
<hr />
<h2>Stage H — Verify and harden <em>(1–2 weeks)</em></h2>
<h3>Step 29 — Test matrix</h3>
<p>Real hardware, not just VMs:</p>
<ul>
<li><strong>OS:</strong> Windows 10, Windows 11, an Apple Silicon Mac, an Intel Mac if you still support one, Ubuntu on GNOME Wayland, Ubuntu on Xorg.</li>
<li><strong>Browsers side by side:</strong> Chrome, Edge, Firefox, Safari, Brave, Opera, Vivaldi — plus one you deliberately do not support, to verify graceful degradation rather than a crash.</li>
<li><strong>Locales:</strong> at least one non-English UI locale per OS. This is where name-matching bugs surface.</li>
</ul>
<h3>Step 30 — Failure drills</h3>
<p>Each of these should degrade visibly and recover without a restart:</p>
<ul>
<li>Alt-tab storms; 50 window switches in 30 seconds.</li>
<li>SPA navigation through 10 Jira tickets in a minute — verify against the heartbeat resolution you promised.</li>
<li>Incognito and private windows in every browser.</li>
<li>Multi-monitor, and a browser window spanning two displays.</li>
<li>Sleep, wake, lock, unlock, fast user switching.</li>
<li>Clock changed forwards and backwards mid-session.</li>
<li>Browser force-quit mid-session; browser updated and restarted mid-session.</li>
<li>Permission revoked mid-session (macOS); side-car killed mid-session (Windows).</li>
<li>Elevated browser (Windows); accessibility force-disabled (Firefox).</li>
<li>Offline for an hour, then reconnect — verify no duplicates and no loss.</li>
</ul>
<h3>Step 31 — Acceptance criteria</h3>
<p>Write these as numbers before you start, so "done" is not a matter of opinion. Suggested starting points:</p>
<ul>
<li>Exact-URL capture for Safari and all Chromium browsers on macOS: <strong>≥ 99%</strong> of focused browser-seconds attributed to a URL.</li>
<li>Normalized capture on Windows Chromium: <strong>≥ 95%</strong>, with <strong>&lt; 0.5%</strong> garbage rows surviving normalization.</li>
<li>SPA route change reflected within <strong>≤ 2× heartbeat interval</strong>.</li>
<li>Median resolver latency <strong>&lt; 60 ms</strong>; p99 <strong>&lt; 250 ms</strong>; zero agent-visible hangs across the drill suite.</li>
<li>Sum of session <code>activeMs</code> within <strong>± 2%</strong> of tracked timer time.</li>
<li>Zero private-window URLs stored where <code>private == true</code>.</li>
</ul>
<hr />
<h2>7.3.2 Coverage matrix, extension-free</h2>
<div class="tw"><table>
<thead>
<tr>
<th>Browser</th>
<th>macOS</th>
<th>Windows</th>
<th>Linux (GNOME/Xorg)</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Chrome, Edge, Brave, Vivaldi, Opera</strong></td>
<td>Exact — Apple Events</td>
<td>Displayed — UIA</td>
<td>Displayed — AT-SPI2</td>
</tr>
<tr>
<td><strong>Safari</strong></td>
<td>Exact — Apple Events <em>(no private-mode signal)</em></td>
<td>n/a</td>
<td>n/a</td>
</tr>
<tr>
<td><strong>Firefox</strong></td>
<td>Displayed — AX <em>(needs Accessibility permission)</em></td>
<td>Displayed — UIA <em>(needs a11y enabled)</em></td>
<td>Displayed — AT-SPI2</td>
</tr>
<tr>
<td><strong>Arc and other Chromium forks</strong></td>
<td>Test per browser; generic fallback</td>
<td>Generic UIA fallback</td>
<td>Generic AT-SPI2 fallback</td>
</tr>
<tr>
<td><strong>Unsupported / unknown browser</strong></td>
<td>Title only</td>
<td>Title only</td>
<td>Title only</td>
</tr>
<tr>
<td><strong>Non-GNOME Wayland</strong></td>
<td>—</td>
<td>—</td>
<td><strong>Off, reported to user</strong></td>
</tr>
</tbody>
</table></div>
<hr />
<h2>7.3.3 Limitations to document publicly</h2>
<p>Put these in your admin docs. Every one you leave out becomes a support ticket or a trust problem.</p>
<ol>
<li>URL resolution is heartbeat-sampled; visits shorter than the interval may be merged or missed.</li>
<li>On Windows and Linux the URL is derived from the address bar and the scheme is assumed.</li>
<li>Firefox on macOS requires the Accessibility permission; without it, Firefox is title-only.</li>
<li>Safari private windows are not distinguishable from normal windows by the OS.</li>
<li>Only the focused tab of the focused window is tracked; background tabs are never counted.</li>
<li>Reading Chromium's accessibility tree on Windows enables full browser accessibility, with a small memory and CPU cost in the browser.</li>
<li>A browser running elevated cannot be read by a non-elevated agent.</li>
<li>Linux support is GNOME-on-Wayland or any-WM-on-Xorg only.</li>
<li>macOS permissions reset when the app is updated in ways that change its signature or location.</li>
</ol>
<hr />
<h2>7.3.4 Prerequisites — start the starred items this week</h2>
<h3>Accounts and identities</h3>
<ul>
<li>★ <strong>Windows code-signing certificate</strong>, OV or EV on hardware or cloud HSM. Identity verification takes days to weeks and is the longest lead item in the project.</li>
<li>★ <strong>Apple Developer Program</strong> membership, a Developer ID Application certificate, and notarization credentials wired into CI.</li>
<li>Nothing else. No store accounts, no extension IDs — that is the extension-free dividend.</li>
</ul>
<h3>Decisions needed before the schema exists</h3>
<p>See §7.3.5 — D1 and D3 are schema-shaped and D5 gates Stage D.</p>
<h3>Hardware</h3>
<p>The Step 29 matrix. Sourcing an Apple Silicon Mac and a GNOME Wayland box is often the actual schedule constraint; check now.</p>
<h3>Skills on the team</h3>
<p>One developer comfortable with C# and COM for Stage C. Stages B and D need shell, AppleScript and a little Swift or Python — no deep platform expertise. If nobody on the team has touched COM, Stage C is where to budget slack.</p>
<hr />
<h2>7.3.5 Open decisions</h2>
<p><strong>D1 — How much of the URL do we store?</strong>
<em>Recommendation:</em> host + path, query strings stripped by default, full-URL capture as an org-level opt-in. Paths carry the useful signal; query strings carry session tokens, password-reset links and search terms.</p>
<p><strong>D2 — What is the heartbeat interval?</strong>
<em>Recommendation:</em> 5 s while a browser is focused, paused otherwise. It sets your SPA resolution and it is the main lever on both data quality and CPU.</p>
<p><strong>D3 — What happens to private windows, including where we cannot detect them?</strong>
<em>Recommendation:</em> strip host and path where <code>private == true</code>; for Safari, either suppress URL capture or disclose the gap. Decide deliberately.</p>
<p><strong>D4 — Do we ship the Windows UIA path if it degrades browser performance?</strong>
<em>Recommendation:</em> yes, with the remote kill switch from Step 16 and a note in the admin docs.</p>
<p><strong>D5 — Does Linux ship in v1?</strong>
<em>Recommendation:</em> run the Step 20 spike first, then decide. GNOME-only and clearly labelled, or defer — there is no third option.</p>
<p><strong>D6 — Do we surface confidence to end users?</strong>
<em>Recommendation:</em> yes. An "approximate — exact URLs available on macOS" marker converts better than silently mixing fidelities, and it protects the report's credibility.</p>
<hr />
<h2>Rough schedule</h2>
<div class="tw"><table>
<thead>
<tr>
<th>Stage</th>
<th>Duration</th>
<th>Parallelizable</th>
</tr>
</thead>
<tbody>
<tr>
<td>A — Foundations</td>
<td>2–3 weeks</td>
<td>No, blocks everything</td>
</tr>
<tr>
<td>B — macOS</td>
<td>1–2 weeks</td>
<td>Yes, after A</td>
</tr>
<tr>
<td>C — Windows (C#)</td>
<td>2–3 weeks</td>
<td>Yes, after A</td>
</tr>
<tr>
<td>D — Linux</td>
<td>1–2 weeks</td>
<td>Yes, after A · optional</td>
</tr>
<tr>
<td>E — Normalization</td>
<td>1 week</td>
<td>Overlaps C</td>
</tr>
<tr>
<td>F — Permissions &amp; coverage UX</td>
<td>1 week</td>
<td>Yes</td>
</tr>
<tr>
<td>G — Packaging &amp; signing</td>
<td>1 week</td>
<td>Start certificates in week 1</td>
</tr>
<tr>
<td>H — Verify &amp; harden</td>
<td>1–2 weeks</td>
<td>No</td>
</tr>
</tbody>
</table></div>
<p><strong>Serial: ~10–14 weeks. With B, C and D in parallel: ~7–9 weeks.</strong> Start both certificates in week one regardless — they can block a release independently of any code.</p>
<hr />
<p><em>Verified against: Hubstaff platform support and permission documentation; Chromium accessibility architecture docs and Linux accessibility notes; Microsoft UI Automation documentation; Apple hardened-runtime and NSAppleEventsUsageDescription docs; Mozilla AppleScript bugs 369901 and 516502; GNOME Shell Introspect D-Bus API (MR 326); AT-SPI2 (freedesktop); the get-windows package documentation; Electron powerMonitor API.</em></p>
</main></body></html>