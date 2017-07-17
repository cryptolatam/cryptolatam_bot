"use strict";

const bb = require("bot-brother");
const redis = require("redis");
const Bluebird = require("bluebird");
const dedent = require("dedent");
const _ = require("lodash");
const moment = require("moment");
const fs = require("mz/fs");
const path = require("path");

const CryptoMKT = require("@cryptolatam/cryptomkt").default;
const Money = require("@cryptolatam/money");

Bluebird.promisifyAll(redis.RedisClient.prototype);
Bluebird.promisifyAll(redis.Multi.prototype);

const configuration = require("./configuration");
const info = require("../package.json");

const config = configuration();

const cryptomkt = new CryptoMKT();
const client = redis.createClient({
  port: config.get("REDIS:PORT"),
  host: config.get("REDIS:HOST"),
});

const url = config.get("URL");
const token = config.get("TELEGRAM:TOKEN");
const manager = bb.sessionManager.redis({ client });

const bot = bb({
  key: token,
  sessionManager: manager,
  webHook: {
    url: `${url}/bot${token}`,
    port: config.get("PORT"),
  },
});

bot.texts({
  start: dedent`
    Hola,
    Este bot está en desarrollo pero es usable.

    :crystal_ball: Los comandos disponibles son los siguientes:
    <% commands.forEach(command => { %>
    /<%= command -%>
    <% }); -%>
  `,
  about: dedent`
    *(<%= info.version %>)*

    :bust_in_silhouette: *Autor:*
     • <%= info.author.name %>
     • <%= info.author.email %>
     • <%= info.author.url %>
     • @<%= info.author.telegram %>

    :pray: *Ayúdame a mantener esto con alguna donación:*
    - PayPal <%= info.author.paypal %>
    - Bitcoin: \`<%= info.author.btc %>\`
    - Ether: \`<%= info.author.eth %>\`
  `,
  eth: {
    status: dedent`
      CryptoMKT (ETH/CLP):
      *<%= ask %>* :outbox_tray: Venta _(bid)_
      *<%= bid %>* :inbox_tray: Compra _(ask)_

      _<%= date -%>_
    `,
  },
});

bot.command(/.*/).use("before", async ctx => {
  const { name, args } = ctx.command;
  const date = moment().format("YYYY/MM/DD HH:mm:ss");
  // eslint-disable-next-line
  console.log(date, `@${ctx.meta.user.username} (${ctx.meta.user.language_code}):`, `/${name} ${args}`);
});

/**
 * /start
 * Init bot showing this first message.
 */
bot.command("start").invoke(async ctx => {
  const txt = await fs.readFile(path.join(__dirname, "..", "docs", "commands.txt"), "utf8");

  ctx.data.commands = txt.split("\n").filter(Boolean);
  ctx.data.user = ctx.meta.user;
  await ctx.sendMessage("start", { parse_mode: "Markdown" });
});

/**
 * /help
 * Help message, in this case we just redirect to /start
 */
bot.command("help").invoke(async ctx => {
  await ctx.go("start");
});

/**
 * /about
 * Show information from `package.json` like version, author and donation addresses.
 */
bot.command("about").invoke(async ctx => {
  ctx.data.info = info;
  await ctx.sendMessage("about", { parse_mode: "Markdown" });
});

bot.command("btc").invoke(async ctx => {
  return await ctx.sendMessage("No implementado todavía.");
});

bot.command(new RegExp("eth", "i")).invoke(async ctx => {
  await ctx.bot.api.sendChatAction(ctx.meta.chat.id, "typing");
  const { current } = await cryptomkt.getCandle();

  ctx.inlineKeyboard([
    [
      {
        ":arrows_counterclockwise: Actualizar": { go: "eth" },
      },
    ],
  ]);

  ctx.data.date = moment().format("YYYY/MM/DD HH:mm:ss");
  ctx.data.ask = Money.render(current.ask);
  ctx.data.bid = Money.render(current.bid);

  if (ctx.isRedirected) {
    await ctx.updateText("eth.status", {
      parse_mode: "Markdown",
      // reply_markup: { inline_keyboard: [[]] },
    });
  } else {
    await ctx.sendMessage("eth.status", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[]] },
    });
  }
});

// eslint-disable-next-line
console.log(dedent`
  Bot Started with:
  - URL: ${url}
  - PORT: ${config.get("PORT")}
  - TOKEN: ${_.fill([...token], "*", 0, -5).join("")}
`);
