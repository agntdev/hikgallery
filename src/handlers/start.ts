import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { featuredCategory, findItem, showGallery } from "../gallery.js";

const composer = new Composer<Ctx>();
composer.command("start", async (ctx) => {
  const argument = ctx.match?.trim();
  if (argument?.startsWith("item_")) {
    const item = await findItem(ctx, argument.slice(5));
    if (!item) { await ctx.reply("That gallery item isn’t available anymore. Tap /start to browse what’s here now."); return; }
    await ctx.replyWithPhoto(item.telegramFileId, { caption: `${item.title}\n\n${item.caption}` });
    return;
  }
  const featured = await featuredCategory(ctx);
  await ctx.reply(`Welcome to the gallery. Here’s ${featured.name} to start.`, { reply_markup: { inline_keyboard: [[{ text: "Browse categories", callback_data: "browse:categories" }], [{ text: "Search", callback_data: "search:tip" }]] } });
  await showGallery(ctx, featured.id);
});
composer.callbackQuery("menu:main", async (ctx) => { await ctx.answerCallbackQuery(); const featured = await featuredCategory(ctx); await showGallery(ctx, featured.id, 0, true); });
export default composer;
