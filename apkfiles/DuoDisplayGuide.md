# DuoDisplay Integration Guide

This file explains how to use `apkfiles/DuoDisplay.json` to collapse related units into one visible card and switch between related forms from that same card.

## Files

- `apkfiles/Duo.json`
  - broad mechanic reference
  - includes direct links, helper summons, imposters, clones, and related mechanics

- `apkfiles/DuoDisplay.json`
  - UI-facing parent card mapping
  - use this file for card collapse and form switching

## Goal

Reduce page length by showing only one parent card for linked units.

Example:
- show `FrankensteinRegular01`
- hide `FrankensteinRegularDoll01` from the main grid
- add a small button on Frankenstein's card
- clicking the button swaps the card data between Frankenstein and Mary

## Core Rule

Render only `parentCards` as visible roots for grouped units.

Every parent card should manage:

- `baseEntryId`
- `currentEntryId`
- `duoChildren`
- `duoGroup`
- `duoButtonLabel`
- `duoIndex`

Suggested runtime shape:

```js
{
  baseEntryId: "FrankensteinRegular01",
  currentEntryId: "FrankensteinRegular01",
  duoChildren: ["FrankensteinRegularDoll01"],
  duoGroup: "Frankenstein Mary",
  duoButtonLabel: "Switch",
  duoIndex: 0
}
```

## Build Process

### 1. Load character entries
Load all character entry data as usual.

### 2. Load DuoDisplay
Load `apkfiles/DuoDisplay.json`.

### 3. Build a child-to-parent lookup
Create a reverse lookup so every child knows which parent owns it.

Example:

```js
childToParent["FrankensteinRegularDoll01"] = "FrankensteinRegular01";
```

### 4. Filter the main grid
When generating visible cards:

- include all normal entries that are not children of another parent
- hide entries that appear as children in `childToParent`
- render only the parent entry once

## Parent Card Setup

When an entry is in `parentCards`, initialize the card like this:

```js
const duo = duoDisplay.parentCards[entryId];

const cardState = {
  baseEntryId: entryId,
  currentEntryId: entryId,
  duoChildren: duo.children || [],
  duoGroup: duo.group || "",
  duoButtonLabel: duo.buttonLabel || "Forms",
  duoIndex: 0
};
```

## Button Behavior

Use one small button on the card.

When clicked, cycle through:

```js
[parent, ...children]
```

Example:

```js
function cycleDuoForm(cardState) {
  const forms = [cardState.baseEntryId, ...cardState.duoChildren];
  cardState.duoIndex = (cardState.duoIndex + 1) % forms.length;
  cardState.currentEntryId = forms[cardState.duoIndex];
  return cardState.currentEntryId;
}
```

Then re-render the card using `currentEntryId`.

## Rendering Rule

Always render card content from `currentEntryId`, not `baseEntryId`.

That means these fields should all update when the button is pressed:

- portrait
- display name
- title/subtitle
- element
- rarity
- stats
- active skills
- passive skills
- leader skill
- tags
- image path
- entry-based effects or badge data

## Recommended UI Placement

Add the button near the existing card controls.

Recommended labels:

- `Forms`
- `Switch`
- `Transform`
- `Summon`
- `Clone`

Use the `buttonLabel` from `DuoDisplay.json` when available.

## Important Constraint

Do not collapse generic helpers/minions into the main grid by default.

Ignore these categories for normal card merging:

- `genericHelperSummons`
- `enemyImposterExchangeUnits`
- `selfCloneOrDuplicateUnits`

These are mechanic references, not default parent-card groups.

## Safe Default Logic

Only collapse units found in:

```json
DuoDisplay.parentCards
```

That keeps the UI stable and avoids hiding units that should still appear independently.

## Suggested Implementation Order

1. load `DuoDisplay.json`
2. build `childToParent`
3. remove child entries from the visible grid
4. initialize card state for parent entries
5. add a duo button when `duoChildren.length > 0`
6. on click, cycle `currentEntryId`
7. re-render the card from the swapped entry

## Example

Parent:
- `Jeanne01`

Children:
- `JeanneAngel01`

Visible result:
- only one Jeanne card is shown in the grid
- clicking `Transform` swaps between Jeanne and Jeanne Angel

## Developer Note

If you later want dropdown selection instead of cycling, keep the same parent-child structure and replace the cycle function with a selector menu using the same form list.
