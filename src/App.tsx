import "./App.css";
import { TonConnectButton } from "@tonconnect/ui-react";
import { useContracts } from "./hooks/useContracts";
import { useTonConnect } from "./hooks/useTonConnect";

function App() {
  const {
    // usdt minter
    usdt_minter_contract_address,
    total_supply, 
    admin_address,
    // investor
    investor_contract_address,
    total_stusdt_supply, 
    usdt_balance,
    down_threshold,
    up_threshold,
    main_admin_address,
    beneficiary_address,
    sendTransfer,
    // beneficiary usdt wallet
    bene_usdt_balance,
    bene_usdt_jw_address,
    // usdt wallet
    owner,
    usdt_jetton_balance,
    usdt_jw_address,
    // stUSDT wallet
    stusdt_jetton_balance,
    stusdt_jw_address,
  } = useContracts();

  const { connected } = useTonConnect()
  
  return (
    <div>
      <div>
        <TonConnectButton />
      </div>

      <div>

        <div className='Card'>
          <b>USDT Minter Admin Address</b>
          <div className='Hint'>{admin_address}</div>
          <b>USDT Minter contract Address</b>
          <div className='Hint'>{usdt_minter_contract_address}</div>
          <b>Total USDT issued</b>
          <div className='Hint'>{total_supply ?? "0"}</div>
        </div>

        <div className='Card'>
          <b>Investment Contract Admin Address</b>
          <div className='Hint'>{main_admin_address}</div>
          <b>Investment Contract Address</b>
          <div className='Hint'>{investor_contract_address}</div>
          <b>Total stUSDT issued</b>
          <div className='Hint'>{total_stusdt_supply ?? "0"}</div>
          <b>USDT balance on investment wallet</b>
          <div className='Hint'>{usdt_balance ?? "0"}</div>
          <b>Min USDT amount to invest</b>
          <div className='Hint'>{down_threshold}</div>
          <b>Max USDT amount on contract balance</b>
          <div className='Hint'>{up_threshold}</div>
          <b>Beneficiary address</b>
          <div className='Hint'>{beneficiary_address}</div>
          <b>Beneficiary USDT wallet address</b>
          <div className='Hint'>{bene_usdt_jw_address}</div>
          <b>USDT balance on beneficiary wallet</b>
          <div className='Hint'>{bene_usdt_balance}</div>
        </div>

        {connected && (
          <div className='Card'>
            <b>User Address</b>
            <div className='Hint'>{owner}</div>
            <b>USDT Wallet Address</b>
            <div className='Hint'>{usdt_jw_address}</div>
            <b>USDT Balance</b>
            <div className='Hint'>{usdt_jetton_balance ?? "0"}</div>
            <b>stUSDT Wallet Address</b>
            <div className='Hint'>{stusdt_jw_address}</div>
            <b>stUSDT Balance</b>
            <div className='Hint'>{stusdt_jetton_balance ?? "0"}</div>
          </div>
        )}

        {connected && (
          <form onSubmit={ (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const amount = formData.get("amount") as string
              sendTransfer(Date.now(), amount);
            }}>
            <p><b>Send some USDT to Investment Contract:</b></p>
            <input type="text" id="amount" name="amount" />
            <button type="submit">Submit</button>
          </form>
        )}

      </div>

    </div>
  );
}

export default App;
