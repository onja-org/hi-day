export {};

// CoverageReport/BrowserCoverageRow/Window.api are declared once, ambiently,
// in window.d.ts — shared across every renderer entry point. row.approximateNote
// (decision D6's "approximate" marker text) is pre-computed by the main
// process (url-capture/coverage-report.ts's approximateNoteFor), not
// re-derived here — this process can't import that module directly (a
// different compile target across the contextIsolation boundary), and an
// earlier version of this file re-implemented the same confidence -> marker
// decision locally, which had already drifted from the main process's
// naming before being caught and consolidated.

function statusLabel(status: CoverageStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'degraded':
      return 'Degraded';
    case 'off':
      return 'Off';
  }
}

function renderRow(row: BrowserCoverageRow): HTMLTableRowElement {
  const tr = document.createElement('tr');

  const nameCell = document.createElement('td');
  nameCell.textContent = row.key;
  tr.appendChild(nameCell);

  const statusCell = document.createElement('td');
  statusCell.textContent = row.installed ? statusLabel(row.status) : 'Not installed';
  statusCell.className = `coverage-status coverage-status--${row.installed ? row.status : 'off'}`;
  tr.appendChild(statusCell);

  const reasonCell = document.createElement('td');
  reasonCell.textContent = row.reason;
  if (row.approximateNote) {
    const marker = document.createElement('span');
    marker.className = 'coverage-approximate';
    marker.textContent = ` (${row.approximateNote})`;
    reasonCell.appendChild(marker);
  }
  tr.appendChild(reasonCell);

  return tr;
}

function renderHealth(health: CoverageReport['resolverHealth']): void {
  const section = document.getElementById('coverage-health')!;
  const stateEl = document.getElementById('coverage-health-state')!;
  const errorsEl = document.getElementById('coverage-health-errors')!;

  section.hidden = false;
  stateEl.textContent = `Status: ${health.state}${health.lastSuccessfulResolveAt ? ` — last successful read ${new Date(health.lastSuccessfulResolveAt).toLocaleTimeString()}` : ''}`;

  const errorEntries = Object.entries(health.recentErrorCounts);
  errorsEl.textContent =
    errorEntries.length === 0
      ? 'No recent errors.'
      : `Recent errors: ${errorEntries.map(([code, count]) => `${code} (${count})`).join(', ')}`;
}

async function load(): Promise<void> {
  const loadingEl = document.getElementById('coverage-loading')!;
  const errorEl = document.getElementById('coverage-error')!;
  const tableEl = document.getElementById('coverage-table') as HTMLTableElement;
  const rowsEl = document.getElementById('coverage-rows')!;

  loadingEl.hidden = false;
  errorEl.hidden = true;
  tableEl.hidden = true;

  const report = await window.api.coverage.get();

  loadingEl.hidden = true;

  if (!report) {
    errorEl.hidden = false;
    errorEl.textContent = 'Website tracking is not supported on this platform yet.';
    return;
  }

  rowsEl.replaceChildren(...report.browsers.map(renderRow));
  tableEl.hidden = false;
  renderHealth(report.resolverHealth);
}

document.getElementById('coverage-refresh')!.addEventListener('click', () => void load());

void load();
