import { describe } from "mocha";
import { expect } from "chai";
const vite = require('@vite/vuilder');
import config from "../vite.config.json";

let provider: any;
let deployer: any;


describe('TeamLock in Emergency', () => {
  before(async function() {
    provider = vite.localProvider();
    deployer = vite.newAccount(config.networks.local.mnemonic, 0);
  });

  it('test contract in emergency', async () => {
    // compile contract
    const compiledContracts = await vite.compileLegacy('TeamLock_0.4.3.solpp');
    expect(compiledContracts).to.have.property('TeamLock');

    // init user accounts
    const user1 = vite.newAccount(config.networks.local.mnemonic, 4);
    const user2 = vite.newAccount(config.networks.local.mnemonic, 3);

    await deployer.sendToken(user1.address, '0');
    await user1.receiveAll();
    await deployer.sendToken(user2.address, '0');
    await user2.receiveAll();

    // deploy contract
    let teamLock = compiledContracts.TeamLock;
    teamLock.setDeployer(deployer).setProvider(provider);

    let startTime = Math.round(Date.now() / 1000); // now
    let interval = 15; // in seconds
    let endTime = startTime + interval * 2; // lock for 2 months
    let unlockAmount = 100;

    await teamLock.deploy({
      params: [
        deployer.address!,
        user1.address!,
        startTime.toString(),
        endTime.toString(),
        interval.toString(),
        unlockAmount.toString()
      ],
      responseLatency: 1
    });
    expect(teamLock.address).to.be.a('string');

    // deposit
    await deployer.sendToken(teamLock.address, '1000'); // lock 1000 VITE
    expect(await teamLock.balance()).to.be.equal('1000');

    // only owner can call disable()
    expect(await teamLock.query('isOwner', [deployer.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('isOwner', [user1.address])).to.be.deep.equal(['0']);
    expect(await teamLock.query('isOwner', [user2.address])).to.be.deep.equal(['0']);
    await teamLock.call('disable', [], {caller: user1}); // no effect
    await teamLock.call('disable', [], {caller: user2}); // no effect

    // unlock (can be triggered by anyone)
    await teamLock.call('unlock', [], {caller: user1});
    await user1.receiveAll();
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');

    // unlock again in a short period
    await teamLock.call('unlock', [], {});
    await user1.receiveAll();
    expect(Date.now() / 1000 < startTime + interval).to.be.true; // less than 30 days
    // should not unlock any additional tokens
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');

    // add new owners
    await teamLock.call('addOwner', [user2.address], {});

    // check owners
    expect(await teamLock.query('isOwner', [user2.address])).to.be.deep.equal(['1']);

    // disable unlocking
    await teamLock.call('disable', [], {caller: user2});

    // wait for the next month
    let nextMonth = async function() {
      return Date.now() / 1000 > startTime + interval;
    }
    await vite.utils.waitFor(nextMonth, 'Wait for the next month', 1000);

    // unlock once again, should not unlock any tokens
    await teamLock.call('unlock', [], {});
    await user1.receiveAll();
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');

    // check benificiary
    expect(await teamLock.query('getBenificiary', [])).to.be.deep.equal([user1.address]);

    // wait for the next next month
    let nextNextMonth = async function() {
      return Date.now() / 1000 > startTime + interval * 2;
    }
    await vite.utils.waitFor(nextNextMonth, 'Wait for the next month', 1000);

    // unlock once again, should not unlock any tokens
    await teamLock.call('unlock', [], {});
    await user1.receiveAll();
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');
  });
});