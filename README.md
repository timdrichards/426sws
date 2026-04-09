# COMPSCI 426 — Scalable Web Systems

This repository contains the course website, built with [Eleventy](https://www.11ty.dev/) and deployed with a `pathPrefix` of `/426sws/`.

## Development

```bash
npm install
npm start       # local dev server with live reload
npm run build   # production build to _site/
```

---

## How the Site Works

The root page (`index.md` → `/`) lists all active semesters. Each semester lives in its own directory under `semesters/` and has a permanent URL. Shared course material (lectures, project docs) lives under `material/` and is linked from semester pages.

```
index.md                          → /              root page; links to all semesters
semesters/
  spring-2026/
    index.md                      → /spring-2026/  semester homepage
    fall-2026.11tydata.json        semester + semesterName data (see below)
    adm/
      syllabus.md                 → /spring-2026/syllabus/
      schedule.md                 → /spring-2026/schedule/
    lec/                          semester-specific lecture pages
    prj/
      docs/
        index.md                  → /spring-2026/prj/   semester project overview
  fall-2026/
    ...                           same structure
material/
  lec/
    13/                           lecture 13 materials (deck, ekit, arc)
    14/                           lecture 14 materials
  prj/
    docs/                         shared project documentation (git, health, etc.)
    sprints/                      sprint pages
_data/
  course.js                       site-wide metadata (title)
_includes/
  layouts/
    base.njk                      base HTML layout
    prj.njk                       project section layout with nav
css/
  style.css                       site stylesheet
eleventy.config.js                Eleventy configuration
```

---

## Semester Directory Data

Every file inside a semester directory inherits two variables from its `<semester>.11tydata.json`:

```json
{
  "semester": "fall-2026",
  "semesterName": "Fall 2026",
  "layout": "layouts/prj.njk"
}
```

These are available in frontmatter and page content as Nunjucks expressions. Pages inside the semester use them for permalinks and titles so they never hard-code the semester slug:

```yaml
---
title: '{{ semesterName }} Schedule'
permalink: '/{{ semester }}/schedule/'
---
```

This means adding a page to one semester does not require touching any other semester's files.

---

## Adding a New Semester

**1. Create the semester directory and data file.**

```
semesters/fall-2027/
└── fall-2027.11tydata.json
```

```json
{
  "semester": "fall-2027",
  "semesterName": "Fall 2027",
  "layout": "layouts/base.njk"
}
```

**2. Add the semester homepage.**

```
semesters/fall-2027/index.md
```

```yaml
---
layout: layouts/base.njk
title: Fall 2027
permalink: /fall-2027/
---
```

Write the semester description in the body. Internal links use the `url` filter:

```markdown
- [Syllabus]({{ '/fall-2027/syllabus/' | url }})
```

**3. Add administrative pages** (`adm/syllabus.md`, `adm/schedule.md`). The permalinks use the `semester` variable inherited from the directory data file, so these files can be copied from an existing semester without modification:

```yaml
---
layout: layouts/base.njk
title: '{{ semesterName }} Syllabus'
permalink: '/{{ semester }}/syllabus/'
---
```

**4. Add a project overview page** if the semester has a team project:

```
semesters/fall-2027/prj/docs/index.md
```

Use `permalink: '/{{ semester }}/prj/'` to keep the URL consistent. Link to the shared docs under `material/prj/docs/` as needed.

**5. Add the semester to the root page** (`index.md`):

```markdown
- [Fall 2027]({{ '/fall-2027/' | url }})
```

The semester URL is live as soon as the site is deployed — you can share it before listing it on the root page.

---

## Shared Material (`material/`)

Content that is not semester-specific lives under `material/` and has its own permanent URL. Semester pages link to it rather than duplicating it.

### Lectures (`material/lec/<number>/`)

Each lecture directory contains:

```
material/lec/13/
├── index.md            → /material/lec/13/    lecture landing page
├── arc/                architecture scenario pages
├── deck/               slide deck (PDF + HTML)
└── ekit/               exercise kit (code + zip download)
```

### Project Documentation (`material/prj/docs/`)

The shared project docs — git workflow, repository structure, health endpoints, endpoint descriptions, and so on — live here and are tagged `prj`. The `prjPages` collection in `eleventy.config.js` collects them and sorts by `navOrder`, which drives the project section nav rendered by `prj.njk`.

A page appears in the project nav if it has a `navTitle` in its frontmatter. Pages without `navTitle` are still published and reachable by direct link — they just do not appear in the nav.

```
material/prj/docs/
├── docs.11tydata.json   sets layout: prj.njk and tags: [prj] for all docs
├── index.md             navOrder: 1  — project overview
├── project.md           navOrder: 2  — project guide
├── systems.md           navOrder: 3  — system choices
├── starter.md           navOrder: 4  — starter repo
├── repository.md        navOrder: 5  — repository structure
├── git.md               navOrder: 6  — git workflow
├── endpoint.md          navOrder: 8  — endpoint descriptions
├── simulate.md          navOrder: 9  — simulating services
└── health.md            (no navTitle — linked from repository.md)
```

---

## Project Structure Summary

```
_data/                   course.js — site title
_includes/layouts/       base.njk, prj.njk
css/                     style.css
material/
  lec/<number>/          per-lecture deck, ekit, arc pages
  prj/docs/              shared project documentation
  prj/sprints/           sprint pages
semesters/
  <term>-<year>/
    <term>-<year>.11tydata.json   semester slug + name data
    index.md                      semester homepage
    adm/                          syllabus, schedule
    lec/                          semester lecture pages
    prj/docs/                     semester project overview
index.md                 root page
eleventy.config.js       Eleventy config + prjPages collection
```
