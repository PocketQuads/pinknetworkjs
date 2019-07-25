/**
 * This is a modified linked list
 * It is used because of the relatively efficient inserting of new elements in the middle
 */
class ChainedRange {

    constructor(lowerBound, upperBound, payout) {
        this.next = null;
        this.lower_bound = lowerBound;
        this.upper_bound = upperBound;
        this.payout = payout;
    }

    /**
     * Inserts a bet in the range list, by passing it through the chain until it is fully inserted
     * @param {Object} bet
     */
    insertBet(bet) {
        if (bet.upper_bound > this.upper_bound) {
            this.next.insertBet(bet)
        }

        if (bet.lower_bound <= this.upper_bound) {
            if (bet.lower_bound <= this.lower_bound) {
                if (bet.upper_bound >= this.upper_bound) {
                    //Bet is in whole range
                    this.payout += parseFloat(bet.amount) * parseFloat(bet.multiplier);
                } else {
                    //Bet is in the left of the range
                    const newRange = new ChainedRange(bet.upper_bound + 1, this.upper_bound, this.payout);
                    this.upper_bound = bet.upper_bound;
                    this.insertNextRange(newRange);
                    this.payout += parseFloat(bet.amount) * parseFloat(bet.multiplier);
                }
            } else {
                if (bet.upper_bound >= this.upper_bound) {
                    //Bet is on the right of the range
                    const newRange = new ChainedRange(bet.lower_bound, this.upper_bound, this.payout + parseFloat(bet.amount) * parseFloat(bet.multiplier));
                    this.upper_bound = bet.lower_bound - 1;
                    this.insertNextRange(newRange);
                } else {
                    //Bet is in the middle of the range
                    const newMiddleRange = new ChainedRange(bet.lower_bound, bet.upper_bound, this.payout + parseFloat(bet.amount) * parseFloat(bet.multiplier));
                    const newRightRange = new ChainedRange(bet.upper_bound + 1, this.upper_bound, this.payout);
                    this.upper_bound = bet.lower_bound - 1;
                    this.insertNextRange(newMiddleRange);
                    newMiddleRange.insertNextRange(newRightRange);
                }
            }
        }
    }

    /**
     *
     * @param {ChainedRange} nextRange
     */
    insertNextRange(nextRange) {
        nextRange.next = this.next;
        this.next = nextRange;
    }
}

/**
 * Calculates the minimum bankroll required to accept the bets in the chained ranges
 * Mirrors the bankroll management function used in the smart contract
 * @param {ChainedRange} chainedRangeStart
 * @param {number} amountCollected
 * @param {number} maxResult
 */
function calculateMinBankroll(chainedRangeStart, amountCollected, maxResult) {
    let variance = 0;
    let currentRange = chainedRangeStart;
    while (currentRange !== null) {
        if (currentRange.payout > amountCollected) {
            //Odds of this range winning
            const odds = (currentRange.upper_bound - currentRange.lower_bound + 1) / maxResult;
            //This factor is the max percentage of the bankroll that could be bet on this result, if it were the only bet
            const maxBetFactor = 5 / Math.sqrt(1 / odds - 1) - 0.2;
            //This is the amount that the bankroll has to play if this range wins, plus the initial bet amount on this range
            const effectivePayout = currentRange.payout - amountCollected + currentRange.payout * odds;
            //The odds of going losing 50% of the bankroll in 100 bets approximately grows proportional to the cube of the relative size of the bet
            variance += Math.pow(effectivePayout * odds / maxBetFactor, 3);
        }
        currentRange = currentRange.next;
    }
    return Math.cbrt(variance) * 100
}


/**
 * Simulates the minBankroll for an additional bet by first adding it in the ranges that it has to be in
 * and then removing it again afterwards, in order not to change the original chained range
 *
 * @param {ChainedRange} chainedRangeStart - First of the chained ranges
 * @param {number} amountCollected - The amount collected from all bets
 * @param {number} maxResult - The max result of the roll
 * @param {ChainedRange[]} betRanges - The ranges that the bet is to be inserted into
 * @param {number} betAmount - The amount of the bet to be inserted
 * @param {number} betMultiplier - The multiplier of the bet to be inserted
 * @param {number} betEV - the EV of the bet to be inserted
 */
function simulateMinBankrollWithInsertedBet(chainedRangeStart, amountCollected, maxResult, betRanges, betAmount, betMultiplier, betEV) {
    for (let i in betRanges) {
        betRanges[i].payout += betAmount * betMultiplier
    }
    const minBankroll = calculateMinBankroll(chainedRangeStart, amountCollected + betAmount * (0.007 + betEV), maxResult);
    for (let i in betRanges) {
        betRanges[i].payout -= betAmount * betMultiplier
    }
    return minBankroll
}


/**
 * Returns the maximum amount that can be bet with the specified betconfig, taking into account the already placed bets
 * This is not an exact number, but rather an educated guess that is slightly lower than the real maximum
 *
 * Note: This function could be implemented a lot more efficient, however it is still easily quick enough to not cause any problem as it is
 *
 * @param {Object[]} bets - already filled with all previous bets
 * @param {BetConfig} betConfig
 * @param {number} bankroll
 */
function getMaxBet(bets, betConfig, bankroll) {
    //Setting up ranges
    const firstRange = new ChainedRange(1, betConfig.max_roll, 0);
    let totalAmountBet = 0;
    for (let i in bets) {
        firstRange.insertBet(bets[i]);
        const ev = (bets[i].upper_bound - bets[i].lower_bound + 1) / betConfig.max_roll * parseFloat(bets[i].multiplier);
        totalAmountBet += parseFloat(bets[i].amount) * (0.007 + ev);
    }

    // Inserting dummy bet to split ranges if necessary
    firstRange.insertBet({
        lower_bound: betConfig.lower_bound,
        upper_bound: betConfig.upper_bound,
        amount: "0",
        multiplier: "0"
    });

    //Finding the ranges that the new bets is in
    const betRanges = [];     // The ranges that this bet is in
    let currentRange = firstRange;
    while (currentRange != null) {
        if (currentRange.lower_bound <= betConfig.upper_bound && currentRange.upper_bound >= betConfig.lower_bound) {
            betRanges.push(currentRange)
        }
        currentRange = currentRange.next;
    }

    //Calculating start value for approximation = max bet, if this bet were the only bet
    const odds = (betConfig.upper_bound - betConfig.lower_bound + 1) / betConfig.max_roll;
    const maxBetFactor = 5 / Math.sqrt(1 / odds - 1) - 0.2;
    let soloMaxBet = bankroll * maxBetFactor / 100;

    const betEV = betConfig.multiplier * odds;

    for (let i = 100; i >= 0; i--) {
        const amount = i / 100 * soloMaxBet;
        const difference = simulateMinBankrollWithInsertedBet(firstRange, totalAmountBet, betConfig.max_roll, betRanges, amount, betConfig.multiplier, betEV) - bankroll;
        if (difference < 0) {
            // -1% for security for rounding errors
            return amount * 0.99
        }
    }
    return 0
}


module.exports = {
    getMaxBet: getMaxBet
};