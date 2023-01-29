import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: { deploy },
        getNamedAccounts,
    } = hre

    const { adminAccount } = await getNamedAccounts()

    const mare = await deploy('Mare', {
        from: adminAccount,
        log: true,
        args: [adminAccount],
    })
}

const tags = ['Token']
export { tags }

export default func
