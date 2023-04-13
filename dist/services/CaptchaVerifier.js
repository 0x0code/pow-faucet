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
exports.CaptchaVerifier = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const hcaptcha = __importStar(require("hcaptcha"));
const FaucetConfig_1 = require("../common/FaucetConfig");
class CaptchaVerifier {
    async verifyToken(token, remoteIp) {
        if (!FaucetConfig_1.faucetConfig.captchas)
            return true;
        switch (FaucetConfig_1.faucetConfig.captchas.provider) {
            case "hcaptcha":
                return await this.verifyHCaptchaToken(token, remoteIp);
            case "recaptcha":
                return await this.verifyReCaptchaToken(token, remoteIp);
            case "custom":
                return await this.verifyCustomToken(token, remoteIp);
            default:
                return true;
        }
    }
    async verifyHCaptchaToken(token, remoteIp) {
        let hcaptchaResponse = await hcaptcha.verify(FaucetConfig_1.faucetConfig.captchas.secret, token, remoteIp, FaucetConfig_1.faucetConfig.captchas.siteKey);
        return hcaptchaResponse.success;
    }
    async verifyReCaptchaToken(token, remoteIp) {
        let verifyData = new URLSearchParams();
        verifyData.append("secret", FaucetConfig_1.faucetConfig.captchas.secret);
        verifyData.append("response", token);
        verifyData.append("remoteip", remoteIp);
        let verifyRsp = await (0, node_fetch_1.default)("https://www.google.com/recaptcha/api/siteverify", {
            method: 'POST',
            body: verifyData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then((rsp) => rsp.json());
        if (!verifyRsp || !verifyRsp.success)
            return false;
        return true;
    }
    async verifyCustomToken(token, remoteIp) {
        let verifyData = new URLSearchParams();
        verifyData.append("response", token);
        verifyData.append("remoteip", remoteIp);
        let verifyRsp = await (0, node_fetch_1.default)(FaucetConfig_1.faucetConfig.captchas.secret, {
            method: 'POST',
            body: verifyData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then((rsp) => rsp.json());
        if (!verifyRsp || !verifyRsp.success)
            return false;
        return verifyRsp.ident || true;
    }
}
exports.CaptchaVerifier = CaptchaVerifier;
//# sourceMappingURL=CaptchaVerifier.js.map