"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
class ServiceManager {
    static _serviceSymbol = (globalThis.Symbol ? Symbol("ServiceInstances") : "__SvcInstances");
    static _serviceClasses = [];
    static _serviceInstances = [];
    static GetServiceIdx(serviceClass) {
        let serviceIdx;
        if (serviceClass.hasOwnProperty(this._serviceSymbol))
            serviceIdx = serviceClass[this._serviceSymbol];
        else {
            serviceIdx = this._serviceClasses.length;
            Object.defineProperty(serviceClass, this._serviceSymbol, {
                value: serviceIdx,
                writable: false
            });
            this._serviceClasses.push(serviceClass);
            this._serviceInstances.push([]);
        }
        return serviceIdx;
    }
    static GetServiceObj(serviceIdx, identObj) {
        let objListLen = this._serviceInstances[serviceIdx].length;
        for (let idx = 0; idx < objListLen; idx++) {
            if (this._serviceInstances[serviceIdx][idx][0] === identObj)
                return this._serviceInstances[serviceIdx][idx][1];
        }
        return null;
    }
    static AddServiceObj(serviceIdx, identObj, serviceObj) {
        this._serviceInstances[serviceIdx].push([
            identObj,
            serviceObj
        ]);
    }
    static InitService(serviceClass, serviceProps = null, serviceIdent = undefined) {
        if (!serviceClass)
            return null;
        if (serviceIdent === undefined)
            serviceIdent = null;
        let serviceIdx = this.GetServiceIdx(serviceClass);
        let serviceObj = this.GetServiceObj(serviceIdx, serviceIdent);
        if (serviceObj)
            throw "Service already initialized";
        serviceObj = new serviceClass(serviceProps);
        if (!(serviceObj instanceof serviceClass))
            throw "ServiceLoader found object that is not an instance of the requested service";
        this.AddServiceObj(serviceIdx, serviceIdent, serviceObj);
        return serviceObj;
    }
    static GetService(serviceClass, serviceProps = null, serviceIdent = undefined) {
        if (!serviceClass)
            return null;
        if (serviceIdent === undefined)
            serviceIdent = serviceProps;
        let serviceIdx = this.GetServiceIdx(serviceClass);
        let serviceObj = this.GetServiceObj(serviceIdx, serviceIdent);
        if (!serviceObj) {
            serviceObj = new serviceClass(serviceProps);
            this.AddServiceObj(serviceIdx, serviceIdent, serviceObj);
        }
        if (!(serviceObj instanceof serviceClass))
            throw "ServiceLoader found object that is not an instance of the requested service";
        return serviceObj;
    }
}
exports.ServiceManager = ServiceManager;
//# sourceMappingURL=ServiceManager.js.map