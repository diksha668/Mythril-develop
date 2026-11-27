require("@nomicfoundation/hardhat-toolbox");

/**
 * The dataset contracts are Solidity 0.4.x and are analysed/compiled AS-IS.
 * Do not transpile them to 0.8.x before Mythril analysis: 0.8 removes
 * named-function constructors, which would silently erase the SWC-105 bug.
 *
 * Hardhat matches each file to a compiler by its pragma line. All our
 * vulnerable and fixed files pin ^0.4.22 / ^0.4.23 / ^0.4.24 / ^0.4.25 /
 * ^0.4.15, all satisfied by the 0.4.25 compiler below. A 0.8.x entry is
 * kept available in case you add a modern rewrite as a third comparison.
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.4.25",
        settings: { optimizer: { enabled: false } },
      },
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: false } },
      },
    ],
  },
  // selfdestruct code-removal semantics differ by hardfork; the tests avoid
  // relying on them, so the default EVM version is fine.
};
