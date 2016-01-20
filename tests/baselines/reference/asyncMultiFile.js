//// [tests/cases/conformance/async/es6/asyncMultiFile.ts] ////

//// [a.ts]
async function f() {}
//// [b.ts]
function g() { }

//// [a.js]
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new P(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.call(thisArg, _arguments)).next());
    });
};
function f() {
    return __awaiter(this, void 0, Promise, function* () { });
}
//// [b.js]
function g() { }
