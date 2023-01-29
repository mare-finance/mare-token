import * as dotenv from 'dotenv';
dotenv.config()

import '@nomicfoundation/hardhat-network-helpers';
import "@nomiclabs/hardhat-ethers";
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-deploy';
import { HardhatUserConfig } from 'hardhat/config';
import 'solidity-coverage';

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.5.16',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.10',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    }
                }
            }
        ]
    },
    networks: {
        hardhat: {
            forking: {
                url: "https://evm.kava.io",
                blockNumber: 3378340,
            },
            initialBaseFeePerGas: 0,
            gasPrice: 0,
        },
        kava: {
            chainId: 2222,
            url: "https://evm.kava.io",
            accounts: [process.env.DEPLOYER_KAVA!, process.env.RESERVES_KAVA!],
            verify: {
                etherscan: {
                    apiUrl: "https://explorer.kava.io/api",
                    apiKey: "",
                },
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
