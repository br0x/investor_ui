import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode, Slice,
    toNano
} from '@ton/core';
import {JettonWallet} from './JettonWallet';
import {Op} from './JettonConstants';

export type InvestorContent = {
    uri: string
};

export type InvestorConfig = {
    down_threshold: bigint,
    up_threshold: bigint,
    admin: Address,
    usdt_master: Address,
    jw_code: Cell,
    jetton_content: Cell | InvestorContent,
    cold_usdt_owner: Address
};
export type InvestorConfigFull = {
    stusdt_supply: bigint,
    usdt_balance: bigint,
    down_threshold: bigint,
    up_threshold: bigint,
    admin: Address,
    usdt_master: Address,
    jw_code: Cell,
    jetton_content: Cell | InvestorContent,
    cold_usdt_owner: Address
}

export type LockType = 'unlock' | 'out' | 'in' | 'full';

export const LOCK_TYPES = ['unlock', 'out', 'in', 'full'];

export const lockTypeToInt = (lockType: LockType): number => {
    switch (lockType) {
        case 'unlock':
            return 0;
        case 'out':
            return 1;
        case 'in':
            return 2;
        case 'full':
            return 3;
        default:
            throw new Error("Invalid argument!");
    }
}

export const intToLockType = (lockType: number): LockType => {
    switch (lockType) {
        case 0:
            return 'unlock';
        case 1:
            return 'out';
        case 2:
            return 'in';
        case 3:
            return 'full';
        default:
            throw new Error("Invalid argument!");
    }
}

export function endParse(slice: Slice) {
    if (slice.remainingBits > 0 || slice.remainingRefs > 0) {
        throw new Error('remaining bits in data');
    }
}

export function parseAddrFromRef(cell: Cell): Address {
    const sc = cell.beginParse();
    const addr = sc.loadAddress();
    sc.endParse();
    return addr;
}

export function investorConfigCellToConfig(config: Cell): InvestorConfigFull {
    const sc = config.beginParse()
    const parsed: InvestorConfigFull = {
        stusdt_supply: sc.loadCoins(),
        usdt_balance: sc.loadCoins(),
        down_threshold: sc.loadCoins(),
        up_threshold: sc.loadCoins(),
        admin: sc.loadAddress(),
        usdt_master: sc.loadAddress(),
        jw_code: sc.loadRef(),
        jetton_content: sc.loadRef(),
        cold_usdt_owner: parseAddrFromRef(sc.loadRef())
    };
    endParse(sc);
    return parsed;
}

export function parseInvestorData(data: Cell): InvestorConfigFull {
    return investorConfigCellToConfig(data);
}

export function investorConfigFullToCell(config: InvestorConfigFull): Cell {
    const content = config.jetton_content instanceof Cell ? config.jetton_content : jettonContentToCell(config.jetton_content);
    return beginCell()
        .storeCoins(config.stusdt_supply)
        .storeCoins(config.usdt_balance)
        .storeCoins(config.down_threshold)
        .storeCoins(config.up_threshold)
        .storeAddress(config.admin)
        .storeAddress(config.usdt_master)
        .storeRef(config.jw_code)
        .storeRef(content)
        .storeRef(beginCell().storeAddress(config.cold_usdt_owner).endCell())
        .endCell()
}

export function investorConfigToCell(config: InvestorConfig): Cell {
    const content = config.jetton_content instanceof Cell ? config.jetton_content : jettonContentToCell(config.jetton_content);
    return beginCell()
        .storeCoins(0)
        .storeCoins(0)
        .storeCoins(config.down_threshold)
        .storeCoins(config.up_threshold)
        .storeAddress(config.admin)
        .storeAddress(config.usdt_master)
        .storeRef(config.jw_code)
        .storeRef(content)
        .storeRef(beginCell().storeAddress(config.cold_usdt_owner).endCell())
        .endCell();
}

export function jettonContentToCell(content: InvestorContent) {
    return beginCell()
        .storeStringRefTail(content.uri) //Snake logic under the hood
        .endCell();
}

