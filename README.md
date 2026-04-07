# COMPSCI 426 — Scalable Web Systems

This repository contains the course website, built with [Eleventy](https://www.11ty.dev/) and deployed with a `pathPrefix` of `/426sws/`.

## Semester Management

The site supports multiple semesters simultaneously. Each semester has a permanent URL that never changes, and a single setting controls which semester appears at the root URL.

### How It Works

```
_data/course.js                        ← one line controls the root URL
_includes/semester-content/
  spring-2026.njk                      ← spring page content
  summer-2026.njk                      ← summer page content
semesters/
  spring-2026.njk  →  /spring-2026/   ← permanent URL (always live)
  summer-2026.njk  →  /summer-2026/   ← permanent URL (always live)
index.njk          →  /               ← renders whichever semester is active
```

The root `index.njk` dynamically includes the content for `course.activeSemester`. The semester pages in `semesters/` each include the same content partial, so content lives in exactly one place per semester.

### Switching the Active Semester

Open `_data/course.js` and change `activeSemester`:

```js
export default {
  title: 'COMPSCI 426 — Scalable Web Systems',
  activeSemester: 'summer-2026',  // ← change this
}
```

Rebuild and deploy. The root URL now serves the summer page. All prior semester URLs remain live.

### Adding a New Semester

1. Create the content partial at `_includes/semester-content/<term>-<year>.njk`. Write the page content in HTML/Nunjucks — no frontmatter. Use the `url` filter for all internal links so they resolve correctly from any page:
   ```njk
   <a href="{{ '/material/lec/01/' | url }}">Lecture 1</a>
   ```

2. Create the semester page at `semesters/<term>-<year>.njk`:
   ```njk
   ---
   layout: layouts/base.njk
   title: Fall 2026
   permalink: /fall-2026/
   ---
   {% include "semester-content/fall-2026.njk" %}
   ```

3. Share the permanent URL (`/426sws/fall-2026/`) with students as needed.

4. When the semester begins, set `activeSemester: 'fall-2026'` in `_data/course.js` and redeploy.

### Sharing a Semester URL Before It Goes Live at Root

The permanent semester URL is live as soon as the site is deployed — regardless of what `activeSemester` is set to. You can share `/426sws/summer-2026/` with prospective students at any time without exposing the current semester's full course content at the root.

## Development

```bash
npm install
npm start       # local dev server with live reload
npm run build   # production build to _site/
```

## Project Structure

```
_data/                  global data files (course metadata, active semester)
_includes/
  layouts/              base Nunjucks layouts
  semester-content/     per-semester page content partials
semesters/              semester wrapper pages (one permanent URL each)
material/
  lec/                  lecture materials
  prj/                  project documentation and sprint pages
css/                    site stylesheet
index.njk               root page (renders the active semester)
eleventy.config.js      Eleventy configuration
.eleventyignore         files excluded from site build
```
