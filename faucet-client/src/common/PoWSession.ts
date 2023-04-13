import { TypedEmitter } from 'tiny-typed-emitter';
import { IFaucetConfig } from './IFaucetConfig';
import { IPoWClientConnectionKeeper, PoWClient } from "./PoWClient";
import { IPoWMinerShare, IPoWMinerVerification, PoWMiner } from "./PoWMiner";
import { PoWTime } from './PoWTime';

export interface IPoWSessionOptions {
  client: PoWClient;
  powTime: PoWTime;
  getInputs: () => Promise<object>;
  showNotification: (type: string, message: string, time?: number|boolean, timeout?: number) => number;
}

export interface IPoWSessionInfo {
  sessionId: string;
  targetAddr: string;
  startTime: number;
  preimage: string;
  balance: number;
  recovery: string;
  noncePos: number;
}

export interface IPoWSessionBoostInfo {
  stamps: string[];
  score: number;
  factor: number;
}

export interface IPoWSessionBalanceUpdate {
  balance: number;
  recovery: string;
  reason: string;
}

export interface IPoWClaimInfo {
  session: string;
  tokenTime: number;
  startTime: number;
  target: string;
  balance: number;
  nonce: number;
  token: string;
  claiming?: boolean;
  error?: string;
}

interface IPoWSessionTokenInfo {
  id: string;
  startTime: number;
  targetAddr: string;
  preimage: string;
  balance: string;
  nonce: number;
  tokenTime?: number;
  claimable?: boolean;
}

interface PoWSessionEvents {
  'update': () => void;
  'update-boost': (boostInfo: IPoWSessionBoostInfo) => void;
  'killed': (killInfo: any) => void;
  'error': (message: string) => void;
  'claimable': (claimInfo: IPoWClaimInfo) => void;
}

export class PoWSession extends TypedEmitter<PoWSessionEvents> {
  private options: IPoWSessionOptions;
  private sessionInfo: IPoWSessionInfo;
  private shareQueue: IPoWMinerShare[];
  private shareQueueProcessing: boolean;
  private verifyResultQueue: any[];
  private miner: PoWMiner;
  private boostInfo: IPoWSessionBoostInfo;

  public constructor(options: IPoWSessionOptions) {
    super();
    this.options = options;
    this.shareQueue = [];
    this.verifyResultQueue = [];
  }

  public getMiner(): PoWMiner {
    return this.miner;
  }

  public setMiner(miner: PoWMiner) {
    this.miner = miner;
  }

  public startSession() {
    return this.options.getInputs().then((sessionInputs) => {
      return this.options.client.sendRequest("startSession", sessionInputs)
    }).then((session) => {
      this.options.client.setCurrentSession(this);
      this.sessionInfo = Object.assign({
        balance: 0,
        noncePos: 1,
      }, session);
      this.shareQueue = [];
      this.verifyResultQueue = [];
      return session.sessionId;
    });
  }

  public resumeSession(sessionInfo?: IPoWSessionInfo): Promise<void> {
    if(!sessionInfo) {
      if(!this.sessionInfo)
        return Promise.resolve();
      sessionInfo = this.sessionInfo;
    }
    if(this.miner) {
      let faucetConfig = this.options.client.getFaucetConfig();
      this.miner.setPoWParams(faucetConfig.powParams, faucetConfig.powNonceCount);
    }
    this.options.client.setCurrentSession(this);
    return this.options.client.sendRequest("resumeSession", {
      sessionId: sessionInfo.sessionId
    }).then((res) => {
      if(res.lastNonce > sessionInfo.noncePos)
        sessionInfo.noncePos = res.lastNonce + 1;
    }, (err) => {
      if(err && err.code) {
        switch(err.code) {
          case "INVALID_SESSIONID":
            // server doesn't know about this session id anymore - try recover
            return this.options.client.sendRequest("recoverSession", sessionInfo.recovery);
          case "SESSION_CLOSED":
            // session was closed
            if(err.data && err.data.token) {
              // we've got a claim token
              let claimInfo = this.getClaimInfo(err.data.token);
              this.storeClaimInfo(claimInfo);
              this.emit("claimable", claimInfo);
            }
            this.closedSession();
            sessionInfo = null;
            return;
          default:
            this.options.showNotification("error", "Resume session error: [" + err.code + "] " + err.message, true, 20 * 1000);
            break;
        }
      }
      throw err;
    }).then(() => {
      if(!sessionInfo)
        return;
      this.sessionInfo = sessionInfo;

      // resumed session
      if(this.shareQueue.length) {
        this.processShareQueue();
      }
      if(this.verifyResultQueue.length) {
        this.verifyResultQueue.forEach((verifyResult) => this._submitVerifyResult(verifyResult));
        this.verifyResultQueue = [];
      }
      this.emit("update");
    });
  }

  public getSessionInfo(): IPoWSessionInfo {
    return this.sessionInfo;
  }

  public submitShare(share: IPoWMinerShare) {
    if(this.options.client.isReady() && this.shareQueue.length === 0)
      this._submitShare(share);
    else
      this.shareQueue.push(share);
  }

  private processShareQueue() {
    if(this.shareQueueProcessing)
      return;
    this.shareQueueProcessing = true;

    let queueLoop = () => {
      if(!this.sessionInfo) {
        this.shareQueue = [];
        this.shareQueueProcessing = false;
        return;
      }

      let queueLen = this.shareQueue.length;
      if(!this.options.client.isReady())
        queueLen = 0;
      
      if(queueLen > 0) {
        this._submitShare(this.shareQueue.shift());
        queueLen--;
      }

      if(queueLen > 0)
        setTimeout(() => queueLoop(), 2000);
      else
        this.shareQueueProcessing = false;
    }
    queueLoop();
  }

