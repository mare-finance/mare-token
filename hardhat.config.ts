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
                url: "https://evm.kava.io",
                blockNumber: 3732800,
            },
            addresses: {
                msig: "0x1Ed1b93377B6b4Fa4cC7146a06C8912185C9EAb0",
                usdc: "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f",
                usdcWhale: "0x539dA2877F260Db9cf39b6b0A51B3b56bA41495d",
            },
        },
        kava: {
            chainId: 2222,
            url: "https://evm.kava.io",
            accounts: [process.env.DEPLOYER_KAVA!, process.env.RESERVES_KAVA!],
            verify: {
                etherscan: {
                    apiUrl: "https://explorer.kava.io",
                    apiKey: "abc",
                },
            },
            addresses: {
                msig: "0x1Ed1b93377B6b4Fa4cC7146a06C8912185C9EAb0",
                usdc: "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f",
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
