# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GitHub Sprint Analyzer** is a single-file, self-contained HTML5 web application used in CS326 to analyze student team contributions on GitHub. There is no build system — the entire application lives in `github-sprint-analyzer.html`.

## Running the App

Open `github-sprint-analyzer.html` directly in a browser (no server needed):
```
open github-sprint-analyzer.html
```

When embedded as a Claude.ai artifact, GitHub API calls are proxied and the Anthropic API key is auto-injected — no credentials needed.

## Architecture

The app is one large HTML file with inline CSS and JavaScript. There is no module system or bundler. All state lives in a single `STATE` object.

### Tabs / UI Sections

| Tab ID | Purpose |
|---|---|
| `tab-config` | GitHub token, repo, sprint dates, team member mapping |
| `tab-overview` | Summary cards + per-student contribution table + team-level flags |
| `tab-charts` | Six Chart.js visualizations (bar, scatter, line, heatmap) |
| `tab-students` | Per-student deep dive: metrics, flags, commit log, PRs, reviews |
| `tab-ai` | Claude API integration for rubric-based grading |

### Core Data Flow

1. `runAnalysis()` fetches from GitHub REST API (commits, PRs, reviews, issues) using `ghFetch()` with auto-pagination.
2. `buildSummary()` aggregates per-member stats into `STATE.summary`.
3. All render functions read from `STATE` — they do not re-fetch.
4. `getConcerns(studentSummary)` applies rules-based flags (low reviews, high last-minute %, self-merges, etc.).
5. `runAI()` assembles a prompt from `STATE` + optional repo files, then streams a Claude response via `callAnthropicStreaming()`.

### Key Functions

- `ghFetch(token, url, allPages)` — GitHub API wrapper with pagination
- `buildSummary()` — aggregates contribution metrics per member
- `getConcerns(studentSummary)` — rules engine for detecting collaboration issues
- `renderOverview()` / `renderCharts()` / `renderStudents()` — tab renderers
- `renderHeatmaps()` — activity heatmap by day/hour per student
- `loadDemo()` — generates synthetic data for 5 team members (no GitHub token needed)
- `isClaudeArtifact()` — detects if running inside Claude.ai iframe

### Claude API Integration

- When `isClaudeArtifact()` returns true, API calls go through Claude's proxy (no user API key needed).
- When running locally, the user pastes their Anthropic API key into the AI tab.
- Streaming responses are handled by `callAnthropicStreaming()`.

### Last-Minute Detection

Commits/PRs are flagged as "last-minute" if they fall within a configurable window (default 24 hours) before the sprint deadline. This is a key metric surfaced throughout the UI.

### Default Demo Data

Built-in team members: `nbeiner24`, `RitonlyD`, `jameshualiu`, `jneto508`, `ertrldmrhn`. Demo repo: `jneto508/team-event-board`.
