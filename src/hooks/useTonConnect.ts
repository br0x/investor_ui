import { CHAIN, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address, Sender, SenderArguments } from '@ton/core';

// export function useTonConnect(): { sender: Sender; connected: boolean } {
//   const [tonConnectUI] = useTonConnectUI();
//   const adr = tonConnectUI.account?.address;

//   return {
//     sender: {
//       send: async (args: SenderArguments) => {
//         tonConnectUI.sendTransaction({
//           messages: [ // min is 1, max is 4
//             {
//               address: args.to.toString(),
//               amount: args.value.toString(),
//               payload: args.body?.toBoc().toString('base64'),
//             },
//           ],
//           validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes for user to approve
//           network: CHAIN.TESTNET,
//         });
//       },
//       address: adr ? Address.parse(adr) : undefined,
//     },
//     connected: tonConnectUI.connected,
//   };
// }

export function useTonConnect(): {
  sender: Sender;
  connected: boolean;
  wallet: string | null;
  network: CHAIN | null;
} {
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet();

  return {
      sender: {
        send: async (args: SenderArguments) => {
          tonConnectUI.sendTransaction({
            messages: [
              {
                address: args.to.toString(),
                amount: args.value.toString(), 
                payload: args.body?.toBoc().toString("base64"), 
              },
            ],
            validUntil: Date.now() + 5 * 60 * 1000, 
          });
        },
        address: wallet?.account?.address ? Address.parse(wallet?.account?.address as string) : undefined 
      }, 

      connected: !!wallet?.account.address,  
      wallet: wallet?.account.address ?? null,
      network: wallet?.account.chain ?? null 
  }
}
