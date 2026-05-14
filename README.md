# Unrivaled Fitness — Member Milestones Tracker

A web application that tracks and displays attendance achievement milestones for Unrivaled Fitness gym members.

## Features

- **CSV Upload** — Upload a member visit report exported from MindBody
- **Auto-detection** — Finds the `Total Visits` column and member name columns automatically
- **Milestone Brackets** — Groups members into achievement sections (highest bracket first)
- **Deduplication** — Duplicate name entries are merged, keeping the highest visit count
- **Print-ready** — Clean print layout for bulletin boards or announcements

## Milestone Levels

| Range | Milestones |
|-------|-----------|
| Up to 50 | 10, 20, 30, 40, 50 |
| 50 – 200 | 75, 100, 150, 200 |
| 200 – 1,000 | Every 100 (300, 400 … 1,000) |
| 1,000+ | Every 250 (1,250, 1,500 …) |

## Usage

1. Open `index.html` in any modern browser — no server or install needed
2. Export a client visit report from MindBody as CSV
3. Upload the file — the app handles the rest

### Expected CSV columns

- **Name** — one of: `Name`, `Client Name`, `Member Name`, `Full Name`  
  *or* separate `First Name` + `Last Name` columns
- **Visits** — one of: `Total Visits`, `Visits`, `Total Classes`, `Attendance`

## Tech Stack

Vanilla HTML / CSS / JavaScript — no dependencies, no build step.
