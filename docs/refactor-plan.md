# StoryPlay App Refactor Plan

## 1. Product Boundary

This project is the attached StoryPlay app, separate from the main AI-first `infiplot` site.

Its core product loop is:

1. Creators edit games in the creator studio.
2. Players discover games on the home page.
3. Players enter the play page and play through a selected game.

The project should be organized around four areas:

- Home: game discovery.
- Play page: game runtime and player experience.
- Creator studio: game editing and publishing.
- Infrastructure: data model, APIs, storage, uploads, deployment, validation, and future permissions.

## 2. Current Routes

Current implemented routes:

- `/`: home page, lists projects with `listedOnHome`.
- `/projects/[slug]`: play page, starts the interactive player for one project.
- `/admin`: creator studio project overview.
- `/admin?project=[slug]`: creator studio editor for one project.

Target route direction:

- `/`: public game discovery.
- `/projects/[slug]`: public play page.
- `/admin`: creator studio project overview.
- `/admin/projects/[slug]`: project editor.

Keep `/admin?project=[slug]` temporarily for compatibility while migrating.

## 3. Home Page

Responsibility:

- Show playable/published games.
- Present title, tagline, poster, promo video, and entry actions.
- Keep creator/admin actions secondary.

Home should use project summary data only. It should not load the full game graph.

Current source:

- `src/app/page.tsx`
- `listProjectSummaries()`
- `ProjectSummary`

Future fields to consider:

- `visibility`: `public | unlisted | private`
- `publishStatus`: `draft | published`
- `category`
- `tags`
- `coverUrl`
- `publishedAt`
- `playCount`

## 4. Play Page

Responsibility:

- Load one game by slug.
- Create and resume playthrough state.
- Render the current node.
- Handle choices, automatic transitions, timeline events, conditions, actions, and endings.
- Keep runtime errors understandable for players.

Current source:

- `src/app/projects/[slug]/page.tsx`
- `src/components/interactive-player.tsx`
- `src/lib/playthrough-store.ts`
- `src/lib/story-rules.ts`

Important future boundary:

- Players should eventually play a published version of a game, not the mutable draft.
- Creator preview can continue to use draft data.

## 5. Creator Studio

Responsibility:

- Manage projects.
- Edit project settings and presentation.
- Edit nodes, branches, variables, conditions, timeline events, and endings.
- Import/export projects.
- Validate a project before it is exposed on the home page.

Current source:

- `src/app/admin/page.tsx`
- `src/components/admin-project-overview.tsx`
- `src/components/admin-story-editor.tsx`
- `src/components/branch-graph.tsx`
- `src/app/api/admin/*`

Target component split:

- `components/admin/project-overview.tsx`
- `components/admin/project-settings-panel.tsx`
- `components/admin/node-list-panel.tsx`
- `components/admin/node-editor-panel.tsx`
- `components/admin/choice-editor.tsx`
- `components/admin/timeline-editor.tsx`
- `components/admin/variable-editor.tsx`
- `components/admin/publish-checklist.tsx`
- `components/admin/import-export-panel.tsx`

Publishing checks should include:

- A start node exists.
- Every choice target exists.
- Every auto-next target exists.
- Ending nodes are complete.
- Required video URLs or media assets exist.
- Condition variables exist.
- Timeline event payloads are valid.
- Isolated nodes are visible to the creator before publishing.

## 6. Infrastructure

Current source:

- `src/lib/story-engine.ts`: domain types.
- `src/lib/game-store.ts`: project editing operations.
- `src/lib/playthrough-store.ts`: runtime operations.
- `src/lib/storage.ts`: storage adapter selection.
- `src/lib/sqlite.ts`: local SQLite storage.
- `src/lib/postgres.ts`: PostgreSQL storage.
- `src/app/api/*`: API routes.

Target direction:

- `lib/domain`: types, validation, graph checks, rule evaluation.
- `lib/services`: project service, playthrough service, publish service.
- `lib/storage`: SQLite and PostgreSQL adapters behind stable interfaces.
- `lib/runtime`: runtime transition logic.
- `lib/admin`: admin-only editing helpers.

API route direction:

- `/api/projects`
- `/api/projects/[slug]`
- `/api/projects/[slug]/nodes`
- `/api/projects/[slug]/publish`
- `/api/playthroughs`
- `/api/uploads`

Keep current `/api/admin/*` routes until the frontend is migrated.

## 7. Refactor Phases

### Phase 1: Structure Without Behavior Changes

- Create clearer folders for admin, runtime, domain, and storage code.
- Split large components without changing UI behavior.
- Keep existing routes working.
- Run `npm run build` after each meaningful step.

### Phase 2: Data Model Cleanup

- Clarify Project/Game/Node/Choice/Playthrough responsibilities.
- Add validation helpers.
- Prepare fields for publish status and visibility.
- Keep backward compatibility with existing stored projects.

### Phase 3: Creator Studio Split

- Split `AdminStoryEditor` into focused panels.
- Move editor-only helper logic out of the component.
- Add project health/publish checklist.
- Improve project overview and project switching.

### Phase 4: Runtime Stabilization

- Extract runtime state transitions from `InteractivePlayer`.
- Standardize runtime API payloads.
- Improve empty project, missing node, missing video, and ending states.
- Keep preview mode explicit.

### Phase 5: Home Productization

- Show only published/listed games.
- Add better discovery structure: categories, tags, sorting, and empty states.
- Keep the home page independent from editor-only data.

## 8. Immediate Next Step

Start with Phase 1.

Do not change behavior first. Split code and clarify boundaries while preserving:

- `/`
- `/projects/[slug]`
- `/admin`
- `/admin?project=[slug]`
- existing API routes
- current SQLite/PostgreSQL storage behavior