export class Investor implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
    }

    static createFromAddress(address: Address) {
        return new Investor(address);
    }

    static createFromConfig(config: InvestorConfig, code: Cell, workchain = 0) {
        const data = investorConfigToCell(config);
        const init = {code, data};
        return new Investor(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell(),
        });
    }

    static mintMessage(to: Address, jetton_amount: bigint, from?: Address | null, response?: Address | null, customPayload?: Cell | null, forward_ton_amount: bigint = 0n, total_ton_amount: bigint = 0n) {
        const mintMsg = beginCell().storeUint(Op.internal_transfer, 32)
            .storeUint(0, 64)
            .storeCoins(jetton_amount)
            .storeAddress(from)
            .storeAddress(response)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(customPayload)
            .endCell();
        return beginCell().storeUint(Op.mint, 32).storeUint(0, 64) // op, queryId
            .storeAddress(to)
            .storeCoins(total_ton_amount)
            .storeRef(mintMsg)
            .endCell();
    }

    async sendMint(provider: ContractProvider,
                   via: Sender,
                   to: Address,
                   jetton_amount: bigint,
                   from?: Address | null,
                   response_addr?: Address | null,
                   customPayload?: Cell | null,
                   forward_ton_amount: bigint = toNano('0.05'), total_ton_amount: bigint = toNano('0.1')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Investor.mintMessage(to, jetton_amount, from, response_addr, customPayload, forward_ton_amount, total_ton_amount),
            value: total_ton_amount,
        });
    }

    static topUpMessage() {
        return beginCell().storeUint(Op.top_up, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }

    static parseTopUp(slice: Slice) {
        const op = slice.loadUint(32);
        if (op !== Op.top_up) throw new Error('Invalid op');
        const queryId = slice.loadUint(64);
        endParse(slice);
        return {
            queryId,
        }
    }

    async sendTopUp(provider: ContractProvider, via: Sender, value: bigint = toNano('0.1')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Investor.topUpMessage(),
            value: value,
        });
    }


    static forceTransferMessage(transfer_amount: bigint,
                                to: Address,
                                from: Address,
                                custom_payload: Cell | null,
                                forward_amount: bigint = 0n,
                                forward_payload: Cell | null,
                                value: bigint = toNano('0.1'),
                                query_id: bigint = 0n) {

        const transferMessage = JettonWallet.transferMessage(query_id, transfer_amount,
            to,
            to,
            custom_payload,
            forward_amount,
            forward_payload);
        return beginCell().storeUint(Op.call_to, 32).storeUint(query_id, 64)
            .storeAddress(from)
            .storeCoins(value)
            .storeRef(transferMessage)
            .endCell();
    }

    static parseTransfer(slice: Slice) {
        const op = slice.loadUint(32);
        if (op !== Op.transfer) throw new Error('Invalid op');
        const queryId = slice.loadUint(64);
        const jettonAmount = slice.loadCoins();
        const toAddress = slice.loadAddress();
        const responseAddress = slice.loadAddress();
        const customPayload = slice.loadMaybeRef();
        const forwardTonAmount = slice.loadCoins();
        const inRef = slice.loadBit();
        const forwardPayload = inRef ? slice.loadRef().beginParse() : slice;
        return {
            queryId,
            jettonAmount,
            toAddress,
            responseAddress,
            customPayload,
            forwardTonAmount,
            forwardPayload
        }
    }

    async sendForceTransfer(provider: ContractProvider,
                            via: Sender,
                            transfer_amount: bigint,
                            to: Address,
                            from: Address,
                            custom_payload: Cell | null,
                            forward_amount: bigint = 0n,
                            forward_payload: Cell | null,
                            value: bigint = toNano('0.1'),
                            query_id: bigint = 0n) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Investor.forceTransferMessage(transfer_amount,
                to, from,
                custom_payload,
                forward_amount,
                forward_payload,
                value, query_id),
            value: value + toNano('0.1')
        });
    }

    static forceBurnMessage(burn_amount: bigint,
                            to: Address,
                            response: Address | null,
                            value: bigint = toNano('0.1'),
                            query_id: bigint | number = 0) {

        return beginCell().storeUint(Op.call_to, 32).storeUint(query_id, 64)
            .storeAddress(to)
            .storeCoins(value)
            .storeRef(JettonWallet.burnMessage(burn_amount, response, null))
            .endCell()
    }

    static parseBurn(slice: Slice) {
        const op = slice.loadUint(32);
        if (op !== Op.burn) throw new Error('Invalid op');
        const queryId = slice.loadUint(64);
        const jettonAmount = slice.loadCoins();
        const responseAddress = slice.loadAddress();
        const customPayload = slice.loadMaybeRef();
        endParse(slice);
        return {
            queryId,
            jettonAmount,
            responseAddress,
            customPayload,
        }
    }
    async sendForceBurn(provider: ContractProvider,
                        via: Sender,
                        burn_amount: bigint,
                        address: Address,
                        response: Address | null,
                        value: bigint = toNano('0.1'),
                        query_id: bigint | number = 0) {

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Investor.forceBurnMessage(burn_amount, address, response, value, query_id),
            value: value + toNano('0.1')
        });
    }

    static upgradeMessage(new_code: Cell, new_data: Cell, query_id: bigint | number = 0) {
        return beginCell().storeUint(Op.upgrade, 32).storeUint(query_id, 64)
            .storeRef(new_data)
            .storeRef(new_code)
            .endCell();
    }

    static parseUpgrade(slice: Slice) {
        const op = slice.loadUint(32);
        if (op !== Op.upgrade) throw new Error('Invalid op');
        const queryId = slice.loadUint(64);
        const newData = slice.loadRef();
        const newCode = slice.loadRef();
        endParse(slice);
        return {
            queryId,
            newData,
            newCode
        }
    }

    async sendUpgrade(provider: ContractProvider, via: Sender, new_code: Cell, new_data: Cell, value: bigint = toNano('0.1'), query_id: bigint | number = 0) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Investor.upgradeMessage(new_code, new_data, query_id),
            value
        });
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(owner).endCell()
        }])
        return res.stack.readAddress()
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode,
        };
    }

    async getStorageData(provider: ContractProvider) {
        let res = await provider.get('get_storage_data', []);
        let stUsdtTotalSupply = res.stack.readBigNumber();
        let usdtBalance = res.stack.readBigNumber();
        let downThreshold = res.stack.readBigNumber();
        let upThreshold = res.stack.readBigNumber();
        let mainAdminAddress = res.stack.readAddress();
        let usdtMinterAddress = res.stack.readAddress();
        let walletCode = res.stack.readCell();
        let metadataUrl = res.stack.readCell();
        let beneficiaryAddress = parseAddrFromRef(res.stack.readCell());
        return {
            stUsdtTotalSupply,
            usdtBalance,
            downThreshold,
            upThreshold,
            mainAdminAddress,
            usdtMinterAddress,
            walletCode,
            metadataUrl,
            beneficiaryAddress
        };
    }

    async getTotalSupply(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.totalSupply;
    }

    async getAdminAddress(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.adminAddress;
    }

    async getContent(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.content;
    }
}
