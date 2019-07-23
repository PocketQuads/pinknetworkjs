# pinknetworkjs

This is an api wrapper for https://pink.network/documentation . Please read our API documentation
to understand the different responses.
 
## Getting Started

It can be used in the browser by including the minified version or 
in a node project

### Installing

Use it in a npm environment:
```
npm install pinknetworkjs
```

Use it in the browser:
```html
<!-- socket.io >= 2.0.0 -->
<script type="text/javascript" src="socket.io.min.js" />
<!-- jquery >= 3.0.0 -->
<script type="text/javascript" src="jquery.min.js" />
<!-- api wrapper for browser -->
<script type="text/javascript" src="./node_modules/pinknetworkjs/pinknetwork.min.js" />
```

### Bankroll

#### Non Cycle Roll Example
```javascript
const pinknetwork = require("pinknetworkjs");
const bankroll = new pinknetwork.bankroll()

// create the transaction memo for a roll with multiplier 2x and a rake of 5% and a deposit of 10 WAX
let betconfig = bankroll.createBetConfigByMultiplier(2, 5);
// memo returns false if the bankroll is too small to handle this transaction
let memo = bankroll.createRollTransactionMemo(10, "rake.recipient", betconfig)
// subscribe to the roll to get notified when the result is available
if(memo === false) {
    console.log("bankroll too small")
}

// TODO: send transaction with memo["memo"]

// wait for new roll results
bankroll.getRollSubscription().onNewRollResult((roll) => {
    console.log(roll) // This prints a ROLL_RESULT object. For more information visit the api documentation
})
```

#### Cycle Roll Example
```javascript
const pinknetwork = require("pinknetworkjs");
const bankroll = new pinknetwork.bankroll()

// the roll_id of the cycle roll you want to join
const roll_id = 4;

// create the transaction memo to join a cycle roll with multiplier 2x and a rake of 5% and a deposit of 10 WAX
let betconfig = bankroll.createBetConfig(2, 1, 4700, 10000);
// memo returns false if the bankroll is too small to handle this transaction
let memo = bankroll.createCycleRollTransactionMemo(roll_id, 10, betconfig)
// subscribe to the roll to get notified when the result is available
if(memo === false) {
    console.log("bankroll too small")
}

// TODO: send transaction with memo

// listen to new roll results
bankroll.getCycleRollSubscription(roll_id).onNewRollResult((roll) => {
    console.log(roll) // This prints a ROLL_RESULT object. For more information visit the api documentation
});

// get notified for every new bet for this specific roll_id
bankroll.getCycleRollSubscription(roll_id).onNewBet((bet) => {
    console.log(bet) // A new bet came in. BET_OBJECT
})
```

## Documentation

### Bankroll

The bankroll api has the following classes, but you can only interact with the BankrollAPI class
which will return the other classes.

#### class BankrollAPI

* `getRollSubscription()`
  * @return RollSubscription // object of class RollSubscription

* `getCycleRollSubscription(int roll_id)`
  * @param roll_id // roll_id of the subscription
  * @return CycleRollSubscription // object with the id roll_id
  
* `createBetConfigByMultiplier(float multiplier, float rake, int max_roll = 10000)`
  * @param multiplier // example 2.1
  * @param rake // rake the rake_recipient will receive 1.0 = 1.0%
  * @param max_roll // maximum number a roll result can be
  * @return BetConfig // initiate BetConfig class with multiplier and rake (lower_bound = 1 and upper_bound will be calculated)
  
* `createBetConfigByRange(int lower_bound, int upper_bound, float rake, int max_roll = 10000)`
  * @param lower_bound // between 1 and max_roll
  * @param upper_bound // between lower_bound and max_roll
  * @param rake // rake the rake_recipient will receive 1.0 = 1.0%
  * @param max_roll // maximum number a roll result can be
  * @return BetConfig // initiate BetConfig class with lower_bound, upper_bound and rake (multiplier will be calculated)

* `createBetConfig(float multiplier, int lower_bound, int upper_bound, int max_roll = 10000)`
  * @param multiplier // example 2.1
  * @param lower_bound // between 1 and max_roll
  * @param upper_bound // between lower_bound and max_roll
  * @param max_roll // maximum number a roll result can be
  * @return BetConfig // initiate BetConfig class

* `createRollTransactionMemo(float amount, string rake_recipient, BetConfig bet_config)`
  * @param amount // WAX which is sent (used to verify whether the bet is allowed)
  * @param rake_recipient // Account name which receives the rake
  * @param bet_config // BetConfig object
  * @return string // memo of the transaction
  
* `createCycleRollTransactionMemo(int roll_id, float amount, BetConfig bet_config) `
  * @param roll_id // roll_id of the cycle roll
  * @param amount // WAX which is sent (used to verify whether the bet is allowed)
  * @param bet_config // BetConfig object
  * @return string // memo of the transaction
  
* `async request(string endpoint, params = {}, version = 1, method = "GET")`
  * @param endpoint // example "rolls/1"
  * @param params // example {"limit": 50}
  * @param version // api endpoint version
  * @param method // GET or POST. If POST, the params will be the data
  * @return {"success": bool, "data": mixed, "code": int, "message": string}
  
* ENDPOINTS
  * `async getRollHistory(limit = 50, page = 1, rake_recipient = null, bettor = null)` // endpoint /v1/rolls
  * `async getRollResult(roll_id)` // endpoint /v1/rolls/:roll_id
  * `async getCycleRoll(roll_id)` // endpoint /v1/cycles/info/:roll_id
  * `async getCycleRollHistory(roll_id, limit = 50, page = 1, bettor = null)` // endpoint /v1/cycles/:roll_id
  * `async getCycleRollResult(roll_id, cycle_id)` // endpoint /v1/cycles/:roll_id/:cycle_id

#### class BetConfig
This is a config class which stores multiplier, lower_bound, upper_bound and max_roll
and is needed to create transaction memos or calculate the max bet. The rake is also stored
indirectly in this class because it is calculated with the difference between multiplier and 
winning percentage `(upper_bound - lower_bound + 1) / max_roll`. 
The methods `createBetConfigByMultiplier`, `createBetConfigByRange`, `createBetConfig` are
used to initiate objects of this class.

* GETTER
  * `getLowerBound()` @return int
  * `getUpperBound()` @return int
  * `getMultiplier()` @return float
  * `getMaxRoll()` @return int

#### class RollSubscription
This class contains a socket connection to the endpoint `/bankroll/v1/rolls/subscribe`
and fires events whenever the bankroll is updated or a new roll came in which you have subscribed to.

* Methods
  * `getMaxBet(BetConfig bet_config)`

* Events
  * `onNewRollResult(callback cb)`
  * `onBankrollUpdate(callback cb)`

* Subscribers
  * `subscribeRakeRecipient(string wax_account)`
  * `subscribeIdentifier(string identifier)`
  * `subscribeAll()`



#### class CycleRollSubscription
This class contains the socket connection to the endpoint `/bankroll/v1/cycles/subscribe/[:roll_id]` and
fires a event when a new bet or a new result was published on the blockchain for roll_id

* Methods
  * `getMaxBet(BetConfig bet_config)`

* Events
  * `onNewRollResult(callback cb)`
  * `onNewBet(callback cb)`

