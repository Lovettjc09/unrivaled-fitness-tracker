/* ═══════════════════════════════════════════════
   Unrivaled Fitness — Member Milestones Tracker
═══════════════════════════════════════════════ */

// ── Milestone levels ────────────────────────────────────────────────

const FIXED_MILESTONES = [
  10, 20, 30, 40, 50,
  75, 100,
  150, 200,
  300, 400, 500, 600, 700, 800, 900, 1000,
];

function getHighestMilestone(visits) {
  if (visits < 10) return null;
  if (visits >= 1000) return 1000 + Math.floor((visits - 1000) / 250) * 250;
  for (let i = FIXED_MILESTONES.length - 1; i >= 0; i--) {
    if (visits >= FIXED_MILESTONES[i]) return FIXED_MILESTONES[i];
  }
  return null;
}

function getMilestoneTier(milestone) {
  if (milestone >= 1000) return 5;
  if (milestone >= 500)  return 4;
  if (milestone >= 200)  return 3;
  if (milestone >= 100)  return 2;
  return 1;
}

// ── CSV Parsing ─────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  result.push(cell.trim());
  return result;
}

function findColumnIndex(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSV(rawText) {
  const text = rawText.replace(/^﻿/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

  if (lines.length < 2) throw new Error('data.csv appears to be empty or has no data rows.');

  const headers = parseCSVLine(lines[0]);

  const visitsIdx = findColumnIndex(headers, [
    'total visits', 'totalvisits', 'visits', 'total classes',
    'class count', 'attendance count', 'attendance',
  ]);
  if (visitsIdx === -1) throw new Error(
    `No "Total Visits" column found in data.csv. Detected: ${headers.join(', ')}`
  );

  const fullNameIdx  = findColumnIndex(headers, ['client name', 'member name', 'full name', 'name', 'client']);
  const firstNameIdx = findColumnIndex(headers, ['first name', 'firstname', 'first']);
  const lastNameIdx  = findColumnIndex(headers, ['last name', 'lastname', 'surname', 'last']);

  if (fullNameIdx === -1 && (firstNameIdx === -1 || lastNameIdx === -1)) {
    throw new Error(`No name column found in data.csv. Detected: ${headers.join(', ')}`);
  }

  const memberMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);

    let name = '';
    if (fullNameIdx !== -1) {
      name = (row[fullNameIdx] ?? '').trim();
    } else {
      const first = (row[firstNameIdx] ?? '').trim();
      const last  = (row[lastNameIdx]  ?? '').trim();
      name = [first, last].filter(Boolean).join(' ');
    }

    if (!name) continue;

    const visits = parseInt((row[visitsIdx] ?? '').trim().replace(/,/g, ''), 10);
    if (isNaN(visits)) continue;

    if (!memberMap.has(name) || memberMap.get(name) < visits) {
      memberMap.set(name, visits);
    }
  }

  return Array.from(memberMap.entries()).map(([name, visits]) => ({ name, visits }));
}

// ── Data Processing ─────────────────────────────────────────────────

function groupByMilestone(members) {
  const groups      = new Map();
  const noMilestone = [];

  for (const member of members) {
    const ms = getHighestMilestone(member.visits);
    if (ms === null) { noMilestone.push(member); continue; }
    if (!groups.has(ms)) groups.set(ms, []);
    groups.get(ms).push(member);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => b - a);
  return { sortedGroups, noMilestone };
}

// ── DOM Rendering ────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function fmt(n) { return n.toLocaleString(); }

function renderMilestoneSection(milestone, members) {
  const section = document.createElement('div');
  section.className = `milestone-section tier-${getMilestoneTier(milestone)}`;
  section.innerHTML = `
    <div class="milestone-header">
      <div class="milestone-badge">
        <span class="milestone-number">${fmt(milestone)}</span>
        <span class="milestone-word">Classes</span>
      </div>
      <div class="milestone-meta">
        <span class="milestone-count">${members.length} ${members.length === 1 ? 'member' : 'members'}</span>
      </div>
    </div>
    <div class="member-grid">${
      members.map(m => `
        <div class="member-item">
          <span class="member-name">${esc(m.name)}</span>
          <span class="member-visits">${fmt(m.visits)}</span>
        </div>`
      ).join('')
    }</div>`;
  return section;
}

function renderResults(members) {
  const { sortedGroups, noMilestone } = groupByMilestone(members);
  const achieverCount = members.length - noMilestone.length;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat">
      <span class="stat-value">${fmt(members.length)}</span>
      <span class="stat-label">Total Members</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-value">${fmt(achieverCount)}</span>
      <span class="stat-label">Milestone Achievers</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-value">${fmt(sortedGroups.length)}</span>
      <span class="stat-label">Bracket${sortedGroups.length !== 1 ? 's' : ''} Active</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-value">${sortedGroups.length > 0 ? fmt(sortedGroups[0][0]) : '—'}</span>
      <span class="stat-label">Top Milestone</span>
    </div>`;

  const container = document.getElementById('milestones-container');
  container.innerHTML = '';
  if (sortedGroups.length === 0) {
    container.innerHTML = '<div class="empty-state">No members have reached a milestone yet (minimum 10 classes required).</div>';
  } else {
    for (const [milestone, list] of sortedGroups) {
      container.appendChild(renderMilestoneSection(milestone, list));
    }
  }

  const note = document.getElementById('no-milestone-note');
  if (noMilestone.length > 0) {
    note.textContent = `${fmt(noMilestone.length)} member${noMilestone.length !== 1 ? 's have' : ' has'} not yet reached their first milestone (10 classes).`;
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }

  document.getElementById('print-date').textContent =
    `Printed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('results-section').classList.remove('hidden');
}

function showError(message) {
  document.getElementById('loading-state').classList.add('hidden');
  const el = document.getElementById('error-state');
  document.getElementById('error-message').textContent = message;
  el.classList.remove('hidden');
}

// ── Boot ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  fetch('data.csv')
    .then(res => {
      if (!res.ok) throw new Error(`Could not load data.csv (HTTP ${res.status}). Make sure the file exists in the repository.`);
      return res.text();
    })
    .then(text => {
      const members = parseCSV(text);
      if (members.length === 0) throw new Error('No valid member records found in data.csv.');
      renderResults(members);
    })
    .catch(err => showError(err.message));
});
