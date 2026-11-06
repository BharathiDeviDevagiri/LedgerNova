import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextBalance } from '../src/services/account.service.js';

describe('Double-Entry Accounting & Money Conservation', () => {
  it('Asset accounts increase with DEBIT and decrease with CREDIT', () => {
    const assetAccount = {
      type: 'ASSET',
      balance: 100000n, // ₹1,000.00
    };

    const debitResult = calculateNextBalance(assetAccount, 'DEBIT', 50000n);
    assert.equal(debitResult.valid, true);
    assert.equal(debitResult.balance, 150000n);

    const creditResult = calculateNextBalance(assetAccount, 'CREDIT', 40000n);
    assert.equal(creditResult.valid, true);
    assert.equal(creditResult.balance, 60000n);
  });

  it('Liability customer accounts increase with CREDIT and decrease with DEBIT', () => {
    const customerAccount = {
      type: 'LIABILITY',
      balance: 50000n, // ₹500.00
    };

    // Customer receives money -> CREDIT increases liability balance
    const depositResult = calculateNextBalance(customerAccount, 'CREDIT', 20000n);
    assert.equal(depositResult.valid, true);
    assert.equal(depositResult.balance, 70000n);

    // Customer spends money -> DEBIT decreases liability balance
    const withdrawalResult = calculateNextBalance(customerAccount, 'DEBIT', 30000n);
    assert.equal(withdrawalResult.valid, true);
    assert.equal(withdrawalResult.balance, 20000n);
  });

  it('Rejects negative balances on overdrawn accounts', () => {
    const customerAccount = {
      type: 'LIABILITY',
      balance: 10000n, // ₹100.00
    };

    // Attempting to debit ₹150.00 (15000n)
    const result = calculateNextBalance(customerAccount, 'DEBIT', 15000n);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'INSUFFICIENT_FUNDS');
  });

  it('Conserves total money across customer-to-customer transfers', () => {
    let senderBalance = 5000000n; // ₹50,000
    let receiverBalance = 1000000n; // ₹10,000
    const initialTotalWealth = senderBalance + receiverBalance;

    const transferAmount = 2500000n; // ₹25,000

    // Sender is DEBITED
    senderBalance -= transferAmount;
    // Receiver is CREDITED
    receiverBalance += transferAmount;

    const finalTotalWealth = senderBalance + receiverBalance;

    assert.equal(finalTotalWealth, initialTotalWealth);
    assert.equal(senderBalance, 2500000n);
    assert.equal(receiverBalance, 3500000n);
  });

  it('Conserves total money when fee is routed to revenue account', () => {
    let customerA = 100000n; // ₹1,000
    let customerB = 50000n;  // ₹500
    let bankFeeRevenue = 0n;

    const initialTotal = customerA + customerB + bankFeeRevenue;

    const transferAmount = 40000n; // ₹400
    const feeAmount = 200n;        // ₹2

    // Customer A pays transfer + fee
    customerA -= (transferAmount + feeAmount);
    // Customer B receives transfer amount
    customerB += transferAmount;
    // Bank earns fee
    bankFeeRevenue += feeAmount;

    const finalTotal = customerA + customerB + bankFeeRevenue;
    assert.equal(finalTotal, initialTotal);
    assert.equal(customerA, 59800n);
    assert.equal(customerB, 90000n);
    assert.equal(bankFeeRevenue, 200n);
  });
});
