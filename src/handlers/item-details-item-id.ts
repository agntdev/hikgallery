import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { findItem, searchItems, showGallery } from "../gallery.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
function caption(item: NonNullable<Awaited<ReturnType<typeof findItem>>>) { const lines = [item.title, "", item.caption]; if (item.metadata.artist) lines.push(`Artist: ${item.metadata.artist}`); if (item.metadata.date) lines.push(`Date: ${item.metadata.date}`); if (item.metadata.tags.length) lines.push(`Tags: ${item.metadata.tags.join(", ")}`); return lines.join("\n").slice(0, 1024); }
composer.callbackQuery(/^item:details:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const item = await findItem(ctx, ctx.match[1]); if (!item) { await ctx.reply("That item isn’t available anymore. Browse the gallery to find something new."); return; } await ctx.replyWithPhoto(item.telegramFileId, { caption: caption(item), reply_markup: inlineKeyboard([[inlineButton("Share", `item:share:${item.id}`)], [inlineButton("Back to gallery", "gallery:back")]]) }); });
composer.callbackQuery(/^item:share:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const item = await findItem(ctx, ctx.match[1]); if (!item) { await ctx.reply("That item isn’t available anymore."); return; } const username = ctx.me.username; const link = username ? `https://t.me/${username}?start=item_${item.id}` : undefined; await ctx.reply(link ? `Share this item with this link:\n${link}` : "You can forward the image above to share it."); });
composer.callbackQuery("gallery:back", async (ctx) => { await ctx.answerCallbackQuery(); const term = ctx.session.searchTerm; await showGallery(ctx, ctx.session.currentCategoryId ?? "photography", ctx.session.pageIndex ?? 0, true, term ? await searchItems(ctx, term) : undefined); });
export default composer;
