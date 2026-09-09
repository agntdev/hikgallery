import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { searchItems, showGallery } from "../gallery.js";
const composer = new Composer<Ctx>();
async function page(ctx: Ctx, index: number) { const term = ctx.session.searchTerm; await showGallery(ctx, ctx.session.currentCategoryId ?? "photography", index, true, term ? await searchItems(ctx, term) : undefined); }
composer.callbackQuery("gallery:page_next", async (ctx) => { await ctx.answerCallbackQuery({ text: "Loading images…" }); await page(ctx, (ctx.session.pageIndex ?? 0) + 1); });
composer.callbackQuery("gallery:page_prev", async (ctx) => { await ctx.answerCallbackQuery({ text: "Loading images…" }); await page(ctx, (ctx.session.pageIndex ?? 0) - 1); });
composer.callbackQuery(/^gallery:(next|prev):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery({ text: "Loading images…" }); await page(ctx, Number(ctx.match[2])); });
export default composer;
