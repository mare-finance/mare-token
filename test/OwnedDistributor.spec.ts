import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { getTokenContract, goToFixture } from "./_utils";

interface DeployFixture {
    admin: SignerWithAddress;
    user: SignerWithAddress;
    mare: Contract;
    distributor: Contract;
    lastClaim: number;
    claimable: Contract;
    participants: {
        address: string;
        signer: SignerWithAddress;
        share: BigNumber;
    }[];
}

describe.only("Owned Distributor", function () {
    const rewardPerSecond = ethers.utils.parseEther("100000000");

    let deployment: DeployFixture;

    const deployFixture = async () => {
        const [admin, user] = await ethers.getSigners();

        const lastClaim =
            (await ethers.provider.getBlock("latest")).timestamp + 1000;

        const mare = await getTokenContract({
            admin,
            mintAmount: ethers.utils.parseEther("1000000000000"),
        });

        const MockClaimable = await ethers.getContractFactory("MockClaimable");
        const mockClaimable = await MockClaimable.deploy(
            mare.address,
            rewardPerSecond,
            lastClaim
        );
        await mockClaimable.deployed();

        const Distributor = await ethers.getContractFactory("OwnedDistributor");
        const distributor = await Distributor.deploy(
            mare.address,
            mockClaimable.address,
            admin.address
        );
        await distributor.deployed();

        // set the mock claimable to use the distributor
        await expect(mockClaimable.setRecipient(distributor.address)).not.to
            .reverted;

        // send some mare to the mock claimable
        await expect(
            mare.transfer(
                mockClaimable.address,
                await mare.balanceOf(admin.address)
            )
        ).not.to.reverted;

        const participants = await makeParticipants(admin, 10);

        return {
            admin,
            user,
            mare,
            distributor,
            lastClaim,
            claimable: mockClaimable,
            participants,
        };
    };

    this.beforeEach(async function () {
        deployment = await loadFixture(deployFixture);
    });

    describe("Constructor", function () {
        it("Should set the correct values", async function () {
            const { admin, mare, claimable, distributor } = deployment;

            expect(await distributor.mare()).to.equal(mare.address);
            expect(await distributor.claimable()).to.equal(claimable.address);
            expect(await distributor.admin()).to.equal(admin.address);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow the admin to new admin", async function () {
            const { admin, user, distributor } = deployment;

            await expect(distributor.connect(admin).setAdmin(user.address)).not
                .to.reverted;
            expect(await distributor.admin()).to.equal(user.address);
        });

        it("Should not allow a non-admin to set a new admin", async function () {
            const { user, distributor } = deployment;

            await expect(distributor.connect(user).setAdmin(user.address)).to
                .reverted;
        });

        it("Should allow the admin to edit a recipient", async function () {
            const { admin, user, distributor } = deployment;

            await expect(
                distributor.connect(admin).editRecipient(user.address, 1)
            ).not.to.reverted;
            expect(
                (await distributor.recipients(user.address)).shares
            ).to.equal(1);
        });

        it("Should not allow a non-admin to edit a recipient", async function () {
            const { user, distributor } = deployment;

            await expect(
                distributor.connect(user).editRecipient(user.address, 1)
            ).to.reverted;
        });

        it("Should allow the admin to edit multiple recipients", async function () {
            const { admin, distributor, participants } = deployment;

            await expect(
                distributor.connect(admin).editRecipients(
                    participants.map(p => p.address),
                    participants.map(p => p.share)
                )
            ).not.to.reverted;

            for (let i = 0; i < Math.min(participants.length, 3); i++) {
                expect(
                    (await distributor.recipients(participants[i].address))
                        .shares
                ).to.equal(participants[i].share);
            }
        });
    });

    describe("Claiming", function () {
        this.beforeEach(async function () {
            const { admin, distributor, participants, lastClaim } = deployment;

            await expect(
                distributor.connect(admin).editRecipients(
                    participants.map(p => p.address),
                    participants.map(p => p.share)
                )
            ).not.to.reverted;

            expect(await distributor.totalShares()).to.equal(
                participants.reduce(
                    (acc, p) => acc.add(p.share),
                    ethers.BigNumber.from(0)
                )
            );

            // go to the last claim time
            await loadFixture(goToFixture(lastClaim));
        });

        it("Should allow a user to claim their share", async function () {
            const { distributor, mare, participants, lastClaim, claimable } =
                deployment;

            const totalShares = participants.reduce(
                (acc, p) => acc.add(p.share),
                ethers.BigNumber.from(0)
            );

            for (let i = 0; i < Math.min(participants.length, 3); i++) {
                const nextBlockTime =
                    (await ethers.provider.getBlock("latest")).timestamp + 1;

                const expectedReward = rewardPerSecond
                    .mul(nextBlockTime - lastClaim)
                    .mul(participants[i].share)
                    .div(totalShares);

                await expect(
                    distributor.connect(participants[i].signer).claim()
                ).to.emit(mare, "Transfer");

                expect(await mare.balanceOf(participants[i].address)).to.eq(
                    expectedReward
                );
            }
        });
    });
});

const makeParticipants = async (admin: SignerWithAddress, count: number) => {
    const participants = [];

    for (let i = 0; i < count; i++) {
        const participant = ethers.Wallet.createRandom();
        const signer = await ethers.getImpersonatedSigner(participant.address);

        const share = Math.random() * 100_000_000;
        const shareEther = share.toFixed(18);
        const shareWei = ethers.utils.parseEther(shareEther);

        participants.push({
            address: participant.address,
            signer: signer,
            share: shareWei,
        });
    }

    // funding ether
    await Promise.all(
        participants.map(
            async p =>
                await expect(
                    admin.sendTransaction({
                        to: p.address,
                        value: ethers.utils.parseEther("1"),
                    })
                ).not.to.reverted
        )
    );

    return participants;
};
