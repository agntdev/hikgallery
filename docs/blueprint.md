# GalleryHikBot — Bot specification

**Archetype:** content

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

A read-only, curated Telegram image gallery: public visitors browse categorized, paginated image collections with item details and share buttons; gallery admins manage content (add/list/delete) via a private admin-only chat. Images persist as Telegram media so items can be re-sent and shared; public users cannot upload or edit content.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Public visitors who want to browse curated images inside Telegram
- Customers or prospects who want to share or view image details
- Gallery admins who upload and manage items via a private admin chat

## Success criteria

- Visitor can open /start and see a featured category and first page of items with working Prev/Next inline buttons
- Visitor can pick a category, paginate (4 items/page), open an item to view full image + caption + metadata, and use Share to forward or get a shareable deep link
- Search via /search <term> returns matching items by title or tags
- Admin (identified by ADMIN_CHAT_ID) can add an item (/add), list items (/list), and delete by ID (/delete <item_id>) in private chat and receives confirmation notifications
- Images persist (re-sent via Telegram file_id) after restarts and the same stable item IDs exist for management and sharing

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main gallery menu, show featured category and first page of items
- **Browse categories** (button, actor: user, callback: browse:categories) — Open the inline category picker
  - outputs: category list (buttons)
- **Next page** (button, actor: user, callback: gallery:page_next) — Load next page of items in current category
  - inputs: current category id, page index
  - outputs: next page of item thumbnails (up to 4)
- **View details** (button, actor: user, callback: item:details:<item_id>) — Open full item view with caption, metadata and share button
  - inputs: item_id
  - outputs: full image message with caption and control buttons
- **/search** (command, actor: user, command: /search <term>) — Keyword search across item titles and tags; returns result list with same pagination-style controls
- **/add** (command, actor: admin, command: /add) — Admin-only: start add-item wizard (upload image, enter title, pick/enter category, caption, optional metadata)
  - inputs: image file, title, category, caption, optional metadata
  - outputs: new item saved confirmation, admin notification
- **/delete** (command, actor: admin, command: /delete <item_id>) — Admin-only: delete an item by stable item ID
  - inputs: item_id
  - outputs: delete confirmation, admin notification
- **/list** (command, actor: admin, command: /list [category]) — Admin-only: list items, optionally filtered by category
  - inputs: optional category id
  - outputs: paginated list of item summary cards with IDs

## Flows

### Start & Featured
_Trigger:_ /start

1. Bot shows a short welcome and the featured category header
2. Bot sends first page of items for the featured category (4 items) as a compact grid or sequential messages with inline Prev/Next, Details, Share buttons
3. Inline keyboard includes a 'Browse categories' button to open category picker

_Data touched:_ Category, Item, SessionState

### Category browsing & pagination
_Trigger:_ callback browse:categories or gallery:page_*

1. User opens category picker (inline keyboard); selects a category
2. Bot sends page 1 of items for that category (4 items) with Prev/Next and item action buttons
3. User presses Next/Prev; bot updates message or sends new page preserving user's current category and page index

_Data touched:_ Category, Item, SessionState

### View item details & share
_Trigger:_ callback item:details:<item_id>

1. Bot fetches item by ID and sends full-size image with caption including title and optional metadata (artist/date/tags)
2. Inline buttons: Details (metadata expanded or inline), Share (opens Telegram forward/share UI or returns deep link), Back to gallery (returns to previous page)
3. If Share selected, bot either provides a deep link to the item (bot deep link) or prompts user to forward the message

_Data touched:_ Item

### Search
_Trigger:_ /search <term>

1. Bot searches title and tags for the keyword (case-insensitive substring match)
2. Bot returns paginated results (same UI model as browsing) or 'no results' message
3. User navigates results with Prev/Next and opens item details as usual

_Data touched:_ Item

### Admin add item (wizard)
_Trigger:_ /add in admin chat

1. Bot verifies sender's chat id matches ADMIN_CHAT_ID
2. Bot asks admin to upload an image (ForceReply or expect photo message)
3. Bot prompts for title (ForceReply), then prompts to pick or type category (inline buttons for existing categories or 'Add new category' fallback), then caption, then optional metadata (artist/date/tags)
4. Bot stores media file_id, creates stable item ID, persists item and media reference, and responds with confirmation
5. Bot sends a confirmation message to admin chat (and optionally to an owner notification target)

_Data touched:_ Item, Category, MediaAsset, AdminMessage

### Admin delete item
_Trigger:_ /delete <item_id> in admin chat

