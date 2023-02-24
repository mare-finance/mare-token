import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import hre from "hardhat";
import { getTokenContract } from "./_utils";

const mantissa = ethers.utils.parseEther("1");
const mareAmount = ethers.utils.parseEther("2500000");
const vestingAmount = ethers.utils.parseEther("3200000");
const bonusVestingAmount = ethers.utils.parseEther("300000");
const initial = 5000;
const periodDuration = 3 * 24 * 60 * 60; // 3 days
const bonusDuration = 1 * 24 * 60 * 60; // 1 day
const vestingBeginGap = 30 * 60; // 30 minutes
const vestingDuration = 1 * 360 * 24 * 60 * 60; // 1 year

const deployFixture = async () => {
    // Accounts
    const [admin, reservesManager, participant1, participant2] =
        await ethers.getSigners();

    const addresses = hre.network.config.addresses;
    if (!addresses) throw new Error("No addresses in config");

    // Times
    const periodBegin = (await ethers.provider.getBlock("latest")).timestamp;
    const periodEnd = periodBegin + periodDuration;
    const vestingBegin = periodEnd + vestingBeginGap;
    const vestingEnd = vestingBegin + vestingDuration;

    // Mare
    const mare = await getTokenContract({
        admin: admin,
        mintAmount: ethers.utils.parseEther("100000000"),
        decimals: "18",
    });

    // USDC
    const usdc = await getTokenContract({
        admin: admin,
        mintAmount: ethers.utils.parseEther("100000"),
        existingAddress: addresses.usdc,
        whaleAddress: addresses.usdcWhale,
        decimals: "6",
    });

    // Distributor
    const Vester = await ethers.getContractFactory("VesterSale");
    const vester = await Vester.deploy(
        mare.address,
        admin.address,
        vestingAmount,
        vestingBegin,
        vestingEnd
    );

    const Distributor = await ethers.getContractFactory("OwnedDistributor");
    const distributor = await Distributor.deploy(
        mare.address,
        vester.address,
        admin.address
    );
    await (await vester.setRecipient(distributor.address)).wait(1);

    // Bonus Distributor
    const BonusVester = await ethers.getContractFactory("VesterSale");
    const bonusVester = await BonusVester.deploy(
        mare.address,
        admin.address,
        bonusVestingAmount,
        vestingBegin,
        vestingEnd
    );

    const BonusDistributor = await ethers.getContractFactory(
        "OwnedDistributor"
    );
    const bonusDistributor = await BonusDistributor.deploy(
        mare.address,
        bonusVester.address,
        admin.address
    );
    await (await bonusVester.setRecipient(bonusDistributor.address)).wait(1);

    // Velodrome Contracts
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
    const veNFT = await ethers.getContractAt(
        "IVelodromeVotingEscrow",
        addresses.veNFT
    );

    // Liquidity Generator
    const LiquidityGenerator = await ethers.getContractFactory(
        "LiquidityGenerator"
    );
    const liquidityGenerator = await LiquidityGenerator.deploy([
        admin.address,
        mare.address,
        usdc.address,
        velo.address,
        router.address,
        voter.address,
        reservesManager.address,
        distributor.address,
        bonusDistributor.address,
        periodBegin,
        periodDuration,
        bonusDuration,
    ]);

    // Add Mare to the liquidity generator
    await (await mare.transfer(liquidityGenerator.address, mareAmount)).wait(1);

    // Add Mare to Vester
    await (await mare.transfer(vester.address, vestingAmount)).wait(1);

    // Add Mare to Bonus Vester
    await (
        await mare.transfer(bonusVester.address, bonusVestingAmount)
    ).wait(1);

    // Set the liquidity generator as the distributor's admin
    await (await distributor.setAdmin(liquidityGenerator.address)).wait(1);
    await (await bonusDistributor.setAdmin(liquidityGenerator.address)).wait(1);

    // Get Pair
    const pairFactory = await ethers.getContractAt(
        "IVelodromePairFactory",
        await router.factory()
    );
    const pairAddress = await pairFactory.getPair(
        mare.address,
        usdc.address,
        false
    );
    const pair = await ethers.getContractAt(
        "./contracts/interfaces/IERC20.sol:IERC20",
        pairAddress
    );

    // Go to 5 hours later
    await ethers.provider.send("evm_increaseTime", [5 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    // Whitelist tokens in behalf of the governor
    const gaugeGovernor = await ethers.getSigner(
        "0xb074ec6c37659525eef2fb44478077901f878012"
    );
    try {
        await (
            await voter.connect(gaugeGovernor).whitelist(mare.address)
        ).wait(1);
    } catch {}
    try {
        await (
            await voter.connect(gaugeGovernor).whitelist(usdc.address)
        ).wait(1);
    } catch {}

    return {
        admin,
        reservesManager,
        participant1,
        participant2,
        mare,
        usdc,
        distributor,
        vester,
        bonusDistributor,
        bonusVester,
        velo,
        router,
        voter,
        veNFT,
        periodBegin,
        vestingBegin,
        liquidityGenerator,
        pair,
        gauge: {},
    };
};

describe("Liquidity Generator", function () {
    it("Should deploy the liquidity generation contract", async function () {
        const deployment = await loadFixture(deployFixture);
        const { liquidityGenerator, pair } = deployment;

        const gauge = await getGauge(deployment);

        expect(liquidityGenerator.address).to.be.properAddress;
        expect(pair.address).to.be.properAddress;
        expect(gauge.address).to.be.properAddress;
    });

    it("Should finalize and stake the liquidity", async function () {
        const deployment = await loadFixture(deployFixture);
        const { liquidityGenerator, pair, participant1, participant2 } =
            deployment;

        // Participates
        await depositParticipant(participant1, deployment);
        await depositParticipant(participant2, deployment);

        // Go to the end of the event and finalize
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // increase time by 3 days
        await ethers.provider.send("evm_mine", []); // mine the next block

        await (await liquidityGenerator.finalize()).wait(1);

        expect(await pair.balanceOf(liquidityGenerator.address)).to.equals(
            0,
            "generator LP balance is 0 after finalize"
        );

        const gauge = await getGauge(deployment);
        expect(await gauge.balanceOf(liquidityGenerator.address)).to.gt(
            0,
            "generator gauge balance is greater than 0 after finalize"
        );
    });

    it("Should withdraw liquidity and send to reserves manager", async function () {
        const deployment = await loadFixture(deployFixture);
        const {
            reservesManager,
            liquidityGenerator,
            pair,
            participant1,
            participant2,
        } = deployment;

        // Participates
        await depositParticipant(participant1, deployment);
        await depositParticipant(participant2, deployment);

        // Go to the end of the event and finalize
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // increase time by 3 days
        await ethers.provider.send("evm_mine", []); // mine the next block
        await (await liquidityGenerator.finalize()).wait(1);

        // Go to the end of the lock time and deliver lp to reserves
        await ethers.provider.send("evm_increaseTime", [6 * 30 * 24 * 60 * 60]); // increase time by 6 monts
        await ethers.provider.send("evm_mine", []); // mine the next block
        await (
            await liquidityGenerator.deliverLiquidityToReservesManager()
        ).wait(1);

        expect(await pair.balanceOf(liquidityGenerator.address)).to.equals(
            0,
            "generator LP balance is 0 after deliver"
        );

        const gauge = await getGauge(deployment);
        expect(await gauge.balanceOf(liquidityGenerator.address)).to.equals(
            0,
            "generator gauge balance is 0 after deliver"
        );
        expect(await pair.balanceOf(reservesManager.address)).to.gt(
            0,
            "reserves LP balance is greater than 0 after deliver"
        );
    });

    it("Should claim velo rewards after vote and bribe", async function () {
        const deployment = await loadFixture(deployFixture);
        const {
            reservesManager,
            velo,
            voter,
            veNFT,
            liquidityGenerator,
            pair,
            participant1,
            participant2,
        } = deployment;

        // Participates
        await depositParticipant(participant1, deployment);
        await depositParticipant(participant2, deployment);

        // Go to the end of the event and finalize
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // increase time by 3 days
        await ethers.provider.send("evm_mine", []); // mine the next block
        await (await liquidityGenerator.finalize()).wait(1);

        // Create Lock for a person
        const veNFTOwner = await ethers.getSigner(
            "0x9a69a19f189585da168c6f125ac23db866caff11"
        );
        const tokenIdIndex = await veNFT.balanceOf(veNFTOwner.address);
        await (
            await veNFT
                .connect(veNFTOwner)
                .create_lock(
                    await velo.balanceOf(veNFTOwner.address),
                    126142880
                )
        ).wait(1);
        const tokenId = await veNFT.tokenOfOwnerByIndex(
            veNFTOwner.address,
            tokenIdIndex
        );

        // Vote for Mare pair on velodrome
        await (
            await voter
                .connect(veNFTOwner)
                .vote(tokenId, [pair.address], [10000])
        ).wait(1);

        // Go to 1 week later and claim velo rewards
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // increase time by 7 days
        await ethers.provider.send("evm_mine", []); // mine the next block

        const gauge = await getGauge(deployment);
        await (await voter.distribute(gauge.address)).wait(1);

        await (await liquidityGenerator.claimVeloRewards()).wait(1);
        // check velo balance after velo claim
        expect(await velo.balanceOf(reservesManager.address)).to.gt(
            0,
            "reserves velo balance is greater than 0 after claim"
        );
    });

    it("Participants should claim their tokens", async function () {
        const deployment = await loadFixture(deployFixture);
        const {
            mare,
            participant1,
            participant2,
            distributor,
            vester,
            bonusDistributor,
            bonusVester,
            vestingBegin,
            liquidityGenerator,
        } = deployment;

        // Participate for Participant 1
        const part1Amount = ethers.utils.parseUnits("100", 6);
        await depositParticipant(participant1, deployment, part1Amount);

        // Participate for Participant 2
        const part2Amount = ethers.utils.parseUnits("155", 6);
        await depositParticipant(participant2, deployment, part2Amount);

        // Go to the end of the event and finalize
        await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // increase time by 3 days
        await ethers.provider.send("evm_mine", []); // mine the next block
        await (await liquidityGenerator.finalize()).wait(1);

        // Go to claim time
        const time = (await ethers.provider.getBlock("latest")).timestamp;
        await ethers.provider.send("evm_increaseTime", [vestingBegin - time]); // go to vesting begin
        await ethers.provider.send("evm_mine", []); // mine the next block

        // Claim tokens for Participant 1 on vester
        const part1Share = part1Amount
            .mul(mantissa)
            .div(part1Amount.add(part2Amount));
        const part1Claim = vestingAmount
            .mul(initial)
            .div(10000)
            .mul(part1Share)
            .div(mantissa);
        await (await distributor.connect(participant1).claim()).wait(1);
        expect(await mare.balanceOf(participant1.address)).to.lt(
            part1Claim.add(ethers.utils.parseEther("10")), // can slightly differ due to first second of claim
            "participant 1 mare balance is not correct after claim"
        );
        // Participant 1 claimed own share but distributor claim all claimable tokens from vester
        const claimedShare = vestingAmount.mul(initial).div(10000);
        expect(await mare.balanceOf(vester.address)).to.gt(
            vestingAmount.sub(claimedShare).sub(ethers.utils.parseEther("10")),
            "vester mare balance is not correct after claim"
        );

        // Claim tokens for Participant 2 on bonus vester
        const part2Share = part2Amount
            .mul(mantissa)
            .div(part1Amount.add(part2Amount));
        const part2Claim = bonusVestingAmount
            .mul(initial)
            .div(10000)
            .mul(part2Share)
            .div(mantissa);
        await (await bonusDistributor.connect(participant2).claim()).wait(1);
        expect(await mare.balanceOf(participant2.address)).to.lt(
            part2Claim.add(ethers.utils.parseEther("10")), // can slightly differ due to first second of claim
            "participant 2 mare balance is not correct after claim"
        );
        // Participant 2 claimed own share but distributor claim all claimable tokens from bonus vester
        const bonusClaimedShare = bonusVestingAmount.mul(initial).div(10000);
        expect(await mare.balanceOf(bonusVester.address)).to.gt(
            bonusVestingAmount
                .sub(bonusClaimedShare)
                .sub(ethers.utils.parseEther("10")),
            "bonus vester mare balance is not correct after claim"
        );
    });
});

const depositParticipant = async (
    participant: SignerWithAddress,
    deployment: {
        usdc: Contract;
        liquidityGenerator: Contract;
    },
    depositAmount?: BigNumber
) => {
    const { usdc, liquidityGenerator } = deployment;
    const amount = depositAmount ?? (await usdc.balanceOf(participant.address));
    await (
        await usdc
            .connect(participant)
            .approve(liquidityGenerator.address, amount)
    ).wait(1);
    await (
        await liquidityGenerator.connect(participant).deposit(amount)
    ).wait(1);
};

const getGauge = async (deployment: { voter: Contract; pair: Contract }) => {
    const { voter, pair } = deployment;
    return await ethers.getContractAt(
        "IVelodromeGauge",
        await voter.gauges(pair.address)
    );
};
