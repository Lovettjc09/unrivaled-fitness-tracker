/* ═══════════════════════════════════════════════
   Unrivaled Fitness — Member Milestones Tracker
═══════════════════════════════════════════════ */

// ── Milestone levels ────────────────────────────────────────────────

// Every 10 up to 50 → 75 → 100 → 150 → 200 → every 100 to 1000 → every 250 thereafter
const FIXED_MILESTONES = [
  10, 20, 30, 40, 50,
  75, 100,
  150, 200,
  300, 400, 500, 600, 700, 800, 900, 1000,
];

/**
 * Returns the highest milestone bracket a member has achieved,
 * or null if they haven't reached the first milestone (10 classes).
 */
function getHighestMilestone(visits) {
  if (visits < 10) return null;

  if (visits >= 1000) {
    // After 1000, every 250
    return 1000 + Math.floor((visits - 1000) / 250) * 250;
  }

  for (let i = FIXED_MILESTONES.length - 1; i >= 0; i--) {
    if (visits >= FIXED_MILESTONES[i]) return FIXED_MILESTONES[i];
  }

  return null;
}

/**
 * Visual tier used for accent color CSS class.
 * 1 = lowest (muted gold), 5 = highest (white gleam).
 */
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
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside quoted field
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
  // Exact match first (case-insensitive)
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase());
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parses CSV text and returns an array of { name, visits } objects.
 * Deduplicates by name, keeping the highest visit count.
 */
function parseCSV(rawText) {
  // Strip UTF-8 BOM if present
  const text = rawText.replace(/^﻿/, '');

  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) {
    throw new Error('The CSV file appears to be empty or has no data rows.');
  }

  const headers = parseCSVLine(lines[0]);

  // ── Detect visits column ──
  const visitsIdx = findColumnIndex(headers, [
    'total visits', 'totalvisits', 'visits', 'total classes',
    'class count', 'attendance count', 'attendance',
  ]);

  if (visitsIdx === -1) {
    throw new Error(
      `No "Total Visits" column found. ` +
      `Detected columns: ${headers.map(h => `"${h}"`).join(', ')}. ` +
      `Please ensure your MindBody export includes visit count data.`
    );
  }

  // ── Detect name column(s) ──
  const fullNameIdx = findColumnIndex(headers, [
    'client name', 'member name', 'full name', 'name', 'client',
  ]);
  const firstNameIdx = findColumnIndex(headers, ['first name', 'firstname', 'first']);
  const lastNameIdx  = findColumnIndex(headers, ['last name', 'lastname', 'surname', 'last']);

  const hasFullName   = fullNameIdx !== -1;
  const hasSplitName  = firstNameIdx !== -1 && lastNameIdx !== -1;

  if (!hasFullName && !hasSplitName) {
    throw new Error(
      `No name column found. ` +
      `Detected columns: ${headers.map(h => `"${h}"`).join(', ')}. ` +
      `Please ensure your CSV has a "Name" or "First Name"/"Last Name" column.`
    );
  }

  // ── Parse rows ──
  const memberMap = new Map(); // name → visits (highest)
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);

    // Resolve name
    let name = '';
    if (hasFullName) {
      name = (row[fullNameIdx] ?? '').trim();
    } else {
      const first = (row[firstNameIdx] ?? '').trim();
      const last  = (row[lastNameIdx]  ?? '').trim();
      name = [first, last].filter(Boolean).join(' ');
    }

    if (!name) { skipped++; continue; }

    // Resolve visit count (strip commas from numbers like "1,234")
    const visitsRaw = (row[visitsIdx] ?? '').trim().replace(/,/g, '');
    const visits = parseInt(visitsRaw, 10);
    if (isNaN(visits)) { skipped++; continue; }

    // Keep the highest count if the same name appears more than once
    if (!memberMap.has(name) || memberMap.get(name) < visits) {
      memberMap.set(name, visits);
    }
  }

  const members = Array.from(memberMap.entries()).map(([name, visits]) => ({ name, visits }));
  return { members, skipped, totalRows: lines.length - 1 };
}

