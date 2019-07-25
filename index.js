const io = require("socket.io-client");
const request = require("request-promise-native");

module.exports = {
    "bankroll": require("./core")(io, request)
};