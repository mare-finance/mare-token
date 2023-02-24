import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatNetworkConfig, HardhatRuntimeEnvironment } from "hardhat/types";

const liquidityAmount = ethers.utils.parseEther("2500000");
const vestingAmount = ethers.utils.parseEther("3200000");
const bonusVestingAmount = ethers.utils.parseEther("300000");
const periodBegin = 1677445200; // 2023-02-26 9:00:00 PM UTC
const periodDuration = 3 * 24 * 60 * 60; // 3 days
const bonusDuration = 1 * 24 * 60 * 60; // 1 day
const vestingBegin = 1664409600; // 2023-02-28 12:00:00 AM UTC
const vestingDuration = 1 * 365 * 24 * 60 * 60; // 1 year

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (hre.network.name !== "localhost") {
        return;
    }

    const addresses = hre.network.config.addresses;
    if (!addresses) throw new Error("No addresses in config");

    const {
        deployments: { deploy, get },
        getNamedAccounts,
    } = hre;
    const vestingEnd = vestingBegin + vestingDuration;

    const { adminAccount, reservesAccount } = await getNamedAccounts();
    const admin = await ethers.getSigner(adminAccount);
    const reserves = await ethers.getSigner(reservesAccount);

    const mareDeploy = await get("Mare");
    const mare = await ethers.getContractAt(
        "contracts/interfaces/IERC20.sol:IERC20",
        mareDeploy.address
    );

    // USDC
    const usdc = await ethers.getContractAt(
        "contracts/interfaces/IERC20.sol:IERC20",
        addresses.usdc
    );

    // Distributor
    const vesterDeploy = await deploy("VesterSale", {
        from: admin.address,
        log: true,
        args: [
            mare.address,
            admin.address,
            vestingAmount,
            vestingBegin,
            vestingEnd,
        ],
    });
    const vester = await ethers.getContractAt(
        "VesterSale",
        vesterDeploy.address
    );
    // await (await mare.transfer(vester.address, vestingAmount)).wait(1)

    const distributorDeploy = await deploy("OwnedDistributor", {
        from: admin.address,
        log: true,
        args: [mare.address, vester.address, admin.address],
    });
    const distributor = await ethers.getContractAt(
        "OwnedDistributor",
        distributorDeploy.address
    );
    await (await vester.setRecipient(distributor.address)).wait(1);

    // Bonus Distributor
    const bonusVesterDeploy = await deploy("VesterSale", {
        from: admin.address,
        log: true,
        args: [
            mare.address,
            admin.address,
            bonusVestingAmount,
            vestingBegin,
            vestingEnd,
        ],
    });
    const bonusVester = await ethers.getContractAt(
        "VesterSale",
        bonusVesterDeploy.address
    );
    /*await (
        await mare.transfer(bonusVester.address, bonusVestingAmount)
    ).wait(1)*/

    const bonusDistributorDeploy = await deploy("OwnedDistributor", {
        from: admin.address,
        log: true,
        args: [mare.address, bonusVester.address, admin.address],
    });
    const bonusDistributor = await ethers.getContractAt(
        "OwnedDistributor",
        bonusDistributorDeploy.address
    );
    await (await bonusVester.setRecipient(bonusDistributor.address)).wait(1);

    const velo = await ethers.getContractAt(
        "./contracts/interfaces/IERC20.sol:IERC20",
        addresses.velo
    );
    const router = await ethers.getContractAt(
        "IVelodromeRouter",
        addresses.router
    );
    const voter = await ethers.getContractAt(
        "IVelodromeVoter",
        addresses.voter
    );

    const liquidityGeneratorDeploy = await deploy("LiquidityGenerator", {
        from: admin.address,
        log: true,
        args: [
            [
                admin.address,
                mare.address,
                usdc.address,
                velo.address,
                router.address,
                voter.address,
                reserves.address,
                distributor.address,
                bonusDistributor.address,
                periodBegin,
                periodDuration,
                bonusDuration,
            ],
        ],
    });
    const liquidityGenerator = await ethers.getContractAt(
        "LiquidityGenerator",
        liquidityGeneratorDeploy.address
    );
    /*await (
        await mare.transfer(liquidityGenerator.address, liquidityAmount)
    ).wait(1)*/

    // Set the liquidity generator as the distributor's admin
    await (await distributor.setAdmin(liquidityGenerator.address)).wait(1);
    await (await bonusDistributor.setAdmin(liquidityGenerator.address)).wait(1);
};

const tags = ["liquidity-generator"];
export { tags };

export default func;
