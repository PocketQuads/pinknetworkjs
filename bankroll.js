const socketio = require("socket.io-client");
const request = require("request-promise-native");

class BankrollAPI {
    constructor() {
        this.subscription = new RollSubscription();
        this.cycle_roll_subscriptions = {};
    }

    subscription() {
        return this.subscription();
    }

    createTransactionMemo(amount, multiplier, rake, lower_bound = null, upper_bound = null) {

    }

    calculateMaxBet(amount, multiplier, rake) {

    }

    async getRolls(limit = 50, page = 1, rake_recipient = null, bettor = null) {

    }

    async getRollResult(roll_id) {

    }

    async getCycleRoll(roll_id) {

    }

    async getCycleRolls(roll_id, limit = 50, page = 1, bettor = null) {

    }

    async getCycleRollResult(roll_id, cycle_id) {

    }

    getCycleRollSubscription(roll_id) {

    }

    async _request() {

    }
}

class RollSubscription {
    constructor() {
        this.io = socketio.connect()
    }

    onNewRollResult(cb) {

    }

    onBankrollUpdate(cb) {

    }
}

class CycleRollSubscription {
    onNewRollResult(cb) {

    }

    onNewBet(cb) {

    }
}