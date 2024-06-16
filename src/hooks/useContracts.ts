import { useEffect, useState } from "react";
import { JettonMinter } from "../contracts/JettonMinter";
import { fromUnits, toUnits } from "../contracts/helpers/units";
import { useTonClient } from "./useTonClient";
import { useAsyncInitialize } from "./useAsyncInitialize";
import { Address, OpenedContract, toNano } from "@ton/core";
import { useTonConnect } from "./useTonConnect";
import { JettonWallet } from "../contracts/JettonWallet";
import { Investor } from "../contracts/Investor";

const usdtMinterAddr = "kQBPuk_vxUyvSgFjaA_Auu0mM8RphDNDjHbBuryHiKC_mdQW";
const investorAddr = "kQBq9R7F85ZUNc8LUzohPjdiUkY-SlCaQECzmYGeUqU-zk6t";

export function useContracts() {

    const client = useTonClient();

    // const [usdtMinterData, setUsdtMinterData] = useState<null | {
    //     total_supply: string;
    //     admin_address: string;
    // }>();

    const [investorData, setInvestorData] = useState<null | {
        total_stusdt_supply: string;
        usdt_balance: string;
        down_threshold: string;
        up_threshold: string;
        main_admin_address: string;
        beneficiary_address: string;
    }>();

    const [usdtWalletData, setUsdtWalletData] = useState<null | {
        // owner: string | undefined;
        usdt_jetton_balance: string | undefined;
        // usdt_jw_address: string | undefined;
    }>();

    const [stUsdtWalletData, setStUsdtWalletData] = useState<null | {
        stusdt_jetton_balance: string | undefined;
        // stusdt_jw_address: string | undefined;
    }>();

    const [beneficiaryWalletData, setBeneficiaryWalletData] = useState<null | {
        bene_usdt_balance: string | undefined;
        bene_usdt_jw_address: string | undefined;
    }>();

    const { sender, connected } = useTonConnect();

    const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

    const usdtMinter = useAsyncInitialize(async () => {
        if (!client) return;
        const contract = new JettonMinter(Address.parse(usdtMinterAddr));
        return client.open(contract) as OpenedContract<JettonMinter>;
    }, [client]);
    
    const investor = useAsyncInitialize(async () => {
        if (!client) return;
        const contract = new Investor(Address.parse(investorAddr));
        return client.open(contract) as OpenedContract<Investor>;
    }, [client]);
    
    const usdtWalletAddress = useAsyncInitialize(async () => {
        if (!client || !usdtMinter || !connected) return undefined;
        return await usdtMinter?.getWalletAddress(sender.address!);
    }, [usdtMinter, connected]);
    
    const usdtWalletContract = useAsyncInitialize(async () => {
        if (!client || !connected || !usdtWalletAddress) return undefined;
        const j_contract = new JettonWallet(usdtWalletAddress!);
        return client.open(j_contract) as OpenedContract<JettonWallet>;
    }, [connected, usdtWalletAddress]);
    
    const stUsdtWalletAddress = useAsyncInitialize(async () => {
        if (!client || !investor || !connected) return undefined;
        return await investor?.getWalletAddress(sender.address!);
    }, [investor, connected]);
    
    const stUsdtWalletContract = useAsyncInitialize(async () => {
        if (!client || !connected || !stUsdtWalletAddress) return undefined;
        const j_contract = new JettonWallet(stUsdtWalletAddress!);
        return client.open(j_contract) as OpenedContract<JettonWallet>;
    }, [connected, stUsdtWalletAddress]);
    
    const beneficiaryUsdtWalletAddress = useAsyncInitialize(async () => {
        if (!client || !investor || !usdtMinter) return;
        const beneAddress = (await investor?.getStorageData()).beneficiaryAddress;
        return await usdtMinter?.getWalletAddress(beneAddress);
    }, [investor, usdtMinter]);
    
    const beneficiaryUsdtWalletContract = useAsyncInitialize(async () => {
        if (!client || !beneficiaryUsdtWalletAddress) return undefined;
        const j_contract = new JettonWallet(beneficiaryUsdtWalletAddress!);
        return client.open(j_contract) as OpenedContract<JettonWallet>;
    }, [beneficiaryUsdtWalletAddress]);
    
    useEffect(() => {
        async function getValues() {
            // if (!usdtMinter) return;        
            // const { totalSupply, adminAddress } = await usdtMinter.getJettonData();
            // setUsdtMinterData({
            //     total_supply: fromUnits(totalSupply, 6),
            //     admin_address: adminAddress.toString({bounceable: false, testOnly: true}),
            // });

            if (!investor) return;            
            const { 
                stUsdtTotalSupply,
                usdtBalance,
                downThreshold,
                upThreshold,
                mainAdminAddress,
                beneficiaryAddress
            } = await investor.getStorageData();
            setInvestorData({
                total_stusdt_supply: fromUnits(stUsdtTotalSupply, 6),
                usdt_balance: fromUnits(usdtBalance, 6),
                down_threshold: fromUnits(downThreshold, 6),
                up_threshold: fromUnits(upThreshold, 6),
                main_admin_address: mainAdminAddress.toString({bounceable: false, testOnly: true}),
                beneficiary_address: beneficiaryAddress.toString({bounceable: false, testOnly: true}),
            });

            setBeneficiaryWalletData({
                bene_usdt_balance: beneficiaryUsdtWalletContract ? fromUnits((await beneficiaryUsdtWalletContract.getWalletData()).balance, 6) : undefined,
                bene_usdt_jw_address: beneficiaryUsdtWalletAddress?.toString(),
            });

            setUsdtWalletData({
                // owner: sender.address?.toString(),
                usdt_jetton_balance: usdtWalletContract ? fromUnits((await usdtWalletContract.getWalletData()).balance, 6) : undefined,
                // usdt_jw_address: usdtWalletAddress?.toString(),
            });

            setStUsdtWalletData({
                stusdt_jetton_balance: stUsdtWalletContract ? fromUnits((await stUsdtWalletContract.getWalletData()).balance, 6) : undefined,
                // stusdt_jw_address: stUsdtWalletAddress?.toString(),
            });

            await sleep(10000); // sleep 10 seconds and poll value again
            getValues();
        }
        getValues();
    }, [/*usdtMinter,*/ investor, beneficiaryUsdtWalletContract, usdtWalletContract, stUsdtWalletContract]);

    return {
        // usdt_minter_contract_address: usdtMinter?.address.toString({bounceable: true, testOnly: true}),
        // ...usdtMinterData,
        investor_contract_address: investor?.address.toString({bounceable: true, testOnly: true}),
        ...investorData,
        sendTransfer: (queryId: number, amount: string) => {
            return usdtWalletContract?.sendTransfer(sender, 
                toNano('0.035'),
                BigInt(queryId), 
                toUnits(amount, 6),
                investor?.address!,
                sender.address!, // responce (excess)
                null, // custom payload
                toNano('0.026'), // forward ton amount (>0 so jetton notification will be sent)
                null // forward payload
            );
        },
        ...usdtWalletData,
        ...stUsdtWalletData,
        ...beneficiaryWalletData
    };
}

