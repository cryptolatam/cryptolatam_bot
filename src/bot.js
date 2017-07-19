"use strict";

const bb = require("bot-brother");
const dedent = require("dedent");
const moment = require("moment");
const fs = require("mz/fs");
const path = require("path");

const Money = require("@cryptolatam/money");

module.exports = function createBot(options) {
  const { config, manager, surbtc, cryptomkt, info } = options;
  const token = config.get("TELEGRAM:TOKEN");

  const COMMANDS_PATH = path.join(__dirname, "..", "docs", "commands.txt");

  const bot = bb({
    key: token,
    sessionManager: manager,
    webHook: {
      url: `${config.get("URL")}/bot${token}`,
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
      :bust_in_silhouette: *Autor:*
       • <%= info.author.name %>
       • <%= info.author.email %>
       • <%= info.author.url %>
       • @<%= info.author.telegram %>

      :pray: *Ayúdame a mantener esto con alguna donación:*
      - PayPal:
        <%= info.author.paypal %>
      - Bitcoin:
        \`<%= info.author.btc %>\`
      - Ether:
        \`<%= info.author.eth %>\`
    `,
    market: {
      status: dedent`
        <% exchanges.forEach(exchange => { %>
        :bank: *<%= exchange.name %>* (<%= exchange.change %>):
        :outbox_tray: BID: \`<%= exchange.ask %>\`
        :inbox_tray: ASK: \`<%= exchange.bid %>\`
        :bar_chart: Volumen: \`<%= exchange.volume %>\`
        <% }) %>
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
    const txt = await fs.readFile(COMMANDS_PATH, "utf8");
    // Use String.raw to fix scape problem.
    ctx.data.commands = txt.replace("_", String.raw`\_`).split("\n").filter(Boolean);
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

  bot.command(new RegExp("btc", "i")).invoke(async ctx => {
    ctx.bot.api.sendChatAction(ctx.meta.chat.id, "typing");
    const exchanges = await Promise.all([surbtc.getCandle("BTC", "CLP")]);

    ctx.inlineKeyboard([
      [
        {
          ":arrows_counterclockwise: Actualizar": { go: "btc" },
        },
      ],
    ]);

    ctx.data.date = moment().format("YYYY/MM/DD HH:mm:ss");
    ctx.data.exchanges = exchanges.map(exchange => ({
      name: "SurBTC",
      change: "BTC/CLP",
      ask: Money.render(exchange.current.ask),
      bid: Money.render(exchange.current.bid),
      volume: Money.render(exchange.current.volume),
    }));

    if (ctx.isRedirected) {
      await ctx.updateText("market.status", {
        parse_mode: "Markdown",
        // reply_markup: { inline_keyboard: [[]] },
      });
    } else {
      await ctx.sendMessage("market.status", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[]] },
      });
    }
  });

  bot.command(new RegExp("eth", "i")).invoke(async ctx => {
    ctx.bot.api.sendChatAction(ctx.meta.chat.id, "typing");
    const exchanges = await Promise.all([cryptomkt.getCandle(), surbtc.getCandle("ETH", "CLP")]);

    ctx.inlineKeyboard([
      [
        {
          ":arrows_counterclockwise: Actualizar": { go: "eth" },
        },
      ],
    ]);

    ctx.data.date = moment().format("YYYY/MM/DD HH:mm:ss");
    ctx.data.exchanges = exchanges.map((exchange, i) => ({
      name: i === 0 ? "CryptoMKT" : "SurBTC",
      change: "ETH/CLP",
      ask: Money.render(exchange.current.ask),
      bid: Money.render(exchange.current.bid),
      volume: Money.render(exchange.current.volume),
    }));

    if (ctx.isRedirected) {
      await ctx.updateText("market.status", {
        parse_mode: "Markdown",
        // reply_markup: { inline_keyboard: [[]] },
      });
    } else {
      await ctx.sendMessage("market.status", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[]] },
      });
    }
  });
};