// ── Data Processing ─────────────────────────────────────────────────

function groupByMilestone(members) {
  const groups   = new Map();
  const noMilestone = [];

  for (const member of members) {
    const ms = getHighestMilestone(member.visits);
    if (ms === null) {
      noMilestone.push(member);
      continue;
    }
    if (!groups.has(ms)) groups.set(ms, []);
    groups.get(ms).push(member);
  }

  // Sort members within each group alphabetically by name
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Return groups sorted by milestone descending (highest first)
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => b - a);

  return { sortedGroups, noMilestone };
}

// ── DOM Rendering ───────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function fmt(n) {
  return n.toLocaleString();
}

function renderMilestoneSection(milestone, members) {
  const tier    = getMilestoneTier(milestone);
  const section = document.createElement('div');
  section.className = `milestone-section tier-${tier}`;

  section.innerHTML = `
    <div class="milestone-header">
      <div class="milestone-badge">
        <span class="milestone-number">${fmt(milestone)}</span>
        <span class="milestone-word">Classes</span>
      </div>
      <div class="milestone-meta">
        <span class="milestone-count">
          ${members.length} ${members.length === 1 ? 'member' : 'members'}
        </span>
      </div>
    </div>
    <div class="member-grid">${
      members.map(m =>
        `<div class="member-item">
          <span class="member-name">${esc(m.name)}</span>
          <span class="member-visits">${fmt(m.visits)}</span>
        </div>`
      ).join('')
    }</div>
  `;

  return section;
}

function renderResults({ members, skipped }) {
  const { sortedGroups, noMilestone } = groupByMilestone(members);

  const achieverCount = members.length - noMilestone.length;

  // ── Stats bar ──
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
      <span class="stat-value">${
        sortedGroups.length > 0 ? fmt(sortedGroups[0][0]) : '—'
      }</span>
      <span class="stat-label">Top Milestone</span>
    </div>
  `;

  // ── Milestone sections ──
  const container = document.getElementById('milestones-container');
  container.innerHTML = '';

  if (sortedGroups.length === 0) {
    container.innerHTML = '<div class="empty-state">No members have reached a milestone yet (minimum 10 classes required).</div>';
  } else {
    for (const [milestone, list] of sortedGroups) {
      container.appendChild(renderMilestoneSection(milestone, list));
    }
  }

  // ── Sub-milestone note ──
  const note = document.getElementById('no-milestone-note');
  if (noMilestone.length > 0) {
    note.textContent =
      `${fmt(noMilestone.length)} member${noMilestone.length !== 1 ? 's have' : ' has'} ` +
      `not yet reached their first milestone (10 classes).`;
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }

  // ── Set print date ──
  document.getElementById('print-date').textContent =
    `Printed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

  // ── Swap sections ──
  document.getElementById('upload-section').classList.add('hidden');
  document.getElementById('results-section').classList.remove('hidden');
}

// ── File Handling ───────────────────────────────────────────────────

function showError(message) {
  const el = document.getElementById('upload-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError() {
  const el = document.getElementById('upload-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function handleFile(file) {
  if (!file) return;

  clearError();

  if (!/\.(csv|txt)$/i.test(file.name)) {
    showError('Please upload a CSV file (.csv).');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const result = parseCSV(e.target.result);
      if (result.members.length === 0) {
        showError('No valid member records were found in the file. Please check that it contains name and visit-count data.');
        return;
      }
      renderResults(result);
    } catch (err) {
      showError(err.message);
    }
  };

  reader.onerror = () => {
    showError('Failed to read the file. Please try again.');
  };

  reader.readAsText(file);
}

// ── Event Wiring ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  const dropZone    = document.getElementById('drop-zone');
  const fileInput   = document.getElementById('file-input');
  const newUploadBtn = document.getElementById('new-upload-btn');

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = ''; // allow re-selecting same file
  });

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-active'));
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Keyboard activation of drop zone
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // "New Upload" resets to upload view
  newUploadBtn.addEventListener('click', () => {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('upload-section').classList.remove('hidden');
    clearError();
  });
});
