import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const mareAddress = "0xd86c8d4279ccafbec840c782bcc50d201f277419";
const liquidityAmount = ethers.utils.parseEther("2500000");
const vestingAmount = ethers.utils.parseEther("3200000");
const bonusVestingAmount = ethers.utils.parseEther("300000");
const periodBegin = 1677445200; // 2023-02-26 9:00:00 PM UTC
const periodDuration = 3 * 24 * 60 * 60; // 3 days
const bonusDuration = 1 * 24 * 60 * 60; // 1 day
const vestingBegin = 1677715200; // 2023-03-02 12:00:00 AM UTC
const vestingDuration = 1 * 365 * 24 * 60 * 60; // 1 year

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    return false;
    const addresses = hre.network.config.addresses;
    if (!addresses) throw new Error("No addresses in config");

    const {
        deployments: { deploy, get },
        getNamedAccounts,
    } = hre;
    const vestingEnd = vestingBegin + vestingDuration;

    const { adminAccount } = await getNamedAccounts();
    const admin = await ethers.getSigner(adminAccount);

    const mare = await ethers.getContractAt(
        "contracts/interfaces/IERC20.sol:IERC20",
        mareAddress
    );

    // USDC
    const usdc = await ethers.getContractAt(
        "contracts/interfaces/IERC20.sol:IERC20",
        addresses.usdc
    );

    // Distributor
    const vesterDeploy = await deploy("Vester", {
        from: admin.address,
        log: true,
        args: [
            mare.address,
            admin.address,
            vestingAmount,
            vestingBegin,
            vestingEnd,
        ],
        contract: "contracts/VesterSale.sol:VesterSale",
    });
    const vester = await ethers.getContractAt(
        "VesterSale",
        vesterDeploy.address
    );

    const distributorDeploy = await deploy("Distributor", {
        from: admin.address,
        log: true,
        args: [mare.address, vester.address, admin.address],
        contract: "contracts/OwnedDistributor.sol:OwnedDistributor",
    });
    const distributor = await ethers.getContractAt(
        "OwnedDistributor",
        distributorDeploy.address
    );
    await (await vester.setRecipient(distributor.address)).wait(1);

    // Bonus Distributor
    const bonusVesterDeploy = await deploy("BonusVester", {
        from: admin.address,
        log: true,
        args: [
            mare.address,
            admin.address,
            bonusVestingAmount,
            vestingBegin,
            vestingEnd,
        ],
        contract: "contracts/VesterSale.sol:VesterSale",
    });
    const bonusVester = await ethers.getContractAt(
        "VesterSale",
        bonusVesterDeploy.address
    );

    const bonusDistributorDeploy = await deploy("BonusDistributor", {
        from: admin.address,
        log: true,
        args: [mare.address, bonusVester.address, admin.address],
        contract: "contracts/OwnedDistributor.sol:OwnedDistributor",
    });
    const bonusDistributor = await ethers.getContractAt(
        "OwnedDistributor",
        bonusDistributorDeploy.address
    );
    await (await bonusVester.setRecipient(bonusDistributor.address)).wait(1);

    const liquidityGeneratorDeploy = await deploy("LiquidityGenerator", {
        from: admin.address,
        log: true,
        args: [
            [
                admin.address,
                mare.address,
                usdc.address,
                addresses.msig,
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
