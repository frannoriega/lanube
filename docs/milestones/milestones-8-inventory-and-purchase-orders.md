# Milestone 8 — Inventory & purchase orders

> **Decided (2026-09-21):** the existing dormant `Inventory`/`PurchaseOrder`
> schema is stale, not authoritative — it predates this use case and doesn't
> match it (1-item-per-order shape, `PENDING/DONE/CANCELLED` status names, no
> threshold column). The use case below wins; schema gets restructured to
> match it via migration, per "Engineering input" below.

## Use case (as described 2026-09-21)

Track what the space physically has — equipment (computers with serial
numbers), office elements, consumables (toilet paper, soap). Each item has
a minimum-stock threshold; admins can adjust quantities. When an item's
quantity drops below its threshold, it's automatically added to a purchase
order — a printable "please buy this" shortcut, not a full procurement
system. A purchase order has a status (pending/ordered/fulfilled); admins
can edit it (add items, change quantities) before it's fulfilled; once
fulfilled, the ordered quantities add back into inventory stock.

## Engineering input — where the existing schema doesn't match the ask

The dormant `Inventory`/`PurchaseOrder` schema predates this conversation
and doesn't actually fit what's being asked — worth calling out before
building on top of it rather than discovering the mismatch mid-migration:

1. **A purchase order today is 1 row = 1 item** (`PurchaseOrder.inventoryId`
   - a single `quantity`). But "admins can edit the purchase order — add
     more items, change the amounts" and "low-stock items get added to _a_
     purchase order" both describe a PO as a **shopping list with multiple
     line items**, not one PO per item. This needs a real restructure: a
     `PurchaseOrder` with a `PurchaseOrderItem` (line item: inventoryId +
     quantity) child table, not a direct `inventoryId` column on the order
     itself.
2. **`OrderStatus` is currently `PENDING/DONE/CANCELLED`**, not the
   `pending/ordered/fulfilled` asked for here — needs updating (and
   deciding whether `CANCELLED` is still wanted as a fourth state, or the
   three named states are the complete set).
3. **No threshold field exists** (`Inventory.quantity` only) — needs a
   `minQuantity`/`threshold` column plus the trigger logic to act on it.
4. **Serialized assets vs. bulk consumables are different shapes**, and the
   current schema only models the bulk case (a `quantity` count). "A
   computer with a serial number" is a trackable individual unit — you
   presumably don't want computer #1 and computer #2 folded into a single
   `quantity: 2` row once they need distinguishing (e.g. one is loaned out,
   one is broken). **Decided (2026-09-21): serialized-asset tracking is in
   scope for v1**, not deferred — so this needs the `InventoryUnit` child
   table (below) built from the start, not bolted on later.

None of this changes the size of the feature much — it's still a
straightforward CRUD + one small trigger — but it does mean this needs a
real schema migration, not just wiring up the existing tables as they
stand today.

## What needs building

1. **Schema**: `Inventory` gets `minQuantity` (or `threshold`) and becomes
   "the kind of thing" (a laptop model, a consumable). A new
   `InventoryUnit` child table (serial number, condition/loan status) holds
   individually-tracked units under an `Inventory` row — used when an item
   is serialized (equipment); bulk consumables (toilet paper, soap) skip
   `InventoryUnit` entirely and just use `Inventory.quantity` directly.
   `Inventory.quantity` for a serialized item is then derived (count of
   `InventoryUnit` rows in an "available" state) rather than
   independently tracked — needs a decision on whether it's a stored,
   trigger-maintained column (consistent with how `ReservationLedger`
   denormalizes for fast reads) or computed at query time (see open
   questions — this determines whether the low-stock trigger reads a
   column or runs a count). `PurchaseOrder` gets a `PurchaseOrderItem`
   line-item child table; `OrderStatus` becomes `PENDING/ORDERED/FULFILLED`
   (+ maybe `CANCELLED`).
2. **Low-stock trigger**: when an inventory update drops `quantity` below
   `minQuantity`, add that item (creating it if missing) as a line item to
   the **current open PO** — needs a decision on what "current open PO"
   means: always exactly one `PENDING` PO that auto-additions land into
   (a running draft), or a new PO per trigger event. Recommend the running
   draft — it matches "purchase order is just a shortcut" better than
   spawning many small POs for the same shopping trip.
3. **Admin inventory UI**: list, create, edit quantity/threshold, and
   manage individual serialized units under an item — add a unit (serial
   number), mark one as loaned/broken/retired, which is what actually
   drives fulfilled-and-restocked serialized items back to "available."
4. **Admin purchase order UI**: view the open PO (or list of POs by
   status), manually add/remove/adjust line items, mark `ORDERED`, and mark
   `FULFILLED` — the fulfillment action is the one with real logic: it must
   add each line item's quantity back into the corresponding `Inventory`
   row's `quantity`, inside one transaction (all-or-nothing, same principle
   as reservation approval's atomicity).
5. **Printable view**: a print-stylesheet (or a dedicated `/admin/
purchase-orders/[id]/print` route) — this is UI-only, no new backend
   concept, just something that renders cleanly on paper.

## Open questions (needs a product decision before/while building)

- **Serialized-unit quantity: stored + trigger-maintained, or computed at
  read time?** Now that serialized tracking is confirmed for v1 (above),
  does `Inventory.quantity` for a serialized item stay a denormalized
  column kept in sync by a trigger whenever a unit's status changes
  (matches the `ReservationLedger` precedent — fast reads, write-time
  cost), or is it just `COUNT(*)` over `InventoryUnit` at query time
  (simpler, no sync-drift risk, likely fine at this data volume — an
  inventory is not a high-write-frequency table)? Leaning toward computed
  — there's no evidence this table will see write volume anywhere close to
  reservations.
- **One running draft PO, or one PO per low-stock event?** Affects both the
  trigger logic and the admin UI (a single evolving list vs. a history of
  many small orders).
- **Can a `PENDING` PO's auto-added items be removed by an admin**, or only
  manually-added ones? (i.e. can an admin say "no, don't buy more toilet
  paper yet" and pull it off the list even though it's still below
  threshold?)
- **Who requests/owns a PO**: is `requestedBy` still meaningful once POs
  aggregate multiple auto-triggered items from different admins' inventory
  edits, or does it become "created automatically, edited by whoever"
  with no single owner?
- **Permission**: `inventory:manage` as a new permission, ADMIN or
  SUPERADMIN? Not yet in `rbac.ts`.
