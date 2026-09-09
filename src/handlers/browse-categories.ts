import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { categories, showGallery } from "../gallery.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Browse gallery", data: "browse:categories", order: 10 });
const composer = new Composer<Ctx>();
composer.callbackQuery("browse:categories", async (ctx) => { await ctx.answerCallbackQuery(); const all = await categories(ctx); await ctx.editMessageText("Pick a collection to explore.", { reply_markup: inlineKeyboard([[inlineButton("All images", "category:all")], ...all.map((entry) => [inlineButton(entry.name, `category:${entry.id}`)]), [inlineButton("Main menu", "menu:main")]]) }); });
composer.callbackQuery(/^category:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery({ text: "Loading images…" }); delete ctx.session.searchTerm; await showGallery(ctx, ctx.match[1], 0, true); });
export default composer;