1. Bot verifies admin identity, looks up item by ID
2. Bot asks for confirmation via inline Yes/No
3. On Yes: delete item record (media remains in Telegram but item no longer visible), send confirmation message and notification to admin
4. On No: cancel and notify admin

_Data touched:_ Item, AdminMessage

### Admin list items
_Trigger:_ /list [category] in admin chat

1. Bot verifies admin identity and optionally filters by category
2. Bot returns a paginated list of items with IDs and quick inline delete buttons per item
3. Admin can tap item entries to open details or delete

_Data touched:_ Item, Category

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id of the gallery admin who can add/delete items
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Category** _(retention: persistent)_ — A gallery category grouping items (seeded defaults provided). Visible to all users.
  - fields: id (string stable id), name (string), short_description (string), featured_order (optional int)
- **Item** _(retention: persistent)_ — A gallery item: stored media with title, caption and optional metadata; referenced by a stable item ID for sharing and admin actions.
  - fields: id (string stable id), telegram_file_id (string) OR stored media reference, title (string), caption (string), category_id (string), metadata (object: artist, date, tags[]), created_by_admin (admin id), created_at (timestamp)
- **MediaAsset** _(retention: persistent)_ — Internal record to map Telegram file_id (or stored asset) to items so images can be re-sent reliably.
  - fields: media_id (string), telegram_file_id (string), mime_type (string), size_bytes (int, optional)
- **SessionState** _(retention: session)_ — Per-user ephemeral UI state used for pagination and 'back to gallery' behavior.
  - fields: user_id (int), current_category_id (string), page_index (int), last_message_id (int, optional)
- **AdminMessage** _(retention: persistent)_ — Notifications and confirmations sent to admin chat for add/delete actions and errors.
  - fields: message_id (int), admin_id (int), action (string), item_id (string, optional), timestamp (timestamp)

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, file storage (file_id), deep links
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set or change ADMIN_CHAT_ID (owner admin identity) used to authorize admin commands
- Add, edit, or delete categories (seeded defaults available)
- Add items via /add in the admin chat and delete items via /delete
- Set featured category used on /start
- Export items list (CSV/JSON) of titles, IDs, categories for backup
- Enable/disable public search (on/off toggle)

## Notifications

- Admin confirmation on successful add: 'Item saved — ID: <item_id>'
- Admin confirmation on successful delete: 'Item deleted — ID: <item_id>'
- Error notifications to admin on failure to save media or persistence errors

## Permissions & privacy

- Gallery is public-read: visitors can view and share items but cannot upload or modify content
- Admin actions are restricted to the ADMIN_CHAT_ID and validated on every admin command
- Media is stored as Telegram file_id references so images persist; bot stores minimal metadata to recreate messages
- No user-upload persistence for public users; any photo sent by a non-admin is ignored and not stored
- Personal data retention limited to admin identifiers and optional metadata provided for items; owner is responsible for sensitive content policy

## Edge cases

- Category has zero items — bot shows an empty-state message with 'Back' and 'Browse categories' buttons
- Pagination boundaries (Prev on first page or Next on last page) gracefully disabled or hidden
- Image upload fails or Telegram returns invalid file_id — admin gets a failure message and retry suggestion
- Admin deletes an item while a visitor is viewing it — viewing message remains but item is removed from listings; deep-linking the deleted ID returns 'not found'
- Duplicate titles or tags — items are identified and managed by stable item_id, not title
- Large images exceed Telegram size limits — admin receives clear error and guidance to reduce image size
- Search returns no results — bot returns a friendly 'no matches' message and suggests category browse

## Required tests

- Dialog test: /start -> featured category -> page navigation (Next/Prev) -> open item -> Back to gallery
- Search test: /search <term> returns correct items by title and tags and paginates
- Admin add test: as ADMIN_CHAT_ID run /add wizard (upload photo, title, category, caption) and verify item persists and appears in public browse
- Admin delete test: /delete <item_id> confirmation flow and verify item removed from public listings
- Media persistence test: added item's telegram_file_id re-sends correctly after simulated restart
- Permission test: non-admin attempts /add or /delete and is rejected with no side effects

## Assumptions

- Seed categories will be created at deployment (Photography, Illustration, Digital Art, Sculptures, Architecture, Other) if owner does not provide their own
- Shareable link = Telegram bot deep link to open item details (no external hosting or short links required)
- Only one admin identifier is required at deploy time (ADMIN_CHAT_ID); multi-admin support can be added later
- Search is simple substring match over title and tags (no external search service)
- Media storage uses Telegram file_id so no external storage credentials are required
