# Codex Handoff — Sidebar Awaken Indicator Bug

## Purpose

Find and fix the Catalog desktop sidebar awaken indicator issue without mutating unrelated systems.

The current bug is specifically in the desktop sidebar awaken controls, not the card badges.

Expected behavior:

```text
[5★ Active] [6★ Inactive] [FA Inactive]
[5★ Inactive] [6★ Active] [FA Inactive]
[5★ Inactive] [6★ Inactive] [FA Active]
```

When the user clicks a sidebar awaken state, exactly one sidebar awaken button should visually appear active and the other two should visually appear inactive.

---

## Critical no-mutation rule

Do not broadly rewrite, refactor, or mutate unrelated files.

Off limits unless proven absolutely necessary:

- Do not change Catalog card layout.
- Do not change mobile behavior.
- Do not change roster behavior.
- Do not change optimizer behavior.
- Do not add document-wide `MutationObserver` logic.
- Do not add synthetic clicks across unrelated buttons.
- Do not fetch data per click.
- Do not modify generated `apkfiles` data.
- Do not change progressive loading.
- Do not rewrite `catalog-v2-lite.js` unless the DOM markup is proven to be missing required attributes.
- Do not alter unrelated CSS selectors.

This bug should be solved at the narrowest possible owning path.

---

## Required first step

Before touching code, read the repository map:

```text
CATALOG_CODE_PATH_INDEX.md
```

Also check the companion changelog:

```text
CATALOG_CODE_PATH_INDEX_CHANGELOG.md
```

These files explain routing and ownership. Use them to avoid guessing.

Relevant routing from the map:

- Desktop sidebar behavior: `catalog-click-fast-authority.js`
- Catalog-wide theme/sidebar button styling: `test-catalog-v2-theme.css`
- Desktop sidebar visual shell: `test-catalog-v2-desktop-sidebar-authority.js`
- Desktop structure/layout: `test-catalog-v2-desktop-structure.js`
- Catalog card renderer: `catalog-v2-lite.js`

For this issue, start with:

```text
catalog-click-fast-authority.js
```

Then inspect CSS that may override its visual state:

```text
test-catalog-v2-theme.css
test-catalog-v2-desktop-sidebar-authority.js
test-catalog-v2-desktop-structure.js
```

---

## Current symptoms

The sidebar awaken buttons do not visually reflect active/inactive state correctly.

The user reports that hard refresh did not fix it.

This means either:

1. The correct active/aria state is not being written to `#v2AwakenTabs button`, or
2. The state is written correctly, but a later CSS rule makes active/inactive look the same, or
3. A later script rebuilds `#v2AwakenTabs` after the active state is applied, or
4. The actual visible sidebar buttons are not the `#v2AwakenTabs` buttons currently being patched.

Do not assume. Inspect the live DOM path and actual CSS cascade.

---

## Exact DOM target

The visible desktop sidebar awaken controls are expected to be:

```text
#v2AwakenTabs button
```

The desired attributes/classes must be:

For 5★ active:

```html
<button class="active" aria-pressed="true">5★</button>
<button aria-pressed="false">6★</button>
<button aria-pressed="false">FA</button>
```

For 6★ active:

```html
<button aria-pressed="false">5★</button>
<button class="active" aria-pressed="true">6★</button>
<button aria-pressed="false">FA</button>
```

For FA active:

```html
<button aria-pressed="false">5★</button>
<button aria-pressed="false">6★</button>
<button class="active" aria-pressed="true">FA</button>
```

It is acceptable if inactive buttons do not have an explicit inactive class, as long as they clearly render inactive.

---

## Current related files and commits

Recent attempts touched:

```text
catalog-click-fast-authority.js
```

Relevant recent commits:

```text
9085258c2524e845dc932d68f5a276df8e7833aa
c4d6a26ac2864494f6163fdb901c2fa92a24d47c
```

A CSS attempt was also made in:

```text
test-catalog-v2-theme.css
```

Relevant recent commit:

```text
ff1f1fdf062f35b28322622b1ec0d3098ed26b3c
```

The issue still appears unresolved from the user's view.

---

## Suspect areas to inspect

### 1. `catalog-click-fast-authority.js`

Inspect:

```text
renderBase(card)
setCardState(card, idx)
syncSidebarAwakenTabs(idx)
handleSidebarAwaken(event)
```

Expected responsibility:

- Build `#v2AwakenTabs` buttons with labels `5★`, `6★`, `FA`.
- On click, update active state immediately.
- Only one button should have `.active` and `aria-pressed="true"`.
- Other buttons should have no `.active` and `aria-pressed="false"`.

Important: do not confuse card buttons with sidebar buttons.

Card buttons:

```text
#catalogGrid .unitCard .stateRow .stateBtn
```

Sidebar buttons:

```text
#v2AwakenTabs button
```

This bug is for the sidebar buttons.

---

### 2. `test-catalog-v2-theme.css`

Inspect CSS around:

```text
.v2-awaken-tabs button
.v2-awaken-tabs button.active
#v2AwakenTabs button
#v2AwakenTabs button.active
#v2AwakenTabs button[aria-pressed="true"]
#v2AwakenTabs button[aria-pressed="false"]
.stateBtn
.stateBtn.active
```

The prior generic rules included:

```css
.page-catalog-v2 .v2-awaken-tabs button,
.page-catalog-v2 .stateBtn { ... }

.page-catalog-v2 .v2-awaken-tabs button.active,
.page-catalog-v2 .stateBtn.active { ... }
```

The sidebar-specific rules should override those, but confirm with the actual CSS cascade.

---

