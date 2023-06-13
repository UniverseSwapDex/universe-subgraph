/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token, Bundle } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";

let WELA_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
let USDC_WELA_PAIR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; 

export function getElaPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(USDC_WELA_PAIR); // usdc is token1
  
  if (usdcPair !== null) {
    return usdcPair.token1Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // ETH
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
  "0x9Bf33eC16237b7593Cd78AD744E8fb4bec767d62", // IDAO
  "0x4b9D9186A4e8A973ec8f6C6f02AeBB781582EB43", // stIDAO
  "0x9855ee9C74A6b07f6C1814Ac6B1771465780252c", // stUNID
  "0x594f097E513c15509f4BA286057C4ACCc3Ef7c2E"  // wUNID
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ELA = BigDecimal.fromString("10");

/**
 * Search through graph to find derived ELA per token.
 * @todo update to be derived ELA (add stablecoin estimates)
 **/
export function findElaPerToken(token: Token): BigDecimal {
  if (token.id == WELA_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveELA.gt(MINIMUM_LIQUIDITY_THRESHOLD_ELA)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedELA as BigDecimal); // return token1 per our token * ELA per token 1
      }
      if (pair.token1 == token.id && pair.reserveELA.gt(MINIMUM_LIQUIDITY_THRESHOLD_ELA)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedELA as BigDecimal); // return token0 per our token * ELA per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedELA.times(bundle.elaPrice);
  let price1 = token1.derivedELA.times(bundle.elaPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedELA.times(bundle.elaPrice);
  let price1 = token1.derivedELA.times(bundle.elaPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
