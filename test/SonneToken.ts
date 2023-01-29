import { expect } from "chai";
import { ethers } from "hardhat";

describe("Mare Token", function () {
  it("Should mint 100m tokens to given accounts", async function () {
    const totalSupply = ethers.utils.parseEther("100000000");
    const account = "0x1110000000000000000000000000000000000000";

    const Mare = await ethers.getContractFactory("Mare");
    const mare = await Mare.deploy(account);

    expect(await mare.totalSupply()).to.equal(totalSupply);
    expect(await mare.balanceOf(account)).to.equal(totalSupply);
  });
});
