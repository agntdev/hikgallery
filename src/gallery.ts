import type { Ctx } from "./bot.js";
import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

export interface Category { id: string; name: string; shortDescription: string; featuredOrder?: number }
export interface Item { id: string; telegramFileId: string; title: string; caption: string; categoryId: string; metadata: { artist?: string; date?: string; tags: string[] }; createdByAdmin: string; createdAt: string }

interface Statement { bind(...values: unknown[]): Statement; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>; first<T = Record<string, unknown>>(): Promise<T | null> }
interface D1 { prepare(sql: string): Statement }
type EnvContext = Ctx & { env?: { DB?: D1 } };

const seeded: Category[] = [
  { id: "photography", name: "Photography", shortDescription: "Moments framed with care.", featuredOrder: 1 },
  { id: "illustration", name: "Illustration", shortDescription: "Drawn stories to explore." },
  { id: "digital-art", name: "Digital Art", shortDescription: "Fresh work made on screen." },
  { id: "sculptures", name: "Sculptures", shortDescription: "Form, texture, and space." },
  { id: "architecture", name: "Architecture", shortDescription: "Spaces worth a closer look." },
  { id: "other", name: "Other", shortDescription: "More carefully chosen work." },
];
/** Injectable clock seam for created-at values and any future gallery time rules. */
let clock: () => Date = () => new Date();
export const now = (): Date => clock();
export function setGalleryClockForTests(next: (() => Date) | undefined): void { clock = next ?? (() => new Date()); }

