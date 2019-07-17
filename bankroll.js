const socketio = require("socket.io-client");
const request = require("request-promise-native");

const API_ENDPOINT = "https://api.pink.network/bankroll/";

class BetConfig {
    constructor(max_roll = 10000) {
        this.lower_bound = null;
        this.upper_bound = null;
        this.rake = 0;
        this.multipler = 0;
    }

    setRange(lower_bound, upper_bound) {
        this.lower_bound = lower_bound;
        this.upper_bound = upper_bound;
    }

    getLowerBound() {
        this._fill();
        return this.lower_bound;
    }

    getUpperBound() {
        this._fill();
        return this.upper_bound;
    }

    setRake(rake) {
        this.rake = rake;
    }

    getRake() {
        this._fill();
        return this.rake;
    }

    setMultiplier(multiplier) {
        this.multipler = multiplier;
    }

    getMultiplier() {
        this._fill();
        return this.multipler;
    }

    _fill() {
        if (this.rake !== null && this.upper_bound !== null && this.multipler === null) {
            if (this.lower_bound === null) {
                this.lower_bound = 1;
            }

            // TODO calculate multiplier
        } else if (this.rake !== null && this.multipler !== null && this.upper_bound === null) {
            if (this.lower_bound === null) {
                this.lower_bound = 1;
            }

            // TODO: calculate upper_bound
        }
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

class BankrollAPI {
    constructor() {
        this.roll_subscription = new RollSubscription();
        this.cycle_roll_subscriptions = {};

        this.bankroll = 10000;
    }

    rollsubscription() {
        return this.roll_subscription;
    }

    cyclesubscription(roll_id) {
        if (typeof this.bankroll["" + roll_id + ""] === "undefined") {
            this.cycle_roll_subscriptions["" + roll_id + ""] = new CycleRollSubscription(this, roll_id);
        }

        return this.cycle_roll_subscriptions["" + roll_id + ""];
    }

    createEmptyBetConfig() {
        return new BetConfig();
    }

    createRollTransactionMemo(amount, rake_recipient, bet_config) {
        if (amount > this.roll_subscription.getMaxBet(amount, bet_config)) {
            return false;
        }

        let identifier = random_hex_string(16);

        return {
            "memo":
                "#bet " + bet_config.getMultiplier() + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound() +
                " " + btoa(rake_recipient) + " " + identifier,
            "identifier": identifier,
            "amount": amount
        }
    }

    createCycleRollTransactionMemo(roll_id, amount, bet_config) {
        if(amount > this.roll_subscription.getMaxBet(amount, bet_config)) {
            return false;
        }

        return {
            "memo": "#join " + roll_id + " " + bet_config.getMultiplier() + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound(),
            "amount": amount
        }
    }

    /* API ENDPOINTS */

    async getRollHistory(limit = 50, page = 1, rake_recipient = null, bettor = null) {
        let resp = await this.request("rolls", {
            "limit": limit,
            "page": page,
            "rake_recipient": rake_recipient,
            "bettor": bettor
        });

        if(resp["success"]) {
            return resp["data"];
        }

        throw resp["code"] + resp["message"];
    }

    async getRollResult(roll_id) {
        let resp = await this.request("rolls/" + roll_id);

        if(resp["success"]) {
            return resp["data"];
        }

        throw resp["code"] + resp["message"];
    }

    async getCycleRoll(roll_id) {
        let resp = await this.request("cycles/info/" + roll_id);

        if(resp["success"]) {
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

        if(resp["success"]) {
            return resp["data"];
        }

        throw resp["code"] + resp["message"];
    }

    async getCycleRollResult(roll_id, cycle_id) {
        let resp = await this.request("cycles/" + roll_id + "/" + cycle_id);

        if(resp["success"]) {
            return resp["data"];
        }

        throw resp["code"] + resp["message"];
    }

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

class RollSubscription {
    constructor(bankroll_api, roll_id) {
        this.api = bankroll_api;
        this.socket = socketio(API_ENDPOINT + "v1/cycles/subscribe/" + roll_id, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax : 5000,
            reconnectionAttempts: Infinity
        });

        this.bankroll = 0;

        this.bankrollcallbacks = [];
        this.rollcallbacks = [];

        let self = this;
        this.socket.on("bankroll_update", function (data) {
            self.bankroll = data;

            for(let i = 0; self.bankrollcallbacks.length; i++) {
                self.bankrollcallbacks[i](data);
            }
        });

        this.socket.on("new_roll", function (data) {
            for(let i = 0; self.rollcallbacks.length; i++) {
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

    subscribeCreator(wax_account) {
        this.socket.emit("subscribe_creator", wax_account)
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

    getMaxBet(bet_config) {
        // TODO: real bankroll calculation
        return 0.05 * this.bankroll;
    }
}

class CycleRollSubscription {
    constructor(bankroll_api, roll_id) {
        this.api = bankroll_api;
        this.socket = socketio(API_ENDPOINT + "v1/cycles/subscribe/" + roll_id, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax : 5000,
            reconnectionAttempts: Infinity
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
            for(let i = 0; self.rollcallbacks.length; i++) {
                self.rollcallbacks[i](data);
            }
        });

        this.socket.on("new_bet", function (data) {
            for(let i = 0; self.betcallbacks.length; i++) {
                self.betcallbacks[i](data);
            }

            self.bets = [];
        });
    }

    onNewRollResult(cb) {
        this.rollcallbacks.push(cb);
    }

    onNewBet(cb) {
        this.betcallbacks.push(cb);
    }

    getMaxBet(bet_config) {
        // TODO: real bankroll calculation
        return 0.05 * this.bankroll;
    }
}

module.exports = BankrollAPI;