  private _submitShare(share: IPoWMinerShare) {
    this.options.client.sendRequest("foundShare", share).catch((err) => {
      this.options.showNotification("error", "Submission error: [" + err.code + "] " + err.message, true, 20 * 1000);
    });
  }

  public processVerification(verification: IPoWMinerVerification) {
    if(!this.miner)
      return;
    this.miner.processVerification(verification);
  }

  public submitVerifyResult(result) {
    if(this.options.client.isReady() && this.verifyResultQueue.length === 0)
      this._submitVerifyResult(result);
    else
      this.verifyResultQueue.push(result);
  }

  private _submitVerifyResult(result) {
    this.options.client.sendRequest("verifyResult", result).catch((err) => {
      this.options.showNotification("error", "Verification error: [" + err.code + "] " + err.message, true, 20 * 1000);
    });
  }

  public updateBalance(balanceUpdate: IPoWSessionBalanceUpdate) {
    this.sessionInfo.balance = balanceUpdate.balance;
    this.sessionInfo.recovery = balanceUpdate.recovery;
    this.storeSessionStatus();
    this.emit("update");
  }

  public updateBoostInfo(boostInfo: IPoWSessionBoostInfo) {
    this.boostInfo = boostInfo;
    this.emit("update-boost", boostInfo);
  }

  public getBoostInfo(): IPoWSessionBoostInfo {
    return this.boostInfo;
  }

  public getNonceRange(count: number): number {
    if(!this.sessionInfo)
      return null;
    
    let noncePos = this.sessionInfo.noncePos;
    this.sessionInfo.noncePos += count;
    this.storeSessionStatus();

    return noncePos;
  }

  public closeSession(): Promise<void> {
    return this.options.client.sendRequest("closeSession").then((rsp) => {

      if(rsp.claimable) {
        let claimInfo = this.getClaimInfo(rsp.token);
        this.storeClaimInfo(claimInfo);
        this.emit("claimable", claimInfo);
      }

      this.closedSession();
    });
  }

  public closedSession(): void {
    this.sessionInfo = null;
    this.storeSessionStatus();
    this.emit("update");
  }

  public processSessionKill(killInfo: any) {
    let claimable = false;
    if(killInfo.level === "timeout" && killInfo.token) {
      let claimInfo = this.getClaimInfo(killInfo.token);
      this.storeClaimInfo(claimInfo);
      this.emit("claimable", claimInfo);
      claimable = true;
    }
    this.sessionInfo = null;
    if(killInfo.level === "session" || killInfo.level === "timeout")
      this.storeSessionStatus();
    if(!claimable)
      this.emit("killed", killInfo);
    this.emit("update");
  }

  private storeSessionStatus() {
    let sessionStr: string = null;
    if(this.sessionInfo)
      sessionStr = JSON.stringify(this.sessionInfo);
    
    if(sessionStr)
      localStorage.setItem('powSessionStatus', sessionStr);
    else if(localStorage.getItem('powSessionStatus'))
      localStorage.removeItem('powSessionStatus');
  }

  public getStoredSessionInfo(faucetConfig: IFaucetConfig): IPoWSessionInfo {
    let sessionStr = localStorage.getItem('powSessionStatus');
    let session: IPoWSessionInfo = null;
    if(sessionStr) {
      try {
        session = JSON.parse(sessionStr);
      } catch(ex) {}
    }
    if(!session)
      return null;

    let sessionAge = this.options.powTime.getSyncedTime() - session.startTime;
    if(sessionAge >= faucetConfig.powTimeout)
      return null;
    
    return session;
  }

  private getClaimInfo(claimToken: string): IPoWClaimInfo {
    // parse claim token
    if(!claimToken || typeof claimToken !== "string")
      return null;
    let sigPos = claimToken.indexOf("|");
    if(sigPos === -1)
      return null;
    
    let claimObj = JSON.parse(atob(claimToken.substring(0, sigPos))) as IPoWSessionTokenInfo;
    if(!claimObj)
      return null;
    
    return {
      session: claimObj.id,
      tokenTime: claimObj.tokenTime,
      startTime: claimObj.startTime,
      target: claimObj.targetAddr,
      balance: parseInt(claimObj.balance),
      nonce: claimObj.nonce,
      token: claimToken
    };
  }

  public getStoredClaimInfo(faucetConfig: IFaucetConfig): IPoWClaimInfo {
    let claimStr = localStorage.getItem('powClaimStatus');
    let claimInfo: IPoWClaimInfo = null;
    if(claimStr) {
      try {
        claimInfo = JSON.parse(claimStr);
      } catch(ex) {}
    }
    if(!claimInfo)
      return null;

    let claimAge = this.options.powTime.getSyncedTime() - claimInfo.startTime;
    if(claimAge >= faucetConfig.claimTimeout)
      return null;
    
    return claimInfo;
  }

  public storeClaimInfo(claimInfo: IPoWClaimInfo) {
    let claimStr = claimInfo ? JSON.stringify(claimInfo) : null;
    if(claimStr)
      localStorage.setItem('powClaimStatus', claimStr);
    else if(localStorage.getItem('powClaimStatus'))
      localStorage.removeItem('powClaimStatus');
  }

}
