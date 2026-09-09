import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { findItem, recordAdminAction, removeItem } from "../gallery.js";
import { adminChatId, confirmKeyboard, requireOwner } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
async function owner(ctx: Ctx) { if (ctx.chat?.type !== "private") { await ctx.reply("Gallery management is available in your private chat with me."); return false; } return requireOwner(ctx); }
composer.command("delete", async (ctx) => { if (!(await owner(ctx))) return; const id = ctx.match?.trim(); if (!id) { await ctx.reply("Send the item ID too, like /delete g123abc."); return; } if (!(await findItem(ctx, id))) { await ctx.reply("I couldn’t find that item. Check the ID and try again."); return; } await ctx.reply(`Delete ${id}? This removes it from the public gallery.`, { reply_markup: confirmKeyboard(`delete:${id}`, { yes: "Delete", no: "Keep it" }) }); });
composer.callbackQuery(/^delete:([^:]+):(yes|no)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; const [, id, action] = ctx.match; if (action === "no") { await ctx.editMessageText("Kept it in the gallery."); return; } try { if (!(await removeItem(ctx, id))) { await ctx.editMessageText("That item was already gone."); return; } await recordAdminAction(ctx, "delete", id); const text = `Item deleted — ID: ${id}`; await ctx.editMessageText(text); const destination = adminChatId(ctx as Ctx & { env?: Record<string, unknown> }); if (destination && destination !== String(ctx.chat?.id)) await ctx.api.sendMessage(destination, text).catch(() => undefined); } catch { await ctx.editMessageText("I couldn’t delete that item. Please try again."); } });
export default composer;
