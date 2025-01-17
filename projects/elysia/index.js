const ADDRESSES = require("../helper/coreAssets.json");
const sdk = require("@defillama/sdk");
const { stakings } = require("../helper/staking");
const { sumTokensExport } = require("../helper/unwrapLPs");
const abi = require("./abi");
const { ethers } = require("ethers");

const addresses = {
  elfi: "0x4da34f8264cb33a5c9f17081b9ef5ff6091116f4",
  el: "0x2781246fe707bb15cee3e5ea354e2154a2877b16",
  elStaking: "0x3F0c3E32bB166901AcD0Abc9452a3f0c5b8B2C9D",
  dai: ADDRESSES.ethereum.DAI,
  usdt: ADDRESSES.ethereum.USDT,
  busd: ADDRESSES.ethereum.BUSD,
  usdc: ADDRESSES.ethereum.USDC,
  elfiStaking: [
    "0xb41bcd480fbd986331eeed516c52e447b50dacb4",
    "0xCD668B44C7Cf3B63722D5cE5F655De68dD8f2750",
    "0x24a7fb55e4ac2cb40944bc560423b496dfa8803f",
  ],
  bscElfi: "0x6C619006043EaB742355395690c7b42d3411E8c0",
  bscElfiStaking: [
    "0x73653254ED0F28D6E5A59191bbB38B06C899fBcA",
    "0x861c2221e4d73a97cd94e64c7287fd968cba03e4",
  ],
};

const ethMoneyPools = [
  [addresses.dai, "0x527c901e05228f54a9a63151a924a97622f9f173"],
  [addresses.usdt, "0xe0bda8e3a27e889837ae37970fe97194453ee79c"],
  [addresses.usdc, "0x3fea4cc5a03e372ac9cded96bd07795ac9034d71"],
];

const v1BscMoneyPools = [
  [ADDRESSES.bsc.BUSD, "0x5bb4d02a0ba38fb8b916758f11d9b256967a1f7f"],
];

const v2BscMoneyPoolsToken = ADDRESSES.bsc.USDT;
const v2BscMoneyPools = [
  [v2BscMoneyPoolsToken, "0x924B375Ea2E8f1F2E686E53823748C7C29ad6466"],
  [v2BscMoneyPoolsToken, "0xB21a2a097FFC25A4B1C9baA50da482eA84687dcE"],
  [v2BscMoneyPoolsToken, "0x836B9a6EF1B6a813136fe91803285383Ba94956C"],
  [v2BscMoneyPoolsToken, "0x5a0154B76E8afe0ef3AA28fD6b4eA863458dB9EB"],
];

const v2KlaytnMoneyPoolsToken = ADDRESSES.klaytn.oUSDT;
const v2KlaytnMoneyPools = [
  [v2KlaytnMoneyPoolsToken, "0x60961ca3A40BE41ddDEf708bf51ef2F8e9760A3b"],
  [v2KlaytnMoneyPoolsToken, "0x7F97f905A8d6fe4C493D339F094232E3577b4DBd"],
];

function ethBorrowed() {
  return async (_, _b, { ["ethereum"]: block }) => {
    const pools = ethMoneyPools;
    const { output: bals } = await sdk.api.abi.multiCall({
      abi: "erc20:balanceOf",
      calls: pools.map((i) => ({ target: i[0], params: i[1] })),
      chain: "ethereum",
      block,
    });
    const { output: totalSupplies } = await sdk.api.abi.multiCall({
      abi: "erc20:totalSupply",
      calls: pools.map((i) => ({ target: i[1] })),
      chain: "ethereum",
      block,
    });
    const balances = {};
    bals.forEach(({ input: { target }, output }, i) => {
      sdk.util.sumSingleBalance(
        balances,
        target,
        totalSupplies[i].output - output,
        "ethereum"
      );
    });
    return balances;
  };
}

function bscBorrowed() {
  return async (_, _b, { ["bsc"]: block }) => {
    const pools = v1BscMoneyPools;
    const { output: bals } = await sdk.api.abi.multiCall({
      abi: "erc20:balanceOf",
      calls: pools.map((i) => ({ target: i[0], params: i[1] })),
      chain: "bsc",
      block,
    });

    const { output: totalSupplies } = await sdk.api.abi.multiCall({
      abi: "erc20:totalSupply",
      calls: pools.map((i) => ({ target: i[1] })),
      chain: "bsc",
      block,
    });
    const balances = {};
    bals.forEach(({ input: { target }, output }, i) => {
      sdk.util.sumSingleBalance(
        balances,
        target,
        totalSupplies[i].output - output,
        "bsc"
      );
    });

    const { output: loansValues } = await sdk.api.abi.multiCall({
      abi: abi.loansValue,
      calls: v2BscMoneyPools.map((pool) => ({ target: pool[1] })),
      chain: "bsc",
      block,
    });

    loansValues.forEach(({ input: { target }, output }, i) => {
      sdk.util.sumSingleBalance(
        balances,
        v2BscMoneyPoolsToken,
        Number(output),
        "bsc"
      );
    });

    return balances;
  };
}

function klaytnBorrowed() {
  return async (_, _b, { ["klaytn"]: block }) => {
    const balances = {};
    const { output: loansValues } = await sdk.api.abi.multiCall({
      abi: abi.loansValue,
      calls: v2KlaytnMoneyPools.map((pool) => ({ target: pool[1] })),
      chain: "klaytn",
      block,
    });

    loansValues.forEach(({ input: { target }, output }, i) => {
      sdk.util.sumSingleBalance(
        balances,
        v2KlaytnMoneyPoolsToken,
        Number(output),
        "klaytn"
      );
    });

    return balances;
  };
}

const bscTokenAndOwners = [...v1BscMoneyPools, ...v2BscMoneyPools];

module.exports = {
  timetravel: true,
  ethereum: {
    borrowed: ethBorrowed(),
    tvl: sumTokensExport({ tokensAndOwners: ethMoneyPools }),
    staking: sumTokensExport({
      tokens: [addresses.el, addresses.elfi],
      owners: [addresses.elStaking, ...addresses.elfiStaking],
    }),
  },
  bsc: {
    tvl: sumTokensExport({ tokensAndOwners: bscTokenAndOwners, chain: "bsc" }),
    borrowed: bscBorrowed(),
    staking: stakings(addresses.bscElfiStaking, addresses.bscElfi, "bsc"),
  },
  klaytn: {
    tvl: sumTokensExport({ v2KlaytnMoneyPools }),
    borrowed: klaytnBorrowed(),
  },
};