function db(ctx: Ctx): D1 | undefined { return (ctx as EnvContext).env?.DB; }
async function setup(ctx: Ctx): Promise<D1 | undefined> {
  const database = db(ctx); if (!database) return undefined;
  await database.prepare("CREATE TABLE IF NOT EXISTS gallery_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, featured_order INTEGER)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS gallery_items (id TEXT PRIMARY KEY, file_id TEXT NOT NULL, title TEXT NOT NULL, caption TEXT NOT NULL, category_id TEXT NOT NULL, metadata TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS gallery_items_category ON gallery_items(category_id, created_at)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS gallery_media_assets (media_id TEXT PRIMARY KEY, file_id TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS gallery_admin_messages (message_id INTEGER, admin_id TEXT NOT NULL, action TEXT NOT NULL, item_id TEXT, timestamp TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS gallery_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
  for (const category of seeded) await database.prepare("INSERT OR IGNORE INTO gallery_categories (id,name,description,featured_order) VALUES (?,?,?,?)").bind(category.id, category.name, category.shortDescription, category.featuredOrder ?? null).run();
  return database;
}
function categoryFrom(row: Record<string, unknown>): Category { return { id: String(row.id), name: String(row.name), shortDescription: String(row.description), ...(row.featured_order == null ? {} : { featuredOrder: Number(row.featured_order) }) }; }
function itemFrom(row: Record<string, unknown>): Item { let metadata: Item["metadata"] = { tags: [] }; try { metadata = JSON.parse(String(row.metadata)) as Item["metadata"]; } catch { /* old malformed record has no optional metadata */ } return { id: String(row.id), telegramFileId: String(row.file_id), title: String(row.title), caption: String(row.caption), categoryId: String(row.category_id), metadata: { ...metadata, tags: Array.isArray(metadata.tags) ? metadata.tags : [] }, createdByAdmin: String(row.created_by), createdAt: String(row.created_at) }; }

export async function categories(ctx: Ctx): Promise<Category[]> { const database = await setup(ctx); if (!database) return seeded; const rows = await database.prepare("SELECT id,name,description,featured_order FROM gallery_categories ORDER BY CASE WHEN featured_order IS NULL THEN 1 ELSE 0 END, featured_order, name").all(); return (rows.results ?? []).map(categoryFrom); }
export async function category(ctx: Ctx, id: string): Promise<Category | undefined> { return (await categories(ctx)).find((entry) => entry.id === id); }
export async function featuredCategory(ctx: Ctx): Promise<Category> { const all = await categories(ctx); return all.find((entry) => entry.featuredOrder !== undefined) ?? all[0] ?? seeded[0]; }
export async function itemsInCategory(ctx: Ctx, categoryId: string): Promise<Item[]> { const database = await setup(ctx); if (!database) return []; const rows = await database.prepare("SELECT * FROM gallery_items WHERE category_id=? ORDER BY created_at DESC, id DESC").bind(categoryId).all(); return (rows.results ?? []).map(itemFrom); }
export async function findItem(ctx: Ctx, id: string): Promise<Item | undefined> { const database = await setup(ctx); if (!database) return undefined; const row = await database.prepare("SELECT * FROM gallery_items WHERE id=?").bind(id).first(); return row ? itemFrom(row) : undefined; }
export async function searchItems(ctx: Ctx, term: string): Promise<Item[]> { const database = await setup(ctx); if (!database) return []; const like = `%${term.toLowerCase()}%`; const rows = await database.prepare("SELECT * FROM gallery_items WHERE lower(title) LIKE ? OR lower(metadata) LIKE ? ORDER BY created_at DESC, id DESC").bind(like, like).all(); return (rows.results ?? []).map(itemFrom); }
export async function saveCategory(ctx: Ctx, name: string): Promise<Category> { const database = await setup(ctx); if (!database) throw new Error("storage unavailable"); const id = slug(name); await database.prepare("INSERT OR IGNORE INTO gallery_categories (id,name,description,featured_order) VALUES (?,?,?,NULL)").bind(id, name, `A collection of ${name}.`).run(); return (await category(ctx, id))!; }
export async function saveItem(ctx: Ctx, item: Item): Promise<void> { const database = await setup(ctx); if (!database) throw new Error("storage unavailable"); await database.prepare("INSERT INTO gallery_items (id,file_id,title,caption,category_id,metadata,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(item.id,item.telegramFileId,item.title,item.caption,item.categoryId,JSON.stringify(item.metadata),item.createdByAdmin,item.createdAt).run(); await database.prepare("INSERT OR REPLACE INTO gallery_media_assets (media_id,file_id,mime_type,size_bytes) VALUES (?,?,?,?)").bind(`media_${item.id}`,item.telegramFileId,"image/jpeg",null).run(); }
export async function recordAdminAction(ctx: Ctx, action: string, itemId?: string): Promise<void> { const database = await setup(ctx); if (!database) return; await database.prepare("INSERT INTO gallery_admin_messages (message_id,admin_id,action,item_id,timestamp) VALUES (?,?,?,?,?)").bind(null, String(ctx.from?.id ?? ctx.chat?.id ?? ""), action, itemId ?? null, now().toISOString()).run(); }
export async function removeItem(ctx: Ctx, id: string): Promise<boolean> { const database = await setup(ctx); if (!database) throw new Error("storage unavailable"); if (!(await findItem(ctx,id))) return false; await database.prepare("DELETE FROM gallery_items WHERE id=?").bind(id).run(); return true; }
export function slug(value: string): string { const result = value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,32); return result || "other"; }
export function makeId(): string { return `g${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`; }
export function parseMetadata(input: string): Item["metadata"] { const result: Item["metadata"] = { tags: [] }; for (const part of input.split(";")) { const [key, ...rest] = part.split(":"); const value = rest.join(":").trim(); if (!value) continue; if (key.trim().toLowerCase() === "artist") result.artist = value; else if (key.trim().toLowerCase() === "date") result.date = value; else if (key.trim().toLowerCase() === "tags") result.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0,20); } return result; }
export function clearDraft(ctx: Ctx): void { delete ctx.session.step; delete ctx.session.draftFileId; delete ctx.session.draftMimeType; delete ctx.session.draftSize; delete ctx.session.draftTitle; delete ctx.session.draftCategoryId; delete ctx.session.draftCaption; }

export async function showGallery(ctx: Ctx, categoryId: string, page = 0, edit = false, results?: Item[]): Promise<void> { const chosen = await category(ctx, categoryId); if (!chosen && !results) { await ctx.reply("That collection isn’t available anymore. Tap Browse categories to choose another."); return; } const collection = results ?? await itemsInCategory(ctx, categoryId); const totalPages = Math.max(1, Math.ceil(collection.length / 4)); const actual = Math.max(0, Math.min(page, totalPages - 1)); ctx.session.currentCategoryId = categoryId; ctx.session.pageIndex = actual; const visible = collection.slice(actual * 4, actual * 4 + 4); const heading = results ? `Here are matches for “${ctx.session.searchTerm ?? "your search"}” — page ${actual + 1} of ${totalPages}.` : `${chosen!.name} — ${chosen!.shortDescription}\nPage ${actual + 1} of ${totalPages}.`;
  const rows = visible.map((item) => [inlineButton(item.title.slice(0, 48), `item:details:${item.id}`), inlineButton("Share", `item:share:${item.id}`)]);
  if (collection.length === 0) rows.push([inlineButton("Browse categories", "browse:categories")]);
  const nav = []; if (actual > 0) nav.push(inlineButton("‹ Prev", `gallery:prev:${actual - 1}`)); if (actual < totalPages - 1) nav.push(inlineButton("Next ›", `gallery:next:${actual + 1}`)); if (nav.length) rows.push(nav); rows.push([inlineButton("Browse categories", "browse:categories"), inlineButton("Main menu", "menu:main")]);
  const text = collection.length ? heading : `${chosen!.name} has no images yet — tap Browse categories to explore another collection.`;
  const extra = { reply_markup: inlineKeyboard(rows) }; if (edit) await ctx.editMessageText(text, extra); else await ctx.reply(text, extra);
}
