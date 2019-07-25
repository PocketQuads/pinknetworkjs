(function () {
    function r(e, n, t) {
        function o(i, f) {
            if (!n[i]) {
                if (!e[i]) {
                    var c = "function" == typeof require && require;
                    if (!f && c) return c(i, !0);
                    if (u) return u(i, !0);
                    var a = new Error("Cannot find module '" + i + "'");
                    throw a.code = "MODULE_NOT_FOUND", a
                }
                var p = n[i] = {exports: {}};
                e[i][0].call(p.exports, function (r) {
                    var n = e[i][1][r];
                    return o(n || r)
                }, p, p.exports, r, e, n, t)
            }
            return n[i].exports
        }

        for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
        return o
    }

    return r
})()({
    1: [function (require, module, exports) {
        module.exports = function (io, request) {
            const API_ENDPOINT = "https://api.pink.network/bankroll/";

            class BankrollAPI {
                constructor() {
                    this.roll_subscription = new RollSubscription();
                    this.cycle_roll_subscriptions = {};
                }

                /**
                 * @returns {RollSubscription}
                 */
                getRollSubscription() {
                    return this.roll_subscription;
                }

                /**
                 *
                 * @param {number} roll_id
                 * @returns {CycleRollSubscription}
                 */
                getCycleRollSubscription(roll_id) {
                    if (typeof this.cycle_roll_subscriptions[String(roll_id)] === "undefined") {
                        this.cycle_roll_subscriptions[String(roll_id)] = new CycleRollSubscription(roll_id);
                    }

                    return this.cycle_roll_subscriptions[String(roll_id)];
                }

                /**
                 *
                 * @param {number} multiplier
                 * @param {number} rake
                 * @param {number} max_roll
                 * @returns {BetConfig}
                 */
                createBetConfigByMultiplier(multiplier, rake, max_roll = 10000) {
                    let lower_bound = 1;
                    let upper_bound = Math.floor(((99 - rake) / (100 * multiplier)) * max_roll);

                    return new BetConfig(multiplier, lower_bound, upper_bound, max_roll);
                }

                /**
                 *
                 * @param {number} lower_bound
                 * @param {number} upper_bound
                 * @param {number} rake
                 * @param {number} max_roll
                 * @returns {BetConfig}
                 */
                createBetConfigByRange(lower_bound, upper_bound, rake, max_roll = 10000) {
                    let odds = (upper_bound - lower_bound + 1) / max_roll;
                    let multiplier = ((99 - rake) / (100 * odds));

                    return new BetConfig(multiplier.toFixed(3), lower_bound, upper_bound, max_roll);
                }

                /**
                 *
                 * @param {number} multiplier
                 * @param {number} lower_bound
                 * @param {number} upper_bound
                 * @param {number} max_roll
                 * @returns {BetConfig}
                 */
                createBetConfig(multiplier, lower_bound, upper_bound, max_roll = 10000) {
                    return new BetConfig(multiplier, lower_bound, upper_bound, max_roll);
                }

                /**
                 *
                 * @param {number} amount
                 * @param {String} rake_recipient
                 * @param {BetConfig} bet_config
                 * @returns {boolean|{identifier: string, amount: *, memo: string}}
                 */
                createRollTransactionMemo(amount, rake_recipient, bet_config) {
                    if (amount > this.getRollSubscription().getMaxBet(amount, bet_config)) {
                        return false;
                    }

                    let identifier = random_hex_string(16);
                    let client_seed = random_hex_string(16);

                    this.getRollSubscription().subscribeIdentifier(identifier);

                    return "#bet " + bet_config.getMultiplier() + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound() + " " + rake_recipient + " " + identifier + " " + client_seed
                }

                /**
                 *
                 * @param {number} roll_id
                 * @param {number} amount
                 * @param {BetConfig} bet_config
                 * @returns {{amount: *, memo: string}|boolean}
                 */
                createCycleRollTransactionMemo(roll_id, amount, bet_config) {
                    if (amount > this.getCycleRollHistory(roll_id).getMaxBet(amount, bet_config)) {
                        return false;
                    }

                    let client_seed = random_hex_string(16);

                    return "#join " + roll_id + " " + bet_config.getMultiplier() + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound() + " " + client_seed;
                }

                /* API ENDPOINTS */
                async getRollHistory(limit = 50, page = 1, rake_recipient = null, bettor = null) {
                    let resp = await this.request("rolls", {
                        "limit": limit,
                        "page": page,
                        "rake_recipient": rake_recipient,
                        "bettor": bettor
                    });

                    if (resp["success"]) {
                        return resp["data"];
                    }

                    throw resp["code"] + resp["message"];
                }

                async getRollResult(roll_id) {
                    let resp = await this.request("rolls/" + roll_id);

                    if (resp["success"]) {
                        return resp["data"];
                    }

                    throw resp["code"] + resp["message"];
                }

                async getCycleRoll(roll_id) {
                    let resp = await this.request("cycles/info/" + roll_id);

                    if (resp["success"]) {
                        return resp["data"];
                    }

                    throw resp["code"] + resp["message"];
                }

                async getCycleRollHistory(roll_id, limit = 50, page = 1, bettor = null) {
                    let resp = await this.request("cycles/" + roll_id, {
                        "limit": limit,
                        "page": page,
                        "bettor": bettor
                    });

                    if (resp["success"]) {
                        return resp["data"];
                    }

                    throw resp["code"] + resp["message"];
                }

                async getCycleRollResult(roll_id, cycle_id) {
                    let resp = await this.request("cycles/" + roll_id + "/" + cycle_id);

                    if (resp["success"]) {
                        return resp["data"];
                    }

                    throw resp["code"] + resp["message"];
                }

                /**
                 *
                 * @param endpoint
                 * @param params
                 * @param version
                 * @param method
                 * @returns {Promise<{code: number, data: null, success: boolean, message: string}>}
                 */
                async request(endpoint, params = {}, version = 1, method = "GET") {
                    let url = API_ENDPOINT + "v" + version + "/" + endpoint;

                    let querystring = "";

                    if (method === "GET") {
                        for (let key in params) {
                            if (querystring !== "") {
                                url += "&";
                            }

                            querystring += key + "=" + encodeURIComponent(params[key]);
                        }

                        if (querystring.length > 0) {
                            url += "?" + querystring;
                        }
                    }

                    try {
                        if (method === "GET") {
                            return await request({
                                "method": "GET",
                                "uri": url,
                                "json": true
                            });
                        } else if (method === "POST") {
                            return await request({
                                "method": "GET",
                                "uri": url,
                                "body": params,
                                "json": true
                            });
                        }

                        throw 500;
                    } catch (e) {
                        return {"success": false, "data": null, "code": 500, "message": "Internal Server Error"}
                    }
                }
            }

            class BetConfig {
                /**
                 *
                 * @param multiplier
                 * @param lower_bound
                 * @param upper_bound
                 * @param max_roll
                 */
                constructor(multiplier, lower_bound, upper_bound, max_roll = 10000) {
                    this.lower_bound = lower_bound;
                    this.upper_bound = upper_bound;
                    this.multipler = multiplier;
                    this.max_roll = max_roll;
                }

                /**
                 *
                 * @returns {number}
                 */
                getLowerBound() {
                    return this.lower_bound;
                }

                /**
                 *
                 * @returns {number}
                 */
                getUpperBound() {
                    return this.upper_bound;
                }

                /**
                 *
                 * @returns {number}
                 */
                getMultiplier() {
                    return this.multipler;
                }

                /**
                 * @returns {number}
                 */
                getMaxRoll() {
                    return this.max_roll;
                }
            }

            class RollSubscription {
                constructor() {
                    this.socket = io(API_ENDPOINT + "v1/rolls", {
                        "path": "/bankroll/socket"
                    });

                    this.bankroll = 0;

                    this.bankrollcallbacks = [];
                    this.rollcallbacks = [];

                    let self = this;
                    this.socket.on("bankroll_update", function (data) {
                        self.bankroll = data;

                        for (let i = 0; self.bankrollcallbacks.length; i++) {
                            self.bankrollcallbacks[i](data);
                        }
                    });

                    this.socket.on("new_roll", function (data) {
                        for (let i = 0; self.rollcallbacks.length; i++) {
                            self.rollcallbacks[i](data);
                        }
                    });
                }

                subscribeRakeRecipient(wax_account) {
                    this.socket.emit("subscribe_rake_recipient", wax_account)
                }

                subscribeIdentifier(identifier) {
                    this.socket.emit("subscribe_identifier", identifier)
                }

                subscribeAll() {
                    this.socket.emit("subscribe_all", null)
                }

                onNewRollResult(cb) {
                    this.rollcallbacks.push(cb);
                }

                onBankrollUpdate(cb) {
                    this.bankrollcallbacks.push(cb);
                }

                /**
                 *
                 * @param {BetConfig} bet_config
                 * @returns {number}
                 */
                getMaxBet(bet_config) {
                    // TODO: real bankroll calculation
                    return 0.05 * this.bankroll;
                }
            }

            class CycleRollSubscription {
                /**
                 *
                 * @param {number} roll_id
                 */
                constructor(roll_id) {
                    this.socket = io(API_ENDPOINT + "v1/cycles/" + roll_id, {
                        "path": "/bankroll/socket"
                    });

                    this.bankroll = 0;
                    this.bets = [];

                    this.betcallbacks = [];
                    this.rollcallbacks = [];

                    let self = this;

                    this.socket.on("bankroll_update", function (data) {
                        self.bankroll = data;
                    });

                    this.socket.on("new_roll", function (data) {
                        for (let i = 0; self.rollcallbacks.length; i++) {
                            self.rollcallbacks[i](data);
                        }
                    });

                    this.socket.on("new_bet", function (data) {
                        self.bets.push(data);

                        for (let i = 0; self.betcallbacks.length; i++) {
                            self.betcallbacks[i](data);
                        }
                    });
                }

                onNewRollResult(cb) {
                    this.rollcallbacks.push(cb);
                }

                onNewBet(cb) {
                    this.betcallbacks.push(cb);
                }

                /**
                 *
                 * @param {BetConfig} bet_config
                 * @returns {number}
                 */
                getMaxBet(bet_config) {
                    // TODO: real bankroll calculation
                    return 0.05 * this.bankroll;
                }
            }

            function random_hex_string(length) {
                let result = '';
                let characters = '0123456789abcdef';
                let charactersLength = characters.length;

                for (let i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }

                return result;
            }

            return BankrollAPI;
        };
    }, {}], 2: [function (require, module, exports) {
        const request = function (options) {
            return new Promise(function (resolve, reject) {
                if (options["method"] === "GET") {
                    $.ajax({
                        method: "GET",
                        url: options["uri"],
                        dataType: options["json"] ? "json" : "text",
                        success: function (data) {
                            resolve(data);
                        },
                        error: function () {
                            reject()
                        }
                    });
                } else if (options["method"] === "POST") {
                    $.ajax({
                        method: "POST",
                        url: options["uri"],
                        data: options["body"],
                        dataType: options["json"] ? "json" : "text",
                        success: function (data) {
                            resolve(data);
                        },
                        error: function () {
                            reject();
                        }
                    });
                } else {
                    reject();
                }
            })
        };

        pinknetwork = {
            "bankroll": require("./core")(io, request)
        };
    }, {"./bankroll": 1}]
}, {}, [2]);
