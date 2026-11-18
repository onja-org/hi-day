// Renders made-up "screens" of Lucas's work as JPEGs, standing in for the
// desktop app's screenshots in 07e (local storage uploads don't work).
// A generic design tool: no real product's name or logo.
import { FAKE_SCREENS as OUT, openBrowser } from './lib.mjs';

const shell = (file, layers, canvas) => `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; font-family: Inter, Arial, sans-serif; }
  body { width: 1440px; height: 900px; background: #e9e9ec; display: grid;
         grid-template-rows: 44px 1fr; grid-template-columns: 240px 1fr 260px; }
  .top { grid-column: 1 / 4; background: #1e1e24; color: #fff; display: flex; align-items: center;
         padding: 0 16px; gap: 18px; font-size: 13px; }
  .top b { font-weight: 600; } .top .muted { color: #9a9aa5; }
  .left, .right { background: #fff; padding: 14px; font-size: 12px; color: #333; }
  .left h4, .right h4 { font-size: 11px; color: #888; text-transform: uppercase; margin: 6px 0 10px; }
  .left div { padding: 5px 6px; border-radius: 4px; } .left .on { background: #e5ecff; }
  .right .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .stage { display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .frame { width: 760px; background: #fffaf3; box-shadow: 0 6px 30px rgba(0,0,0,.15); }
</style></head><body>
  <div class="top"><b>${file}</b><span class="muted">Brightline Studio</span>
    <span class="muted" style="margin-left:auto">100%</span><span>Share</span></div>
  <div class="left"><h4>Layers</h4>${layers.map((l, i) => `<div class="${i === 1 ? 'on' : ''}">${l}</div>`).join('')}</div>
  <div class="stage">${canvas}</div>
  <div class="right"><h4>Design</h4>
    <div class="row"><span>Width</span><span>1280</span></div>
    <div class="row"><span>Height</span><span>Auto</span></div>
    <div class="row"><span>Fill</span><span>#FFFAF3</span></div>
    <div class="row"><span>Font</span><span>Lora / Inter</span></div>
    <div class="row"><span>Grid</span><span>12 columns</span></div></div>
</body></html>`;

const menu = shell('Harbour Café – Menu page',
  ['Menu page', 'Header', 'Breakfast', 'Lunch', 'Drinks', 'Footer'],
  `<div class="frame" style="padding:36px 48px;color:#3b2a1e">
     <div style="display:flex;justify-content:space-between;font-size:14px"><b>Harbour Café</b><span>Menu · Visit · About</span></div>
     <h1 style="font-family:Georgia;font-size:40px;margin:36px 0 8px">Our menu</h1>
     <p style="color:#8a6f5a;margin-bottom:24px">Fresh every morning, by the water.</p>
     ${[['Breakfast', [['Harbour toast', '8.50'], ['Granola bowl', '7.00'], ['Eggs on sourdough', '9.50']]],
        ['Lunch', [['Fish tacos', '13.00'], ['Garden salad', '10.50'], ['Soup of the day', '8.00']]]]
       .map(([title, items]) => `<h3 style="margin:18px 0 8px;font-family:Georgia">${title}</h3>` +
         items.map(([n, p]) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #d9c7b5"><span>${n}</span><span>${p}</span></div>`).join('')).join('')}
   </div>`);

const home = shell('Harbour Café – Homepage',
  ['Homepage', 'Hero', 'Opening hours', 'Gallery', 'Contact', 'Footer'],
  `<div class="frame" style="color:#3b2a1e">
     <div style="height:300px;background:linear-gradient(135deg,#8fb3c9,#d8c3a5);display:flex;align-items:flex-end;padding:32px">
       <h1 style="font-family:Georgia;font-size:44px;color:#fff">Coffee by the harbour</h1></div>
     <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:28px 36px">
       ${['Opening hours<br><small>Mon–Sat 7:00–17:00</small>', 'Find us<br><small>Quay Street 4</small>', 'Book a table<br><small>Call or message</small>']
         .map((t) => `<div style="background:#fff;padding:18px;border-radius:8px">${t}</div>`).join('')}</div>
     <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 36px 36px">
       ${['#c9b39b', '#a9c2cf', '#d6c8b4', '#b8a28c'].map((c) => `<div style="height:110px;background:${c};border-radius:6px"></div>`).join('')}</div>
   </div>`);

const booking = shell('Lumo – Booking flow v3',
  ['Booking flow', 'Choose a time', 'Confirm', 'Reminders', 'Done'],
  `<div style="display:flex;gap:28px">${[
     ['Choose a time', ['Mon 9:00', 'Mon 11:30', 'Tue 14:00', 'Wed 10:15']],
     ['Confirm', ['Dr. Rivera · General check-up', 'Tue 14:00 · 30 min', 'Reminder: 1 day before']],
     ['Reminders', ['Text message', 'Email', 'No reminder']]]
     .map(([title, rows], i) => `<div style="width:250px;height:520px;background:#fff;border-radius:28px;box-shadow:0 6px 24px rgba(0,0,0,.15);padding:28px 18px;color:#1b2b3a">
        <div style="font-size:12px;color:#6b8aa3">Lumo Health</div><h3 style="margin:10px 0 18px">${title}</h3>
        ${rows.map((r, j) => `<div style="padding:12px;margin-bottom:10px;border-radius:12px;background:${i === 0 && j === 2 ? '#2f6fed' : '#eef3f8'};color:${i === 0 && j === 2 ? '#fff' : 'inherit'};font-size:13px">${r}</div>`).join('')}
        <div style="margin-top:auto;padding:12px;border-radius:12px;background:#2f6fed;color:#fff;text-align:center;font-size:13px;position:relative;top:40px">Continue</div></div>`).join('')}</div>`);

const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [name, html] of [['harbour-menu', menu], ['harbour-home', home], ['lumo-booking', booking]]) {
  await page.setContent(html);
  await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 80 });
  console.log(`made ${name}.jpg`);
}
await browser.close();
