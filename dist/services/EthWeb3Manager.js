"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthWeb3Manager = exports.ClaimTx = exports.ClaimTxStatus = void 0;
const web3_1 = __importDefault(require("web3"));
const net_1 = __importDefault(require("net"));
const EthCom = __importStar(require("@ethereumjs/common"));
const EthTx = __importStar(require("@ethereumjs/tx"));
const EthUtil = __importStar(require("ethereumjs-util"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const FaucetConfig_1 = require("../common/FaucetConfig");
const ConvertHelpers_1 = require("../utils/ConvertHelpers");
const ServiceManager_1 = require("../common/ServiceManager");
const PoWStatusLog_1 = require("../common/PoWStatusLog");
const FaucetStatus_1 = require("./FaucetStatus");
const StringUtils_1 = require("../utils/StringUtils");
const FaucetStatsLog_1 = require("./FaucetStatsLog");
const PromiseDfd_1 = require("../utils/PromiseDfd");
const FaucetStore_1 = require("./FaucetStore");
const PoWRewardLimiter_1 = require("./PoWRewardLimiter");
var ClaimTxStatus;
(function (ClaimTxStatus) {
    ClaimTxStatus["QUEUE"] = "queue";
    ClaimTxStatus["PROCESSING"] = "processing";
    ClaimTxStatus["PENDING"] = "pending";
    ClaimTxStatus["CONFIRMED"] = "confirmed";
    ClaimTxStatus["FAILED"] = "failed";
})(ClaimTxStatus = exports.ClaimTxStatus || (exports.ClaimTxStatus = {}));
var FucetWalletState;
(function (FucetWalletState) {
    FucetWalletState[FucetWalletState["UNKNOWN"] = 0] = "UNKNOWN";
    FucetWalletState[FucetWalletState["NORMAL"] = 1] = "NORMAL";
    FucetWalletState[FucetWalletState["LOWFUNDS"] = 2] = "LOWFUNDS";
    FucetWalletState[FucetWalletState["NOFUNDS"] = 3] = "NOFUNDS";
    FucetWalletState[FucetWalletState["OFFLINE"] = 4] = "OFFLINE";
})(FucetWalletState || (FucetWalletState = {}));
class ClaimTx extends tiny_typed_emitter_1.TypedEmitter {
    status;
    time;
    target;
    amount;
    session;
    nonce;
    txhex;
    txhash;
    txblock;
    retryCount;
    failReason;
    constructor(target, amount, sessId, date) {
        super();
        this.status = ClaimTxStatus.QUEUE;
        this.time = date ? new Date(date) : new Date();
        this.target = target;
        this.amount = amount;
        this.session = sessId;
        this.retryCount = 0;
    }
    serialize() {
        return {
            time: this.time.getTime(),
            target: this.target,
            amount: this.amount.toString(),
            session: this.session,
        };
    }
}
exports.ClaimTx = ClaimTx;
class EthWeb3Manager {
    web3;
    chainCommon;
    walletKey;
    walletAddr;
    walletState;
    claimTxQueue = [];
    pendingTxQueue = {};
    historyTxDict = {};
    lastWalletRefresh;
    queueProcessing = false;
    lastWalletRefill;
    lastWalletRefillTry;
    walletRefilling;
    constructor() {
        this.startWeb3();
        if (typeof FaucetConfig_1.faucetConfig.ethChainId === "number")
            this.initChainCommon(FaucetConfig_1.faucetConfig.ethChainId);
        this.walletKey = Buffer.from(FaucetConfig_1.faucetConfig.ethWalletKey, "hex");
        this.walletAddr = EthUtil.toChecksumAddress("0x" + EthUtil.privateToAddress(this.walletKey).toString("hex"));
        // restore saved claimTx queue
        ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).getClaimTxQueue().forEach((claimTx) => {
            let claim = new ClaimTx(claimTx.target, BigInt(claimTx.amount), claimTx.session, claimTx.time);
            this.claimTxQueue.push(claim);
        });
        this.loadWalletState().then(() => {
            setInterval(() => this.processQueue(), 2000);
        });
    }
    initChainCommon(chainId) {
        if (this.chainCommon && this.chainCommon.chainIdBN().toNumber() === chainId)
            return;
        ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "Web3 ChainCommon initialized with chainId " + chainId);
        this.chainCommon = EthCom.default.forCustomChain('mainnet', {
            networkId: chainId,
            chainId: chainId,
        }, 'london');
    }
    startWeb3() {
        let provider;
        if (FaucetConfig_1.faucetConfig.ethRpcHost.match(/^wss?:\/\//))
            provider = new web3_1.default.providers.WebsocketProvider(FaucetConfig_1.faucetConfig.ethRpcHost);
        else if (FaucetConfig_1.faucetConfig.ethRpcHost.match(/^\//))
            provider = new web3_1.default.providers.IpcProvider(FaucetConfig_1.faucetConfig.ethRpcHost, net_1.default);
        else
            provider = new web3_1.default.providers.HttpProvider(FaucetConfig_1.faucetConfig.ethRpcHost);
        this.web3 = new web3_1.default(provider);
        if (provider.on) {
            provider.on('error', e => {
                ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.ERROR, "Web3 provider error: " + e.toString());
            });
            provider.on('end', e => {
                ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.ERROR, "Web3 connection lost...");
                this.web3 = null;
                setTimeout(() => {
                    this.startWeb3();
                }, 2000);
            });
        }
    }
    getTransactionQueue(queueOnly) {
        let txlist = [];
        Array.prototype.push.apply(txlist, this.claimTxQueue);
        if (!queueOnly) {
            Array.prototype.push.apply(txlist, Object.values(this.pendingTxQueue));
            Array.prototype.push.apply(txlist, Object.values(this.historyTxDict));
        }
        return txlist;
    }
    loadWalletState() {
        this.lastWalletRefresh = Math.floor(new Date().getTime() / 1000);
        let chainIdPromise = typeof FaucetConfig_1.faucetConfig.ethChainId === "number" ? Promise.resolve(FaucetConfig_1.faucetConfig.ethChainId) : this.web3.eth.getChainId();
        return Promise.all([
            this.web3.eth.getBalance(this.walletAddr, "pending"),
            this.web3.eth.getTransactionCount(this.walletAddr, "pending"),
            chainIdPromise,
        ]).catch((ex) => {
            if (ex.toString().match(/"pending" is not yet supported/)) {
                return Promise.all([
                    this.web3.eth.getBalance(this.walletAddr),
                    this.web3.eth.getTransactionCount(this.walletAddr),
                    chainIdPromise,
                ]);
            }
            else
                throw ex;
        }).then((res) => {
            this.initChainCommon(res[2]);
            this.walletState = {
                ready: true,
                balance: BigInt(res[0]),
                nonce: res[1],
            };
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "Wallet " + this.walletAddr + ":  " + (Math.round((0, ConvertHelpers_1.weiToEth)(this.walletState.balance) * 1000) / 1000) + " ETH  [Nonce: " + this.walletState.nonce + "]");
        }, (err) => {
            this.walletState = {
                ready: false,
                balance: 0n,
                nonce: 0,
            };
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.ERROR, "Error loading wallet state for " + this.walletAddr + ": " + err.toString());
        }).then(() => {
            this.updateFaucetStatus();
        });
    }
    updateFaucetStatus() {
        let newStatus = FucetWalletState.UNKNOWN;
        if (this.walletState) {
            newStatus = FucetWalletState.NORMAL;
            if (!this.walletState.ready)
                newStatus = FucetWalletState.OFFLINE;
            else if (this.walletState.balance <= FaucetConfig_1.faucetConfig.spareFundsAmount)
                newStatus = FucetWalletState.NOFUNDS;
            else if (this.walletState.balance <= FaucetConfig_1.faucetConfig.lowFundsBalance)
                newStatus = FucetWalletState.LOWFUNDS;
        }
        let statusMessage = null;
        let statusLevel = null;
        switch (newStatus) {
            case FucetWalletState.LOWFUNDS:
                if (typeof FaucetConfig_1.faucetConfig.lowFundsWarning === "string")
                    statusMessage = FaucetConfig_1.faucetConfig.lowFundsWarning;
                else if (FaucetConfig_1.faucetConfig.lowFundsWarning)
                    statusMessage = "The faucet is running out of funds! Faucet Balance: {1}";
                else
                    break;
                statusMessage = (0, StringUtils_1.strFormatPlaceholder)(statusMessage, (Math.round((0, ConvertHelpers_1.weiToEth)(this.walletState.balance) * 1000) / 1000) + " ETH");
                statusLevel = FaucetStatus_1.FaucetStatusLevel.WARNING;
                break;
            case FucetWalletState.NOFUNDS:
                if (typeof FaucetConfig_1.faucetConfig.noFundsError === "string")
                    statusMessage = FaucetConfig_1.faucetConfig.noFundsError;
                else if (FaucetConfig_1.faucetConfig.noFundsError)
                    statusMessage = "The faucet is out of funds!";
                else
                    break;
                statusMessage = (0, StringUtils_1.strFormatPlaceholder)(statusMessage);
                statusLevel = FaucetStatus_1.FaucetStatusLevel.ERROR;
                break;
            case FucetWalletState.OFFLINE:
                if (typeof FaucetConfig_1.faucetConfig.rpcConnectionError === "string")
                    statusMessage = FaucetConfig_1.faucetConfig.rpcConnectionError;
                else if (FaucetConfig_1.faucetConfig.rpcConnectionError)
                    statusMessage = "The faucet could not connect to the network RPC";
                else
                    break;
                statusMessage = (0, StringUtils_1.strFormatPlaceholder)(statusMessage);
                statusLevel = FaucetStatus_1.FaucetStatusLevel.ERROR;
                break;
        }
        ServiceManager_1.ServiceManager.GetService(FaucetStatus_1.FaucetStatus).setFaucetStatus("wallet", statusMessage, statusLevel);
    }
    getFaucetAddress() {
        return this.walletAddr;
    }
    getWalletBalance(addr) {
        return this.web3.eth.getBalance(addr).then((res) => BigInt(res));
    }
    checkIsContract(addr) {
        return this.web3.eth.getCode(addr).then((res) => res && !!res.match(/^0x[0-9a-f]{2,}$/));
    }
    getFaucetBalance() {
        return this.walletState?.balance || null;
    }
    addClaimTransaction(target, amount, sessId) {
        let claimTx = new ClaimTx(target, amount, sessId);
        this.claimTxQueue.push(claimTx);
        ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).addQueuedClaimTx(claimTx.serialize());
        return claimTx;
    }
    getClaimTransaction(sessId) {
        for (let i = 0; i < this.claimTxQueue.length; i++) {
            if (this.claimTxQueue[i].session === sessId)
                return this.claimTxQueue[i];
        }
        let pendingTxs = Object.values(this.pendingTxQueue);
        for (let i = 0; i < pendingTxs.length; i++) {
            if (pendingTxs[i].session === sessId)
                return pendingTxs[i];
        }
        let historyTxs = Object.values(this.historyTxDict);
        for (let i = 0; i < historyTxs.length; i++) {
            if (historyTxs[i].session === sessId)
                return historyTxs[i];
        }
        return null;
    }
    buildEthTx(target, amount, nonce) {
        if (target.match(/^0X/))
            target = "0x" + target.substring(2);
        var rawTx = {
            nonce: nonce,
            gasLimit: FaucetConfig_1.faucetConfig.ethTxGasLimit,
            maxPriorityFeePerGas: FaucetConfig_1.faucetConfig.ethTxPrioFee,
            maxFeePerGas: FaucetConfig_1.faucetConfig.ethTxMaxFee,
            from: this.walletAddr,
            to: target,
            value: "0x" + amount.toString(16)
        };
        var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: this.chainCommon });
        tx = tx.sign(this.walletKey);
        return tx.serialize().toString('hex');
    }
    async processQueue() {
        if (this.queueProcessing)
            return;
        this.queueProcessing = true;
        try {
            while (Object.keys(this.pendingTxQueue).length < FaucetConfig_1.faucetConfig.ethMaxPending && this.claimTxQueue.length > 0) {
                if (FaucetConfig_1.faucetConfig.ethQueueNoFunds && (!this.walletState.ready || this.walletState.balance - BigInt(FaucetConfig_1.faucetConfig.spareFundsAmount) < this.claimTxQueue[0].amount)) {
                    break; // skip processing (out of funds)
                }
                let claimTx = this.claimTxQueue.splice(0, 1)[0];
                await this.processQueueTx(claimTx);
            }
            let now = Math.floor(new Date().getTime() / 1000);
            let walletRefreshTime = this.walletState.ready ? 600 : 10;
            if (Object.keys(this.pendingTxQueue).length === 0 && now - this.lastWalletRefresh > walletRefreshTime) {
                await this.loadWalletState();
            }
            if (FaucetConfig_1.faucetConfig.ethRefillContract && this.walletState.ready)
                await this.tryRefillWallet();
        }
        catch (ex) {
            let stack;
            try {
                throw new Error();
            }
            catch (ex) {
                stack = ex.stack;
            }
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.ERROR, "Exception in transaction queue processing: " + ex.toString() + `\r\n   Stack Trace: ${ex && ex.stack ? ex.stack : stack}`);
        }
        this.queueProcessing = false;
    }
    sleepPromise(delay) {
        return new Promise((resolve) => {
            setTimeout(resolve, delay);
        });
    }
    async processQueueTx(claimTx) {
        if (!this.walletState.ready) {
            claimTx.failReason = "Network RPC is currently unreachable.";
            claimTx.status = ClaimTxStatus.FAILED;
            claimTx.emit("failed");
            ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).removeQueuedClaimTx(claimTx.session);
            return;
        }
        if (!this.walletState.ready || this.walletState.balance - BigInt(FaucetConfig_1.faucetConfig.spareFundsAmount) < claimTx.amount) {
            claimTx.failReason = "Faucet wallet is out of funds.";
            claimTx.status = ClaimTxStatus.FAILED;
            claimTx.emit("failed");
            ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).removeQueuedClaimTx(claimTx.session);
            return;
        }
        try {
            claimTx.status = ClaimTxStatus.PROCESSING;
            claimTx.emit("processing");
            // send transaction
            let txPromise;
            let retryCount = 0;
            let txError;
            let buildTx = () => {
                claimTx.nonce = this.walletState.nonce;
                return this.buildEthTx(claimTx.target, claimTx.amount, claimTx.nonce);
            };
            do {
                try {
                    let txResult = await this.sendTransaction(buildTx());
                    claimTx.txhash = txResult[0];
                    txPromise = txResult[1];
                }
                catch (ex) {
                    if (!txError)
                        txError = ex;
                    ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.ERROR, "Sending TX for " + claimTx.target + " failed [try: " + retryCount + "]: " + ex.toString());
                    await this.sleepPromise(2000); // wait 2 secs and try again - maybe EL client is busy...
                    await this.loadWalletState();
                }
            } while (!txPromise && retryCount++ < 3);
            if (!txPromise)
                throw txError;
            this.walletState.nonce++;
            this.walletState.balance -= claimTx.amount;
            this.updateFaucetStatus();
            this.pendingTxQueue[claimTx.txhash] = claimTx;
            ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).removeQueuedClaimTx(claimTx.session);
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "Submitted claim transaction " + claimTx.session + " [" + (Math.round((0, ConvertHelpers_1.weiToEth)(claimTx.amount) * 1000) / 1000) + " ETH] to: " + claimTx.target + ": " + claimTx.txhash);
            claimTx.status = ClaimTxStatus.PENDING;
            claimTx.emit("pending");
            // await transaction receipt
            txPromise.then((receipt) => {
                delete this.pendingTxQueue[claimTx.txhash];
                claimTx.txblock = receipt.blockNumber;
                claimTx.status = ClaimTxStatus.CONFIRMED;
                claimTx.emit("confirmed");
                ServiceManager_1.ServiceManager.GetService(FaucetStatsLog_1.FaucetStatsLog).addClaimStats(claimTx);
            }, (error) => {
                ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.WARNING, "Transaction for " + claimTx.target + " failed: " + error.toString());
                delete this.pendingTxQueue[claimTx.txhash];
                claimTx.failReason = "Transaction Error: " + error.toString();
                claimTx.status = ClaimTxStatus.FAILED;
                claimTx.emit("failed");
            }).then(() => {
                this.historyTxDict[claimTx.nonce] = claimTx;
                setTimeout(() => {
                    delete this.historyTxDict[claimTx.nonce];
                }, 30 * 60 * 1000);
            });
        }
        catch (ex) {
            claimTx.failReason = "Processing Exception: " + ex.toString();
            claimTx.status = ClaimTxStatus.FAILED;
            claimTx.emit("failed");
        }
    }
    async sendTransaction(txhex) {
        let txhashDfd = new PromiseDfd_1.PromiseDfd();
        let receiptDfd = new PromiseDfd_1.PromiseDfd();
        let txStatus = 0;
        let txPromise = this.web3.eth.sendSignedTransaction("0x" + txhex);
        txPromise.once('transactionHash', (hash) => {
            txStatus = 1;
            txhashDfd.resolve(hash);
        });
        txPromise.once('receipt', (receipt) => {
            txStatus = 2;
            receiptDfd.resolve(receipt);
        });
        txPromise.on('error', (error) => {
            if (txStatus === 0)
                txhashDfd.reject(error);
            else
                receiptDfd.reject(error);
        });
        let txHash = await txhashDfd.promise;
        return [txHash, receiptDfd.promise];
    }
    async tryRefillWallet() {
        if (!FaucetConfig_1.faucetConfig.ethRefillContract)
            return;
        if (this.walletRefilling)
            return;
        let now = Math.floor(new Date().getTime() / 1000);
        if (this.lastWalletRefillTry && now - this.lastWalletRefillTry < 60)
            return;
        if (this.lastWalletRefill && FaucetConfig_1.faucetConfig.ethRefillContract.cooldownTime && now - this.lastWalletRefill < FaucetConfig_1.faucetConfig.ethRefillContract.cooldownTime)
            return;
        this.lastWalletRefillTry = now;
        if (this.walletState.balance - ServiceManager_1.ServiceManager.GetService(PoWRewardLimiter_1.PoWRewardLimiter).getUnclaimedBalance() > FaucetConfig_1.faucetConfig.ethRefillContract.triggerBalance)
            return;
        this.walletRefilling = true;
        try {
            let txResult = await this.refillWallet();
            this.lastWalletRefill = Math.floor(new Date().getTime() / 1000);
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "Sending withdraw transaction to vault contract: " + txResult[0]);
            let txReceipt = await txResult[1];
            if (!txReceipt.status)
                throw txReceipt;
            txResult[1].then((receipt) => {
                this.walletRefilling = false;
                if (!receipt.status)
                    throw receipt;
                this.loadWalletState(); // refresh balance
                ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "Faucet wallet successfully refilled from vault contract.");
            }).catch((err) => {
                ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.WARNING, "Faucet wallet refill transaction reverted: " + err.toString());
            });
        }
        catch (ex) {
            ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.WARNING, "Faucet wallet refill from vault contract failed: " + ex.toString());
            this.walletRefilling = false;
        }
    }
    async refillWallet() {
        let refillContractAbi = JSON.parse(FaucetConfig_1.faucetConfig.ethRefillContract.abi);
        let refillContract = new this.web3.eth.Contract(refillContractAbi, FaucetConfig_1.faucetConfig.ethRefillContract.contract, {
            from: this.walletAddr,
        });
        let refillAmount = FaucetConfig_1.faucetConfig.ethRefillContract.requestAmount || 0;
        let refillAllowance = null;
        let getCallArgs = (args) => {
            return args.map((arg) => {
                switch (arg) {
                    case "{walletAddr}":
                        arg = this.walletAddr;
                        break;
                    case "{amount}":
                        arg = BigInt(refillAmount);
                        break;
                }
                return arg;
            });
        };
        if (FaucetConfig_1.faucetConfig.ethRefillContract.allowanceFn) {
            // check allowance
            let callArgs = getCallArgs(FaucetConfig_1.faucetConfig.ethRefillContract.allowanceFnArgs || ["{walletAddr}"]);
            refillAllowance = await refillContract.methods[FaucetConfig_1.faucetConfig.ethRefillContract.allowanceFn].apply(this, callArgs).call();
            if (refillAllowance == 0)
                throw "no withdrawable funds from refill contract";
            if (refillAmount > refillAllowance)
                refillAmount = refillAllowance;
        }
        if (FaucetConfig_1.faucetConfig.ethRefillContract.checkContractBalance) {
            let checkAddr = (typeof FaucetConfig_1.faucetConfig.ethRefillContract.checkContractBalance === "string" ? FaucetConfig_1.faucetConfig.ethRefillContract.checkContractBalance : FaucetConfig_1.faucetConfig.ethRefillContract.contract);
            let contractBalance = parseInt(await this.web3.eth.getBalance(checkAddr));
            if (contractBalance <= (FaucetConfig_1.faucetConfig.ethRefillContract.contractDustBalance || 1000000000))
                throw "refill contract is out of funds";
            if (refillAmount > contractBalance)
                refillAmount = contractBalance;
        }
        let callArgs = getCallArgs(FaucetConfig_1.faucetConfig.ethRefillContract.withdrawFnArgs || ["{amount}"]);
        var rawTx = {
            nonce: this.walletState.nonce,
            gasLimit: FaucetConfig_1.faucetConfig.ethRefillContract.withdrawGasLimit || FaucetConfig_1.faucetConfig.ethTxGasLimit,
            maxPriorityFeePerGas: FaucetConfig_1.faucetConfig.ethTxPrioFee,
            maxFeePerGas: FaucetConfig_1.faucetConfig.ethTxMaxFee,
            from: this.walletAddr,
            to: FaucetConfig_1.faucetConfig.ethRefillContract.contract,
            value: 0,
            data: refillContract.methods[FaucetConfig_1.faucetConfig.ethRefillContract.withdrawFn].apply(this, callArgs).encodeABI()
        };
        var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: this.chainCommon });
        tx = tx.sign(this.walletKey);
        let txHex = tx.serialize().toString('hex');
        let txResult = await this.sendTransaction(txHex);
        this.walletState.nonce++;
        return txResult;
    }
    getFaucetRefillCooldown() {
        let now = Math.floor(new Date().getTime() / 1000);
        if (!FaucetConfig_1.faucetConfig.ethRefillContract || !FaucetConfig_1.faucetConfig.ethRefillContract.cooldownTime)
            return 0;
        if (!this.lastWalletRefill)
            return 0;
        let cooldown = FaucetConfig_1.faucetConfig.ethRefillContract.cooldownTime - (now - this.lastWalletRefill);
        if (cooldown < 0)
            return 0;
        return cooldown;
    }
}
exports.EthWeb3Manager = EthWeb3Manager;
//# sourceMappingURL=EthWeb3Manager.js.map