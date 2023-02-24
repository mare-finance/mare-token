import * as dotenv from "dotenv";
dotenv.config();

import "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.10",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            chainId: 2222,
            forking: {
                url: "https://evm.testnet.kava.io",
                blockNumber: 3378340,
            },
            initialBaseFeePerGas: 0,
            gasPrice: 0,
            addresses: {
                usdc: "0x43D8814FdFB9B8854422Df13F1c66e34E4fa91fD",
                usdcWhale: "0x446CdC0cFdbf8707F9b67bf3F9d83Bb46B9d3712",
                velo: "0x02f689F7d4Fd01eE8181CCa612Efe9f63178b86E",
                router: "0x9607aC5221B91105C29FAff5E282B8Af081B0063",
                voter: "0xa8B1E1B4333202355785C90fB434964046ef2E64",
                veNFT: "0x9e5EF504ee5c6B0D6735771845F3850989bad369",
            },
        },
        kava: {
            chainId: 2221,
            url: "https://evm.testnet.kava.io",
            accounts: [process.env.DEPLOYER_KAVA!, process.env.RESERVES_KAVA!],
            verify: {
                etherscan: {
                    apiUrl: "https://explorer.testnet.kava.io/api",
                    apiKey: "",
                },
            },
            addresses: {
                usdc: "0x43D8814FdFB9B8854422Df13F1c66e34E4fa91fD",
                usdcWhale: "0x446CdC0cFdbf8707F9b67bf3F9d83Bb46B9d3712",
                velo: "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05",
                router: "0x9c12939390052919af3155f41bf4160fd3666a6f",
                voter: "0x09236cfF45047DBee6B921e00704bed6D6B8Cf7e",
                veNFT: "0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26",
            },
        },
    },
    namedAccounts: {
        adminAccount: {
            default: 0,
        },
        reservesAccount: {
            default: 1,
        },
    },
};

export default config;
