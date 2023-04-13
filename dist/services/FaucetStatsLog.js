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
exports.FaucetStatsLog = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FaucetConfig_1 = require("../common/FaucetConfig");
const PoWStatusLog_1 = require("../common/PoWStatusLog");
const ServiceManager_1 = require("../common/ServiceManager");
const ConvertHelpers_1 = require("../utils/ConvertHelpers");
const PoWClient_1 = require("../websock/PoWClient");
const PoWSession_1 = require("../websock/PoWSession");
class FaucetStatsLog {
    statShareCount = 0;
    statShareRewards = 0n;
    statVerifyCount = 0;
    statVerifyMisses = 0;
    statVerifyReward = 0n;
    statVerifyPenalty = 0n;
    statClaimCount = 0;
    statClaimRewards = 0n;
    statSlashCount = 0;
    enabled;
    statsFile;
    statsTimer;
    constructor() {
        if (FaucetConfig_1.faucetConfig.faucetStats) {
            this.enabled = true;
            this.statsFile = path.join(FaucetConfig_1.faucetConfig.appBasePath, FaucetConfig_1.faucetConfig.faucetStats.logfile || "faucet-stats.log");
        }
        else {
            this.enabled = false;
        }
        this.sheduleStatsLoop();
    }
    sheduleStatsLoop() {
        let now = (new Date()).getTime();
        let loopInterval = FaucetConfig_1.faucetConfig.faucetLogStatsInterval * 1000;
        let loopIndex = Math.floor(now / loopInterval);
        let nextLoopTime = (loopIndex + 1) * loopInterval;
        let loopDelay = nextLoopTime - now + 10;
        if (this.statsTimer)
            clearTimeout(this.statsTimer);
        this.statsTimer = setTimeout(() => {
            this.statsTimer = null;
            this.processFaucetStats();
            this.sheduleStatsLoop();
        }, loopDelay);
    }
    addStatsEntry(type, data) {
        if (!this.enabled)
            return;
        let now = Math.floor((new Date()).getTime() / 1000);
        let entry = type + " " + now + " " + JSON.stringify(data) + "\n";
        fs.appendFileSync(this.statsFile, entry);
    }
    addSessionStats(session) {
        let ipinfo = session.getLastIpInfo();
        this.addStatsEntry("SESS", {
            st: Math.floor(session.getStartTime().getTime() / 1000),
            ip: session.getLastRemoteIp(),
            to: session.getTargetAddr(),
            val: session.getBalance().toString(),
            hr: Math.round(session.getReportedHashRate()),
            no: session.getLastNonce(),
            loc: ipinfo ? {
                c: ipinfo.countryCode,
                r: ipinfo.regionCode,
                h: ipinfo.hosting ? 1 : undefined,
                p: ipinfo.proxy ? 1 : undefined,
            } : null,
            in: session.getIdent(),
            id: session.getSessionId(),
        });
    }
    addClaimStats(claim) {
        this.addStatsEntry("CLAIM", {
            to: claim.target,
            val: claim.amount.toString(),
            sess: claim.session,
        });
    }
    processFaucetStats() {
        let sessions = PoWSession_1.PoWSession.getAllSessions(true);
        let idleSessCount = sessions.filter((s) => !s.getActiveClient()).length;
        let hashRate = 0;
        sessions.forEach((s) => {
            if (s.getSessionStatus() !== PoWSession_1.PoWSessionStatus.MINING)
                return;
            hashRate += s.getReportedHashRate() || 0;
        });
        hashRate = Math.round(hashRate);
        let statsLog = [];
        statsLog.push("clients: " + PoWClient_1.PoWClient.getClientCount());
        statsLog.push("sessions: " + sessions.length + " (" + hashRate + " H/s, " + idleSessCount + " idle)");
        statsLog.push("shares: " + this.statShareCount + " (" + (Math.round((0, ConvertHelpers_1.weiToEth)(this.statShareRewards) * 1000) / 1000) + " ETH)");
        statsLog.push("verify: " + (this.statVerifyCount - this.statVerifyMisses) + " (reward: " + (Math.round((0, ConvertHelpers_1.weiToEth)(this.statVerifyReward) * 1000) / 1000) + " ETH, missed: " + this.statVerifyMisses + " / -" + (Math.round((0, ConvertHelpers_1.weiToEth)(this.statVerifyPenalty) * 1000) / 1000) + " ETH)");
        statsLog.push("claims: " + this.statClaimCount + " (" + (Math.round((0, ConvertHelpers_1.weiToEth)(this.statClaimRewards) * 1000) / 1000) + " ETH)");
        ServiceManager_1.ServiceManager.GetService(PoWStatusLog_1.PoWStatusLog).emitLog(PoWStatusLog_1.PoWStatusLogLevel.INFO, "# STATS # " + statsLog.join(", "));
        this.addStatsEntry("STATS", {
            cliCnt: PoWClient_1.PoWClient.getClientCount(),
            sessCnt: sessions.length,
            sessIdl: idleSessCount,
            hashRate: hashRate,
            shareCnt: this.statShareCount,
            shareVal: this.statShareRewards.toString(),
            vrfyCnt: this.statVerifyCount,
            vrfyMisa: this.statVerifyMisses,
            vrfyVal: this.statVerifyReward.toString(),
            vrfyPen: this.statVerifyPenalty.toString(),
            claimCnt: this.statClaimCount,
            claimVal: this.statClaimRewards.toString(),
            slashCnt: this.statSlashCount,
        });
        this.statShareCount = 0;
        this.statShareRewards = 0n;
        this.statVerifyCount = 0;
        this.statVerifyMisses = 0;
        this.statVerifyReward = 0n;
        this.statVerifyPenalty = 0n;
        this.statClaimCount = 0;
        this.statClaimRewards = 0n;
        this.statSlashCount = 0;
    }
}
exports.FaucetStatsLog = FaucetStatsLog;
//# sourceMappingURL=FaucetStatsLog.js.map