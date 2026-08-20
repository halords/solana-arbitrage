/* eslint-disable no-console */
import { createKeyPairSignerFromBytes, KeyPairSigner, getBase58Decoder } from '@solana/kit';
import fs from 'node:fs';
import path from 'node:path';

async function generateOrGetHotWallet(): Promise<void> {
  const savePath = path.join(process.cwd(), 'mainnet-hot-wallet.json');

  let signer: KeyPairSigner;
  let base58PrivateKey = '';

  if (fs.existsSync(savePath)) {
    try {
      const raw = fs.readFileSync(savePath, 'utf-8');
      const parsed = JSON.parse(raw) as { keypairBytes?: number[]; privateKeyBase58?: string } | number[];
      if (Array.isArray(parsed)) {
        const bytes = new Uint8Array(parsed);
        signer = await createKeyPairSignerFromBytes(bytes);
        base58PrivateKey = getBase58Decoder().decode(bytes);
      } else if (parsed.keypairBytes) {
        const bytes = new Uint8Array(parsed.keypairBytes);
        signer = await createKeyPairSignerFromBytes(bytes);
        base58PrivateKey = parsed.privateKeyBase58 || getBase58Decoder().decode(bytes);
      } else {
        throw new Error('Unrecognized format, regenerating');
      }
      console.log('\n======================================================');
      console.log('🔑 EXISTING HOT WALLET LOADED:');
      console.log(`📍 Public Address:      ${signer.address}`);
      console.log(`🔐 Private Key (Phantom): ${base58PrivateKey}`);
      console.log(`📁 File:                 ${savePath}`);
      console.log('======================================================\n');
      return;
    } catch {
      // Regenerate valid 64-byte keypair
    }
  }

  // Generate extractable standard Ed25519 keypair
  const keyPair = (await globalThis.crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  )) as { privateKey: Parameters<typeof globalThis.crypto.subtle.exportKey>[1]; publicKey: Parameters<typeof globalThis.crypto.subtle.exportKey>[1] };

  const rawPrivate = new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  const rawPublic = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey));
  
  // Standard 64-byte Solana keypair: 32 bytes seed + 32 bytes pubkey
  const keypair64 = new Uint8Array(64);
  keypair64.set(rawPrivate.slice(-32), 0);
  keypair64.set(rawPublic, 32);

  signer = await createKeyPairSignerFromBytes(keypair64);
  base58PrivateKey = getBase58Decoder().decode(keypair64);

  // Save standard Solana CLI array + metadata
  const walletFileContent = {
    address: signer.address,
    privateKeyBase58: base58PrivateKey,
    keypairBytes: Array.from(keypair64),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(savePath, JSON.stringify(walletFileContent, null, 2));

  console.log('\n======================================================');
  console.log('✨ NEW HOT WALLET GENERATED & PERSISTED:');
  console.log(`📍 Public Address:        ${signer.address}`);
  console.log(`🔐 Private Key (Phantom):   ${base58PrivateKey}`);
  console.log(`📁 Config File:            ${savePath}`);
  console.log('======================================================\n');

  console.log('💡 INSTRUCTIONS TO FUND:');
  console.log(`1. Open your Phantom / Solflare wallet.`);
  console.log(`2. Click 'Send' -> select SOL.`);
  console.log(`3. Send ~0.06 SOL to: ${signer.address}\n`);
}

void generateOrGetHotWallet();