### 3. `test-catalog-v2-desktop-sidebar-authority.js`

Inspect for rules or injected CSS that target:

```text
#v2AwakenTabs
.v2-awaken-tabs
.v2-awaken-tabs button
```

This file may visually override sidebar buttons after the theme file.

---

### 4. `test-catalog-v2-desktop-structure.js`

Inspect whether it rebuilds, moves, or rewrites `#v2AwakenTabs` after `catalog-click-fast-authority.js` renders it.

Watch for any function that does:

```text
innerHTML = ... #v2AwakenTabs ...
querySelector('#v2AwakenTabs')
.v2-awaken-tabs
```

Also note this file previously contained risky synthetic awaken routing. Do not reintroduce or expand synthetic click behavior.

---

### 5. `test-catalog-v2-sidebar-detail-buttons.js`

This file is already marked as a conflict candidate in the path index.

Inspect only if needed. It may create another sidebar detail/selection path.

Do not build new behavior there unless the actual visible buttons are proven to come from that file.

---

## Debugging instructions

Use browser DevTools and inspect the actual visible sidebar buttons.

For each sidebar click, verify:

```js
[...document.querySelectorAll('#v2AwakenTabs button')].map(b => ({
  text: b.textContent.trim(),
  cls: b.className,
  pressed: b.getAttribute('aria-pressed'),
  opacity: getComputedStyle(b).opacity,
  background: getComputedStyle(b).backgroundImage,
  color: getComputedStyle(b).color,
  filter: getComputedStyle(b).filter
}))
```

Expected after clicking 5★:

```text
5★ -> active true, bright active style
6★ -> active false, dim inactive style
FA -> active false, dim inactive style
```

Expected after clicking 6★:

```text
5★ -> active false, dim inactive style
6★ -> active true, bright active style
FA -> active false, dim inactive style
```

Expected after clicking FA:

```text
5★ -> active false, dim inactive style
6★ -> active false, dim inactive style
FA -> active true, bright active style
```

If the DOM state is correct but visual style is wrong, fix CSS only.

If the DOM state is wrong, fix `catalog-click-fast-authority.js` only.

If the visible buttons are not inside `#v2AwakenTabs`, identify the real DOM path and update `CATALOG_CODE_PATH_INDEX.md` before patching.

---

## Suggested narrow fix strategy

### If DOM state is wrong

Patch only `catalog-click-fast-authority.js`.

Recommended helper:

```js
function syncSidebarAwakenTabs(idx){
  const tabs=document.getElementById('v2AwakenTabs');
  if(!tabs)return;
  [...tabs.querySelectorAll('button')].forEach((btn,i)=>{
    const on=i===idx;
    btn.classList.toggle('active',on);
    btn.classList.toggle('inactive',!on);
    btn.setAttribute('aria-pressed',String(on));
    btn.dataset.v2Active=String(on);
  });
}
```

Call this immediately after:

- `#v2AwakenTabs` is rebuilt in `renderBase(card)`
- a sidebar awaken button is clicked in `handleSidebarAwaken(event)`
- `setCardState(card, idx)` updates state

Do not use a document-wide observer.

### If CSS cascade is wrong

Patch only `test-catalog-v2-theme.css` or the later-loading CSS/injected style that actually wins the cascade.

Suggested selectors:

```css
body.page-catalog-v2 #v2AwakenTabs > button,
body.page-catalog-v2 #v2AwakenTabs > button.inactive,
body.page-catalog-v2 #v2AwakenTabs > button[aria-pressed="false"]{
  opacity:.38!important;
  filter:saturate(.45) brightness(.58)!important;
  background:rgba(255,255,255,.055)!important;
  color:rgba(255,255,255,.52)!important;
}

body.page-catalog-v2 #v2AwakenTabs > button.active,
body.page-catalog-v2 #v2AwakenTabs > button[aria-pressed="true"],
body.page-catalog-v2 #v2AwakenTabs > button[data-v2-active="true"]{
  opacity:1!important;
  filter:saturate(1.55) brightness(1.2)!important;
  background:linear-gradient(135deg,var(--v2-theme-trim),rgba(168,85,247,.88))!important;
  color:#07030d!important;
}
```

Only apply CSS where it actually wins. If a later JS-injected style wins, patch that injected style instead of adding a weaker CSS rule.

---

## Files that should not be changed for this issue

Do not touch unless you prove the issue lives there:

```text
catalog-v2-lite.js
app.js
optimizer.js
optimizerEngine.js
roster-profile-store.js
runtime-stat-engine.js
mobile-only files
apkfiles data
```

---

## Update the map after fixing

After the fix, update:

```text
CATALOG_CODE_PATH_INDEX.md
```

At minimum, update the Catalog desktop request routing section to clearly say:

```text
Sidebar awaken active/inactive visual state -> actual owning file found during debug
```

Also update any load-order or conflict notes if the real issue is a later CSS/JS override.

If only a temporary note is needed, update:

```text
CATALOG_CODE_PATH_INDEX_CHANGELOG.md
```

---

## Acceptance criteria

On desktop Catalog:

1. Select any character with three states.
2. Click sidebar `5★`.
   - 5★ visibly active.
   - 6★ visibly inactive.
   - FA visibly inactive.
3. Click sidebar `6★`.
   - 5★ visibly inactive.
   - 6★ visibly active.
   - FA visibly inactive.
4. Click sidebar `FA`.
   - 5★ visibly inactive.
   - 6★ visibly inactive.
   - FA visibly active.
5. Sidebar image/description still follows selected state.
6. Mobile behavior is unchanged.
7. Catalog card layout is unchanged.
