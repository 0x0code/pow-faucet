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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoWStatusLog = exports.PoWStatusLogLevel = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const FaucetStore_1 = require("../services/FaucetStore");
const DateUtils_1 = require("../utils/DateUtils");
const StringUtils_1 = require("../utils/StringUtils");
const PoWSession_1 = require("../websock/PoWSession");
const FaucetConfig_1 = require("./FaucetConfig");
const ServiceManager_1 = require("./ServiceManager");
var PoWStatusLogLevel;
(function (PoWStatusLogLevel) {
    PoWStatusLogLevel["ERROR"] = "ERROR";
    PoWStatusLogLevel["WARNING"] = "WARNING";
    PoWStatusLogLevel["INFO"] = "INFO";
    PoWStatusLogLevel["HIDDEN"] = "HIDDEN";
})(PoWStatusLogLevel = exports.PoWStatusLogLevel || (exports.PoWStatusLogLevel = {}));
class PoWStatusLog extends tiny_typed_emitter_1.TypedEmitter {
    constructor() {
        super();
        if (FaucetConfig_1.faucetConfig.faucetPidFile) {
            fs.writeFileSync(FaucetConfig_1.faucetConfig.faucetPidFile, process.pid.toString());
        }
        process.on('uncaughtException', (err, origin) => {
            this.emitLog(PoWStatusLogLevel.ERROR, `### Caught unhandled exception: ${err}\r\n` + `  Exception origin: ${origin}\r\n` + `  Stack Trace: ${err.stack}\r\n`);
            this.shutdown(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            let stack;
            try {
                throw new Error();
            }
            catch (ex) {
                stack = ex.stack;
            }
            this.emitLog(PoWStatusLogLevel.ERROR, `### Caught unhandled rejection: ${reason}\r\n` + `  Stack Trace: ${reason && reason.stack ? reason.stack : stack}\r\n`);
        });
        process.on('SIGUSR1', () => {
            this.emitLog(PoWStatusLogLevel.INFO, `# Received SIGURS1 signal - reloading faucet config`);
            (0, FaucetConfig_1.loadFaucetConfig)();
            this.emit("reload");
        });
        process.on('SIGINT', () => {
            // CTRL+C
            this.emitLog(PoWStatusLogLevel.INFO, `# Received SIGINT signal - shutdown faucet`);
            this.shutdown(0);
        });
        process.on('SIGQUIT', () => {
            // Keyboard quit
            this.emitLog(PoWStatusLogLevel.INFO, `# Received SIGQUIT signal - shutdown faucet`);
            this.shutdown(0);
        });
        process.on('SIGTERM', () => {
            // `kill` command
            this.emitLog(PoWStatusLogLevel.INFO, `# Received SIGTERM signal - shutdown faucet`);
            this.shutdown(0);
        });
    }
    shutdown(code) {
        try {
            PoWSession_1.PoWSession.saveSessionData();
            ServiceManager_1.ServiceManager.GetService(FaucetStore_1.FaucetStore).saveStore(true);
        }
        catch (ex) { }
        process.exit(code);
    }
    emitLog(level, message, data) {
        if (level === PoWStatusLogLevel.HIDDEN)
            return;
        let logLine = (0, DateUtils_1.renderDate)(new Date(), true, true) + "  " + (0, StringUtils_1.strPadRight)(level, 7, " ") + "  " + message;
        if (FaucetConfig_1.faucetConfig.faucetLogFile) {
            let logFile = FaucetConfig_1.faucetConfig.faucetLogFile.match(/^\//) ? FaucetConfig_1.faucetConfig.faucetLogFile : path.join(FaucetConfig_1.faucetConfig.appBasePath, FaucetConfig_1.faucetConfig.faucetLogFile);
            fs.appendFileSync(logFile, logLine + "\r\n");
        }
        console.log(logLine);
    }
}
exports.PoWStatusLog = PoWStatusLog;
//# sourceMappingURL=PoWStatusLog.js.map