/* eslint no-console:0 */

"use strict";

const dedent = require("dedent");
const _ = require("lodash");
const moment = require("moment");

const SurBTC = require("@cryptolatam/surbtc").default;
const CryptoMKT = require("@cryptolatam/cryptomkt").default;

const createBot = require("./bot");
const createSessionManager = require("./manager");

const configuration = require("./configuration");
const info = require("../package.json");

const config = configuration();

const manager = createSessionManager(config);
const surbtc = new SurBTC({
  timeout: 5000,
});
const cryptomkt = new CryptoMKT({
  timeout: 5000,
});

// eslint-disable-next-line
const bot = createBot({
  manager,
  config,
  surbtc,
  cryptomkt,
  info,
});

console.log(dedent`
  Bot Started with:
  - NODE_ENV: ${config.get("NODE_ENV")}
  - URL: ${config.get("URL")}
  - PORT: ${config.get("PORT")}
  - TOKEN: ${_.fill([...config.get("TELEGRAM:TOKEN")], "*", 0, -5).join("")}
  - STARTED: ${moment().format()}
`);
