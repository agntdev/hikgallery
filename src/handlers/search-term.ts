import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { searchItems, showGallery } from "../gallery.js";
import { registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Search", data: "search:tip", order: 20 });
const composer = new Composer<Ctx>();
composer.command("search", async (ctx) => { const term = ctx.match?.trim(); if (!term) { await ctx.reply("Tell me what to look for, like /search sunset."); return; } ctx.session.searchTerm = term; const items = await searchItems(ctx, term); if (!items.length) { await ctx.reply("No matches yet — try another word or browse the collections."); return; } await showGallery(ctx, "search", 0, false, items); });
composer.callbackQuery("search:tip", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Search by title or tag. Send /search followed by a word, like /search portrait."); });
export default composer;
