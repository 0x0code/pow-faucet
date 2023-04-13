"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FaucetConfig_1 = require("./common/FaucetConfig");
const EthWeb3Manager_1 = require("./services/EthWeb3Manager");
const EnsWeb3Manager_1 = require("./services/EnsWeb3Manager");
const FaucetWebServer_1 = require("./webserv/FaucetWebServer");
const FaucetStore_1 = require("./services/FaucetStore");
const ServiceManager_1 = require("./common/ServiceManager");
const PoWValidator_1 = require("./validator/PoWValidator");
const FaucetStatsLog_1 = require("./services/FaucetStatsLog");
const FaucetWebApi_1 = require("./webserv/FaucetWebApi");
const PoWSession_1 = require("./websock/PoWSession");
(() => {
    (0, FaucetConfig_1.loadFaucetConfig)();
    ServiceManager_1.ServiceManager.InitService(FaucetStore_1.FaucetStore);
    ServiceManager_1.ServiceManager.InitService(EthWeb3Manager_1.EthWeb3Manager);
    ServiceManager_1.ServiceManager.InitService(EnsWeb3Manager_1.EnsWeb3Manager);
    ServiceManager_1.ServiceManager.InitService(PoWValidator_1.PoWValidator);
    ServiceManager_1.ServiceManager.InitService(FaucetStatsLog_1.FaucetStatsLog);
    ServiceManager_1.ServiceManager.InitService(FaucetWebApi_1.FaucetWebApi);
    ServiceManager_1.ServiceManager.InitService(FaucetWebServer_1.FaucetHttpServer);
    PoWSession_1.PoWSession.loadSessionData();
})();
//# sourceMappingURL=app.js.map