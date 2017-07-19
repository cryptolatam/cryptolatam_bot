/* eslint no-console:0 */

"use strict";

const bb = require("bot-brother");
const redis = require("redis");
const Bluebird = require("bluebird");
const dedent = require("dedent");
const _ = require("lodash");
const moment = require("moment");

const SurBTC = require("@cryptolatam/surbtc").default;
const CryptoMKT = require("@cryptolatam/cryptomkt").default;

const createBot = require("./bot");

Bluebird.promisifyAll(redis.RedisClient.prototype);
Bluebird.promisifyAll(redis.Multi.prototype);

const configuration = require("./configuration");
const info = require("../package.json");

const config = configuration();

const surbtc = new SurBTC({
  timeout: 5000,
});
const cryptomkt = new CryptoMKT({
  timeout: 5000,
});
const client = redis.createClient({
  port: config.get("REDIS:PORT"),
  host: config.get("REDIS:HOST"),
});
const manager = bb.sessionManager.redis({ client });

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
