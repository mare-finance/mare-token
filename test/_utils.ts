import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

const getTokenContract = async (opts: {
    admin: SignerWithAddress
    mintAmount?: BigNumber
    existingAddress?: string
    whaleAddress?: string
    decimals?: string
}) => {
    if (opts.existingAddress) {
        const token = await ethers.getContractAt(
            'MockERC20Token',
            opts.existingAddress,
        )

        if (opts.whaleAddress) {
            const whale = await ethers.getSigner(opts.whaleAddress)

            const balance = await token.balanceOf(whale.address)
            await (
                await token.connect(whale).transfer(opts.admin.address, balance)
            ).wait(1)
        }

        return token
    } else {
        const Token = await ethers.getContractFactory('MockERC20Token')
        const token = await Token.connect(opts.admin).deploy(
            opts.mintAmount || ethers.utils.parseEther('100000000'),
            18,
        )
        return token
    }
}

export { getTokenContract }