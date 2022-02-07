import { describe } from "mocha";
import { expect } from "chai";
const vite = require('@vite/vuilder');
import config from "../vite.config.json";

let provider: any;
let deployer: any;


describe('TeamLock Normal Case', () => {
  before(async function() {
    provider = vite.localProvider();
    deployer = vite.newAccount(config.networks.local.mnemonic, 0);
  });

  it('test contract in normal case', async () => {
    // compile contract
    const compiledContracts = await vite.compile('TeamLock_0.8.0.solpp');
    expect(compiledContracts).to.have.property('TeamLock');

    // init user accounts
    const user1 = vite.newAccount(config.networks.local.mnemonic, 1);
    const user2 = vite.newAccount(config.networks.local.mnemonic, 2);
    const user3 = vite.newAccount(config.networks.local.mnemonic, 3);
    const user4 = vite.newAccount(config.networks.local.mnemonic, 4);

    await deployer.sendToken(user1.address, '0');
    await user1.receiveAll();
    await deployer.sendToken(user2.address, '0');
    await user2.receiveAll();
    await deployer.sendToken(user3.address, '0');
    await user3.receiveAll();
    await deployer.sendToken(user4.address, '0');
    await user4.receiveAll();

    // deploy contract
    let teamLock = compiledContracts.TeamLock;
    teamLock.setDeployer(deployer).setProvider(provider);

    let startTime = Math.round(Date.now() / 1000); // now
    let interval = 20; // in seconds
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

    // check params
    expect(await teamLock.query('nextTime', [deployer.address])).to.be.deep.equal([startTime.toString()]);
    expect(await teamLock.query('endTime', [deployer.address])).to.be.deep.equal([endTime.toString()]);
    expect(await teamLock.query('interval', [deployer.address])).to.be.deep.equal([interval.toString()]);
    expect(await teamLock.query('unlockAmount', [deployer.address])).to.be.deep.equal([unlockAmount.toString()]);

    // deposit
    await deployer.sendToken(teamLock.address, '1000'); // lock 1000 VITE
    expect(await teamLock.balance()).to.be.equal('1000');

    // check initial benificiary
    let result = await teamLock.query('benificiary', []);
    expect(result).to.be.deep.equal([user1.address]);

    // unlock (can be triggered by anyone)
    await teamLock.call('unlock', [], {caller: user4});
    await user1.receiveAll();
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');

    // unlock again in a short period
    await teamLock.call('unlock', [], {});
    await user1.receiveAll();
    // elapsed must be less than 30 days
    expect(Date.now() / 1000 < startTime + interval).to.be.true;
    // should not unlock any additional tokens
    expect(await user1.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('900');

    // set a new benificiary
    await teamLock.call('setBenificiary', [user2.address], {});
    result = await teamLock.query('benificiary', []);
    expect(result).to.be.deep.equal([user2.address]);

    // only owner can set benificiary
    await teamLock.call('setBenificiary', [user1.address], {caller: user1});
    result = await teamLock.query('benificiary', []);
    expect(result).to.be.deep.equal([user2.address]);

    // check owners
    expect(await teamLock.query('owners', [deployer.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user1.address])).to.be.deep.equal(['0']);
    expect(await teamLock.query('owners', [user2.address])).to.be.deep.equal(['0']);

    // add new owners
    await teamLock.call('addOwner', [user1.address], {});
    await teamLock.call('addOwner', [user2.address], {caller: user1});
    await teamLock.call('addOwner', [user3.address], {caller: user1});
    await teamLock.call('addOwner', [user4.address], {caller: user1});
    // check owners, only 3 owners
    expect(await teamLock.query('owners', [deployer.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user1.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user2.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user3.address])).to.be.deep.equal(['0']);
    expect(await teamLock.query('owners', [user4.address])).to.be.deep.equal(['0']);
    // check owner count
    expect(await teamLock.query('ownerCount', [])).to.be.deep.equal(['3']);

    // renounce ownership
    await teamLock.call('renounceOwner', [], {caller: user2});
    // check owners
    expect(await teamLock.query('owners', [deployer.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user1.address])).to.be.deep.equal(['1']);
    expect(await teamLock.query('owners', [user2.address])).to.be.deep.equal(['0']);
    // check owner count
    expect(await teamLock.query('ownerCount', [])).to.be.deep.equal(['2']);

    // wait for the next month
    let nextMonth = async function() {
      return Date.now() / 1000 > startTime + interval;
    }
    await vite.utils.waitFor(nextMonth, 'Wait for the next month', 1000);

    // unlock once again, tokens should be transfered to the new benificiary
    await teamLock.call('unlock', [], {caller: user2});
    await user2.receiveAll();
    expect(await user2.balance()).to.be.equal('100');
    expect(await teamLock.balance()).to.be.equal('800');

    // wait for the next next month
    let nextNextMonth = async function() {
      return Date.now() / 1000 > startTime + interval * 2;
    }
    await vite.utils.waitFor(nextNextMonth, 'Wait for the next month', 1000);

    // unlock once again, all remaining tokens should be transfered to the benificiary
    await teamLock.call('unlock', [], {caller: user2});
    await user2.receiveAll();
    expect(await user2.balance()).to.be.equal('900');
    expect(await teamLock.balance()).to.be.equal('0');
  });
});