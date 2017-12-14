"use strict";

const bb = require("bot-brother");
const dedent = require("dedent");
const moment = require("moment");
const Bluebird = require("bluebird");
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
    about: {
      info: dedent`
        :bust_in_silhouette: *Autor:*
        • <%= info.author.name %>
        • <%= info.author.email %>
        • <%= info.author.url %>
        • @<%= info.author.telegram %>
      `,
      donations: dedent`
        :pray: *Ayúdame a mantener esto con alguna donación:*

        <% donations.forEach(item => { -%>
        - <%= item.name %>:
          \`<%= item.address %>\`
        <% }); -%>
      `,
    },
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
    // eslint-disable-next-line no-console
    console.log(dedent`
      ${moment().format("YYYY/MM/DD HH:mm:ss")}
      USER: ${JSON.stringify(ctx.meta.user)}
      CHAT: ${JSON.stringify(ctx.meta.chat)}
      FROM: ${JSON.stringify(ctx.meta.from)}
      CMD: ${JSON.stringify(ctx.command)}
      ANSWER: ${JSON.stringify(ctx.answer)}
      CALLBACK: ${JSON.stringify(ctx.callbackData)}
      ---
    `);
  });

  /**
   * /start
   * Init bot showing this first message.
   */
  bot.command("start").invoke(async ctx => {
    const txt = await fs.readFile(COMMANDS_PATH, "utf8");
    // Use String.raw to fix scape problem.
    ctx.data.commands = txt
      .replace("_", String.raw`\_`)
      .split("\n")
      .filter(Boolean);
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
    ctx.data.donations = [
      { name: "BTC", address: config.get("DONATIONS:BTC") },
      { name: "ETH", address: config.get("DONATIONS:ETH") },
      { name: "PayPal", address: config.get("DONATIONS:PAYPAL") },
    ];
    await ctx.sendMessage("about.info", { parse_mode: "Markdown" });
    await ctx.sendMessage("about.donations", { parse_mode: "Markdown" });
  });

  bot.command(new RegExp("btc", "i")).invoke(async ctx => {
    ctx.bot.api.sendChatAction(ctx.meta.chat.id, "typing");

    const promises = [surbtc.getCandle("BTC", "CLP")].map(p => Bluebird.resolve(p).reflect());
    const exchanges = await Bluebird.all(promises);

    ctx.data.date = moment().format("YYYY/MM/DD HH:mm:ss");
    ctx.data.exchanges = exchanges.map(inspection => {
      if (!inspection.isFulfilled()) {
        return {
          name: "SurBTC",
          change: "BTC/CLP",
          ask: "ERROR",
          bid: "ERROR",
          volume: "ERROR",
        };
      } else {
        const exchange = inspection.value();
        return {
          name: "SurBTC",
          change: "BTC/CLP",
          ask: Money.render(exchange.current.ask),
          bid: Money.render(exchange.current.bid),
          volume: Money.render(exchange.current.volume),
        };
      }
    });

    await ctx.sendMessage("market.status", {
      parse_mode: "Markdown",
    });
  });

  bot.command(new RegExp("eth", "i")).invoke(async ctx => {
    ctx.bot.api.sendChatAction(ctx.meta.chat.id, "typing");

    const promises = [cryptomkt.getCandle(), surbtc.getCandle("ETH", "CLP")].map(p => Bluebird.resolve(p).reflect());
    const exchanges = await Bluebird.all(promises);

    ctx.data.date = moment().format("YYYY/MM/DD HH:mm:ss");
    ctx.data.exchanges = exchanges.map((inspection, i) => {
      if (!inspection.isFulfilled()) {
        return {
          name: i === 0 ? "CryptoMKT" : "SurBTC",
          change: "ETH/CLP",
          ask: "ERROR",
          bid: "ERROR",
          volume: "ERROR",
        };
      } else {
        const exchange = inspection.value();
        return {
          name: i === 0 ? "CryptoMKT" : "SurBTC",
          change: "ETH/CLP",
          ask: Money.render(exchange.current.ask),
          bid: Money.render(exchange.current.bid),
          volume: Money.render(exchange.current.volume),
        };
      }
    });

    await ctx.sendMessage("market.status", {
      parse_mode: "Markdown",
    });
  });
};
