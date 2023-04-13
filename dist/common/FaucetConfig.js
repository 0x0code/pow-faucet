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
exports.loadFaucetConfig = exports.faucetConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const randombytes_1 = __importDefault(require("randombytes"));
let cliArgs = (function () {
    let args = {};
    let arg, key;
    for (let i = 0; i < process.argv.length; i++) {
        if ((arg = /^--([^=]+)(?:=(.+))?$/.exec(process.argv[i]))) {
            key = arg[1];
            args[arg[1]] = arg[2] || true;
        }
        else if (key) {
            args[key] = process.argv[i];
            key = null;
        }
    }
    return args;
})();
let packageJson = require('../../package.json');
let basePath = path.join(__dirname, "..", "..");
let configFile;
if (cliArgs['config']) {
    if (cliArgs['config'].match(/^\//))
        configFile = cliArgs['config'];
    else
        configFile = path.join(basePath, cliArgs['config']);
}
else
    configFile = path.join(basePath, "faucet-config.yaml");
let defaultConfig = {
    appBasePath: basePath,
    faucetVersion: packageJson.version,
    staticPath: path.join(basePath, "static"),
    faucetPidFile: null,
    buildSeoIndex: true,
    buildSeoMeta: {
        "keywords": "powfaucet,faucet,ethereum,ethereum faucet,evm,eth,pow",
    },
    faucetStore: path.join(basePath, "faucet-store.json"),
    powPingInterval: 10,
    powPingTimeout: 30,
    faucetTitle: "PoW Faucet",
    faucetImage: "/images/fauceth_420.jpg",
    faucetHomeHtml: "",
    faucetCoinSymbol: "ETH",
    faucetLogFile: null,
    faucetLogStatsInterval: 600,
    serverPort: 8080,
    faucetSecret: null,
    powShareReward: 25000000000000000,
    claimMinAmount: 100000000000000000,
    claimMaxAmount: 10000000000000000000,
    powSessionTimeout: 3600,
    claimSessionTimeout: 7200,
    powIdleTimeout: 1800,
    claimAddrCooldown: 7200,
    claimAddrMaxBalance: null,
    claimAddrDenyContract: false,
    powScryptParams: {
        cpuAndMemory: 4096,
        blockSize: 8,
        paralellization: 1,
        keyLength: 16,
        difficulty: 9
    },
    powNonceCount: 1,
    powHashrateSoftLimit: 0,
    powHashrateHardLimit: 0,
    verifyLocalPercent: 10,
    verifyLocalMaxQueue: 100,
    verifyMinerPeerCount: 2,
    verifyLocalLowPeerPercent: 100,
    verifyMinerPercent: 100,
    verifyMinerIndividuals: 2,
    verifyMinerMaxPending: 10,
    verifyMinerMaxMissed: 10,
    verifyMinerTimeout: 15,
    verifyMinerReward: 0,
    verifyMinerMissPenalty: 10000000000000000,
    captchas: null,
    concurrentSessions: 0,
    ipInfoApi: "http://ip-api.com/json/{ip}?fields=21155839",
    ipRestrictedRewardShare: null,
    ipInfoMatchRestrictedReward: null,
    ipInfoMatchRestrictedRewardFile: null,
    faucetBalanceRestrictedReward: null,
    faucetBalanceRestriction: null,
    spareFundsAmount: 10000000000000000,
    lowFundsBalance: 10000000000000000000,
    lowFundsWarning: true,
    noFundsError: true,
    rpcConnectionError: true,
    denyNewSessions: false,
    ethRpcHost: "http://127.0.0.1:8545/",
    ethWalletKey: "fc2d0a2d823f90e0599e1e9d9202204e42a5ed388000ab565a34e7cbb566274b",
    ethChainId: null,
    ethTxGasLimit: 21000,
    ethTxMaxFee: 1800000000,
    ethTxPrioFee: 800000000,
    ethMaxPending: 12,
    ethQueueNoFunds: false,
    ethTxExplorerLink: null,
    ethRefillContract: null,
    ensResolver: null,
    faucetStats: null,
    resultSharing: null,
    passportBoost: null,
};
exports.faucetConfig = null;
function loadFaucetConfig() {
    let config;
    if (!fs.existsSync(configFile)) {
        // create copy of faucet-config.example.yml
        let exampleConfigFile = path.join(basePath, "faucet-config.example.yaml");
        if (!fs.existsSync(exampleConfigFile))
            throw exampleConfigFile + " not found";
        let exampleYamlSrc = fs.readFileSync(exampleConfigFile, "utf8");
        exampleYamlSrc = exampleYamlSrc.replace(/^ethWalletKey:.*$/m, 'ethWalletKey: "' + (0, randombytes_1.default)(32).toString("hex") + '"');
        exampleYamlSrc = exampleYamlSrc.replace(/^faucetSecret:.*$/m, 'faucetSecret: "' + (0, randombytes_1.default)(40).toString("hex") + '"');
        fs.writeFileSync(configFile, exampleYamlSrc);
    }
    console.log("Loading yaml faucet config from " + configFile);
    let yamlSrc = fs.readFileSync(configFile, "utf8");
    let yamlObj = yaml_1.default.parse(yamlSrc);
    config = yamlObj;
    if (!config.faucetSecret) {
        if (config.powSessionSecret)
            config.faucetSecret = config.powSessionSecret;
        else
            throw "faucetSecret in config must not be left empty";
    }
    if (!config.captchas && config.hcaptcha)
        config.captchas = config.hcaptcha;
    if (!exports.faucetConfig)
        exports.faucetConfig = {};
    Object.assign(exports.faucetConfig, defaultConfig, config);
}
exports.loadFaucetConfig = loadFaucetConfig;
//# sourceMappingURL=FaucetConfig.js.map