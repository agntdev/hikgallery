import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { category, itemsInCategory } from "../gallery.js";
import { inlineButton, inlineKeyboard, requireOwner } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
async function owner(ctx: Ctx) { if (ctx.chat?.type !== "private") { await ctx.reply("Gallery management is available in your private chat with me."); return false; } return requireOwner(ctx); }
composer.command("list", async (ctx) => { if (!(await owner(ctx))) return; const categoryId = ctx.match?.trim() || "photography"; const selected = await category(ctx, categoryId); if (!selected) { await ctx.reply("I couldn’t find that collection. Use its short name, like photography."); return; } const items = await itemsInCategory(ctx, categoryId); if (!items.length) { await ctx.reply(`${selected.name} has no items yet — add one with /add.`); return; } const visible = items.slice(0, 8); await ctx.reply(`${selected.name} has ${items.length} item${items.length === 1 ? "" : "s"}.`, { reply_markup: inlineKeyboard(visible.flatMap((item) => [[inlineButton(`${item.title} · ${item.id}`, `item:details:${item.id}`)], [inlineButton("Delete", `delete:${item.id}:yes`)]])) }); });
export default composer;
