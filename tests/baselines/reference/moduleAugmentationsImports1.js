//// [tests/cases/compiler/moduleAugmentationsImports1.ts] ////

//// [a.ts]

export class A {}

//// [b.ts]
export class B {x: number;}

//// [c.d.ts]
declare module "C" {
    class Cls {y: string; }
}

//// [d.ts]
/// <reference path="c.d.ts"/>

import {A} from "./a";
import {B} from "./b";
import {Cls} from "C";

(<any>A.prototype).getB = function () {};
(<any>A.prototype).getCls = function () {}

declare module "./a" {
    interface A {
        getB(): B;
    }
}

declare module "./a" {
    interface A {
        getCls(): Cls;
    }
}

//// [main.ts]
import {A} from "./a";
import "d";

let a: A;
let b = a.getB().x.toFixed();
let c = a.getCls().y.toLowerCase();

//// [f.js]
define("a", ["require", "exports"], function (require, exports) {
    "use strict";
    var A = (function () {
        function A() {
        }
        return A;
    }());
    exports.A = A;
});
define("b", ["require", "exports"], function (require, exports) {
    "use strict";
    var B = (function () {
        function B() {
        }
        return B;
    }());
    exports.B = B;
});
/// <reference path="c.d.ts"/>
define("d", ["require", "exports", "a"], function (require, exports, a_1) {
    "use strict";
    a_1.A.prototype.getB = function () { };
    a_1.A.prototype.getCls = function () { };
});
define("main", ["require", "exports", "d"], function (require, exports) {
    "use strict";
    var a;
    var b = a.getB().x.toFixed();
    var c = a.getCls().y.toLowerCase();
});


//// [f.d.ts]
/// <reference path="tests/cases/compiler/c.d.ts" />
declare module "a" {
    export class A {
    }
}
declare module "b" {
    export class B {
        x: number;
    }
}
declare module "d" {
    import { B } from "b";
    import { Cls } from "C";
    module "a" {
        interface A {
            getB(): B;
        }
    }
    module "a" {
        interface A {
            getCls(): Cls;
        }
    }
}
declare module "main" {
}
