import { describe } from "mocha";
import { expect } from "chai";
const vite = require('@vite/vuilder');
import config from "../vite.config.json";

let provider: any;
let deployer: any;


describe('TeamLock Constructor Params', () => {
  before(async function() {
    provider = vite.localProvider();
    deployer = vite.newAccount(config.networks.local.mnemonic, 0);
  });

  it('test contructor params', async () => {
    // compile contract
    const compiledContracts = await vite.compileLegacy('TeamLock.solpp');
    expect(compiledContracts).to.have.property('TeamLock');

    // deploy contract
    let teamLock = compiledContracts.TeamLock;
    teamLock.setDeployer(deployer).setProvider(provider);

    await teamLock.deploy({
      params: [
        deployer.address!,
        deployer.address!,
        '0',
        '0',
        '0',
        '0'
      ],
      responseLatency: 1
    });
    expect(teamLock.address).to.be.a('string');

    // params in production environment
    let startTime = Math.round(new Date('Feb 01 2022').getTime() / 1000); // Feb 01 2022
    let interval = 30 * 24 * 3600; // 30 days in seconds
    let endTime = Math.round(new Date('Jan 01 2024').getTime() / 1000); // Jan 01 2024
    let unlockAmount = '1500000000000000000000000';

    // check params
    expect(await teamLock.query('getNextTime', [deployer.address])).to.be.deep.equal([startTime.toString()]);
    expect(await teamLock.query('getEndTime', [deployer.address])).to.be.deep.equal([endTime.toString()]);
    expect(await teamLock.query('getInterval', [deployer.address])).to.be.deep.equal([interval.toString()]);
    expect(await teamLock.query('getUnlockAmount', [deployer.address])).to.be.deep.equal([unlockAmount.toString()]);
    expect(await teamLock.query('getBenificiary', [])).to.be.deep.equal([deployer.address]);
    expect(await teamLock.query('isOwner', [deployer.address])).to.be.deep.equal(['1']);

  });
});