"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsWeb3Manager = void 0;
const web3_1 = __importDefault(require("web3"));
const ethereum_ens_1 = __importDefault(require("ethereum-ens"));
const FaucetConfig_1 = require("../common/FaucetConfig");
class EnsWeb3Manager {
    ens;
    constructor() {
        if (!FaucetConfig_1.faucetConfig.ensResolver)
            return;
        let provider = new web3_1.default.providers.HttpProvider(FaucetConfig_1.faucetConfig.ensResolver.rpcHost);
        this.ens = new ethereum_ens_1.default(provider, FaucetConfig_1.faucetConfig.ensResolver.ensAddr || undefined, web3_1.default);
    }
    resolveEnsName(ensName) {
        if (!this.ens)
            return Promise.reject("ENS resolver not enabled");
        return this.ens.resolver(ensName).addr();
    }
}
exports.EnsWeb3Manager = EnsWeb3Manager;
//# sourceMappingURL=EnsWeb3Manager.js.map