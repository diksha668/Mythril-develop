require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // Two compilers: Hardhat picks the newest one that satisfies each file's pragma.
    //  - 0.4.25 -> the original SmartBugs contracts (all use ^0.4.x, no overflow checks)
    //  - 0.8.20 -> the fixed contracts (built-in overflow/underflow checks)
    compilers: [
      { version: "0.4.25" },
      { version: "0.8.20" },
    ],
  },
};
