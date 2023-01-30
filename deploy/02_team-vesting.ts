import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

const vestingAmount = ethers.utils.parseEther("12000000");
const vestingBegin = 1664409600; // 2022-09-29 12:00:00 AM UTC
const vestingDuration = 2 * 365 * 24 * 60 * 60; // 1 year
const cliffDuration = 3 * 30 * 24 * 60 * 60; // 3 months

const recipients: any = {
    "0xEF70c2783E81C634F2331B4aD41E547e2F704Ed1":
        ethers.utils.parseEther("4500"),
    "0x40Bd6e764DBc5C7268aaC775D8978881B16221F1":
        ethers.utils.parseEther("4500"),
    "0xB58Ee267704ec4529e1B1f17B81Db73279DC4821":
        ethers.utils.parseEther("2000"),
    "0x87Cd8B143992D6BBaFb4701E8c463dF59D787568":
        ethers.utils.parseEther("500"),
    "0x8E72a24221517E51502f20f387415a06b27A5b51":
        ethers.utils.parseEther("250"),
    "0xA07f2E459773733b15A1eB95Be7530EE6DaDb515":
        ethers.utils.parseEther("250"),
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: { deploy, get },
        getNamedAccounts,
    } = hre;
    const vestingEnd = vestingBegin + vestingDuration;
    const vestingCliff = vestingBegin + cliffDuration;

    const { adminAccount } = await getNamedAccounts();
    await impersonateAccount(adminAccount);
    const admin = await ethers.getSigner(adminAccount);

    const mareDeploy = await get("Mare");
    const mare = await ethers.getContractAt(
        "contracts/interfaces/IERC20.sol:IERC20",
        mareDeploy.address
    );

    // Deploy Vester Cliff
    const vesterCliffDeploy = await deploy("VesterCliff", {
        from: admin.address,
        log: true,
        args: [
            mare.address,
            admin.address,
            vestingAmount,
            vestingBegin,
            vestingEnd,
            vestingCliff,
        ],
    });
    const vesterCliff = await ethers.getContractAt(
        "VesterCliff",
        vesterCliffDeploy.address
    );

    // Deploy Distributor
    const ownedDistributorDeploy = await deploy("OwnedDistributor", {
        from: admin.address,
        log: true,
        args: [mare.address, vesterCliff.address, admin.address],
    });
    const ownedDistributor = await ethers.getContractAt(
        "OwnedDistributor",
        ownedDistributorDeploy.address
    );

    // Set vester recipient to Distributor
    await (await vesterCliff.setRecipient(ownedDistributor.address)).wait(1);

    // Edit Recipients
    for (const [recipient, amount] of Object.entries(recipients)) {
        await (await ownedDistributor.editRecipient(recipient, amount)).wait(1);
    }
};

export default func;

const tags = ["team-vesting"];
export { tags };
