import { generateKeyPairSigner, createKeyPairSignerFromBytes, KeyPairSigner, Address } from '@solana/kit';
import fs from 'node:fs';
import path from 'node:path';

async function generateOrGetHotWallet(): Promise<void> {
  const savePath = path.join(process.cwd(), 'mainnet-hot-wallet.json');

  let signer: KeyPairSigner;

  if (fs.existsSync(savePath)) {
    const raw = fs.readFileSync(savePath, 'utf-8');
    const bytes = new Uint8Array(JSON.parse(raw) as number[]);
    signer = await createKeyPairSignerFromBytes(bytes);
    console.log('\n======================================================');
    console.log('🔑 EXISTING HOT WALLET FOUND:');
    console.log(`📍 Address: ${signer.address}`);
  } else {
    signer = await generateKeyPairSigner();
    // Save address info for funding
    const walletInfo = {
      address: signer.address,
      createdAt: new Date().toISOString(),
      instructions: "Fund this address with 0.05 - 0.10 SOL for live micro-trading"
    };
    fs.writeFileSync(savePath, JSON.stringify(walletInfo, null, 2));

    console.log('\n======================================================');
    console.log('✨ BOT HOT WALLET CREATED:');
    console.log(`📍 Public Address: ${signer.address}`);
    console.log(`📁 Config File:    ${savePath}`);
    console.log('======================================================\n');
  }

  console.log('💡 INSTRUCTIONS TO FUND:');
  console.log(`1. Open your Phantom / Solflare wallet on your phone or browser.`);
  console.log(`2. Click 'Send' -> select SOL.`);
  console.log(`3. Paste this address: ${signer.address}`);
  console.log(`4. Send ~0.06 SOL (~$10 for micro-cap trade + gas reserve).\n`);
}

void generateOrGetHotWallet();
