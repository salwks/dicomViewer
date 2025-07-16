(async ()=>{
    function wi(f, y) {
        const { rows: _, columns: R, data: A } = f, { rows: r, columns: L, data: j } = y, W = [], N = [], M = [];
        for(let z = 0; z < L; z++){
            const H = z * (R - 1) / (L - 1);
            W[z] = Math.floor(H), N[z] = Math.min(W[z] + 1, R - 1), M[z] = H - W[z];
        }
        for(let z = 0; z < r; z++){
            const H = z * (_ - 1) / (r - 1), X = Math.floor(H) * R, q = Math.min(X + R, (_ - 1) * R), te = H - Math.floor(H), ce = 1 - te, $e = z * L;
            for(let Q = 0; Q < L; Q++){
                const _e = A[X + W[Q]], ge = A[X + N[Q]], we = A[q + W[Q]], Pe = A[q + N[Q]], Ue = 1 - M[Q];
                j[$e + Q] = (_e * Ue + ge * M[Q]) * ce + (we * Ue + Pe * M[Q]) * te;
            }
        }
        return j;
    }
    function Pi(f, y) {
        const { rows: _, columns: R, pixelData: A, samplesPerPixel: r = 1 } = f, { rows: L, columns: j, pixelData: W } = y, N = [];
        for(let M = 0; M < j; M++){
            const z = M * (R - 1) / (j - 1);
            N[M] = Math.floor(z) * r;
        }
        for(let M = 0; M < L; M++){
            const z = M * (_ - 1) / (L - 1), H = Math.floor(z) * R * r, X = M * j;
            for(let q = 0; q < j; q++)for(let te = 0; te < r; te++)W[X + q + te] = A[H + N[q] + te];
        }
        return W;
    }
    const pi = Symbol("Comlink.proxy"), Ti = Symbol("Comlink.endpoint"), Ci = Symbol("Comlink.releaseProxy"), qn = Symbol("Comlink.finalizer"), Mn = Symbol("Comlink.thrown"), di = (f)=>typeof f == "object" && f !== null || typeof f == "function", Ai = {
        canHandle: (f)=>di(f) && f[pi],
        serialize (f) {
            const { port1: y, port2: _ } = new MessageChannel;
            return Zn(f, y), [
                _,
                [
                    _
                ]
            ];
        },
        deserialize (f) {
            return f.start(), Si(f);
        }
    }, $i = {
        canHandle: (f)=>di(f) && Mn in f,
        serialize ({ value: f }) {
            let y;
            return f instanceof Error ? y = {
                isError: !0,
                value: {
                    message: f.message,
                    name: f.name,
                    stack: f.stack
                }
            } : y = {
                isError: !1,
                value: f
            }, [
                y,
                []
            ];
        },
        deserialize (f) {
            throw f.isError ? Object.assign(new Error(f.value.message), f.value) : f.value;
        }
    }, vi = new Map([
        [
            "proxy",
            Ai
        ],
        [
            "throw",
            $i
        ]
    ]);
    function Ri(f, y) {
        for (const _ of f)if (y === _ || _ === "*" || _ instanceof RegExp && _.test(y)) return !0;
        return !1;
    }
    function Zn(f, y = globalThis, _ = [
        "*"
    ]) {
        y.addEventListener("message", function R(A) {
            if (!A || !A.data) return;
            if (!Ri(_, A.origin)) {
                console.warn(`Invalid origin '${A.origin}' for comlink proxy`);
                return;
            }
            const { id: r, type: L, path: j } = Object.assign({
                path: []
            }, A.data), W = (A.data.argumentList || []).map(kn);
            let N;
            try {
                const M = j.slice(0, -1).reduce((H, X)=>H[X], f), z = j.reduce((H, X)=>H[X], f);
                switch(L){
                    case "GET":
                        N = z;
                        break;
                    case "SET":
                        M[j.slice(-1)[0]] = kn(A.data.value), N = !0;
                        break;
                    case "APPLY":
                        N = z.apply(M, W);
                        break;
                    case "CONSTRUCT":
                        {
                            const H = new z(...W);
                            N = Ui(H);
                        }
                        break;
                    case "ENDPOINT":
                        {
                            const { port1: H, port2: X } = new MessageChannel;
                            Zn(f, X), N = Fi(H, [
                                H
                            ]);
                        }
                        break;
                    case "RELEASE":
                        N = void 0;
                        break;
                    default:
                        return;
                }
            } catch (M) {
                N = {
                    value: M,
                    [Mn]: 0
                };
            }
            Promise.resolve(N).catch((M)=>({
                    value: M,
                    [Mn]: 0
                })).then((M)=>{
                const [z, H] = Nn(M);
                y.postMessage(Object.assign(Object.assign({}, z), {
                    id: r
                }), H), L === "RELEASE" && (y.removeEventListener("message", R), hi(y), qn in f && typeof f[qn] == "function" && f[qn]());
            }).catch((M)=>{
                const [z, H] = Nn({
                    value: new TypeError("Unserializable return value"),
                    [Mn]: 0
                });
                y.postMessage(Object.assign(Object.assign({}, z), {
                    id: r
                }), H);
            });
        }), y.start && y.start();
    }
    function Ei(f) {
        return f.constructor.name === "MessagePort";
    }
    function hi(f) {
        Ei(f) && f.close();
    }
    function Si(f, y) {
        const _ = new Map;
        return f.addEventListener("message", function(A) {
            const { data: r } = A;
            if (!r || !r.id) return;
            const L = _.get(r.id);
            if (L) try {
                L(r);
            } finally{
                _.delete(r.id);
            }
        }), Kn(f, _, [], y);
    }
    function Hn(f) {
        if (f) throw new Error("Proxy has been released and is not useable");
    }
    function gi(f) {
        return Dn(f, new Map, {
            type: "RELEASE"
        }).then(()=>{
            hi(f);
        });
    }
    const Vn = new WeakMap, Bn = "FinalizationRegistry" in globalThis && new FinalizationRegistry((f)=>{
        const y = (Vn.get(f) || 0) - 1;
        Vn.set(f, y), y === 0 && gi(f);
    });
    function ki(f, y) {
        const _ = (Vn.get(y) || 0) + 1;
        Vn.set(y, _), Bn && Bn.register(f, y, f);
    }
    function Di(f) {
        Bn && Bn.unregister(f);
    }
    function Kn(f, y, _ = [], R = function() {}) {
        let A = !1;
        const r = new Proxy(R, {
            get (L, j) {
                if (Hn(A), j === Ci) return ()=>{
                    Di(r), gi(f), y.clear(), A = !0;
                };
                if (j === "then") {
                    if (_.length === 0) return {
                        then: ()=>r
                    };
                    const W = Dn(f, y, {
                        type: "GET",
                        path: _.map((N)=>N.toString())
                    }).then(kn);
                    return W.then.bind(W);
                }
                return Kn(f, y, [
                    ..._,
                    j
                ]);
            },
            set (L, j, W) {
                Hn(A);
                const [N, M] = Nn(W);
                return Dn(f, y, {
                    type: "SET",
                    path: [
                        ..._,
                        j
                    ].map((z)=>z.toString()),
                    value: N
                }, M).then(kn);
            },
            apply (L, j, W) {
                Hn(A);
                const N = _[_.length - 1];
                if (N === Ti) return Dn(f, y, {
                    type: "ENDPOINT"
                }).then(kn);
                if (N === "bind") return Kn(f, y, _.slice(0, -1));
                const [M, z] = ri(W);
                return Dn(f, y, {
                    type: "APPLY",
                    path: _.map((H)=>H.toString()),
                    argumentList: M
                }, z).then(kn);
            },
            construct (L, j) {
                Hn(A);
                const [W, N] = ri(j);
                return Dn(f, y, {
                    type: "CONSTRUCT",
                    path: _.map((M)=>M.toString()),
                    argumentList: W
                }, N).then(kn);
            }
        });
        return ki(r, f), r;
    }
    function Oi(f) {
        return Array.prototype.concat.apply([], f);
    }
    function ri(f) {
        const y = f.map(Nn);
        return [
            y.map((_)=>_[0]),
            Oi(y.map((_)=>_[1]))
        ];
    }
    const yi = new WeakMap;
    function Fi(f, y) {
        return yi.set(f, y), f;
    }
    function Ui(f) {
        return Object.assign(f, {
            [pi]: !0
        });
    }
    function Nn(f) {
        for (const [y, _] of vi)if (_.canHandle(f)) {
            const [R, A] = _.serialize(f);
            return [
                {
                    type: "HANDLER",
                    name: y,
                    value: R
                },
                A
            ];
        }
        return [
            {
                type: "RAW",
                value: f
            },
            yi.get(f) || []
        ];
    }
    function kn(f) {
        switch(f.type){
            case "HANDLER":
                return vi.get(f.name).deserialize(f.value);
            case "RAW":
                return f.value;
        }
    }
    function Dn(f, y, _, R) {
        return new Promise((A)=>{
            const r = ji();
            y.set(r, A), f.start && f.start(), f.postMessage(Object.assign({
                id: r
            }, _), R);
        });
    }
    function ji() {
        return new Array(4).fill(0).map(()=>Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
    }
    async function ni(f, y) {
        let _ = y.buffer, R = y.byteOffset;
        const A = y.length;
        if (f.bitsAllocated === 16) R % 2 && (_ = _.slice(R), R = 0), f.pixelRepresentation === 0 ? f.pixelData = new Uint16Array(_, R, A / 2) : f.pixelData = new Int16Array(_, R, A / 2);
        else if (f.bitsAllocated === 8 || f.bitsAllocated === 1) f.pixelData = y;
        else if (f.bitsAllocated === 32) {
            if (R % 2 && (_ = _.slice(R), R = 0), f.floatPixelData || f.doubleFloatPixelData) throw new Error("Float pixel data is not supported for parsing into ImageFrame");
            f.pixelRepresentation === 0 ? f.pixelData = new Uint32Array(_, R, A / 4) : f.pixelRepresentation === 1 ? f.pixelData = new Int32Array(_, R, A / 4) : f.pixelData = new Float32Array(_, R, A / 4);
        }
        return f;
    }
    function Ii(f) {
        return (f & 255) << 8 | f >> 8 & 255;
    }
    async function xi(f, y) {
        if (f.bitsAllocated === 16) {
            let _ = y.buffer, R = y.byteOffset;
            const A = y.length;
            R % 2 && (_ = _.slice(R), R = 0), f.pixelRepresentation === 0 ? f.pixelData = new Uint16Array(_, R, A / 2) : f.pixelData = new Int16Array(_, R, A / 2);
            for(let r = 0; r < f.pixelData.length; r++)f.pixelData[r] = Ii(f.pixelData[r]);
        } else f.bitsAllocated === 8 && (f.pixelData = y);
        return f;
    }
    async function Wi(f, y) {
        if (f.bitsAllocated === 8) return f.planarConfiguration ? Mi(f, y) : Hi(f, y);
        if (f.bitsAllocated === 16) return Li(f, y);
        throw new Error("unsupported pixel format for RLE");
    }
    function Hi(f, y) {
        const _ = y, R = f.rows * f.columns, A = new ArrayBuffer(R * f.samplesPerPixel), r = new DataView(_.buffer, _.byteOffset), L = new Int8Array(_.buffer, _.byteOffset), j = new Int8Array(A);
        let W = 0;
        const N = r.getInt32(0, !0);
        for(let M = 0; M < N; ++M){
            W = M;
            let z = r.getInt32((M + 1) * 4, !0), H = r.getInt32((M + 2) * 4, !0);
            H === 0 && (H = _.length);
            const X = R * N;
            for(; z < H;){
                const q = L[z++];
                if (q >= 0 && q <= 127) for(let te = 0; te < q + 1 && W < X; ++te)j[W] = L[z++], W += f.samplesPerPixel;
                else if (q <= -1 && q >= -127) {
                    const te = L[z++];
                    for(let ce = 0; ce < -q + 1 && W < X; ++ce)j[W] = te, W += f.samplesPerPixel;
                }
            }
        }
        return f.pixelData = new Uint8Array(A), f;
    }
    function Mi(f, y) {
        const _ = y, R = f.rows * f.columns, A = new ArrayBuffer(R * f.samplesPerPixel), r = new DataView(_.buffer, _.byteOffset), L = new Int8Array(_.buffer, _.byteOffset), j = new Int8Array(A);
        let W = 0;
        const N = r.getInt32(0, !0);
        for(let M = 0; M < N; ++M){
            W = M * R;
            let z = r.getInt32((M + 1) * 4, !0), H = r.getInt32((M + 2) * 4, !0);
            H === 0 && (H = _.length);
            const X = R * N;
            for(; z < H;){
                const q = L[z++];
                if (q >= 0 && q <= 127) for(let te = 0; te < q + 1 && W < X; ++te)j[W] = L[z++], W++;
                else if (q <= -1 && q >= -127) {
                    const te = L[z++];
                    for(let ce = 0; ce < -q + 1 && W < X; ++ce)j[W] = te, W++;
                }
            }
        }
        return f.pixelData = new Uint8Array(A), f;
    }
    function Li(f, y) {
        const _ = y, R = f.rows * f.columns, A = new ArrayBuffer(R * f.samplesPerPixel * 2), r = new DataView(_.buffer, _.byteOffset), L = new Int8Array(_.buffer, _.byteOffset), j = new Int8Array(A), W = r.getInt32(0, !0);
        for(let N = 0; N < W; ++N){
            let M = 0;
            const z = N === 0 ? 1 : 0;
            let H = r.getInt32((N + 1) * 4, !0), X = r.getInt32((N + 2) * 4, !0);
            for(X === 0 && (X = _.length); H < X;){
                const q = L[H++];
                if (q >= 0 && q <= 127) for(let te = 0; te < q + 1 && M < R; ++te)j[M * 2 + z] = L[H++], M++;
                else if (q <= -1 && q >= -127) {
                    const te = L[H++];
                    for(let ce = 0; ce < -q + 1 && M < R; ++ce)j[M * 2 + z] = te, M++;
                }
            }
        }
        return f.pixelRepresentation === 0 ? f.pixelData = new Uint16Array(A) : f.pixelData = new Int16Array(A), f;
    }
    function zn(f) {
        return f && f.__esModule && Object.prototype.hasOwnProperty.call(f, "default") ? f.default : f;
    }
    function Vi(f) {
        if (Object.prototype.hasOwnProperty.call(f, "__esModule")) return f;
        var y = f.default;
        if (typeof y == "function") {
            var _ = function R() {
                var A = !1;
                try {
                    A = this instanceof R;
                } catch  {}
                return A ? Reflect.construct(y, arguments, this.constructor) : y.apply(this, arguments);
            };
            _.prototype = y.prototype;
        } else _ = {};
        return Object.defineProperty(_, "__esModule", {
            value: !0
        }), Object.keys(f).forEach(function(R) {
            var A = Object.getOwnPropertyDescriptor(f, R);
            Object.defineProperty(_, R, A.get ? A : {
                enumerable: !0,
                get: function() {
                    return f[R];
                }
            });
        }), _;
    }
    var Gn = {
        exports: {}
    }, Bi = {}, Ni = Object.freeze({
        __proto__: null,
        default: Bi
    }), rn = Vi(Ni), ii;
    function zi() {
        return ii || (ii = 1, function(f, y) {
            var _ = (()=>{
                var R = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
                return typeof __filename < "u" && (R = R || __filename), function(A) {
                    A = A || {};
                    var r = typeof A < "u" ? A : {}, L, j;
                    r.ready = new Promise(function(e, t) {
                        L = e, j = t;
                    });
                    var W = Object.assign({}, r), N = "./this.program", M = (e, t)=>{
                        throw t;
                    }, z = typeof window == "object", H = typeof importScripts == "function", X = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string", q = "";
                    function te(e) {
                        return r.locateFile ? r.locateFile(e, q) : q + e;
                    }
                    var ce, $e, Q;
                    if (X) {
                        var _e = rn, ge = rn;
                        H ? q = ge.dirname(q) + "/" : q = __dirname + "/", ce = (e, t)=>(e = Ce(e) ? new URL(e) : ge.normalize(e), _e.readFileSync(e, t ? void 0 : "utf8")), Q = (e)=>{
                            var t = ce(e, !0);
                            return t.buffer || (t = new Uint8Array(t)), t;
                        }, $e = (e, t, o)=>{
                            e = Ce(e) ? new URL(e) : ge.normalize(e), _e.readFile(e, function(l, d) {
                                l ? o(l) : t(d.buffer);
                            });
                        }, process.argv.length > 1 && (N = process.argv[1].replace(/\\/g, "/")), process.argv.slice(2), process.on("uncaughtException", function(e) {
                            if (!(e instanceof ar)) throw e;
                        }), process.on("unhandledRejection", function(e) {
                            throw e;
                        }), M = (e, t)=>{
                            throw process.exitCode = e, t;
                        }, r.inspect = function() {
                            return "[Emscripten Module object]";
                        };
                    } else (z || H) && (H ? q = self.location.href : typeof document < "u" && document.currentScript && (q = document.currentScript.src), R && (q = R), q.indexOf("blob:") !== 0 ? q = q.substr(0, q.replace(/[?#].*/, "").lastIndexOf("/") + 1) : q = "", ce = (e)=>{
                        var t = new XMLHttpRequest;
                        return t.open("GET", e, !1), t.send(null), t.responseText;
                    }, H && (Q = (e)=>{
                        var t = new XMLHttpRequest;
                        return t.open("GET", e, !1), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
                    }), $e = (e, t, o)=>{
                        var l = new XMLHttpRequest;
                        l.open("GET", e, !0), l.responseType = "arraybuffer", l.onload = ()=>{
                            if (l.status == 200 || l.status == 0 && l.response) {
                                t(l.response);
                                return;
                            }
                            o();
                        }, l.onerror = o, l.send(null);
                    });
                    var we = r.print || console.log.bind(console), Pe = r.printErr || console.warn.bind(console);
                    Object.assign(r, W), W = null, r.arguments && r.arguments, r.thisProgram && (N = r.thisProgram), r.quit && (M = r.quit);
                    var Ue;
                    r.wasmBinary && (Ue = r.wasmBinary), r.noExitRuntime, typeof WebAssembly != "object" && at("no native wasm support detected");
                    var it, Vt = !1;
                    function Ft(e, t) {
                        e || at(t);
                    }
                    var Tt = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
                    function nr(e, t, o) {
                        for(var l = t + o, d = t; e[d] && !(d >= l);)++d;
                        if (d - t > 16 && e.buffer && Tt) return Tt.decode(e.subarray(t, d));
                        for(var h = ""; t < d;){
                            var g = e[t++];
                            if (!(g & 128)) {
                                h += String.fromCharCode(g);
                                continue;
                            }
                            var m = e[t++] & 63;
                            if ((g & 224) == 192) {
                                h += String.fromCharCode((g & 31) << 6 | m);
                                continue;
                            }
                            var P = e[t++] & 63;
                            if ((g & 240) == 224 ? g = (g & 15) << 12 | m << 6 | P : g = (g & 7) << 18 | m << 12 | P << 6 | e[t++] & 63, g < 65536) h += String.fromCharCode(g);
                            else {
                                var S = g - 65536;
                                h += String.fromCharCode(55296 | S >> 10, 56320 | S & 1023);
                            }
                        }
                        return h;
                    }
                    function vr(e, t) {
                        return e ? nr(ue, e, t) : "";
                    }
                    function ir(e, t, o, l) {
                        if (!(l > 0)) return 0;
                        for(var d = o, h = o + l - 1, g = 0; g < e.length; ++g){
                            var m = e.charCodeAt(g);
                            if (m >= 55296 && m <= 57343) {
                                var P = e.charCodeAt(++g);
                                m = 65536 + ((m & 1023) << 10) | P & 1023;
                            }
                            if (m <= 127) {
                                if (o >= h) break;
                                t[o++] = m;
                            } else if (m <= 2047) {
                                if (o + 1 >= h) break;
                                t[o++] = 192 | m >> 6, t[o++] = 128 | m & 63;
                            } else if (m <= 65535) {
                                if (o + 2 >= h) break;
                                t[o++] = 224 | m >> 12, t[o++] = 128 | m >> 6 & 63, t[o++] = 128 | m & 63;
                            } else {
                                if (o + 3 >= h) break;
                                t[o++] = 240 | m >> 18, t[o++] = 128 | m >> 12 & 63, t[o++] = 128 | m >> 6 & 63, t[o++] = 128 | m & 63;
                            }
                        }
                        return t[o] = 0, o - d;
                    }
                    function Ge(e, t, o) {
                        return ir(e, ue, t, o);
                    }
                    function ye(e) {
                        for(var t = 0, o = 0; o < e.length; ++o){
                            var l = e.charCodeAt(o);
                            l <= 127 ? t++ : l <= 2047 ? t += 2 : l >= 55296 && l <= 57343 ? (t += 4, ++o) : t += 3;
                        }
                        return t;
                    }
                    var le, fe, ue, ie, ae, oe, ve, Bt, Nt;
                    function zt(e) {
                        le = e, r.HEAP8 = fe = new Int8Array(e), r.HEAP16 = ie = new Int16Array(e), r.HEAP32 = oe = new Int32Array(e), r.HEAPU8 = ue = new Uint8Array(e), r.HEAPU16 = ae = new Uint16Array(e), r.HEAPU32 = ve = new Uint32Array(e), r.HEAPF32 = Bt = new Float32Array(e), r.HEAPF64 = Nt = new Float64Array(e);
                    }
                    r.INITIAL_MEMORY;
                    var qt, or = [], hr = [], Dr = [];
                    function nn() {
                        if (r.preRun) for(typeof r.preRun == "function" && (r.preRun = [
                            r.preRun
                        ]); r.preRun.length;)Ct(r.preRun.shift());
                        At(or);
                    }
                    function on() {
                        At(hr);
                    }
                    function an() {
                        if (r.postRun) for(typeof r.postRun == "function" && (r.postRun = [
                            r.postRun
                        ]); r.postRun.length;)Xe(r.postRun.shift());
                        At(Dr);
                    }
                    function Ct(e) {
                        or.unshift(e);
                    }
                    function Je(e) {
                        hr.unshift(e);
                    }
                    function Xe(e) {
                        Dr.unshift(e);
                    }
                    var Ye = 0, ot = null;
                    function Ut(e) {
                        Ye++, r.monitorRunDependencies && r.monitorRunDependencies(Ye);
                    }
                    function jt(e) {
                        if (Ye--, r.monitorRunDependencies && r.monitorRunDependencies(Ye), Ye == 0 && ot) {
                            var t = ot;
                            ot = null, t();
                        }
                    }
                    function at(e) {
                        r.onAbort && r.onAbort(e), e = "Aborted(" + e + ")", Pe(e), Vt = !0, e += ". Build with -sASSERTIONS for more info.";
                        var t = new WebAssembly.RuntimeError(e);
                        throw j(t), t;
                    }
                    var Te = "data:application/octet-stream;base64,";
                    function be(e) {
                        return e.startsWith(Te);
                    }
                    function Ce(e) {
                        return e.startsWith("file://");
                    }
                    var Se;
                    Se = "libjpegturbowasm_decode.wasm", be(Se) || (Se = te(Se));
                    function Or(e) {
                        try {
                            if (e == Se && Ue) return new Uint8Array(Ue);
                            if (Q) return Q(e);
                            throw "both async and sync fetching of the wasm failed";
                        } catch (t) {
                            at(t);
                        }
                    }
                    function gr() {
                        if (!Ue && (z || H)) {
                            if (typeof fetch == "function" && !Ce(Se)) return fetch(Se, {
                                credentials: "same-origin"
                            }).then(function(e) {
                                if (!e.ok) throw "failed to load wasm binary file at '" + Se + "'";
                                return e.arrayBuffer();
                            }).catch(function() {
                                return Or(Se);
                            });
                            if ($e) return new Promise(function(e, t) {
                                $e(Se, function(o) {
                                    e(new Uint8Array(o));
                                }, t);
                            });
                        }
                        return Promise.resolve().then(function() {
                            return Or(Se);
                        });
                    }
                    function yr() {
                        var e = {
                            a: $
                        };
                        function t(g, m) {
                            var P = g.exports;
                            r.asm = P, it = r.asm.K, zt(it.buffer), qt = r.asm.M, Je(r.asm.L), jt();
                        }
                        Ut();
                        function o(g) {
                            t(g.instance);
                        }
                        function l(g) {
                            return gr().then(function(m) {
                                return WebAssembly.instantiate(m, e);
                            }).then(function(m) {
                                return m;
                            }).then(g, function(m) {
                                Pe("failed to asynchronously prepare wasm: " + m), at(m);
                            });
                        }
                        function d() {
                            return !Ue && typeof WebAssembly.instantiateStreaming == "function" && !be(Se) && !Ce(Se) && !X && typeof fetch == "function" ? fetch(Se, {
                                credentials: "same-origin"
                            }).then(function(g) {
                                var m = WebAssembly.instantiateStreaming(g, e);
                                return m.then(o, function(P) {
                                    return Pe("wasm streaming compile failed: " + P), Pe("falling back to ArrayBuffer instantiation"), l(o);
                                });
                            }) : l(o);
                        }
                        if (r.instantiateWasm) try {
                            var h = r.instantiateWasm(e, t);
                            return h;
                        } catch (g) {
                            Pe("Module.instantiateWasm callback failed with error: " + g), j(g);
                        }
                        return d().catch(j), {};
                    }
                    function ar(e) {
                        this.name = "ExitStatus", this.message = "Program terminated with exit(" + e + ")", this.status = e;
                    }
                    function At(e) {
                        for(; e.length > 0;)e.shift()(r);
                    }
                    function Fr(e) {
                        this.excPtr = e, this.ptr = e - 24, this.set_type = function(t) {
                            ve[this.ptr + 4 >> 2] = t;
                        }, this.get_type = function() {
                            return ve[this.ptr + 4 >> 2];
                        }, this.set_destructor = function(t) {
                            ve[this.ptr + 8 >> 2] = t;
                        }, this.get_destructor = function() {
                            return ve[this.ptr + 8 >> 2];
                        }, this.set_refcount = function(t) {
                            oe[this.ptr >> 2] = t;
                        }, this.set_caught = function(t) {
                            t = t ? 1 : 0, fe[this.ptr + 12 >> 0] = t;
                        }, this.get_caught = function() {
                            return fe[this.ptr + 12 >> 0] != 0;
                        }, this.set_rethrown = function(t) {
                            t = t ? 1 : 0, fe[this.ptr + 13 >> 0] = t;
                        }, this.get_rethrown = function() {
                            return fe[this.ptr + 13 >> 0] != 0;
                        }, this.init = function(t, o) {
                            this.set_adjusted_ptr(0), this.set_type(t), this.set_destructor(o), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
                        }, this.add_ref = function() {
                            var t = oe[this.ptr >> 2];
                            oe[this.ptr >> 2] = t + 1;
                        }, this.release_ref = function() {
                            var t = oe[this.ptr >> 2];
                            return oe[this.ptr >> 2] = t - 1, t === 1;
                        }, this.set_adjusted_ptr = function(t) {
                            ve[this.ptr + 16 >> 2] = t;
                        }, this.get_adjusted_ptr = function() {
                            return ve[this.ptr + 16 >> 2];
                        }, this.get_exception_ptr = function() {
                            var t = p(this.get_type());
                            if (t) return ve[this.excPtr >> 2];
                            var o = this.get_adjusted_ptr();
                            return o !== 0 ? o : this.excPtr;
                        };
                    }
                    function _t(e, t, o) {
                        var l = new Fr(e);
                        throw l.init(t, o), e;
                    }
                    var ke = {};
                    function De(e) {
                        for(; e.length;){
                            var t = e.pop(), o = e.pop();
                            o(t);
                        }
                    }
                    function he(e) {
                        return this.fromWireType(oe[e >> 2]);
                    }
                    var Ne = {}, tt = {}, st = {}, _r = 48, Gt = 57;
                    function It(e) {
                        if (e === void 0) return "_unknown";
                        e = e.replace(/[^a-zA-Z0-9_]/g, "$");
                        var t = e.charCodeAt(0);
                        return t >= _r && t <= Gt ? "_" + e : e;
                    }
                    function mt(e, t) {
                        return e = It(e), new Function("body", "return function " + e + `() {
    "use strict";    return body.apply(this, arguments);
};
`)(t);
                    }
                    function He(e, t) {
                        var o = mt(t, function(l) {
                            this.name = t, this.message = l;
                            var d = new Error(l).stack;
                            d !== void 0 && (this.stack = this.toString() + `
` + d.replace(/^Error(:[^\n]*)?\n/, ""));
                        });
                        return o.prototype = Object.create(e.prototype), o.prototype.constructor = o, o.prototype.toString = function() {
                            return this.message === void 0 ? this.name : this.name + ": " + this.message;
                        }, o;
                    }
                    var xt = void 0;
                    function Me(e) {
                        throw new xt(e);
                    }
                    function Le(e, t, o) {
                        e.forEach(function(m) {
                            st[m] = t;
                        });
                        function l(m) {
                            var P = o(m);
                            P.length !== e.length && Me("Mismatched type converter count");
                            for(var S = 0; S < e.length; ++S)ze(e[S], P[S]);
                        }
                        var d = new Array(t.length), h = [], g = 0;
                        t.forEach((m, P)=>{
                            tt.hasOwnProperty(m) ? d[P] = tt[m] : (h.push(m), Ne.hasOwnProperty(m) || (Ne[m] = []), Ne[m].push(()=>{
                                d[P] = tt[m], ++g, g === h.length && l(d);
                            }));
                        }), h.length === 0 && l(d);
                    }
                    function $t(e) {
                        var t = ke[e];
                        delete ke[e];
                        var o = t.rawConstructor, l = t.rawDestructor, d = t.fields, h = d.map((g)=>g.getterReturnType).concat(d.map((g)=>g.setterArgumentType));
                        Le([
                            e
                        ], h, (g)=>{
                            var m = {};
                            return d.forEach((P, S)=>{
                                var I = P.fieldName, B = g[S], V = P.getter, re = P.getterContext, ee = g[S + d.length], de = P.setter, Fe = P.setterContext;
                                m[I] = {
                                    read: (We)=>B.fromWireType(V(re, We)),
                                    write: (We, Sn)=>{
                                        var Lt = [];
                                        de(Fe, We, ee.toWireType(Lt, Sn)), De(Lt);
                                    }
                                };
                            }), [
                                {
                                    name: t.name,
                                    fromWireType: function(P) {
                                        var S = {};
                                        for(var I in m)S[I] = m[I].read(P);
                                        return l(P), S;
                                    },
                                    toWireType: function(P, S) {
                                        for(var I in m)if (!(I in S)) throw new TypeError('Missing field:  "' + I + '"');
                                        var B = o();
                                        for(I in m)m[I].write(B, S[I]);
                                        return P !== null && P.push(l, B), B;
                                    },
                                    argPackAdvance: 8,
                                    readValueFromPointer: he,
                                    destructorFunction: l
                                }
                            ];
                        });
                    }
                    function Rt(e, t, o, l, d) {}
                    function Ae(e) {
                        switch(e){
                            case 1:
                                return 0;
                            case 2:
                                return 1;
                            case 4:
                                return 2;
                            case 8:
                                return 3;
                            default:
                                throw new TypeError("Unknown type size: " + e);
                        }
                    }
                    function Et() {
                        for(var e = new Array(256), t = 0; t < 256; ++t)e[t] = String.fromCharCode(t);
                        Y = e;
                    }
                    var Y = void 0;
                    function pe(e) {
                        for(var t = "", o = e; ue[o];)t += Y[ue[o++]];
                        return t;
                    }
                    var ne = void 0;
                    function Z(e) {
                        throw new ne(e);
                    }
                    function ze(e, t, o = {}) {
                        if (!("argPackAdvance" in t)) throw new TypeError("registerType registeredInstance requires argPackAdvance");
                        var l = t.name;
                        if (e || Z('type "' + l + '" must have a positive integer typeid pointer'), tt.hasOwnProperty(e)) {
                            if (o.ignoreDuplicateRegistrations) return;
                            Z("Cannot register type '" + l + "' twice");
                        }
                        if (tt[e] = t, delete st[e], Ne.hasOwnProperty(e)) {
                            var d = Ne[e];
                            delete Ne[e], d.forEach((h)=>h());
                        }
                    }
                    function ut(e, t, o, l, d) {
                        var h = Ae(o);
                        t = pe(t), ze(e, {
                            name: t,
                            fromWireType: function(g) {
                                return !!g;
                            },
                            toWireType: function(g, m) {
                                return m ? l : d;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: function(g) {
                                var m;
                                if (o === 1) m = fe;
                                else if (o === 2) m = ie;
                                else if (o === 4) m = oe;
                                else throw new TypeError("Unknown boolean type size: " + t);
                                return this.fromWireType(m[g >> h]);
                            },
                            destructorFunction: null
                        });
                    }
                    function mr(e) {
                        if (!(this instanceof vt) || !(e instanceof vt)) return !1;
                        for(var t = this.$$.ptrType.registeredClass, o = this.$$.ptr, l = e.$$.ptrType.registeredClass, d = e.$$.ptr; t.baseClass;)o = t.upcast(o), t = t.baseClass;
                        for(; l.baseClass;)d = l.upcast(d), l = l.baseClass;
                        return t === l && o === d;
                    }
                    function sr(e) {
                        return {
                            count: e.count,
                            deleteScheduled: e.deleteScheduled,
                            preservePointerOnDelete: e.preservePointerOnDelete,
                            ptr: e.ptr,
                            ptrType: e.ptrType,
                            smartPtr: e.smartPtr,
                            smartPtrType: e.smartPtrType
                        };
                    }
                    function St(e) {
                        function t(o) {
                            return o.$$.ptrType.registeredClass.name;
                        }
                        Z(t(e) + " instance already deleted");
                    }
                    var Jt = !1;
                    function ur(e) {}
                    function Re(e) {
                        e.smartPtr ? e.smartPtrType.rawDestructor(e.smartPtr) : e.ptrType.registeredClass.rawDestructor(e.ptr);
                    }
                    function bt(e) {
                        e.count.value -= 1;
                        var t = e.count.value === 0;
                        t && Re(e);
                    }
                    function se(e, t, o) {
                        if (t === o) return e;
                        if (o.baseClass === void 0) return null;
                        var l = se(e, t, o.baseClass);
                        return l === null ? null : o.downcast(l);
                    }
                    var je = {};
                    function br() {
                        return Object.keys(lt).length;
                    }
                    function ct() {
                        var e = [];
                        for(var t in lt)lt.hasOwnProperty(t) && e.push(lt[t]);
                        return e;
                    }
                    var kt = [];
                    function ft() {
                        for(; kt.length;){
                            var e = kt.pop();
                            e.$$.deleteScheduled = !1, e.delete();
                        }
                    }
                    var Ke = void 0;
                    function Ur(e) {
                        Ke = e, kt.length && Ke && Ke(ft);
                    }
                    function Xt() {
                        r.getInheritedInstanceCount = br, r.getLiveInheritedInstances = ct, r.flushPendingDeletes = ft, r.setDelayFunction = Ur;
                    }
                    var lt = {};
                    function jr(e, t) {
                        for(t === void 0 && Z("ptr should not be undefined"); e.baseClass;)t = e.upcast(t), e = e.baseClass;
                        return t;
                    }
                    function pt(e, t) {
                        return t = jr(e, t), lt[t];
                    }
                    function cr(e, t) {
                        (!t.ptrType || !t.ptr) && Me("makeClassHandle requires ptr and ptrType");
                        var o = !!t.smartPtrType, l = !!t.smartPtr;
                        return o !== l && Me("Both smartPtrType and smartPtr must be specified"), t.count = {
                            value: 1
                        }, dt(Object.create(e, {
                            $$: {
                                value: t
                            }
                        }));
                    }
                    function Yt(e) {
                        var t = this.getPointee(e);
                        if (!t) return this.destructor(e), null;
                        var o = pt(this.registeredClass, t);
                        if (o !== void 0) {
                            if (o.$$.count.value === 0) return o.$$.ptr = t, o.$$.smartPtr = e, o.clone();
                            var l = o.clone();
                            return this.destructor(e), l;
                        }
                        function d() {
                            return this.isSmartPointer ? cr(this.registeredClass.instancePrototype, {
                                ptrType: this.pointeeType,
                                ptr: t,
                                smartPtrType: this,
                                smartPtr: e
                            }) : cr(this.registeredClass.instancePrototype, {
                                ptrType: this,
                                ptr: e
                            });
                        }
                        var h = this.registeredClass.getActualType(t), g = je[h];
                        if (!g) return d.call(this);
                        var m;
                        this.isConst ? m = g.constPointerType : m = g.pointerType;
                        var P = se(t, this.registeredClass, m.registeredClass);
                        return P === null ? d.call(this) : this.isSmartPointer ? cr(m.registeredClass.instancePrototype, {
                            ptrType: m,
                            ptr: P,
                            smartPtrType: this,
                            smartPtr: e
                        }) : cr(m.registeredClass.instancePrototype, {
                            ptrType: m,
                            ptr: P
                        });
                    }
                    function dt(e) {
                        return typeof FinalizationRegistry > "u" ? (dt = (t)=>t, e) : (Jt = new FinalizationRegistry((t)=>{
                            bt(t.$$);
                        }), dt = (t)=>{
                            var o = t.$$, l = !!o.smartPtr;
                            if (l) {
                                var d = {
                                    $$: o
                                };
                                Jt.register(t, d, t);
                            }
                            return t;
                        }, ur = (t)=>Jt.unregister(t), dt(e));
                    }
                    function wr() {
                        if (this.$$.ptr || St(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
                        var e = dt(Object.create(Object.getPrototypeOf(this), {
                            $$: {
                                value: sr(this.$$)
                            }
                        }));
                        return e.$$.count.value += 1, e.$$.deleteScheduled = !1, e;
                    }
                    function Kt() {
                        this.$$.ptr || St(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && Z("Object already scheduled for deletion"), ur(this), bt(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
                    }
                    function wt() {
                        return !this.$$.ptr;
                    }
                    function Ir() {
                        return this.$$.ptr || St(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && Z("Object already scheduled for deletion"), kt.push(this), kt.length === 1 && Ke && Ke(ft), this.$$.deleteScheduled = !0, this;
                    }
                    function Ve() {
                        vt.prototype.isAliasOf = mr, vt.prototype.clone = wr, vt.prototype.delete = Kt, vt.prototype.isDeleted = wt, vt.prototype.deleteLater = Ir;
                    }
                    function vt() {}
                    function fr(e, t, o) {
                        if (e[t].overloadTable === void 0) {
                            var l = e[t];
                            e[t] = function() {
                                return e[t].overloadTable.hasOwnProperty(arguments.length) || Z("Function '" + o + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + e[t].overloadTable + ")!"), e[t].overloadTable[arguments.length].apply(this, arguments);
                            }, e[t].overloadTable = [], e[t].overloadTable[l.argCount] = l;
                        }
                    }
                    function lr(e, t, o) {
                        r.hasOwnProperty(e) ? (Z("Cannot register public name '" + e + "' twice"), fr(r, e, e), r.hasOwnProperty(o) && Z("Cannot register multiple overloads of a function with the same number of arguments (" + o + ")!"), r[e].overloadTable[o] = t) : r[e] = t;
                    }
                    function Pr(e, t, o, l, d, h, g, m) {
                        this.name = e, this.constructor = t, this.instancePrototype = o, this.rawDestructor = l, this.baseClass = d, this.getActualType = h, this.upcast = g, this.downcast = m, this.pureVirtualFunctions = [];
                    }
                    function Dt(e, t, o) {
                        for(; t !== o;)t.upcast || Z("Expected null or instance of " + o.name + ", got an instance of " + t.name), e = t.upcast(e), t = t.baseClass;
                        return e;
                    }
                    function sn(e, t) {
                        if (t === null) return this.isReference && Z("null is not a valid " + this.name), 0;
                        t.$$ || Z('Cannot pass "' + tr(t) + '" as a ' + this.name), t.$$.ptr || Z("Cannot pass deleted object as a pointer of type " + this.name);
                        var o = t.$$.ptrType.registeredClass, l = Dt(t.$$.ptr, o, this.registeredClass);
                        return l;
                    }
                    function un(e, t) {
                        var o;
                        if (t === null) return this.isReference && Z("null is not a valid " + this.name), this.isSmartPointer ? (o = this.rawConstructor(), e !== null && e.push(this.rawDestructor, o), o) : 0;
                        t.$$ || Z('Cannot pass "' + tr(t) + '" as a ' + this.name), t.$$.ptr || Z("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && t.$$.ptrType.isConst && Z("Cannot convert argument of type " + (t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name) + " to parameter type " + this.name);
                        var l = t.$$.ptrType.registeredClass;
                        if (o = Dt(t.$$.ptr, l, this.registeredClass), this.isSmartPointer) switch(t.$$.smartPtr === void 0 && Z("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy){
                            case 0:
                                t.$$.smartPtrType === this ? o = t.$$.smartPtr : Z("Cannot convert argument of type " + (t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name) + " to parameter type " + this.name);
                                break;
                            case 1:
                                o = t.$$.smartPtr;
                                break;
                            case 2:
                                if (t.$$.smartPtrType === this) o = t.$$.smartPtr;
                                else {
                                    var d = t.clone();
                                    o = this.rawShare(o, Pt.toHandle(function() {
                                        d.delete();
                                    })), e !== null && e.push(this.rawDestructor, o);
                                }
                                break;
                            default:
                                Z("Unsupporting sharing policy");
                        }
                        return o;
                    }
                    function cn(e, t) {
                        if (t === null) return this.isReference && Z("null is not a valid " + this.name), 0;
                        t.$$ || Z('Cannot pass "' + tr(t) + '" as a ' + this.name), t.$$.ptr || Z("Cannot pass deleted object as a pointer of type " + this.name), t.$$.ptrType.isConst && Z("Cannot convert argument of type " + t.$$.ptrType.name + " to parameter type " + this.name);
                        var o = t.$$.ptrType.registeredClass, l = Dt(t.$$.ptr, o, this.registeredClass);
                        return l;
                    }
                    function fn(e) {
                        return this.rawGetPointee && (e = this.rawGetPointee(e)), e;
                    }
                    function ht(e) {
                        this.rawDestructor && this.rawDestructor(e);
                    }
                    function gt(e) {
                        e !== null && e.delete();
                    }
                    function rt() {
                        Be.prototype.getPointee = fn, Be.prototype.destructor = ht, Be.prototype.argPackAdvance = 8, Be.prototype.readValueFromPointer = he, Be.prototype.deleteObject = gt, Be.prototype.fromWireType = Yt;
                    }
                    function Be(e, t, o, l, d, h, g, m, P, S, I) {
                        this.name = e, this.registeredClass = t, this.isReference = o, this.isConst = l, this.isSmartPointer = d, this.pointeeType = h, this.sharingPolicy = g, this.rawGetPointee = m, this.rawConstructor = P, this.rawShare = S, this.rawDestructor = I, !d && t.baseClass === void 0 ? l ? (this.toWireType = sn, this.destructorFunction = null) : (this.toWireType = cn, this.destructorFunction = null) : this.toWireType = un;
                    }
                    function xr(e, t, o) {
                        r.hasOwnProperty(e) || Me("Replacing nonexistant public symbol"), r[e].overloadTable !== void 0 && o !== void 0 || (r[e] = t, r[e].argCount = o);
                    }
                    function Wt(e, t, o) {
                        var l = r["dynCall_" + e];
                        return o && o.length ? l.apply(null, [
                            t
                        ].concat(o)) : l.call(null, t);
                    }
                    var Qt = [];
                    function Ee(e) {
                        var t = Qt[e];
                        return t || (e >= Qt.length && (Qt.length = e + 1), Qt[e] = t = qt.get(e)), t;
                    }
                    function Wr(e, t, o) {
                        if (e.includes("j")) return Wt(e, t, o);
                        var l = Ee(t).apply(null, o);
                        return l;
                    }
                    function Qe(e, t) {
                        var o = [];
                        return function() {
                            return o.length = 0, Object.assign(o, arguments), Wr(e, t, o);
                        };
                    }
                    function Ie(e, t) {
                        e = pe(e);
                        function o() {
                            return e.includes("j") ? Qe(e, t) : Ee(t);
                        }
                        var l = o();
                        return typeof l != "function" && Z("unknown function pointer with signature " + e + ": " + t), l;
                    }
                    var Tr = void 0;
                    function Ht(e) {
                        var t = G(e), o = pe(t);
                        return x(t), o;
                    }
                    function Ze(e, t) {
                        var o = [], l = {};
                        function d(h) {
                            if (!l[h] && !tt[h]) {
                                if (st[h]) {
                                    st[h].forEach(d);
                                    return;
                                }
                                o.push(h), l[h] = !0;
                            }
                        }
                        throw t.forEach(d), new Tr(e + ": " + o.map(Ht).join([
                            ", "
                        ]));
                    }
                    function Zt(e, t, o, l, d, h, g, m, P, S, I, B, V) {
                        I = pe(I), h = Ie(d, h), m && (m = Ie(g, m)), S && (S = Ie(P, S)), V = Ie(B, V);
                        var re = It(I);
                        lr(re, function() {
                            Ze("Cannot construct " + I + " due to unbound types", [
                                l
                            ]);
                        }), Le([
                            e,
                            t,
                            o
                        ], l ? [
                            l
                        ] : [], function(ee) {
                            ee = ee[0];
                            var de, Fe;
                            l ? (de = ee.registeredClass, Fe = de.instancePrototype) : Fe = vt.prototype;
                            var We = mt(re, function() {
                                if (Object.getPrototypeOf(this) !== Sn) throw new ne("Use 'new' to construct " + I);
                                if (Lt.constructor_body === void 0) throw new ne(I + " has no accessible constructor");
                                var ti = Lt.constructor_body[arguments.length];
                                if (ti === void 0) throw new ne("Tried to invoke ctor of " + I + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(Lt.constructor_body).toString() + ") parameters instead!");
                                return ti.apply(this, arguments);
                            }), Sn = Object.create(Fe, {
                                constructor: {
                                    value: We
                                }
                            });
                            We.prototype = Sn;
                            var Lt = new Pr(I, We, Sn, V, de, h, m, S), Wn = new Be(I, Lt, !0, !1, !1), Fn = new Be(I + "*", Lt, !1, !1, !1), ei = new Be(I + " const*", Lt, !1, !0, !1);
                            return je[e] = {
                                pointerType: Fn,
                                constPointerType: ei
                            }, xr(re, We), [
                                Wn,
                                Fn,
                                ei
                            ];
                        });
                    }
                    function Hr(e, t) {
                        for(var o = [], l = 0; l < e; l++)o.push(ve[t + l * 4 >> 2]);
                        return o;
                    }
                    function Mr(e, t) {
                        if (!(e instanceof Function)) throw new TypeError("new_ called with constructor type " + typeof e + " which is not a function");
                        var o = mt(e.name || "unknownFunctionName", function() {});
                        o.prototype = e.prototype;
                        var l = new o, d = e.apply(l, t);
                        return d instanceof Object ? d : l;
                    }
                    function pr(e, t, o, l, d) {
                        var h = t.length;
                        h < 2 && Z("argTypes array size mismatch! Must at least get return value and 'this' types!");
                        for(var g = t[1] !== null && o !== null, m = !1, P = 1; P < t.length; ++P)if (t[P] !== null && t[P].destructorFunction === void 0) {
                            m = !0;
                            break;
                        }
                        for(var S = t[0].name !== "void", I = "", B = "", P = 0; P < h - 2; ++P)I += (P !== 0 ? ", " : "") + "arg" + P, B += (P !== 0 ? ", " : "") + "arg" + P + "Wired";
                        var V = "return function " + It(e) + "(" + I + `) {
if (arguments.length !== ` + (h - 2) + `) {
throwBindingError('function ` + e + " called with ' + arguments.length + ' arguments, expected " + (h - 2) + ` args!');
}
`;
                        m && (V += `var destructors = [];
`);
                        var re = m ? "destructors" : "null", ee = [
                            "throwBindingError",
                            "invoker",
                            "fn",
                            "runDestructors",
                            "retType",
                            "classParam"
                        ], de = [
                            Z,
                            l,
                            d,
                            De,
                            t[0],
                            t[1]
                        ];
                        g && (V += "var thisWired = classParam.toWireType(" + re + `, this);
`);
                        for(var P = 0; P < h - 2; ++P)V += "var arg" + P + "Wired = argType" + P + ".toWireType(" + re + ", arg" + P + "); // " + t[P + 2].name + `
`, ee.push("argType" + P), de.push(t[P + 2]);
                        if (g && (B = "thisWired" + (B.length > 0 ? ", " : "") + B), V += (S ? "var rv = " : "") + "invoker(fn" + (B.length > 0 ? ", " : "") + B + `);
`, m) V += `runDestructors(destructors);
`;
                        else for(var P = g ? 1 : 2; P < t.length; ++P){
                            var Fe = P === 1 ? "thisWired" : "arg" + (P - 2) + "Wired";
                            t[P].destructorFunction !== null && (V += Fe + "_dtor(" + Fe + "); // " + t[P].name + `
`, ee.push(Fe + "_dtor"), de.push(t[P].destructorFunction));
                        }
                        S && (V += `var ret = retType.fromWireType(rv);
return ret;
`), V += `}
`, ee.push(V);
                        var We = Mr(Function, ee).apply(null, de);
                        return We;
                    }
                    function me(e, t, o, l, d, h) {
                        Ft(t > 0);
                        var g = Hr(t, o);
                        d = Ie(l, d), Le([], [
                            e
                        ], function(m) {
                            m = m[0];
                            var P = "constructor " + m.name;
                            if (m.registeredClass.constructor_body === void 0 && (m.registeredClass.constructor_body = []), m.registeredClass.constructor_body[t - 1] !== void 0) throw new ne("Cannot register multiple constructors with identical number of parameters (" + (t - 1) + ") for class '" + m.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
                            return m.registeredClass.constructor_body[t - 1] = ()=>{
                                Ze("Cannot construct " + m.name + " due to unbound types", g);
                            }, Le([], g, function(S) {
                                return S.splice(1, 0, null), m.registeredClass.constructor_body[t - 1] = pr(P, S, null, d, h), [];
                            }), [];
                        });
                    }
                    function er(e, t, o, l, d, h, g, m) {
                        var P = Hr(o, l);
                        t = pe(t), h = Ie(d, h), Le([], [
                            e
                        ], function(S) {
                            S = S[0];
                            var I = S.name + "." + t;
                            t.startsWith("@@") && (t = Symbol[t.substring(2)]), m && S.registeredClass.pureVirtualFunctions.push(t);
                            function B() {
                                Ze("Cannot call " + I + " due to unbound types", P);
                            }
                            var V = S.registeredClass.instancePrototype, re = V[t];
                            return re === void 0 || re.overloadTable === void 0 && re.className !== S.name && re.argCount === o - 2 ? (B.argCount = o - 2, B.className = S.name, V[t] = B) : (fr(V, t, I), V[t].overloadTable[o - 2] = B), Le([], P, function(ee) {
                                var de = pr(I, ee, S, h, g);
                                return V[t].overloadTable === void 0 ? (de.argCount = o - 2, V[t] = de) : V[t].overloadTable[o - 2] = de, [];
                            }), [];
                        });
                    }
                    var xe = [], Oe = [
                        {},
                        {
                            value: void 0
                        },
                        {
                            value: null
                        },
                        {
                            value: !0
                        },
                        {
                            value: !1
                        }
                    ];
                    function Lr(e) {
                        e > 4 && --Oe[e].refcount === 0 && (Oe[e] = void 0, xe.push(e));
                    }
                    function nt() {
                        for(var e = 0, t = 5; t < Oe.length; ++t)Oe[t] !== void 0 && ++e;
                        return e;
                    }
                    function ln() {
                        for(var e = 5; e < Oe.length; ++e)if (Oe[e] !== void 0) return Oe[e];
                        return null;
                    }
                    function qe() {
                        r.count_emval_handles = nt, r.get_first_emval = ln;
                    }
                    var Pt = {
                        toValue: (e)=>(e || Z("Cannot use deleted val. handle = " + e), Oe[e].value),
                        toHandle: (e)=>{
                            switch(e){
                                case void 0:
                                    return 1;
                                case null:
                                    return 2;
                                case !0:
                                    return 3;
                                case !1:
                                    return 4;
                                default:
                                    {
                                        var t = xe.length ? xe.pop() : Oe.length;
                                        return Oe[t] = {
                                            refcount: 1,
                                            value: e
                                        }, t;
                                    }
                            }
                        }
                    };
                    function Cr(e, t) {
                        t = pe(t), ze(e, {
                            name: t,
                            fromWireType: function(o) {
                                var l = Pt.toValue(o);
                                return Lr(o), l;
                            },
                            toWireType: function(o, l) {
                                return Pt.toHandle(l);
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: he,
                            destructorFunction: null
                        });
                    }
                    function tr(e) {
                        if (e === null) return "null";
                        var t = typeof e;
                        return t === "object" || t === "array" || t === "function" ? e.toString() : "" + e;
                    }
                    function et(e, t) {
                        switch(t){
                            case 2:
                                return function(o) {
                                    return this.fromWireType(Bt[o >> 2]);
                                };
                            case 3:
                                return function(o) {
                                    return this.fromWireType(Nt[o >> 3]);
                                };
                            default:
                                throw new TypeError("Unknown float type: " + e);
                        }
                    }
                    function Vr(e, t, o) {
                        var l = Ae(o);
                        t = pe(t), ze(e, {
                            name: t,
                            fromWireType: function(d) {
                                return d;
                            },
                            toWireType: function(d, h) {
                                return h;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: et(t, l),
                            destructorFunction: null
                        });
                    }
                    function pn(e, t, o) {
                        switch(t){
                            case 0:
                                return o ? function(d) {
                                    return fe[d];
                                } : function(d) {
                                    return ue[d];
                                };
                            case 1:
                                return o ? function(d) {
                                    return ie[d >> 1];
                                } : function(d) {
                                    return ae[d >> 1];
                                };
                            case 2:
                                return o ? function(d) {
                                    return oe[d >> 2];
                                } : function(d) {
                                    return ve[d >> 2];
                                };
                            default:
                                throw new TypeError("Unknown integer type: " + e);
                        }
                    }
                    function dn(e, t, o, l, d) {
                        t = pe(t);
                        var h = Ae(o), g = (B)=>B;
                        if (l === 0) {
                            var m = 32 - 8 * o;
                            g = (B)=>B << m >>> m;
                        }
                        var P = t.includes("unsigned"), S = (B, V)=>{}, I;
                        P ? I = function(B, V) {
                            return S(V, this.name), V >>> 0;
                        } : I = function(B, V) {
                            return S(V, this.name), V;
                        }, ze(e, {
                            name: t,
                            fromWireType: g,
                            toWireType: I,
                            argPackAdvance: 8,
                            readValueFromPointer: pn(t, h, l !== 0),
                            destructorFunction: null
                        });
                    }
                    function Br(e, t, o) {
                        var l = [
                            Int8Array,
                            Uint8Array,
                            Int16Array,
                            Uint16Array,
                            Int32Array,
                            Uint32Array,
                            Float32Array,
                            Float64Array
                        ], d = l[t];
                        function h(g) {
                            g = g >> 2;
                            var m = ve, P = m[g], S = m[g + 1];
                            return new d(le, S, P);
                        }
                        o = pe(o), ze(e, {
                            name: o,
                            fromWireType: h,
                            argPackAdvance: 8,
                            readValueFromPointer: h
                        }, {
                            ignoreDuplicateRegistrations: !0
                        });
                    }
                    function rr(e, t) {
                        t = pe(t);
                        var o = t === "std::string";
                        ze(e, {
                            name: t,
                            fromWireType: function(l) {
                                var d = ve[l >> 2], h = l + 4, g;
                                if (o) for(var m = h, P = 0; P <= d; ++P){
                                    var S = h + P;
                                    if (P == d || ue[S] == 0) {
                                        var I = S - m, B = vr(m, I);
                                        g === void 0 ? g = B : (g += "\0", g += B), m = S + 1;
                                    }
                                }
                                else {
                                    for(var V = new Array(d), P = 0; P < d; ++P)V[P] = String.fromCharCode(ue[h + P]);
                                    g = V.join("");
                                }
                                return x(l), g;
                            },
                            toWireType: function(l, d) {
                                d instanceof ArrayBuffer && (d = new Uint8Array(d));
                                var h, g = typeof d == "string";
                                g || d instanceof Uint8Array || d instanceof Uint8ClampedArray || d instanceof Int8Array || Z("Cannot pass non-string to std::string"), o && g ? h = ye(d) : h = d.length;
                                var m = F(4 + h + 1), P = m + 4;
                                if (ve[m >> 2] = h, o && g) Ge(d, P, h + 1);
                                else if (g) for(var S = 0; S < h; ++S){
                                    var I = d.charCodeAt(S);
                                    I > 255 && (x(P), Z("String has UTF-16 code units that do not fit in 8 bits")), ue[P + S] = I;
                                }
                                else for(var S = 0; S < h; ++S)ue[P + S] = d[S];
                                return l !== null && l.push(x, m), m;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: he,
                            destructorFunction: function(l) {
                                x(l);
                            }
                        });
                    }
                    var Nr = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
                    function Ar(e, t) {
                        for(var o = e, l = o >> 1, d = l + t / 2; !(l >= d) && ae[l];)++l;
                        if (o = l << 1, o - e > 32 && Nr) return Nr.decode(ue.subarray(e, o));
                        for(var h = "", g = 0; !(g >= t / 2); ++g){
                            var m = ie[e + g * 2 >> 1];
                            if (m == 0) break;
                            h += String.fromCharCode(m);
                        }
                        return h;
                    }
                    function vn(e, t, o) {
                        if (o === void 0 && (o = 2147483647), o < 2) return 0;
                        o -= 2;
                        for(var l = t, d = o < e.length * 2 ? o / 2 : e.length, h = 0; h < d; ++h){
                            var g = e.charCodeAt(h);
                            ie[t >> 1] = g, t += 2;
                        }
                        return ie[t >> 1] = 0, t - l;
                    }
                    function hn(e) {
                        return e.length * 2;
                    }
                    function gn(e, t) {
                        for(var o = 0, l = ""; !(o >= t / 4);){
                            var d = oe[e + o * 4 >> 2];
                            if (d == 0) break;
                            if (++o, d >= 65536) {
                                var h = d - 65536;
                                l += String.fromCharCode(55296 | h >> 10, 56320 | h & 1023);
                            } else l += String.fromCharCode(d);
                        }
                        return l;
                    }
                    function yn(e, t, o) {
                        if (o === void 0 && (o = 2147483647), o < 4) return 0;
                        for(var l = t, d = l + o - 4, h = 0; h < e.length; ++h){
                            var g = e.charCodeAt(h);
                            if (g >= 55296 && g <= 57343) {
                                var m = e.charCodeAt(++h);
                                g = 65536 + ((g & 1023) << 10) | m & 1023;
                            }
                            if (oe[t >> 2] = g, t += 4, t + 4 > d) break;
                        }
                        return oe[t >> 2] = 0, t - l;
                    }
                    function _n(e) {
                        for(var t = 0, o = 0; o < e.length; ++o){
                            var l = e.charCodeAt(o);
                            l >= 55296 && l <= 57343 && ++o, t += 4;
                        }
                        return t;
                    }
                    function mn(e, t, o) {
                        o = pe(o);
                        var l, d, h, g, m;
                        t === 2 ? (l = Ar, d = vn, g = hn, h = ()=>ae, m = 1) : t === 4 && (l = gn, d = yn, g = _n, h = ()=>ve, m = 2), ze(e, {
                            name: o,
                            fromWireType: function(P) {
                                for(var S = ve[P >> 2], I = h(), B, V = P + 4, re = 0; re <= S; ++re){
                                    var ee = P + 4 + re * t;
                                    if (re == S || I[ee >> m] == 0) {
                                        var de = ee - V, Fe = l(V, de);
                                        B === void 0 ? B = Fe : (B += "\0", B += Fe), V = ee + t;
                                    }
                                }
                                return x(P), B;
                            },
                            toWireType: function(P, S) {
                                typeof S != "string" && Z("Cannot pass non-string to C++ string type " + o);
                                var I = g(S), B = F(4 + I + t);
                                return ve[B >> 2] = I >> m, d(S, B + 4, I + t), P !== null && P.push(x, B), B;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: he,
                            destructorFunction: function(P) {
                                x(P);
                            }
                        });
                    }
                    function bn(e, t, o, l, d, h) {
                        ke[e] = {
                            name: pe(t),
                            rawConstructor: Ie(o, l),
                            rawDestructor: Ie(d, h),
                            fields: []
                        };
                    }
                    function zr(e, t, o, l, d, h, g, m, P, S) {
                        ke[e].fields.push({
                            fieldName: pe(t),
                            getterReturnType: o,
                            getter: Ie(l, d),
                            getterContext: h,
                            setterArgumentType: g,
                            setter: Ie(m, P),
                            setterContext: S
                        });
                    }
                    function wn(e, t) {
                        t = pe(t), ze(e, {
                            isVoid: !0,
                            name: t,
                            argPackAdvance: 0,
                            fromWireType: function() {},
                            toWireType: function(o, l) {}
                        });
                    }
                    function qr() {
                        throw 1 / 0;
                    }
                    var Gr = {};
                    function Pn(e) {
                        var t = Gr[e];
                        return t === void 0 ? pe(e) : t;
                    }
                    function $r() {
                        return typeof globalThis == "object" ? globalThis : function() {
                            return Function;
                        }()("return this")();
                    }
                    function Jr(e) {
                        return e === 0 ? Pt.toHandle($r()) : (e = Pn(e), Pt.toHandle($r()[e]));
                    }
                    function Xr(e) {
                        e > 4 && (Oe[e].refcount += 1);
                    }
                    function Rr(e, t) {
                        var o = tt[e];
                        return o === void 0 && Z(t + " has unknown type " + Ht(e)), o;
                    }
                    function Tn(e) {
                        for(var t = "", o = 0; o < e; ++o)t += (o !== 0 ? ", " : "") + "arg" + o;
                        for(var l = ()=>ve, d = "return function emval_allocator_" + e + `(constructor, argTypes, args) {
  var HEAPU32 = getMemory();
`, o = 0; o < e; ++o)d += "var argType" + o + " = requireRegisteredType(HEAPU32[((argTypes)>>2)], 'parameter " + o + `');
var arg` + o + " = argType" + o + `.readValueFromPointer(args);
args += argType` + o + `['argPackAdvance'];
argTypes += 4;
`;
                        return d += "var obj = new constructor(" + t + `);
return valueToHandle(obj);
}
`, new Function("requireRegisteredType", "Module", "valueToHandle", "getMemory", d)(Rr, r, Pt.toHandle, l);
                    }
                    var Yr = {};
                    function Cn(e, t, o, l) {
                        e = Pt.toValue(e);
                        var d = Yr[t];
                        return d || (d = Tn(t), Yr[t] = d), d(e, o, l);
                    }
                    function Kr(e, t) {
                        e = Rr(e, "_emval_take_value");
                        var o = e.readValueFromPointer(t);
                        return Pt.toHandle(o);
                    }
                    function An() {
                        at("");
                    }
                    function $n(e, t, o) {
                        ue.copyWithin(e, t, t + o);
                    }
                    function Rn() {
                        return 2147483648;
                    }
                    function En(e) {
                        try {
                            return it.grow(e - le.byteLength + 65535 >>> 16), zt(it.buffer), 1;
                        } catch  {}
                    }
                    function Er(e) {
                        var t = ue.length;
                        e = e >>> 0;
                        var o = Rn();
                        if (e > o) return !1;
                        let l = (P, S)=>P + (S - P % S) % S;
                        for(var d = 1; d <= 4; d *= 2){
                            var h = t * (1 + .2 / d);
                            h = Math.min(h, e + 100663296);
                            var g = Math.min(o, l(Math.max(e, h), 65536)), m = En(g);
                            if (m) return !0;
                        }
                        return !1;
                    }
                    var Sr = {};
                    function Ot() {
                        return N || "./this.program";
                    }
                    function Mt() {
                        if (!Mt.strings) {
                            var e = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8", t = {
                                USER: "web_user",
                                LOGNAME: "web_user",
                                PATH: "/",
                                PWD: "/",
                                HOME: "/home/web_user",
                                LANG: e,
                                _: Ot()
                            };
                            for(var o in Sr)Sr[o] === void 0 ? delete t[o] : t[o] = Sr[o];
                            var l = [];
                            for(var o in t)l.push(o + "=" + t[o]);
                            Mt.strings = l;
                        }
                        return Mt.strings;
                    }
                    function yt(e, t, o) {
                        for(var l = 0; l < e.length; ++l)fe[t++ >> 0] = e.charCodeAt(l);
                        fe[t >> 0] = 0;
                    }
                    function Qr(e, t) {
                        var o = 0;
                        return Mt().forEach(function(l, d) {
                            var h = t + o;
                            ve[e + d * 4 >> 2] = h, yt(l, h), o += l.length + 1;
                        }), 0;
                    }
                    function Zr(e, t) {
                        var o = Mt();
                        ve[e >> 2] = o.length;
                        var l = 0;
                        return o.forEach(function(d) {
                            l += d.length + 1;
                        }), ve[t >> 2] = l, 0;
                    }
                    function kr(e) {
                        M(e, new ar(e));
                    }
                    function en(e, t) {
                        kr(e);
                    }
                    var dr = en;
                    function tn(e) {
                        return 52;
                    }
                    function u(e, t, o, l, d) {
                        return 70;
                    }
                    var c = [
                        null,
                        [],
                        []
                    ];
                    function v(e, t) {
                        var o = c[e];
                        t === 0 || t === 10 ? ((e === 1 ? we : Pe)(nr(o, 0)), o.length = 0) : o.push(t);
                    }
                    function w(e, t, o, l) {
                        for(var d = 0, h = 0; h < o; h++){
                            var g = ve[t >> 2], m = ve[t + 4 >> 2];
                            t += 8;
                            for(var P = 0; P < m; P++)v(e, ue[g + P]);
                            d += m;
                        }
                        return ve[l >> 2] = d, 0;
                    }
                    function C(e) {
                        var t = r["_" + e];
                        return t;
                    }
                    function k(e, t) {
                        fe.set(e, t);
                    }
                    function D(e, t, o, l, d) {
                        var h = {
                            string: (ee)=>{
                                var de = 0;
                                if (ee != null && ee !== 0) {
                                    var Fe = (ee.length << 2) + 1;
                                    de = a(Fe), Ge(ee, de, Fe);
                                }
                                return de;
                            },
                            array: (ee)=>{
                                var de = a(ee.length);
                                return k(ee, de), de;
                            }
                        };
                        function g(ee) {
                            return t === "string" ? vr(ee) : t === "boolean" ? !!ee : ee;
                        }
                        var m = C(e), P = [], S = 0;
                        if (l) for(var I = 0; I < l.length; I++){
                            var B = h[o[I]];
                            B ? (S === 0 && (S = K()), P[I] = B(l[I])) : P[I] = l[I];
                        }
                        var V = m.apply(null, P);
                        function re(ee) {
                            return S !== 0 && s(S), g(ee);
                        }
                        return V = re(V), V;
                    }
                    xt = r.InternalError = He(Error, "InternalError"), Et(), ne = r.BindingError = He(Error, "BindingError"), Ve(), Xt(), rt(), Tr = r.UnboundTypeError = He(Error, "UnboundTypeError"), qe();
                    var $ = {
                        g: _t,
                        A: $t,
                        w: Rt,
                        F: ut,
                        u: Zt,
                        t: me,
                        c: er,
                        E: Cr,
                        m: Vr,
                        b: dn,
                        a: Br,
                        l: rr,
                        h: mn,
                        J: bn,
                        d: zr,
                        G: wn,
                        x: qr,
                        i: Lr,
                        r: Jr,
                        p: Xr,
                        q: Cn,
                        s: Kr,
                        j: An,
                        D: $n,
                        y: Er,
                        z: Qr,
                        B: Zr,
                        I: dr,
                        C: tn,
                        v: u,
                        k: w,
                        o: T,
                        n: E,
                        H: O,
                        f: b,
                        e: U
                    };
                    yr(), r.___wasm_call_ctors = function() {
                        return (r.___wasm_call_ctors = r.asm.L).apply(null, arguments);
                    };
                    var F = r._malloc = function() {
                        return (F = r._malloc = r.asm.N).apply(null, arguments);
                    }, x = r._free = function() {
                        return (x = r._free = r.asm.O).apply(null, arguments);
                    }, G = r.___getTypeName = function() {
                        return (G = r.___getTypeName = r.asm.P).apply(null, arguments);
                    };
                    r.__embind_initialize_bindings = function() {
                        return (r.__embind_initialize_bindings = r.asm.Q).apply(null, arguments);
                    };
                    var J = r._setThrew = function() {
                        return (J = r._setThrew = r.asm.R).apply(null, arguments);
                    }, K = r.stackSave = function() {
                        return (K = r.stackSave = r.asm.S).apply(null, arguments);
                    }, s = r.stackRestore = function() {
                        return (s = r.stackRestore = r.asm.T).apply(null, arguments);
                    }, a = r.stackAlloc = function() {
                        return (a = r.stackAlloc = r.asm.U).apply(null, arguments);
                    }, p = r.___cxa_is_pointer_type = function() {
                        return (p = r.___cxa_is_pointer_type = r.asm.V).apply(null, arguments);
                    };
                    r.dynCall_jiji = function() {
                        return (r.dynCall_jiji = r.asm.W).apply(null, arguments);
                    };
                    function b(e, t) {
                        var o = K();
                        try {
                            Ee(e)(t);
                        } catch (l) {
                            if (s(o), l !== l + 0) throw l;
                            J(1, 0);
                        }
                    }
                    function T(e, t) {
                        var o = K();
                        try {
                            return Ee(e)(t);
                        } catch (l) {
                            if (s(o), l !== l + 0) throw l;
                            J(1, 0);
                        }
                    }
                    function U(e, t, o, l) {
                        var d = K();
                        try {
                            Ee(e)(t, o, l);
                        } catch (h) {
                            if (s(d), h !== h + 0) throw h;
                            J(1, 0);
                        }
                    }
                    function O(e, t, o, l) {
                        var d = K();
                        try {
                            return Ee(e)(t, o, l);
                        } catch (h) {
                            if (s(d), h !== h + 0) throw h;
                            J(1, 0);
                        }
                    }
                    function E(e, t, o) {
                        var l = K();
                        try {
                            return Ee(e)(t, o);
                        } catch (d) {
                            if (s(l), d !== d + 0) throw d;
                            J(1, 0);
                        }
                    }
                    r.ccall = D;
                    var n;
                    ot = function e() {
                        n || i(), n || (ot = e);
                    };
                    function i(e) {
                        if (Ye > 0 || (nn(), Ye > 0)) return;
                        function t() {
                            n || (n = !0, r.calledRun = !0, !Vt && (on(), L(r), r.onRuntimeInitialized && r.onRuntimeInitialized(), an()));
                        }
                        r.setStatus ? (r.setStatus("Running..."), setTimeout(function() {
                            setTimeout(function() {
                                r.setStatus("");
                            }, 1), t();
                        }, 1)) : t();
                    }
                    if (r.preInit) for(typeof r.preInit == "function" && (r.preInit = [
                        r.preInit
                    ]); r.preInit.length > 0;)r.preInit.pop()();
                    return i(), A.ready;
                };
            })();
            f.exports = _;
        }(Gn)), Gn.exports;
    }
    var qi = zi(), Gi = zn(qi);
    const Ji = new URL("/assets/libjpegturbowasm_decode-daqMmuVl.wasm", import.meta.url), Ln = {
        codec: void 0,
        decoder: void 0
    };
    function Xi() {
        if (Ln.codec) return Promise.resolve();
        const f = Gi({
            locateFile: (y)=>y.endsWith(".wasm") ? Ji.toString() : y
        });
        return new Promise((y, _)=>{
            f.then((R)=>{
                Ln.codec = R, Ln.decoder = new R.JPEGDecoder, y();
            }, _);
        });
    }
    async function Yi(f, y) {
        await Xi();
        const _ = Ln.decoder;
        _.getEncodedBuffer(f.length).set(f), _.decode();
        const A = _.getFrameInfo(), r = _.getDecodedBuffer(), L = {
            columns: A.width,
            rows: A.height,
            bitsPerPixel: A.bitsPerSample,
            signed: y.signed,
            bytesPerPixel: y.bytesPerPixel,
            componentsPerPixel: A.componentCount
        }, j = Ki(A, r), W = {
            frameInfo: A
        };
        return {
            ...y,
            pixelData: j,
            imageInfo: L,
            encodeOptions: W,
            ...W,
            ...L
        };
    }
    function Ki(f, y) {
        return f.isSigned ? new Int8Array(y.buffer, y.byteOffset, y.byteLength) : new Uint8Array(y.buffer, y.byteOffset, y.byteLength);
    }
    const In = {
        JpegImage: void 0,
        decodeConfig: {}
    };
    function Qi(f) {
        return In.decodeConfig = f, In.JpegImage ? Promise.resolve() : new Promise((y, _)=>{
            import("./jpeg-CB7_OXod.js").then((R)=>{
                In.JpegImage = R.default, y();
            }).catch(_);
        });
    }
    async function Zi(f, y) {
        if (await Qi(), typeof In.JpegImage > "u") throw new Error("No JPEG Baseline decoder loaded");
        const _ = new In.JpegImage;
        if (_.parse(y), _.colorTransform = !1, f.bitsAllocated === 8) return f.pixelData = _.getData(f.columns, f.rows), f;
        if (f.bitsAllocated === 16) return f.pixelData = _.getData16(f.columns, f.rows), f;
    }
    const xn = {
        jpeg: void 0,
        decodeConfig: {}
    };
    function eo(f) {
        return xn.decodeConfig = f, xn.jpeg ? Promise.resolve() : new Promise((y, _)=>{
            import("./lossless-DVKeooSO.js").then(({ Decoder: R })=>{
                const A = new R;
                xn.jpeg = A, y();
            }, _);
        });
    }
    async function oi(f, y) {
        if (await eo(), typeof xn.jpeg > "u") throw new Error("No JPEG Lossless decoder loaded");
        const _ = f.bitsAllocated <= 8 ? 1 : 2, R = y.buffer, A = xn.jpeg.decode(R, y.byteOffset, y.length, _);
        return f.pixelRepresentation === 0 ? f.bitsAllocated === 16 ? (f.pixelData = new Uint16Array(A.buffer), f) : (f.pixelData = new Uint8Array(A.buffer), f) : (f.pixelData = new Int16Array(A.buffer), f);
    }
    var Jn = {
        exports: {}
    }, ai;
    function to() {
        return ai || (ai = 1, function(f, y) {
            var _ = (()=>{
                var R = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
                return typeof __filename < "u" && (R = R || __filename), function(A) {
                    A = A || {};
                    var r = typeof A < "u" ? A : {}, L, j;
                    r.ready = new Promise(function(u, c) {
                        L = u, j = c;
                    });
                    var W = Object.assign({}, r), N = typeof window == "object", M = typeof importScripts == "function", z = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string", H = "";
                    function X(u) {
                        return r.locateFile ? r.locateFile(u, H) : H + u;
                    }
                    var q, te, ce;
                    if (z) {
                        var $e = rn, Q = rn;
                        M ? H = Q.dirname(H) + "/" : H = __dirname + "/", q = (u, c)=>(u = at(u) ? new URL(u) : Q.normalize(u), $e.readFileSync(u, c ? void 0 : "utf8")), ce = (u)=>{
                            var c = q(u, !0);
                            return c.buffer || (c = new Uint8Array(c)), c;
                        }, te = (u, c, v)=>{
                            u = at(u) ? new URL(u) : Q.normalize(u), $e.readFile(u, function(w, C) {
                                w ? v(w) : c(C.buffer);
                            });
                        }, process.argv.length > 1 && process.argv[1].replace(/\\/g, "/"), process.argv.slice(2), process.on("uncaughtException", function(u) {
                            if (!(u instanceof Or)) throw u;
                        }), process.on("unhandledRejection", function(u) {
                            throw u;
                        }), r.inspect = function() {
                            return "[Emscripten Module object]";
                        };
                    } else (N || M) && (M ? H = self.location.href : typeof document < "u" && document.currentScript && (H = document.currentScript.src), R && (H = R), H.indexOf("blob:") !== 0 ? H = H.substr(0, H.replace(/[?#].*/, "").lastIndexOf("/") + 1) : H = "", q = (u)=>{
                        var c = new XMLHttpRequest;
                        return c.open("GET", u, !1), c.send(null), c.responseText;
                    }, M && (ce = (u)=>{
                        var c = new XMLHttpRequest;
                        return c.open("GET", u, !1), c.responseType = "arraybuffer", c.send(null), new Uint8Array(c.response);
                    }), te = (u, c, v)=>{
                        var w = new XMLHttpRequest;
                        w.open("GET", u, !0), w.responseType = "arraybuffer", w.onload = ()=>{
                            if (w.status == 200 || w.status == 0 && w.response) {
                                c(w.response);
                                return;
                            }
                            v();
                        }, w.onerror = v, w.send(null);
                    });
                    r.print || console.log.bind(console);
                    var _e = r.printErr || console.warn.bind(console);
                    Object.assign(r, W), W = null, r.arguments && r.arguments, r.thisProgram && r.thisProgram, r.quit && r.quit;
                    var ge;
                    r.wasmBinary && (ge = r.wasmBinary), r.noExitRuntime, typeof WebAssembly != "object" && ot("no native wasm support detected");
                    var we, Pe = !1;
                    function Ue(u, c) {
                        u || ot(c);
                    }
                    var it = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
                    function Vt(u, c, v) {
                        for(var w = c + v, C = c; u[C] && !(C >= w);)++C;
                        if (C - c > 16 && u.buffer && it) return it.decode(u.subarray(c, C));
                        for(var k = ""; c < C;){
                            var D = u[c++];
                            if (!(D & 128)) {
                                k += String.fromCharCode(D);
                                continue;
                            }
                            var $ = u[c++] & 63;
                            if ((D & 224) == 192) {
                                k += String.fromCharCode((D & 31) << 6 | $);
                                continue;
                            }
                            var F = u[c++] & 63;
                            if ((D & 240) == 224 ? D = (D & 15) << 12 | $ << 6 | F : D = (D & 7) << 18 | $ << 12 | F << 6 | u[c++] & 63, D < 65536) k += String.fromCharCode(D);
                            else {
                                var x = D - 65536;
                                k += String.fromCharCode(55296 | x >> 10, 56320 | x & 1023);
                            }
                        }
                        return k;
                    }
                    function Ft(u, c) {
                        return u ? Vt(ye, u, c) : "";
                    }
                    function Tt(u, c, v, w) {
                        if (!(w > 0)) return 0;
                        for(var C = v, k = v + w - 1, D = 0; D < u.length; ++D){
                            var $ = u.charCodeAt(D);
                            if ($ >= 55296 && $ <= 57343) {
                                var F = u.charCodeAt(++D);
                                $ = 65536 + (($ & 1023) << 10) | F & 1023;
                            }
                            if ($ <= 127) {
                                if (v >= k) break;
                                c[v++] = $;
                            } else if ($ <= 2047) {
                                if (v + 1 >= k) break;
                                c[v++] = 192 | $ >> 6, c[v++] = 128 | $ & 63;
                            } else if ($ <= 65535) {
                                if (v + 2 >= k) break;
                                c[v++] = 224 | $ >> 12, c[v++] = 128 | $ >> 6 & 63, c[v++] = 128 | $ & 63;
                            } else {
                                if (v + 3 >= k) break;
                                c[v++] = 240 | $ >> 18, c[v++] = 128 | $ >> 12 & 63, c[v++] = 128 | $ >> 6 & 63, c[v++] = 128 | $ & 63;
                            }
                        }
                        return c[v] = 0, v - C;
                    }
                    function nr(u, c, v) {
                        return Tt(u, ye, c, v);
                    }
                    function vr(u) {
                        for(var c = 0, v = 0; v < u.length; ++v){
                            var w = u.charCodeAt(v);
                            w <= 127 ? c++ : w <= 2047 ? c += 2 : w >= 55296 && w <= 57343 ? (c += 4, ++v) : c += 3;
                        }
                        return c;
                    }
                    var ir, Ge, ye, le, fe, ue, ie, ae, oe;
                    function ve(u) {
                        ir = u, r.HEAP8 = Ge = new Int8Array(u), r.HEAP16 = le = new Int16Array(u), r.HEAP32 = ue = new Int32Array(u), r.HEAPU8 = ye = new Uint8Array(u), r.HEAPU16 = fe = new Uint16Array(u), r.HEAPU32 = ie = new Uint32Array(u), r.HEAPF32 = ae = new Float32Array(u), r.HEAPF64 = oe = new Float64Array(u);
                    }
                    r.INITIAL_MEMORY;
                    var Bt, Nt = [], zt = [], qt = [];
                    function or() {
                        if (r.preRun) for(typeof r.preRun == "function" && (r.preRun = [
                            r.preRun
                        ]); r.preRun.length;)nn(r.preRun.shift());
                        gr(Nt);
                    }
                    function hr() {
                        gr(zt);
                    }
                    function Dr() {
                        if (r.postRun) for(typeof r.postRun == "function" && (r.postRun = [
                            r.postRun
                        ]); r.postRun.length;)an(r.postRun.shift());
                        gr(qt);
                    }
                    function nn(u) {
                        Nt.unshift(u);
                    }
                    function on(u) {
                        zt.unshift(u);
                    }
                    function an(u) {
                        qt.unshift(u);
                    }
                    var Ct = 0, Je = null;
                    function Xe(u) {
                        Ct++, r.monitorRunDependencies && r.monitorRunDependencies(Ct);
                    }
                    function Ye(u) {
                        if (Ct--, r.monitorRunDependencies && r.monitorRunDependencies(Ct), Ct == 0 && Je) {
                            var c = Je;
                            Je = null, c();
                        }
                    }
                    function ot(u) {
                        r.onAbort && r.onAbort(u), u = "Aborted(" + u + ")", _e(u), Pe = !0, u += ". Build with -sASSERTIONS for more info.";
                        var c = new WebAssembly.RuntimeError(u);
                        throw j(c), c;
                    }
                    var Ut = "data:application/octet-stream;base64,";
                    function jt(u) {
                        return u.startsWith(Ut);
                    }
                    function at(u) {
                        return u.startsWith("file://");
                    }
                    var Te;
                    Te = "charlswasm_decode.wasm", jt(Te) || (Te = X(Te));
                    function be(u) {
                        try {
                            if (u == Te && ge) return new Uint8Array(ge);
                            if (ce) return ce(u);
                            throw "both async and sync fetching of the wasm failed";
                        } catch (c) {
                            ot(c);
                        }
                    }
                    function Ce() {
                        if (!ge && (N || M)) {
                            if (typeof fetch == "function" && !at(Te)) return fetch(Te, {
                                credentials: "same-origin"
                            }).then(function(u) {
                                if (!u.ok) throw "failed to load wasm binary file at '" + Te + "'";
                                return u.arrayBuffer();
                            }).catch(function() {
                                return be(Te);
                            });
                            if (te) return new Promise(function(u, c) {
                                te(Te, function(v) {
                                    u(new Uint8Array(v));
                                }, c);
                            });
                        }
                        return Promise.resolve().then(function() {
                            return be(Te);
                        });
                    }
                    function Se() {
                        var u = {
                            a: Sr
                        };
                        function c(D, $) {
                            var F = D.exports;
                            r.asm = F, we = r.asm.z, ve(we.buffer), Bt = r.asm.C, on(r.asm.A), Ye();
                        }
                        Xe();
                        function v(D) {
                            c(D.instance);
                        }
                        function w(D) {
                            return Ce().then(function($) {
                                return WebAssembly.instantiate($, u);
                            }).then(function($) {
                                return $;
                            }).then(D, function($) {
                                _e("failed to asynchronously prepare wasm: " + $), ot($);
                            });
                        }
                        function C() {
                            return !ge && typeof WebAssembly.instantiateStreaming == "function" && !jt(Te) && !at(Te) && !z && typeof fetch == "function" ? fetch(Te, {
                                credentials: "same-origin"
                            }).then(function(D) {
                                var $ = WebAssembly.instantiateStreaming(D, u);
                                return $.then(v, function(F) {
                                    return _e("wasm streaming compile failed: " + F), _e("falling back to ArrayBuffer instantiation"), w(v);
                                });
                            }) : w(v);
                        }
                        if (r.instantiateWasm) try {
                            var k = r.instantiateWasm(u, c);
                            return k;
                        } catch (D) {
                            _e("Module.instantiateWasm callback failed with error: " + D), j(D);
                        }
                        return C().catch(j), {};
                    }
                    function Or(u) {
                        this.name = "ExitStatus", this.message = "Program terminated with exit(" + u + ")", this.status = u;
                    }
                    function gr(u) {
                        for(; u.length > 0;)u.shift()(r);
                    }
                    function yr(u) {
                        this.excPtr = u, this.ptr = u - 24, this.set_type = function(c) {
                            ie[this.ptr + 4 >> 2] = c;
                        }, this.get_type = function() {
                            return ie[this.ptr + 4 >> 2];
                        }, this.set_destructor = function(c) {
                            ie[this.ptr + 8 >> 2] = c;
                        }, this.get_destructor = function() {
                            return ie[this.ptr + 8 >> 2];
                        }, this.set_refcount = function(c) {
                            ue[this.ptr >> 2] = c;
                        }, this.set_caught = function(c) {
                            c = c ? 1 : 0, Ge[this.ptr + 12 >> 0] = c;
                        }, this.get_caught = function() {
                            return Ge[this.ptr + 12 >> 0] != 0;
                        }, this.set_rethrown = function(c) {
                            c = c ? 1 : 0, Ge[this.ptr + 13 >> 0] = c;
                        }, this.get_rethrown = function() {
                            return Ge[this.ptr + 13 >> 0] != 0;
                        }, this.init = function(c, v) {
                            this.set_adjusted_ptr(0), this.set_type(c), this.set_destructor(v), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
                        }, this.add_ref = function() {
                            var c = ue[this.ptr >> 2];
                            ue[this.ptr >> 2] = c + 1;
                        }, this.release_ref = function() {
                            var c = ue[this.ptr >> 2];
                            return ue[this.ptr >> 2] = c - 1, c === 1;
                        }, this.set_adjusted_ptr = function(c) {
                            ie[this.ptr + 16 >> 2] = c;
                        }, this.get_adjusted_ptr = function() {
                            return ie[this.ptr + 16 >> 2];
                        }, this.get_exception_ptr = function() {
                            var c = en(this.get_type());
                            if (c) return ie[this.excPtr >> 2];
                            var v = this.get_adjusted_ptr();
                            return v !== 0 ? v : this.excPtr;
                        };
                    }
                    function ar(u, c, v) {
                        var w = new yr(u);
                        throw w.init(c, v), u;
                    }
                    var At = {};
                    function Fr(u) {
                        for(; u.length;){
                            var c = u.pop(), v = u.pop();
                            v(c);
                        }
                    }
                    function _t(u) {
                        return this.fromWireType(ue[u >> 2]);
                    }
                    var ke = {}, De = {}, he = {}, Ne = 48, tt = 57;
                    function st(u) {
                        if (u === void 0) return "_unknown";
                        u = u.replace(/[^a-zA-Z0-9_]/g, "$");
                        var c = u.charCodeAt(0);
                        return c >= Ne && c <= tt ? "_" + u : u;
                    }
                    function _r(u, c) {
                        return u = st(u), new Function("body", "return function " + u + `() {
    "use strict";    return body.apply(this, arguments);
};
`)(c);
                    }
                    function Gt(u, c) {
                        var v = _r(c, function(w) {
                            this.name = c, this.message = w;
                            var C = new Error(w).stack;
                            C !== void 0 && (this.stack = this.toString() + `
` + C.replace(/^Error(:[^\n]*)?\n/, ""));
                        });
                        return v.prototype = Object.create(u.prototype), v.prototype.constructor = v, v.prototype.toString = function() {
                            return this.message === void 0 ? this.name : this.name + ": " + this.message;
                        }, v;
                    }
                    var It = void 0;
                    function mt(u) {
                        throw new It(u);
                    }
                    function He(u, c, v) {
                        u.forEach(function($) {
                            he[$] = c;
                        });
                        function w($) {
                            var F = v($);
                            F.length !== u.length && mt("Mismatched type converter count");
                            for(var x = 0; x < u.length; ++x)pe(u[x], F[x]);
                        }
                        var C = new Array(c.length), k = [], D = 0;
                        c.forEach(($, F)=>{
                            De.hasOwnProperty($) ? C[F] = De[$] : (k.push($), ke.hasOwnProperty($) || (ke[$] = []), ke[$].push(()=>{
                                C[F] = De[$], ++D, D === k.length && w(C);
                            }));
                        }), k.length === 0 && w(C);
                    }
                    function xt(u) {
                        var c = At[u];
                        delete At[u];
                        var v = c.rawConstructor, w = c.rawDestructor, C = c.fields, k = C.map((D)=>D.getterReturnType).concat(C.map((D)=>D.setterArgumentType));
                        He([
                            u
                        ], k, (D)=>{
                            var $ = {};
                            return C.forEach((F, x)=>{
                                var G = F.fieldName, J = D[x], K = F.getter, s = F.getterContext, a = D[x + C.length], p = F.setter, b = F.setterContext;
                                $[G] = {
                                    read: (T)=>J.fromWireType(K(s, T)),
                                    write: (T, U)=>{
                                        var O = [];
                                        p(b, T, a.toWireType(O, U)), Fr(O);
                                    }
                                };
                            }), [
                                {
                                    name: c.name,
                                    fromWireType: function(F) {
                                        var x = {};
                                        for(var G in $)x[G] = $[G].read(F);
                                        return w(F), x;
                                    },
                                    toWireType: function(F, x) {
                                        for(var G in $)if (!(G in x)) throw new TypeError('Missing field:  "' + G + '"');
                                        var J = v();
                                        for(G in $)$[G].write(J, x[G]);
                                        return F !== null && F.push(w, J), J;
                                    },
                                    argPackAdvance: 8,
                                    readValueFromPointer: _t,
                                    destructorFunction: w
                                }
                            ];
                        });
                    }
                    function Me(u, c, v, w, C) {}
                    function Le(u) {
                        switch(u){
                            case 1:
                                return 0;
                            case 2:
                                return 1;
                            case 4:
                                return 2;
                            case 8:
                                return 3;
                            default:
                                throw new TypeError("Unknown type size: " + u);
                        }
                    }
                    function $t() {
                        for(var u = new Array(256), c = 0; c < 256; ++c)u[c] = String.fromCharCode(c);
                        Rt = u;
                    }
                    var Rt = void 0;
                    function Ae(u) {
                        for(var c = "", v = u; ye[v];)c += Rt[ye[v++]];
                        return c;
                    }
                    var Et = void 0;
                    function Y(u) {
                        throw new Et(u);
                    }
                    function pe(u, c, v = {}) {
                        if (!("argPackAdvance" in c)) throw new TypeError("registerType registeredInstance requires argPackAdvance");
                        var w = c.name;
                        if (u || Y('type "' + w + '" must have a positive integer typeid pointer'), De.hasOwnProperty(u)) {
                            if (v.ignoreDuplicateRegistrations) return;
                            Y("Cannot register type '" + w + "' twice");
                        }
                        if (De[u] = c, delete he[u], ke.hasOwnProperty(u)) {
                            var C = ke[u];
                            delete ke[u], C.forEach((k)=>k());
                        }
                    }
                    function ne(u, c, v, w, C) {
                        var k = Le(v);
                        c = Ae(c), pe(u, {
                            name: c,
                            fromWireType: function(D) {
                                return !!D;
                            },
                            toWireType: function(D, $) {
                                return $ ? w : C;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: function(D) {
                                var $;
                                if (v === 1) $ = Ge;
                                else if (v === 2) $ = le;
                                else if (v === 4) $ = ue;
                                else throw new TypeError("Unknown boolean type size: " + c);
                                return this.fromWireType($[D >> k]);
                            },
                            destructorFunction: null
                        });
                    }
                    function Z(u) {
                        if (!(this instanceof wt) || !(u instanceof wt)) return !1;
                        for(var c = this.$$.ptrType.registeredClass, v = this.$$.ptr, w = u.$$.ptrType.registeredClass, C = u.$$.ptr; c.baseClass;)v = c.upcast(v), c = c.baseClass;
                        for(; w.baseClass;)C = w.upcast(C), w = w.baseClass;
                        return c === w && v === C;
                    }
                    function ze(u) {
                        return {
                            count: u.count,
                            deleteScheduled: u.deleteScheduled,
                            preservePointerOnDelete: u.preservePointerOnDelete,
                            ptr: u.ptr,
                            ptrType: u.ptrType,
                            smartPtr: u.smartPtr,
                            smartPtrType: u.smartPtrType
                        };
                    }
                    function ut(u) {
                        function c(v) {
                            return v.$$.ptrType.registeredClass.name;
                        }
                        Y(c(u) + " instance already deleted");
                    }
                    var mr = !1;
                    function sr(u) {}
                    function St(u) {
                        u.smartPtr ? u.smartPtrType.rawDestructor(u.smartPtr) : u.ptrType.registeredClass.rawDestructor(u.ptr);
                    }
                    function Jt(u) {
                        u.count.value -= 1;
                        var c = u.count.value === 0;
                        c && St(u);
                    }
                    function ur(u, c, v) {
                        if (c === v) return u;
                        if (v.baseClass === void 0) return null;
                        var w = ur(u, c, v.baseClass);
                        return w === null ? null : v.downcast(w);
                    }
                    var Re = {};
                    function bt() {
                        return Object.keys(Ke).length;
                    }
                    function se() {
                        var u = [];
                        for(var c in Ke)Ke.hasOwnProperty(c) && u.push(Ke[c]);
                        return u;
                    }
                    var je = [];
                    function br() {
                        for(; je.length;){
                            var u = je.pop();
                            u.$$.deleteScheduled = !1, u.delete();
                        }
                    }
                    var ct = void 0;
                    function kt(u) {
                        ct = u, je.length && ct && ct(br);
                    }
                    function ft() {
                        r.getInheritedInstanceCount = bt, r.getLiveInheritedInstances = se, r.flushPendingDeletes = br, r.setDelayFunction = kt;
                    }
                    var Ke = {};
                    function Ur(u, c) {
                        for(c === void 0 && Y("ptr should not be undefined"); u.baseClass;)c = u.upcast(c), u = u.baseClass;
                        return c;
                    }
                    function Xt(u, c) {
                        return c = Ur(u, c), Ke[c];
                    }
                    function lt(u, c) {
                        (!c.ptrType || !c.ptr) && mt("makeClassHandle requires ptr and ptrType");
                        var v = !!c.smartPtrType, w = !!c.smartPtr;
                        return v !== w && mt("Both smartPtrType and smartPtr must be specified"), c.count = {
                            value: 1
                        }, pt(Object.create(u, {
                            $$: {
                                value: c
                            }
                        }));
                    }
                    function jr(u) {
                        var c = this.getPointee(u);
                        if (!c) return this.destructor(u), null;
                        var v = Xt(this.registeredClass, c);
                        if (v !== void 0) {
                            if (v.$$.count.value === 0) return v.$$.ptr = c, v.$$.smartPtr = u, v.clone();
                            var w = v.clone();
                            return this.destructor(u), w;
                        }
                        function C() {
                            return this.isSmartPointer ? lt(this.registeredClass.instancePrototype, {
                                ptrType: this.pointeeType,
                                ptr: c,
                                smartPtrType: this,
                                smartPtr: u
                            }) : lt(this.registeredClass.instancePrototype, {
                                ptrType: this,
                                ptr: u
                            });
                        }
                        var k = this.registeredClass.getActualType(c), D = Re[k];
                        if (!D) return C.call(this);
                        var $;
                        this.isConst ? $ = D.constPointerType : $ = D.pointerType;
                        var F = ur(c, this.registeredClass, $.registeredClass);
                        return F === null ? C.call(this) : this.isSmartPointer ? lt($.registeredClass.instancePrototype, {
                            ptrType: $,
                            ptr: F,
                            smartPtrType: this,
                            smartPtr: u
                        }) : lt($.registeredClass.instancePrototype, {
                            ptrType: $,
                            ptr: F
                        });
                    }
                    function pt(u) {
                        return typeof FinalizationRegistry > "u" ? (pt = (c)=>c, u) : (mr = new FinalizationRegistry((c)=>{
                            Jt(c.$$);
                        }), pt = (c)=>{
                            var v = c.$$, w = !!v.smartPtr;
                            if (w) {
                                var C = {
                                    $$: v
                                };
                                mr.register(c, C, c);
                            }
                            return c;
                        }, sr = (c)=>mr.unregister(c), pt(u));
                    }
                    function cr() {
                        if (this.$$.ptr || ut(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
                        var u = pt(Object.create(Object.getPrototypeOf(this), {
                            $$: {
                                value: ze(this.$$)
                            }
                        }));
                        return u.$$.count.value += 1, u.$$.deleteScheduled = !1, u;
                    }
                    function Yt() {
                        this.$$.ptr || ut(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && Y("Object already scheduled for deletion"), sr(this), Jt(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
                    }
                    function dt() {
                        return !this.$$.ptr;
                    }
                    function wr() {
                        return this.$$.ptr || ut(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && Y("Object already scheduled for deletion"), je.push(this), je.length === 1 && ct && ct(br), this.$$.deleteScheduled = !0, this;
                    }
                    function Kt() {
                        wt.prototype.isAliasOf = Z, wt.prototype.clone = cr, wt.prototype.delete = Yt, wt.prototype.isDeleted = dt, wt.prototype.deleteLater = wr;
                    }
                    function wt() {}
                    function Ir(u, c, v) {
                        if (u[c].overloadTable === void 0) {
                            var w = u[c];
                            u[c] = function() {
                                return u[c].overloadTable.hasOwnProperty(arguments.length) || Y("Function '" + v + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + u[c].overloadTable + ")!"), u[c].overloadTable[arguments.length].apply(this, arguments);
                            }, u[c].overloadTable = [], u[c].overloadTable[w.argCount] = w;
                        }
                    }
                    function Ve(u, c, v) {
                        r.hasOwnProperty(u) ? ((v === void 0 || r[u].overloadTable !== void 0 && r[u].overloadTable[v] !== void 0) && Y("Cannot register public name '" + u + "' twice"), Ir(r, u, u), r.hasOwnProperty(v) && Y("Cannot register multiple overloads of a function with the same number of arguments (" + v + ")!"), r[u].overloadTable[v] = c) : (r[u] = c, v !== void 0 && (r[u].numArguments = v));
                    }
                    function vt(u, c, v, w, C, k, D, $) {
                        this.name = u, this.constructor = c, this.instancePrototype = v, this.rawDestructor = w, this.baseClass = C, this.getActualType = k, this.upcast = D, this.downcast = $, this.pureVirtualFunctions = [];
                    }
                    function fr(u, c, v) {
                        for(; c !== v;)c.upcast || Y("Expected null or instance of " + v.name + ", got an instance of " + c.name), u = c.upcast(u), c = c.baseClass;
                        return u;
                    }
                    function lr(u, c) {
                        if (c === null) return this.isReference && Y("null is not a valid " + this.name), 0;
                        c.$$ || Y('Cannot pass "' + qe(c) + '" as a ' + this.name), c.$$.ptr || Y("Cannot pass deleted object as a pointer of type " + this.name);
                        var v = c.$$.ptrType.registeredClass, w = fr(c.$$.ptr, v, this.registeredClass);
                        return w;
                    }
                    function Pr(u, c) {
                        var v;
                        if (c === null) return this.isReference && Y("null is not a valid " + this.name), this.isSmartPointer ? (v = this.rawConstructor(), u !== null && u.push(this.rawDestructor, v), v) : 0;
                        c.$$ || Y('Cannot pass "' + qe(c) + '" as a ' + this.name), c.$$.ptr || Y("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && c.$$.ptrType.isConst && Y("Cannot convert argument of type " + (c.$$.smartPtrType ? c.$$.smartPtrType.name : c.$$.ptrType.name) + " to parameter type " + this.name);
                        var w = c.$$.ptrType.registeredClass;
                        if (v = fr(c.$$.ptr, w, this.registeredClass), this.isSmartPointer) switch(c.$$.smartPtr === void 0 && Y("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy){
                            case 0:
                                c.$$.smartPtrType === this ? v = c.$$.smartPtr : Y("Cannot convert argument of type " + (c.$$.smartPtrType ? c.$$.smartPtrType.name : c.$$.ptrType.name) + " to parameter type " + this.name);
                                break;
                            case 1:
                                v = c.$$.smartPtr;
                                break;
                            case 2:
                                if (c.$$.smartPtrType === this) v = c.$$.smartPtr;
                                else {
                                    var C = c.clone();
                                    v = this.rawShare(v, nt.toHandle(function() {
                                        C.delete();
                                    })), u !== null && u.push(this.rawDestructor, v);
                                }
                                break;
                            default:
                                Y("Unsupporting sharing policy");
                        }
                        return v;
                    }
                    function Dt(u, c) {
                        if (c === null) return this.isReference && Y("null is not a valid " + this.name), 0;
                        c.$$ || Y('Cannot pass "' + qe(c) + '" as a ' + this.name), c.$$.ptr || Y("Cannot pass deleted object as a pointer of type " + this.name), c.$$.ptrType.isConst && Y("Cannot convert argument of type " + c.$$.ptrType.name + " to parameter type " + this.name);
                        var v = c.$$.ptrType.registeredClass, w = fr(c.$$.ptr, v, this.registeredClass);
                        return w;
                    }
                    function sn(u) {
                        return this.rawGetPointee && (u = this.rawGetPointee(u)), u;
                    }
                    function un(u) {
                        this.rawDestructor && this.rawDestructor(u);
                    }
                    function cn(u) {
                        u !== null && u.delete();
                    }
                    function fn() {
                        ht.prototype.getPointee = sn, ht.prototype.destructor = un, ht.prototype.argPackAdvance = 8, ht.prototype.readValueFromPointer = _t, ht.prototype.deleteObject = cn, ht.prototype.fromWireType = jr;
                    }
                    function ht(u, c, v, w, C, k, D, $, F, x, G) {
                        this.name = u, this.registeredClass = c, this.isReference = v, this.isConst = w, this.isSmartPointer = C, this.pointeeType = k, this.sharingPolicy = D, this.rawGetPointee = $, this.rawConstructor = F, this.rawShare = x, this.rawDestructor = G, !C && c.baseClass === void 0 ? w ? (this.toWireType = lr, this.destructorFunction = null) : (this.toWireType = Dt, this.destructorFunction = null) : this.toWireType = Pr;
                    }
                    function gt(u, c, v) {
                        r.hasOwnProperty(u) || mt("Replacing nonexistant public symbol"), r[u].overloadTable !== void 0 && v !== void 0 ? r[u].overloadTable[v] = c : (r[u] = c, r[u].argCount = v);
                    }
                    function rt(u, c, v) {
                        var w = r["dynCall_" + u];
                        return v && v.length ? w.apply(null, [
                            c
                        ].concat(v)) : w.call(null, c);
                    }
                    var Be = [];
                    function xr(u) {
                        var c = Be[u];
                        return c || (u >= Be.length && (Be.length = u + 1), Be[u] = c = Bt.get(u)), c;
                    }
                    function Wt(u, c, v) {
                        if (u.includes("j")) return rt(u, c, v);
                        var w = xr(c).apply(null, v);
                        return w;
                    }
                    function Qt(u, c) {
                        var v = [];
                        return function() {
                            return v.length = 0, Object.assign(v, arguments), Wt(u, c, v);
                        };
                    }
                    function Ee(u, c) {
                        u = Ae(u);
                        function v() {
                            return u.includes("j") ? Qt(u, c) : xr(c);
                        }
                        var w = v();
                        return typeof w != "function" && Y("unknown function pointer with signature " + u + ": " + c), w;
                    }
                    var Wr = void 0;
                    function Qe(u) {
                        var c = Mt(u), v = Ae(c);
                        return yt(c), v;
                    }
                    function Ie(u, c) {
                        var v = [], w = {};
                        function C(k) {
                            if (!w[k] && !De[k]) {
                                if (he[k]) {
                                    he[k].forEach(C);
                                    return;
                                }
                                v.push(k), w[k] = !0;
                            }
                        }
                        throw c.forEach(C), new Wr(u + ": " + v.map(Qe).join([
                            ", "
                        ]));
                    }
                    function Tr(u, c, v, w, C, k, D, $, F, x, G, J, K) {
                        G = Ae(G), k = Ee(C, k), $ && ($ = Ee(D, $)), x && (x = Ee(F, x)), K = Ee(J, K);
                        var s = st(G);
                        Ve(s, function() {
                            Ie("Cannot construct " + G + " due to unbound types", [
                                w
                            ]);
                        }), He([
                            u,
                            c,
                            v
                        ], w ? [
                            w
                        ] : [], function(a) {
                            a = a[0];
                            var p, b;
                            w ? (p = a.registeredClass, b = p.instancePrototype) : b = wt.prototype;
                            var T = _r(s, function() {
                                if (Object.getPrototypeOf(this) !== U) throw new Et("Use 'new' to construct " + G);
                                if (O.constructor_body === void 0) throw new Et(G + " has no accessible constructor");
                                var e = O.constructor_body[arguments.length];
                                if (e === void 0) throw new Et("Tried to invoke ctor of " + G + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(O.constructor_body).toString() + ") parameters instead!");
                                return e.apply(this, arguments);
                            }), U = Object.create(b, {
                                constructor: {
                                    value: T
                                }
                            });
                            T.prototype = U;
                            var O = new vt(G, T, U, K, p, k, $, x), E = new ht(G, O, !0, !1, !1), n = new ht(G + "*", O, !1, !1, !1), i = new ht(G + " const*", O, !1, !0, !1);
                            return Re[u] = {
                                pointerType: n,
                                constPointerType: i
                            }, gt(s, T), [
                                E,
                                n,
                                i
                            ];
                        });
                    }
                    function Ht(u, c) {
                        for(var v = [], w = 0; w < u; w++)v.push(ie[c + w * 4 >> 2]);
                        return v;
                    }
                    function Ze(u, c) {
                        if (!(u instanceof Function)) throw new TypeError("new_ called with constructor type " + typeof u + " which is not a function");
                        var v = _r(u.name || "unknownFunctionName", function() {});
                        v.prototype = u.prototype;
                        var w = new v, C = u.apply(w, c);
                        return C instanceof Object ? C : w;
                    }
                    function Zt(u, c, v, w, C) {
                        var k = c.length;
                        k < 2 && Y("argTypes array size mismatch! Must at least get return value and 'this' types!");
                        for(var D = c[1] !== null && v !== null, $ = !1, F = 1; F < c.length; ++F)if (c[F] !== null && c[F].destructorFunction === void 0) {
                            $ = !0;
                            break;
                        }
                        for(var x = c[0].name !== "void", G = "", J = "", F = 0; F < k - 2; ++F)G += (F !== 0 ? ", " : "") + "arg" + F, J += (F !== 0 ? ", " : "") + "arg" + F + "Wired";
                        var K = "return function " + st(u) + "(" + G + `) {
if (arguments.length !== ` + (k - 2) + `) {
throwBindingError('function ` + u + " called with ' + arguments.length + ' arguments, expected " + (k - 2) + ` args!');
}
`;
                        $ && (K += `var destructors = [];
`);
                        var s = $ ? "destructors" : "null", a = [
                            "throwBindingError",
                            "invoker",
                            "fn",
                            "runDestructors",
                            "retType",
                            "classParam"
                        ], p = [
                            Y,
                            w,
                            C,
                            Fr,
                            c[0],
                            c[1]
                        ];
                        D && (K += "var thisWired = classParam.toWireType(" + s + `, this);
`);
                        for(var F = 0; F < k - 2; ++F)K += "var arg" + F + "Wired = argType" + F + ".toWireType(" + s + ", arg" + F + "); // " + c[F + 2].name + `
`, a.push("argType" + F), p.push(c[F + 2]);
                        if (D && (J = "thisWired" + (J.length > 0 ? ", " : "") + J), K += (x ? "var rv = " : "") + "invoker(fn" + (J.length > 0 ? ", " : "") + J + `);
`, $) K += `runDestructors(destructors);
`;
                        else for(var F = D ? 1 : 2; F < c.length; ++F){
                            var b = F === 1 ? "thisWired" : "arg" + (F - 2) + "Wired";
                            c[F].destructorFunction !== null && (K += b + "_dtor(" + b + "); // " + c[F].name + `
`, a.push(b + "_dtor"), p.push(c[F].destructorFunction));
                        }
                        x && (K += `var ret = retType.fromWireType(rv);
return ret;
`), K += `}
`, a.push(K);
                        var T = Ze(Function, a).apply(null, p);
                        return T;
                    }
                    function Hr(u, c, v, w, C, k) {
                        Ue(c > 0);
                        var D = Ht(c, v);
                        C = Ee(w, C), He([], [
                            u
                        ], function($) {
                            $ = $[0];
                            var F = "constructor " + $.name;
                            if ($.registeredClass.constructor_body === void 0 && ($.registeredClass.constructor_body = []), $.registeredClass.constructor_body[c - 1] !== void 0) throw new Et("Cannot register multiple constructors with identical number of parameters (" + (c - 1) + ") for class '" + $.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
                            return $.registeredClass.constructor_body[c - 1] = ()=>{
                                Ie("Cannot construct " + $.name + " due to unbound types", D);
                            }, He([], D, function(x) {
                                return x.splice(1, 0, null), $.registeredClass.constructor_body[c - 1] = Zt(F, x, null, C, k), [];
                            }), [];
                        });
                    }
                    function Mr(u, c, v, w, C, k, D, $) {
                        var F = Ht(v, w);
                        c = Ae(c), k = Ee(C, k), He([], [
                            u
                        ], function(x) {
                            x = x[0];
                            var G = x.name + "." + c;
                            c.startsWith("@@") && (c = Symbol[c.substring(2)]), $ && x.registeredClass.pureVirtualFunctions.push(c);
                            function J() {
                                Ie("Cannot call " + G + " due to unbound types", F);
                            }
                            var K = x.registeredClass.instancePrototype, s = K[c];
                            return s === void 0 || s.overloadTable === void 0 && s.className !== x.name && s.argCount === v - 2 ? (J.argCount = v - 2, J.className = x.name, K[c] = J) : (Ir(K, c, G), K[c].overloadTable[v - 2] = J), He([], F, function(a) {
                                var p = Zt(G, a, x, k, D);
                                return K[c].overloadTable === void 0 ? (p.argCount = v - 2, K[c] = p) : K[c].overloadTable[v - 2] = p, [];
                            }), [];
                        });
                    }
                    var pr = [], me = [
                        {},
                        {
                            value: void 0
                        },
                        {
                            value: null
                        },
                        {
                            value: !0
                        },
                        {
                            value: !1
                        }
                    ];
                    function er(u) {
                        u > 4 && --me[u].refcount === 0 && (me[u] = void 0, pr.push(u));
                    }
                    function xe() {
                        for(var u = 0, c = 5; c < me.length; ++c)me[c] !== void 0 && ++u;
                        return u;
                    }
                    function Oe() {
                        for(var u = 5; u < me.length; ++u)if (me[u] !== void 0) return me[u];
                        return null;
                    }
                    function Lr() {
                        r.count_emval_handles = xe, r.get_first_emval = Oe;
                    }
                    var nt = {
                        toValue: (u)=>(u || Y("Cannot use deleted val. handle = " + u), me[u].value),
                        toHandle: (u)=>{
                            switch(u){
                                case void 0:
                                    return 1;
                                case null:
                                    return 2;
                                case !0:
                                    return 3;
                                case !1:
                                    return 4;
                                default:
                                    {
                                        var c = pr.length ? pr.pop() : me.length;
                                        return me[c] = {
                                            refcount: 1,
                                            value: u
                                        }, c;
                                    }
                            }
                        }
                    };
                    function ln(u, c) {
                        c = Ae(c), pe(u, {
                            name: c,
                            fromWireType: function(v) {
                                var w = nt.toValue(v);
                                return er(v), w;
                            },
                            toWireType: function(v, w) {
                                return nt.toHandle(w);
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: _t,
                            destructorFunction: null
                        });
                    }
                    function qe(u) {
                        if (u === null) return "null";
                        var c = typeof u;
                        return c === "object" || c === "array" || c === "function" ? u.toString() : "" + u;
                    }
                    function Pt(u, c) {
                        switch(c){
                            case 2:
                                return function(v) {
                                    return this.fromWireType(ae[v >> 2]);
                                };
                            case 3:
                                return function(v) {
                                    return this.fromWireType(oe[v >> 3]);
                                };
                            default:
                                throw new TypeError("Unknown float type: " + u);
                        }
                    }
                    function Cr(u, c, v) {
                        var w = Le(v);
                        c = Ae(c), pe(u, {
                            name: c,
                            fromWireType: function(C) {
                                return C;
                            },
                            toWireType: function(C, k) {
                                return k;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: Pt(c, w),
                            destructorFunction: null
                        });
                    }
                    function tr(u, c, v, w, C, k) {
                        var D = Ht(c, v);
                        u = Ae(u), C = Ee(w, C), Ve(u, function() {
                            Ie("Cannot call " + u + " due to unbound types", D);
                        }, c - 1), He([], D, function($) {
                            var F = [
                                $[0],
                                null
                            ].concat($.slice(1));
                            return gt(u, Zt(u, F, null, C, k), c - 1), [];
                        });
                    }
                    function et(u, c, v) {
                        switch(c){
                            case 0:
                                return v ? function(C) {
                                    return Ge[C];
                                } : function(C) {
                                    return ye[C];
                                };
                            case 1:
                                return v ? function(C) {
                                    return le[C >> 1];
                                } : function(C) {
                                    return fe[C >> 1];
                                };
                            case 2:
                                return v ? function(C) {
                                    return ue[C >> 2];
                                } : function(C) {
                                    return ie[C >> 2];
                                };
                            default:
                                throw new TypeError("Unknown integer type: " + u);
                        }
                    }
                    function Vr(u, c, v, w, C) {
                        c = Ae(c);
                        var k = Le(v), D = (J)=>J;
                        if (w === 0) {
                            var $ = 32 - 8 * v;
                            D = (J)=>J << $ >>> $;
                        }
                        var F = c.includes("unsigned"), x = (J, K)=>{}, G;
                        F ? G = function(J, K) {
                            return x(K, this.name), K >>> 0;
                        } : G = function(J, K) {
                            return x(K, this.name), K;
                        }, pe(u, {
                            name: c,
                            fromWireType: D,
                            toWireType: G,
                            argPackAdvance: 8,
                            readValueFromPointer: et(c, k, w !== 0),
                            destructorFunction: null
                        });
                    }
                    function pn(u, c, v) {
                        var w = [
                            Int8Array,
                            Uint8Array,
                            Int16Array,
                            Uint16Array,
                            Int32Array,
                            Uint32Array,
                            Float32Array,
                            Float64Array
                        ], C = w[c];
                        function k(D) {
                            D = D >> 2;
                            var $ = ie, F = $[D], x = $[D + 1];
                            return new C(ir, x, F);
                        }
                        v = Ae(v), pe(u, {
                            name: v,
                            fromWireType: k,
                            argPackAdvance: 8,
                            readValueFromPointer: k
                        }, {
                            ignoreDuplicateRegistrations: !0
                        });
                    }
                    function dn(u, c) {
                        c = Ae(c);
                        var v = c === "std::string";
                        pe(u, {
                            name: c,
                            fromWireType: function(w) {
                                var C = ie[w >> 2], k = w + 4, D;
                                if (v) for(var $ = k, F = 0; F <= C; ++F){
                                    var x = k + F;
                                    if (F == C || ye[x] == 0) {
                                        var G = x - $, J = Ft($, G);
                                        D === void 0 ? D = J : (D += "\0", D += J), $ = x + 1;
                                    }
                                }
                                else {
                                    for(var K = new Array(C), F = 0; F < C; ++F)K[F] = String.fromCharCode(ye[k + F]);
                                    D = K.join("");
                                }
                                return yt(w), D;
                            },
                            toWireType: function(w, C) {
                                C instanceof ArrayBuffer && (C = new Uint8Array(C));
                                var k, D = typeof C == "string";
                                D || C instanceof Uint8Array || C instanceof Uint8ClampedArray || C instanceof Int8Array || Y("Cannot pass non-string to std::string"), v && D ? k = vr(C) : k = C.length;
                                var $ = Ot(4 + k + 1), F = $ + 4;
                                if (ie[$ >> 2] = k, v && D) nr(C, F, k + 1);
                                else if (D) for(var x = 0; x < k; ++x){
                                    var G = C.charCodeAt(x);
                                    G > 255 && (yt(F), Y("String has UTF-16 code units that do not fit in 8 bits")), ye[F + x] = G;
                                }
                                else for(var x = 0; x < k; ++x)ye[F + x] = C[x];
                                return w !== null && w.push(yt, $), $;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: _t,
                            destructorFunction: function(w) {
                                yt(w);
                            }
                        });
                    }
                    var Br = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
                    function rr(u, c) {
                        for(var v = u, w = v >> 1, C = w + c / 2; !(w >= C) && fe[w];)++w;
                        if (v = w << 1, v - u > 32 && Br) return Br.decode(ye.subarray(u, v));
                        for(var k = "", D = 0; !(D >= c / 2); ++D){
                            var $ = le[u + D * 2 >> 1];
                            if ($ == 0) break;
                            k += String.fromCharCode($);
                        }
                        return k;
                    }
                    function Nr(u, c, v) {
                        if (v === void 0 && (v = 2147483647), v < 2) return 0;
                        v -= 2;
                        for(var w = c, C = v < u.length * 2 ? v / 2 : u.length, k = 0; k < C; ++k){
                            var D = u.charCodeAt(k);
                            le[c >> 1] = D, c += 2;
                        }
                        return le[c >> 1] = 0, c - w;
                    }
                    function Ar(u) {
                        return u.length * 2;
                    }
                    function vn(u, c) {
                        for(var v = 0, w = ""; !(v >= c / 4);){
                            var C = ue[u + v * 4 >> 2];
                            if (C == 0) break;
                            if (++v, C >= 65536) {
                                var k = C - 65536;
                                w += String.fromCharCode(55296 | k >> 10, 56320 | k & 1023);
                            } else w += String.fromCharCode(C);
                        }
                        return w;
                    }
                    function hn(u, c, v) {
                        if (v === void 0 && (v = 2147483647), v < 4) return 0;
                        for(var w = c, C = w + v - 4, k = 0; k < u.length; ++k){
                            var D = u.charCodeAt(k);
                            if (D >= 55296 && D <= 57343) {
                                var $ = u.charCodeAt(++k);
                                D = 65536 + ((D & 1023) << 10) | $ & 1023;
                            }
                            if (ue[c >> 2] = D, c += 4, c + 4 > C) break;
                        }
                        return ue[c >> 2] = 0, c - w;
                    }
                    function gn(u) {
                        for(var c = 0, v = 0; v < u.length; ++v){
                            var w = u.charCodeAt(v);
                            w >= 55296 && w <= 57343 && ++v, c += 4;
                        }
                        return c;
                    }
                    function yn(u, c, v) {
                        v = Ae(v);
                        var w, C, k, D, $;
                        c === 2 ? (w = rr, C = Nr, D = Ar, k = ()=>fe, $ = 1) : c === 4 && (w = vn, C = hn, D = gn, k = ()=>ie, $ = 2), pe(u, {
                            name: v,
                            fromWireType: function(F) {
                                for(var x = ie[F >> 2], G = k(), J, K = F + 4, s = 0; s <= x; ++s){
                                    var a = F + 4 + s * c;
                                    if (s == x || G[a >> $] == 0) {
                                        var p = a - K, b = w(K, p);
                                        J === void 0 ? J = b : (J += "\0", J += b), K = a + c;
                                    }
                                }
                                return yt(F), J;
                            },
                            toWireType: function(F, x) {
                                typeof x != "string" && Y("Cannot pass non-string to C++ string type " + v);
                                var G = D(x), J = Ot(4 + G + c);
                                return ie[J >> 2] = G >> $, C(x, J + 4, G + c), F !== null && F.push(yt, J), J;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: _t,
                            destructorFunction: function(F) {
                                yt(F);
                            }
                        });
                    }
                    function _n(u, c, v, w, C, k) {
                        At[u] = {
                            name: Ae(c),
                            rawConstructor: Ee(v, w),
                            rawDestructor: Ee(C, k),
                            fields: []
                        };
                    }
                    function mn(u, c, v, w, C, k, D, $, F, x) {
                        At[u].fields.push({
                            fieldName: Ae(c),
                            getterReturnType: v,
                            getter: Ee(w, C),
                            getterContext: k,
                            setterArgumentType: D,
                            setter: Ee($, F),
                            setterContext: x
                        });
                    }
                    function bn(u, c) {
                        c = Ae(c), pe(u, {
                            isVoid: !0,
                            name: c,
                            argPackAdvance: 0,
                            fromWireType: function() {},
                            toWireType: function(v, w) {}
                        });
                    }
                    var zr = {};
                    function wn(u) {
                        var c = zr[u];
                        return c === void 0 ? Ae(u) : c;
                    }
                    function qr() {
                        return typeof globalThis == "object" ? globalThis : function() {
                            return Function;
                        }()("return this")();
                    }
                    function Gr(u) {
                        return u === 0 ? nt.toHandle(qr()) : (u = wn(u), nt.toHandle(qr()[u]));
                    }
                    function Pn(u) {
                        u > 4 && (me[u].refcount += 1);
                    }
                    function $r(u, c) {
                        var v = De[u];
                        return v === void 0 && Y(c + " has unknown type " + Qe(u)), v;
                    }
                    function Jr(u) {
                        for(var c = "", v = 0; v < u; ++v)c += (v !== 0 ? ", " : "") + "arg" + v;
                        for(var w = ()=>ie, C = "return function emval_allocator_" + u + `(constructor, argTypes, args) {
  var HEAPU32 = getMemory();
`, v = 0; v < u; ++v)C += "var argType" + v + " = requireRegisteredType(HEAPU32[((argTypes)>>2)], 'parameter " + v + `');
var arg` + v + " = argType" + v + `.readValueFromPointer(args);
args += argType` + v + `['argPackAdvance'];
argTypes += 4;
`;
                        return C += "var obj = new constructor(" + c + `);
return valueToHandle(obj);
}
`, new Function("requireRegisteredType", "Module", "valueToHandle", "getMemory", C)($r, r, nt.toHandle, w);
                    }
                    var Xr = {};
                    function Rr(u, c, v, w) {
                        u = nt.toValue(u);
                        var C = Xr[c];
                        return C || (C = Jr(c), Xr[c] = C), C(u, v, w);
                    }
                    function Tn(u, c) {
                        u = $r(u, "_emval_take_value");
                        var v = u.readValueFromPointer(c);
                        return nt.toHandle(v);
                    }
                    function Yr() {
                        ot("");
                    }
                    function Cn(u, c, v) {
                        ye.copyWithin(u, c, c + v);
                    }
                    function Kr() {
                        return 2147483648;
                    }
                    function An(u) {
                        try {
                            return we.grow(u - ir.byteLength + 65535 >>> 16), ve(we.buffer), 1;
                        } catch  {}
                    }
                    function $n(u) {
                        var c = ye.length;
                        u = u >>> 0;
                        var v = Kr();
                        if (u > v) return !1;
                        let w = (F, x)=>F + (x - F % x) % x;
                        for(var C = 1; C <= 4; C *= 2){
                            var k = c * (1 + .2 / C);
                            k = Math.min(k, u + 100663296);
                            var D = Math.min(v, w(Math.max(u, k), 65536)), $ = An(D);
                            if ($) return !0;
                        }
                        return !1;
                    }
                    function Rn(u) {
                        var c = r["_" + u];
                        return c;
                    }
                    function En(u, c) {
                        Ge.set(u, c);
                    }
                    function Er(u, c, v, w, C) {
                        var k = {
                            string: (a)=>{
                                var p = 0;
                                if (a != null && a !== 0) {
                                    var b = (a.length << 2) + 1;
                                    p = kr(b), nr(a, p, b);
                                }
                                return p;
                            },
                            array: (a)=>{
                                var p = kr(a.length);
                                return En(a, p), p;
                            }
                        };
                        function D(a) {
                            return c === "string" ? Ft(a) : c === "boolean" ? !!a : a;
                        }
                        var $ = Rn(u), F = [], x = 0;
                        if (w) for(var G = 0; G < w.length; G++){
                            var J = k[v[G]];
                            J ? (x === 0 && (x = Qr()), F[G] = J(w[G])) : F[G] = w[G];
                        }
                        var K = $.apply(null, F);
                        function s(a) {
                            return x !== 0 && Zr(x), D(a);
                        }
                        return K = s(K), K;
                    }
                    It = r.InternalError = Gt(Error, "InternalError"), $t(), Et = r.BindingError = Gt(Error, "BindingError"), Kt(), ft(), fn(), Wr = r.UnboundTypeError = Gt(Error, "UnboundTypeError"), Lr();
                    var Sr = {
                        h: ar,
                        q: xt,
                        r: Me,
                        w: ne,
                        p: Tr,
                        o: Hr,
                        c: Mr,
                        v: ln,
                        k: Cr,
                        e: tr,
                        b: Vr,
                        a: pn,
                        j: dn,
                        g: yn,
                        u: _n,
                        d: mn,
                        x: bn,
                        i: er,
                        m: Gr,
                        l: Pn,
                        y: Rr,
                        n: Tn,
                        f: Yr,
                        t: Cn,
                        s: $n
                    };
                    Se(), r.___wasm_call_ctors = function() {
                        return (r.___wasm_call_ctors = r.asm.A).apply(null, arguments);
                    };
                    var Ot = r._malloc = function() {
                        return (Ot = r._malloc = r.asm.B).apply(null, arguments);
                    }, Mt = r.___getTypeName = function() {
                        return (Mt = r.___getTypeName = r.asm.D).apply(null, arguments);
                    };
                    r.__embind_initialize_bindings = function() {
                        return (r.__embind_initialize_bindings = r.asm.E).apply(null, arguments);
                    };
                    var yt = r._free = function() {
                        return (yt = r._free = r.asm.F).apply(null, arguments);
                    }, Qr = r.stackSave = function() {
                        return (Qr = r.stackSave = r.asm.G).apply(null, arguments);
                    }, Zr = r.stackRestore = function() {
                        return (Zr = r.stackRestore = r.asm.H).apply(null, arguments);
                    }, kr = r.stackAlloc = function() {
                        return (kr = r.stackAlloc = r.asm.I).apply(null, arguments);
                    }, en = r.___cxa_is_pointer_type = function() {
                        return (en = r.___cxa_is_pointer_type = r.asm.J).apply(null, arguments);
                    };
                    r.ccall = Er;
                    var dr;
                    Je = function u() {
                        dr || tn(), dr || (Je = u);
                    };
                    function tn(u) {
                        if (Ct > 0 || (or(), Ct > 0)) return;
                        function c() {
                            dr || (dr = !0, r.calledRun = !0, !Pe && (hr(), L(r), r.onRuntimeInitialized && r.onRuntimeInitialized(), Dr()));
                        }
                        r.setStatus ? (r.setStatus("Running..."), setTimeout(function() {
                            setTimeout(function() {
                                r.setStatus("");
                            }, 1), c();
                        }, 1)) : c();
                    }
                    if (r.preInit) for(typeof r.preInit == "function" && (r.preInit = [
                        r.preInit
                    ]); r.preInit.length > 0;)r.preInit.pop()();
                    return tn(), A.ready;
                };
            })();
            f.exports = _;
        }(Jn)), Jn.exports;
    }
    var ro = to(), no = zn(ro);
    const io = new URL("/assets/charlswasm_decode-484ovEoR.wasm", import.meta.url), On = {
        codec: void 0,
        decoder: void 0,
        decodeConfig: {}
    };
    function oo(f) {
        return typeof f == "number" ? On.codec.getExceptionMessage(f) : f;
    }
    function ao(f) {
        if (On.decodeConfig = f, On.codec) return Promise.resolve();
        const y = no({
            locateFile: (_)=>_.endsWith(".wasm") ? io.toString() : _
        });
        return new Promise((_, R)=>{
            y.then((A)=>{
                On.codec = A, On.decoder = new A.JpegLSDecoder, _();
            }, R);
        });
    }
    async function si(f, y) {
        try {
            await ao();
            const _ = On.decoder;
            _.getEncodedBuffer(f.length).set(f), _.decode();
            const A = _.getFrameInfo(), r = _.getInterleaveMode(), L = _.getNearLossless(), j = _.getDecodedBuffer(), W = {
                columns: A.width,
                rows: A.height,
                bitsPerPixel: A.bitsPerSample,
                signed: y.signed,
                bytesPerPixel: y.bytesPerPixel,
                componentsPerPixel: A.componentCount
            }, N = so(A, j, y.signed), M = {
                nearLossless: L,
                interleaveMode: r,
                frameInfo: A
            };
            return {
                ...y,
                pixelData: N,
                imageInfo: W,
                encodeOptions: M,
                ...M,
                ...W
            };
        } catch (_) {
            throw oo(_);
        }
    }
    function so(f, y, _) {
        return f.bitsPerSample > 8 ? _ ? new Int16Array(y.buffer, y.byteOffset, y.byteLength / 2) : new Uint16Array(y.buffer, y.byteOffset, y.byteLength / 2) : _ ? new Int8Array(y.buffer, y.byteOffset, y.byteLength) : new Uint8Array(y.buffer, y.byteOffset, y.byteLength);
    }
    var Xn = {
        exports: {}
    }, ui;
    function uo() {
        return ui || (ui = 1, function(f, y) {
            var _ = (()=>{
                var R = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
                return typeof __filename < "u" && (R = R || __filename), function(A) {
                    A = A || {};
                    var r = typeof A < "u" ? A : {}, L, j;
                    r.ready = new Promise(function(s, a) {
                        L = s, j = a;
                    });
                    var W = Object.assign({}, r), N = "./this.program", M = typeof window == "object", z = typeof importScripts == "function", H = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string", X = "";
                    function q(s) {
                        return r.locateFile ? r.locateFile(s, X) : X + s;
                    }
                    var te, ce, $e;
                    if (H) {
                        var Q = rn, _e = rn;
                        z ? X = _e.dirname(X) + "/" : X = __dirname + "/", te = (s, a)=>(s = be(s) ? new URL(s) : _e.normalize(s), Q.readFileSync(s, a ? void 0 : "utf8")), $e = (s)=>{
                            var a = te(s, !0);
                            return a.buffer || (a = new Uint8Array(a)), a;
                        }, ce = (s, a, p)=>{
                            s = be(s) ? new URL(s) : _e.normalize(s), Q.readFile(s, function(b, T) {
                                b ? p(b) : a(T.buffer);
                            });
                        }, process.argv.length > 1 && (N = process.argv[1].replace(/\\/g, "/")), process.argv.slice(2), process.on("uncaughtException", function(s) {
                            if (!(s instanceof yr)) throw s;
                        }), process.on("unhandledRejection", function(s) {
                            throw s;
                        }), r.inspect = function() {
                            return "[Emscripten Module object]";
                        };
                    } else (M || z) && (z ? X = self.location.href : typeof document < "u" && document.currentScript && (X = document.currentScript.src), R && (X = R), X.indexOf("blob:") !== 0 ? X = X.substr(0, X.replace(/[?#].*/, "").lastIndexOf("/") + 1) : X = "", te = (s)=>{
                        var a = new XMLHttpRequest;
                        return a.open("GET", s, !1), a.send(null), a.responseText;
                    }, z && ($e = (s)=>{
                        var a = new XMLHttpRequest;
                        return a.open("GET", s, !1), a.responseType = "arraybuffer", a.send(null), new Uint8Array(a.response);
                    }), ce = (s, a, p)=>{
                        var b = new XMLHttpRequest;
                        b.open("GET", s, !0), b.responseType = "arraybuffer", b.onload = ()=>{
                            if (b.status == 200 || b.status == 0 && b.response) {
                                a(b.response);
                                return;
                            }
                            p();
                        }, b.onerror = p, b.send(null);
                    });
                    var ge = r.print || console.log.bind(console), we = r.printErr || console.warn.bind(console);
                    Object.assign(r, W), W = null, r.arguments && r.arguments, r.thisProgram && (N = r.thisProgram), r.quit && r.quit;
                    var Pe;
                    r.wasmBinary && (Pe = r.wasmBinary), r.noExitRuntime, typeof WebAssembly != "object" && jt("no native wasm support detected");
                    var Ue, it = !1;
                    function Vt(s, a) {
                        s || jt(a);
                    }
                    var Ft = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
                    function Tt(s, a, p) {
                        for(var b = a + p, T = a; s[T] && !(T >= b);)++T;
                        if (T - a > 16 && s.buffer && Ft) return Ft.decode(s.subarray(a, T));
                        for(var U = ""; a < T;){
                            var O = s[a++];
                            if (!(O & 128)) {
                                U += String.fromCharCode(O);
                                continue;
                            }
                            var E = s[a++] & 63;
                            if ((O & 224) == 192) {
                                U += String.fromCharCode((O & 31) << 6 | E);
                                continue;
                            }
                            var n = s[a++] & 63;
                            if ((O & 240) == 224 ? O = (O & 15) << 12 | E << 6 | n : O = (O & 7) << 18 | E << 12 | n << 6 | s[a++] & 63, O < 65536) U += String.fromCharCode(O);
                            else {
                                var i = O - 65536;
                                U += String.fromCharCode(55296 | i >> 10, 56320 | i & 1023);
                            }
                        }
                        return U;
                    }
                    function nr(s, a) {
                        return s ? Tt(fe, s, a) : "";
                    }
                    function vr(s, a, p, b) {
                        if (!(b > 0)) return 0;
                        for(var T = p, U = p + b - 1, O = 0; O < s.length; ++O){
                            var E = s.charCodeAt(O);
                            if (E >= 55296 && E <= 57343) {
                                var n = s.charCodeAt(++O);
                                E = 65536 + ((E & 1023) << 10) | n & 1023;
                            }
                            if (E <= 127) {
                                if (p >= U) break;
                                a[p++] = E;
                            } else if (E <= 2047) {
                                if (p + 1 >= U) break;
                                a[p++] = 192 | E >> 6, a[p++] = 128 | E & 63;
                            } else if (E <= 65535) {
                                if (p + 2 >= U) break;
                                a[p++] = 224 | E >> 12, a[p++] = 128 | E >> 6 & 63, a[p++] = 128 | E & 63;
                            } else {
                                if (p + 3 >= U) break;
                                a[p++] = 240 | E >> 18, a[p++] = 128 | E >> 12 & 63, a[p++] = 128 | E >> 6 & 63, a[p++] = 128 | E & 63;
                            }
                        }
                        return a[p] = 0, p - T;
                    }
                    function ir(s, a, p) {
                        return vr(s, fe, a, p);
                    }
                    function Ge(s) {
                        for(var a = 0, p = 0; p < s.length; ++p){
                            var b = s.charCodeAt(p);
                            b <= 127 ? a++ : b <= 2047 ? a += 2 : b >= 55296 && b <= 57343 ? (a += 4, ++p) : a += 3;
                        }
                        return a;
                    }
                    var ye, le, fe, ue, ie, ae, oe, ve, Bt;
                    function Nt(s) {
                        ye = s, r.HEAP8 = le = new Int8Array(s), r.HEAP16 = ue = new Int16Array(s), r.HEAP32 = ae = new Int32Array(s), r.HEAPU8 = fe = new Uint8Array(s), r.HEAPU16 = ie = new Uint16Array(s), r.HEAPU32 = oe = new Uint32Array(s), r.HEAPF32 = ve = new Float32Array(s), r.HEAPF64 = Bt = new Float64Array(s);
                    }
                    r.INITIAL_MEMORY;
                    var zt, qt = [], or = [], hr = [];
                    function Dr() {
                        if (r.preRun) for(typeof r.preRun == "function" && (r.preRun = [
                            r.preRun
                        ]); r.preRun.length;)an(r.preRun.shift());
                        ar(qt);
                    }
                    function nn() {
                        ar(or);
                    }
                    function on() {
                        if (r.postRun) for(typeof r.postRun == "function" && (r.postRun = [
                            r.postRun
                        ]); r.postRun.length;)Je(r.postRun.shift());
                        ar(hr);
                    }
                    function an(s) {
                        qt.unshift(s);
                    }
                    function Ct(s) {
                        or.unshift(s);
                    }
                    function Je(s) {
                        hr.unshift(s);
                    }
                    var Xe = 0, Ye = null;
                    function ot(s) {
                        Xe++, r.monitorRunDependencies && r.monitorRunDependencies(Xe);
                    }
                    function Ut(s) {
                        if (Xe--, r.monitorRunDependencies && r.monitorRunDependencies(Xe), Xe == 0 && Ye) {
                            var a = Ye;
                            Ye = null, a();
                        }
                    }
                    function jt(s) {
                        r.onAbort && r.onAbort(s), s = "Aborted(" + s + ")", we(s), it = !0, s += ". Build with -sASSERTIONS for more info.";
                        var a = new WebAssembly.RuntimeError(s);
                        throw j(a), a;
                    }
                    var at = "data:application/octet-stream;base64,";
                    function Te(s) {
                        return s.startsWith(at);
                    }
                    function be(s) {
                        return s.startsWith("file://");
                    }
                    var Ce;
                    Ce = "openjpegwasm_decode.wasm", Te(Ce) || (Ce = q(Ce));
                    function Se(s) {
                        try {
                            if (s == Ce && Pe) return new Uint8Array(Pe);
                            if ($e) return $e(s);
                            throw "both async and sync fetching of the wasm failed";
                        } catch (a) {
                            jt(a);
                        }
                    }
                    function Or() {
                        if (!Pe && (M || z)) {
                            if (typeof fetch == "function" && !be(Ce)) return fetch(Ce, {
                                credentials: "same-origin"
                            }).then(function(s) {
                                if (!s.ok) throw "failed to load wasm binary file at '" + Ce + "'";
                                return s.arrayBuffer();
                            }).catch(function() {
                                return Se(Ce);
                            });
                            if (ce) return new Promise(function(s, a) {
                                ce(Ce, function(p) {
                                    s(new Uint8Array(p));
                                }, a);
                            });
                        }
                        return Promise.resolve().then(function() {
                            return Se(Ce);
                        });
                    }
                    function gr() {
                        var s = {
                            a: w
                        };
                        function a(O, E) {
                            var n = O.exports;
                            r.asm = n, Ue = r.asm.E, Nt(Ue.buffer), zt = r.asm.G, Ct(r.asm.F), Ut();
                        }
                        ot();
                        function p(O) {
                            a(O.instance);
                        }
                        function b(O) {
                            return Or().then(function(E) {
                                return WebAssembly.instantiate(E, s);
                            }).then(function(E) {
                                return E;
                            }).then(O, function(E) {
                                we("failed to asynchronously prepare wasm: " + E), jt(E);
                            });
                        }
                        function T() {
                            return !Pe && typeof WebAssembly.instantiateStreaming == "function" && !Te(Ce) && !be(Ce) && !H && typeof fetch == "function" ? fetch(Ce, {
                                credentials: "same-origin"
                            }).then(function(O) {
                                var E = WebAssembly.instantiateStreaming(O, s);
                                return E.then(p, function(n) {
                                    return we("wasm streaming compile failed: " + n), we("falling back to ArrayBuffer instantiation"), b(p);
                                });
                            }) : b(p);
                        }
                        if (r.instantiateWasm) try {
                            var U = r.instantiateWasm(s, a);
                            return U;
                        } catch (O) {
                            we("Module.instantiateWasm callback failed with error: " + O), j(O);
                        }
                        return T().catch(j), {};
                    }
                    function yr(s) {
                        this.name = "ExitStatus", this.message = "Program terminated with exit(" + s + ")", this.status = s;
                    }
                    function ar(s) {
                        for(; s.length > 0;)s.shift()(r);
                    }
                    function At(s) {
                        this.excPtr = s, this.ptr = s - 24, this.set_type = function(a) {
                            oe[this.ptr + 4 >> 2] = a;
                        }, this.get_type = function() {
                            return oe[this.ptr + 4 >> 2];
                        }, this.set_destructor = function(a) {
                            oe[this.ptr + 8 >> 2] = a;
                        }, this.get_destructor = function() {
                            return oe[this.ptr + 8 >> 2];
                        }, this.set_refcount = function(a) {
                            ae[this.ptr >> 2] = a;
                        }, this.set_caught = function(a) {
                            a = a ? 1 : 0, le[this.ptr + 12 >> 0] = a;
                        }, this.get_caught = function() {
                            return le[this.ptr + 12 >> 0] != 0;
                        }, this.set_rethrown = function(a) {
                            a = a ? 1 : 0, le[this.ptr + 13 >> 0] = a;
                        }, this.get_rethrown = function() {
                            return le[this.ptr + 13 >> 0] != 0;
                        }, this.init = function(a, p) {
                            this.set_adjusted_ptr(0), this.set_type(a), this.set_destructor(p), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
                        }, this.add_ref = function() {
                            var a = ae[this.ptr >> 2];
                            ae[this.ptr >> 2] = a + 1;
                        }, this.release_ref = function() {
                            var a = ae[this.ptr >> 2];
                            return ae[this.ptr >> 2] = a - 1, a === 1;
                        }, this.set_adjusted_ptr = function(a) {
                            oe[this.ptr + 16 >> 2] = a;
                        }, this.get_adjusted_ptr = function() {
                            return oe[this.ptr + 16 >> 2];
                        }, this.get_exception_ptr = function() {
                            var a = G(this.get_type());
                            if (a) return oe[this.excPtr >> 2];
                            var p = this.get_adjusted_ptr();
                            return p !== 0 ? p : this.excPtr;
                        };
                    }
                    function Fr(s, a, p) {
                        var b = new At(s);
                        throw b.init(a, p), s;
                    }
                    var _t = {};
                    function ke(s) {
                        for(; s.length;){
                            var a = s.pop(), p = s.pop();
                            p(a);
                        }
                    }
                    function De(s) {
                        return this.fromWireType(ae[s >> 2]);
                    }
                    var he = {}, Ne = {}, tt = {}, st = 48, _r = 57;
                    function Gt(s) {
                        if (s === void 0) return "_unknown";
                        s = s.replace(/[^a-zA-Z0-9_]/g, "$");
                        var a = s.charCodeAt(0);
                        return a >= st && a <= _r ? "_" + s : s;
                    }
                    function It(s, a) {
                        return s = Gt(s), new Function("body", "return function " + s + `() {
    "use strict";    return body.apply(this, arguments);
};
`)(a);
                    }
                    function mt(s, a) {
                        var p = It(a, function(b) {
                            this.name = a, this.message = b;
                            var T = new Error(b).stack;
                            T !== void 0 && (this.stack = this.toString() + `
` + T.replace(/^Error(:[^\n]*)?\n/, ""));
                        });
                        return p.prototype = Object.create(s.prototype), p.prototype.constructor = p, p.prototype.toString = function() {
                            return this.message === void 0 ? this.name : this.name + ": " + this.message;
                        }, p;
                    }
                    var He = void 0;
                    function xt(s) {
                        throw new He(s);
                    }
                    function Me(s, a, p) {
                        s.forEach(function(E) {
                            tt[E] = a;
                        });
                        function b(E) {
                            var n = p(E);
                            n.length !== s.length && xt("Mismatched type converter count");
                            for(var i = 0; i < s.length; ++i)Z(s[i], n[i]);
                        }
                        var T = new Array(a.length), U = [], O = 0;
                        a.forEach((E, n)=>{
                            Ne.hasOwnProperty(E) ? T[n] = Ne[E] : (U.push(E), he.hasOwnProperty(E) || (he[E] = []), he[E].push(()=>{
                                T[n] = Ne[E], ++O, O === U.length && b(T);
                            }));
                        }), U.length === 0 && b(T);
                    }
                    function Le(s) {
                        var a = _t[s];
                        delete _t[s];
                        var p = a.rawConstructor, b = a.rawDestructor, T = a.fields, U = T.map((O)=>O.getterReturnType).concat(T.map((O)=>O.setterArgumentType));
                        Me([
                            s
                        ], U, (O)=>{
                            var E = {};
                            return T.forEach((n, i)=>{
                                var e = n.fieldName, t = O[i], o = n.getter, l = n.getterContext, d = O[i + T.length], h = n.setter, g = n.setterContext;
                                E[e] = {
                                    read: (m)=>t.fromWireType(o(l, m)),
                                    write: (m, P)=>{
                                        var S = [];
                                        h(g, m, d.toWireType(S, P)), ke(S);
                                    }
                                };
                            }), [
                                {
                                    name: a.name,
                                    fromWireType: function(n) {
                                        var i = {};
                                        for(var e in E)i[e] = E[e].read(n);
                                        return b(n), i;
                                    },
                                    toWireType: function(n, i) {
                                        for(var e in E)if (!(e in i)) throw new TypeError('Missing field:  "' + e + '"');
                                        var t = p();
                                        for(e in E)E[e].write(t, i[e]);
                                        return n !== null && n.push(b, t), t;
                                    },
                                    argPackAdvance: 8,
                                    readValueFromPointer: De,
                                    destructorFunction: b
                                }
                            ];
                        });
                    }
                    function $t(s, a, p, b, T) {}
                    function Rt(s) {
                        switch(s){
                            case 1:
                                return 0;
                            case 2:
                                return 1;
                            case 4:
                                return 2;
                            case 8:
                                return 3;
                            default:
                                throw new TypeError("Unknown type size: " + s);
                        }
                    }
                    function Ae() {
                        for(var s = new Array(256), a = 0; a < 256; ++a)s[a] = String.fromCharCode(a);
                        Et = s;
                    }
                    var Et = void 0;
                    function Y(s) {
                        for(var a = "", p = s; fe[p];)a += Et[fe[p++]];
                        return a;
                    }
                    var pe = void 0;
                    function ne(s) {
                        throw new pe(s);
                    }
                    function Z(s, a, p = {}) {
                        if (!("argPackAdvance" in a)) throw new TypeError("registerType registeredInstance requires argPackAdvance");
                        var b = a.name;
                        if (s || ne('type "' + b + '" must have a positive integer typeid pointer'), Ne.hasOwnProperty(s)) {
                            if (p.ignoreDuplicateRegistrations) return;
                            ne("Cannot register type '" + b + "' twice");
                        }
                        if (Ne[s] = a, delete tt[s], he.hasOwnProperty(s)) {
                            var T = he[s];
                            delete he[s], T.forEach((U)=>U());
                        }
                    }
                    function ze(s, a, p, b, T) {
                        var U = Rt(p);
                        a = Y(a), Z(s, {
                            name: a,
                            fromWireType: function(O) {
                                return !!O;
                            },
                            toWireType: function(O, E) {
                                return E ? b : T;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: function(O) {
                                var E;
                                if (p === 1) E = le;
                                else if (p === 2) E = ue;
                                else if (p === 4) E = ae;
                                else throw new TypeError("Unknown boolean type size: " + a);
                                return this.fromWireType(E[O >> U]);
                            },
                            destructorFunction: null
                        });
                    }
                    function ut(s) {
                        if (!(this instanceof Ve) || !(s instanceof Ve)) return !1;
                        for(var a = this.$$.ptrType.registeredClass, p = this.$$.ptr, b = s.$$.ptrType.registeredClass, T = s.$$.ptr; a.baseClass;)p = a.upcast(p), a = a.baseClass;
                        for(; b.baseClass;)T = b.upcast(T), b = b.baseClass;
                        return a === b && p === T;
                    }
                    function mr(s) {
                        return {
                            count: s.count,
                            deleteScheduled: s.deleteScheduled,
                            preservePointerOnDelete: s.preservePointerOnDelete,
                            ptr: s.ptr,
                            ptrType: s.ptrType,
                            smartPtr: s.smartPtr,
                            smartPtrType: s.smartPtrType
                        };
                    }
                    function sr(s) {
                        function a(p) {
                            return p.$$.ptrType.registeredClass.name;
                        }
                        ne(a(s) + " instance already deleted");
                    }
                    var St = !1;
                    function Jt(s) {}
                    function ur(s) {
                        s.smartPtr ? s.smartPtrType.rawDestructor(s.smartPtr) : s.ptrType.registeredClass.rawDestructor(s.ptr);
                    }
                    function Re(s) {
                        s.count.value -= 1;
                        var a = s.count.value === 0;
                        a && ur(s);
                    }
                    function bt(s, a, p) {
                        if (a === p) return s;
                        if (p.baseClass === void 0) return null;
                        var b = bt(s, a, p.baseClass);
                        return b === null ? null : p.downcast(b);
                    }
                    var se = {};
                    function je() {
                        return Object.keys(Xt).length;
                    }
                    function br() {
                        var s = [];
                        for(var a in Xt)Xt.hasOwnProperty(a) && s.push(Xt[a]);
                        return s;
                    }
                    var ct = [];
                    function kt() {
                        for(; ct.length;){
                            var s = ct.pop();
                            s.$$.deleteScheduled = !1, s.delete();
                        }
                    }
                    var ft = void 0;
                    function Ke(s) {
                        ft = s, ct.length && ft && ft(kt);
                    }
                    function Ur() {
                        r.getInheritedInstanceCount = je, r.getLiveInheritedInstances = br, r.flushPendingDeletes = kt, r.setDelayFunction = Ke;
                    }
                    var Xt = {};
                    function lt(s, a) {
                        for(a === void 0 && ne("ptr should not be undefined"); s.baseClass;)a = s.upcast(a), s = s.baseClass;
                        return a;
                    }
                    function jr(s, a) {
                        return a = lt(s, a), Xt[a];
                    }
                    function pt(s, a) {
                        (!a.ptrType || !a.ptr) && xt("makeClassHandle requires ptr and ptrType");
                        var p = !!a.smartPtrType, b = !!a.smartPtr;
                        return p !== b && xt("Both smartPtrType and smartPtr must be specified"), a.count = {
                            value: 1
                        }, Yt(Object.create(s, {
                            $$: {
                                value: a
                            }
                        }));
                    }
                    function cr(s) {
                        var a = this.getPointee(s);
                        if (!a) return this.destructor(s), null;
                        var p = jr(this.registeredClass, a);
                        if (p !== void 0) {
                            if (p.$$.count.value === 0) return p.$$.ptr = a, p.$$.smartPtr = s, p.clone();
                            var b = p.clone();
                            return this.destructor(s), b;
                        }
                        function T() {
                            return this.isSmartPointer ? pt(this.registeredClass.instancePrototype, {
                                ptrType: this.pointeeType,
                                ptr: a,
                                smartPtrType: this,
                                smartPtr: s
                            }) : pt(this.registeredClass.instancePrototype, {
                                ptrType: this,
                                ptr: s
                            });
                        }
                        var U = this.registeredClass.getActualType(a), O = se[U];
                        if (!O) return T.call(this);
                        var E;
                        this.isConst ? E = O.constPointerType : E = O.pointerType;
                        var n = bt(a, this.registeredClass, E.registeredClass);
                        return n === null ? T.call(this) : this.isSmartPointer ? pt(E.registeredClass.instancePrototype, {
                            ptrType: E,
                            ptr: n,
                            smartPtrType: this,
                            smartPtr: s
                        }) : pt(E.registeredClass.instancePrototype, {
                            ptrType: E,
                            ptr: n
                        });
                    }
                    function Yt(s) {
                        return typeof FinalizationRegistry > "u" ? (Yt = (a)=>a, s) : (St = new FinalizationRegistry((a)=>{
                            Re(a.$$);
                        }), Yt = (a)=>{
                            var p = a.$$, b = !!p.smartPtr;
                            if (b) {
                                var T = {
                                    $$: p
                                };
                                St.register(a, T, a);
                            }
                            return a;
                        }, Jt = (a)=>St.unregister(a), Yt(s));
                    }
                    function dt() {
                        if (this.$$.ptr || sr(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
                        var s = Yt(Object.create(Object.getPrototypeOf(this), {
                            $$: {
                                value: mr(this.$$)
                            }
                        }));
                        return s.$$.count.value += 1, s.$$.deleteScheduled = !1, s;
                    }
                    function wr() {
                        this.$$.ptr || sr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && ne("Object already scheduled for deletion"), Jt(this), Re(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
                    }
                    function Kt() {
                        return !this.$$.ptr;
                    }
                    function wt() {
                        return this.$$.ptr || sr(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && ne("Object already scheduled for deletion"), ct.push(this), ct.length === 1 && ft && ft(kt), this.$$.deleteScheduled = !0, this;
                    }
                    function Ir() {
                        Ve.prototype.isAliasOf = ut, Ve.prototype.clone = dt, Ve.prototype.delete = wr, Ve.prototype.isDeleted = Kt, Ve.prototype.deleteLater = wt;
                    }
                    function Ve() {}
                    function vt(s, a, p) {
                        if (s[a].overloadTable === void 0) {
                            var b = s[a];
                            s[a] = function() {
                                return s[a].overloadTable.hasOwnProperty(arguments.length) || ne("Function '" + p + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + s[a].overloadTable + ")!"), s[a].overloadTable[arguments.length].apply(this, arguments);
                            }, s[a].overloadTable = [], s[a].overloadTable[b.argCount] = b;
                        }
                    }
                    function fr(s, a, p) {
                        r.hasOwnProperty(s) ? (ne("Cannot register public name '" + s + "' twice"), vt(r, s, s), r.hasOwnProperty(p) && ne("Cannot register multiple overloads of a function with the same number of arguments (" + p + ")!"), r[s].overloadTable[p] = a) : r[s] = a;
                    }
                    function lr(s, a, p, b, T, U, O, E) {
                        this.name = s, this.constructor = a, this.instancePrototype = p, this.rawDestructor = b, this.baseClass = T, this.getActualType = U, this.upcast = O, this.downcast = E, this.pureVirtualFunctions = [];
                    }
                    function Pr(s, a, p) {
                        for(; a !== p;)a.upcast || ne("Expected null or instance of " + p.name + ", got an instance of " + a.name), s = a.upcast(s), a = a.baseClass;
                        return s;
                    }
                    function Dt(s, a) {
                        if (a === null) return this.isReference && ne("null is not a valid " + this.name), 0;
                        a.$$ || ne('Cannot pass "' + Cr(a) + '" as a ' + this.name), a.$$.ptr || ne("Cannot pass deleted object as a pointer of type " + this.name);
                        var p = a.$$.ptrType.registeredClass, b = Pr(a.$$.ptr, p, this.registeredClass);
                        return b;
                    }
                    function sn(s, a) {
                        var p;
                        if (a === null) return this.isReference && ne("null is not a valid " + this.name), this.isSmartPointer ? (p = this.rawConstructor(), s !== null && s.push(this.rawDestructor, p), p) : 0;
                        a.$$ || ne('Cannot pass "' + Cr(a) + '" as a ' + this.name), a.$$.ptr || ne("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && a.$$.ptrType.isConst && ne("Cannot convert argument of type " + (a.$$.smartPtrType ? a.$$.smartPtrType.name : a.$$.ptrType.name) + " to parameter type " + this.name);
                        var b = a.$$.ptrType.registeredClass;
                        if (p = Pr(a.$$.ptr, b, this.registeredClass), this.isSmartPointer) switch(a.$$.smartPtr === void 0 && ne("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy){
                            case 0:
                                a.$$.smartPtrType === this ? p = a.$$.smartPtr : ne("Cannot convert argument of type " + (a.$$.smartPtrType ? a.$$.smartPtrType.name : a.$$.ptrType.name) + " to parameter type " + this.name);
                                break;
                            case 1:
                                p = a.$$.smartPtr;
                                break;
                            case 2:
                                if (a.$$.smartPtrType === this) p = a.$$.smartPtr;
                                else {
                                    var T = a.clone();
                                    p = this.rawShare(p, qe.toHandle(function() {
                                        T.delete();
                                    })), s !== null && s.push(this.rawDestructor, p);
                                }
                                break;
                            default:
                                ne("Unsupporting sharing policy");
                        }
                        return p;
                    }
                    function un(s, a) {
                        if (a === null) return this.isReference && ne("null is not a valid " + this.name), 0;
                        a.$$ || ne('Cannot pass "' + Cr(a) + '" as a ' + this.name), a.$$.ptr || ne("Cannot pass deleted object as a pointer of type " + this.name), a.$$.ptrType.isConst && ne("Cannot convert argument of type " + a.$$.ptrType.name + " to parameter type " + this.name);
                        var p = a.$$.ptrType.registeredClass, b = Pr(a.$$.ptr, p, this.registeredClass);
                        return b;
                    }
                    function cn(s) {
                        return this.rawGetPointee && (s = this.rawGetPointee(s)), s;
                    }
                    function fn(s) {
                        this.rawDestructor && this.rawDestructor(s);
                    }
                    function ht(s) {
                        s !== null && s.delete();
                    }
                    function gt() {
                        rt.prototype.getPointee = cn, rt.prototype.destructor = fn, rt.prototype.argPackAdvance = 8, rt.prototype.readValueFromPointer = De, rt.prototype.deleteObject = ht, rt.prototype.fromWireType = cr;
                    }
                    function rt(s, a, p, b, T, U, O, E, n, i, e) {
                        this.name = s, this.registeredClass = a, this.isReference = p, this.isConst = b, this.isSmartPointer = T, this.pointeeType = U, this.sharingPolicy = O, this.rawGetPointee = E, this.rawConstructor = n, this.rawShare = i, this.rawDestructor = e, !T && a.baseClass === void 0 ? b ? (this.toWireType = Dt, this.destructorFunction = null) : (this.toWireType = un, this.destructorFunction = null) : this.toWireType = sn;
                    }
                    function Be(s, a, p) {
                        r.hasOwnProperty(s) || xt("Replacing nonexistant public symbol"), r[s].overloadTable !== void 0 && p !== void 0 || (r[s] = a, r[s].argCount = p);
                    }
                    function xr(s, a, p) {
                        var b = r["dynCall_" + s];
                        return p && p.length ? b.apply(null, [
                            a
                        ].concat(p)) : b.call(null, a);
                    }
                    var Wt = [];
                    function Qt(s) {
                        var a = Wt[s];
                        return a || (s >= Wt.length && (Wt.length = s + 1), Wt[s] = a = zt.get(s)), a;
                    }
                    function Ee(s, a, p) {
                        if (s.includes("j")) return xr(s, a, p);
                        var b = Qt(a).apply(null, p);
                        return b;
                    }
                    function Wr(s, a) {
                        var p = [];
                        return function() {
                            return p.length = 0, Object.assign(p, arguments), Ee(s, a, p);
                        };
                    }
                    function Qe(s, a) {
                        s = Y(s);
                        function p() {
                            return s.includes("j") ? Wr(s, a) : Qt(a);
                        }
                        var b = p();
                        return typeof b != "function" && ne("unknown function pointer with signature " + s + ": " + a), b;
                    }
                    var Ie = void 0;
                    function Tr(s) {
                        var a = D(s), p = Y(a);
                        return k(a), p;
                    }
                    function Ht(s, a) {
                        var p = [], b = {};
                        function T(U) {
                            if (!b[U] && !Ne[U]) {
                                if (tt[U]) {
                                    tt[U].forEach(T);
                                    return;
                                }
                                p.push(U), b[U] = !0;
                            }
                        }
                        throw a.forEach(T), new Ie(s + ": " + p.map(Tr).join([
                            ", "
                        ]));
                    }
                    function Ze(s, a, p, b, T, U, O, E, n, i, e, t, o) {
                        e = Y(e), U = Qe(T, U), E && (E = Qe(O, E)), i && (i = Qe(n, i)), o = Qe(t, o);
                        var l = Gt(e);
                        fr(l, function() {
                            Ht("Cannot construct " + e + " due to unbound types", [
                                b
                            ]);
                        }), Me([
                            s,
                            a,
                            p
                        ], b ? [
                            b
                        ] : [], function(d) {
                            d = d[0];
                            var h, g;
                            b ? (h = d.registeredClass, g = h.instancePrototype) : g = Ve.prototype;
                            var m = It(l, function() {
                                if (Object.getPrototypeOf(this) !== P) throw new pe("Use 'new' to construct " + e);
                                if (S.constructor_body === void 0) throw new pe(e + " has no accessible constructor");
                                var re = S.constructor_body[arguments.length];
                                if (re === void 0) throw new pe("Tried to invoke ctor of " + e + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(S.constructor_body).toString() + ") parameters instead!");
                                return re.apply(this, arguments);
                            }), P = Object.create(g, {
                                constructor: {
                                    value: m
                                }
                            });
                            m.prototype = P;
                            var S = new lr(e, m, P, o, h, U, E, i), I = new rt(e, S, !0, !1, !1), B = new rt(e + "*", S, !1, !1, !1), V = new rt(e + " const*", S, !1, !0, !1);
                            return se[s] = {
                                pointerType: B,
                                constPointerType: V
                            }, Be(l, m), [
                                I,
                                B,
                                V
                            ];
                        });
                    }
                    function Zt(s, a) {
                        for(var p = [], b = 0; b < s; b++)p.push(oe[a + b * 4 >> 2]);
                        return p;
                    }
                    function Hr(s, a) {
                        if (!(s instanceof Function)) throw new TypeError("new_ called with constructor type " + typeof s + " which is not a function");
                        var p = It(s.name || "unknownFunctionName", function() {});
                        p.prototype = s.prototype;
                        var b = new p, T = s.apply(b, a);
                        return T instanceof Object ? T : b;
                    }
                    function Mr(s, a, p, b, T) {
                        var U = a.length;
                        U < 2 && ne("argTypes array size mismatch! Must at least get return value and 'this' types!");
                        for(var O = a[1] !== null && p !== null, E = !1, n = 1; n < a.length; ++n)if (a[n] !== null && a[n].destructorFunction === void 0) {
                            E = !0;
                            break;
                        }
                        for(var i = a[0].name !== "void", e = "", t = "", n = 0; n < U - 2; ++n)e += (n !== 0 ? ", " : "") + "arg" + n, t += (n !== 0 ? ", " : "") + "arg" + n + "Wired";
                        var o = "return function " + Gt(s) + "(" + e + `) {
if (arguments.length !== ` + (U - 2) + `) {
throwBindingError('function ` + s + " called with ' + arguments.length + ' arguments, expected " + (U - 2) + ` args!');
}
`;
                        E && (o += `var destructors = [];
`);
                        var l = E ? "destructors" : "null", d = [
                            "throwBindingError",
                            "invoker",
                            "fn",
                            "runDestructors",
                            "retType",
                            "classParam"
                        ], h = [
                            ne,
                            b,
                            T,
                            ke,
                            a[0],
                            a[1]
                        ];
                        O && (o += "var thisWired = classParam.toWireType(" + l + `, this);
`);
                        for(var n = 0; n < U - 2; ++n)o += "var arg" + n + "Wired = argType" + n + ".toWireType(" + l + ", arg" + n + "); // " + a[n + 2].name + `
`, d.push("argType" + n), h.push(a[n + 2]);
                        if (O && (t = "thisWired" + (t.length > 0 ? ", " : "") + t), o += (i ? "var rv = " : "") + "invoker(fn" + (t.length > 0 ? ", " : "") + t + `);
`, E) o += `runDestructors(destructors);
`;
                        else for(var n = O ? 1 : 2; n < a.length; ++n){
                            var g = n === 1 ? "thisWired" : "arg" + (n - 2) + "Wired";
                            a[n].destructorFunction !== null && (o += g + "_dtor(" + g + "); // " + a[n].name + `
`, d.push(g + "_dtor"), h.push(a[n].destructorFunction));
                        }
                        i && (o += `var ret = retType.fromWireType(rv);
return ret;
`), o += `}
`, d.push(o);
                        var m = Hr(Function, d).apply(null, h);
                        return m;
                    }
                    function pr(s, a, p, b, T, U) {
                        Vt(a > 0);
                        var O = Zt(a, p);
                        T = Qe(b, T), Me([], [
                            s
                        ], function(E) {
                            E = E[0];
                            var n = "constructor " + E.name;
                            if (E.registeredClass.constructor_body === void 0 && (E.registeredClass.constructor_body = []), E.registeredClass.constructor_body[a - 1] !== void 0) throw new pe("Cannot register multiple constructors with identical number of parameters (" + (a - 1) + ") for class '" + E.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
                            return E.registeredClass.constructor_body[a - 1] = ()=>{
                                Ht("Cannot construct " + E.name + " due to unbound types", O);
                            }, Me([], O, function(i) {
                                return i.splice(1, 0, null), E.registeredClass.constructor_body[a - 1] = Mr(n, i, null, T, U), [];
                            }), [];
                        });
                    }
                    function me(s, a, p, b, T, U, O, E) {
                        var n = Zt(p, b);
                        a = Y(a), U = Qe(T, U), Me([], [
                            s
                        ], function(i) {
                            i = i[0];
                            var e = i.name + "." + a;
                            a.startsWith("@@") && (a = Symbol[a.substring(2)]), E && i.registeredClass.pureVirtualFunctions.push(a);
                            function t() {
                                Ht("Cannot call " + e + " due to unbound types", n);
                            }
                            var o = i.registeredClass.instancePrototype, l = o[a];
                            return l === void 0 || l.overloadTable === void 0 && l.className !== i.name && l.argCount === p - 2 ? (t.argCount = p - 2, t.className = i.name, o[a] = t) : (vt(o, a, e), o[a].overloadTable[p - 2] = t), Me([], n, function(d) {
                                var h = Mr(e, d, i, U, O);
                                return o[a].overloadTable === void 0 ? (h.argCount = p - 2, o[a] = h) : o[a].overloadTable[p - 2] = h, [];
                            }), [];
                        });
                    }
                    var er = [], xe = [
                        {},
                        {
                            value: void 0
                        },
                        {
                            value: null
                        },
                        {
                            value: !0
                        },
                        {
                            value: !1
                        }
                    ];
                    function Oe(s) {
                        s > 4 && --xe[s].refcount === 0 && (xe[s] = void 0, er.push(s));
                    }
                    function Lr() {
                        for(var s = 0, a = 5; a < xe.length; ++a)xe[a] !== void 0 && ++s;
                        return s;
                    }
                    function nt() {
                        for(var s = 5; s < xe.length; ++s)if (xe[s] !== void 0) return xe[s];
                        return null;
                    }
                    function ln() {
                        r.count_emval_handles = Lr, r.get_first_emval = nt;
                    }
                    var qe = {
                        toValue: (s)=>(s || ne("Cannot use deleted val. handle = " + s), xe[s].value),
                        toHandle: (s)=>{
                            switch(s){
                                case void 0:
                                    return 1;
                                case null:
                                    return 2;
                                case !0:
                                    return 3;
                                case !1:
                                    return 4;
                                default:
                                    {
                                        var a = er.length ? er.pop() : xe.length;
                                        return xe[a] = {
                                            refcount: 1,
                                            value: s
                                        }, a;
                                    }
                            }
                        }
                    };
                    function Pt(s, a) {
                        a = Y(a), Z(s, {
                            name: a,
                            fromWireType: function(p) {
                                var b = qe.toValue(p);
                                return Oe(p), b;
                            },
                            toWireType: function(p, b) {
                                return qe.toHandle(b);
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: De,
                            destructorFunction: null
                        });
                    }
                    function Cr(s) {
                        if (s === null) return "null";
                        var a = typeof s;
                        return a === "object" || a === "array" || a === "function" ? s.toString() : "" + s;
                    }
                    function tr(s, a) {
                        switch(a){
                            case 2:
                                return function(p) {
                                    return this.fromWireType(ve[p >> 2]);
                                };
                            case 3:
                                return function(p) {
                                    return this.fromWireType(Bt[p >> 3]);
                                };
                            default:
                                throw new TypeError("Unknown float type: " + s);
                        }
                    }
                    function et(s, a, p) {
                        var b = Rt(p);
                        a = Y(a), Z(s, {
                            name: a,
                            fromWireType: function(T) {
                                return T;
                            },
                            toWireType: function(T, U) {
                                return U;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: tr(a, b),
                            destructorFunction: null
                        });
                    }
                    function Vr(s, a, p) {
                        switch(a){
                            case 0:
                                return p ? function(T) {
                                    return le[T];
                                } : function(T) {
                                    return fe[T];
                                };
                            case 1:
                                return p ? function(T) {
                                    return ue[T >> 1];
                                } : function(T) {
                                    return ie[T >> 1];
                                };
                            case 2:
                                return p ? function(T) {
                                    return ae[T >> 2];
                                } : function(T) {
                                    return oe[T >> 2];
                                };
                            default:
                                throw new TypeError("Unknown integer type: " + s);
                        }
                    }
                    function pn(s, a, p, b, T) {
                        a = Y(a);
                        var U = Rt(p), O = (t)=>t;
                        if (b === 0) {
                            var E = 32 - 8 * p;
                            O = (t)=>t << E >>> E;
                        }
                        var n = a.includes("unsigned"), i = (t, o)=>{}, e;
                        n ? e = function(t, o) {
                            return i(o, this.name), o >>> 0;
                        } : e = function(t, o) {
                            return i(o, this.name), o;
                        }, Z(s, {
                            name: a,
                            fromWireType: O,
                            toWireType: e,
                            argPackAdvance: 8,
                            readValueFromPointer: Vr(a, U, b !== 0),
                            destructorFunction: null
                        });
                    }
                    function dn(s, a, p) {
                        var b = [
                            Int8Array,
                            Uint8Array,
                            Int16Array,
                            Uint16Array,
                            Int32Array,
                            Uint32Array,
                            Float32Array,
                            Float64Array
                        ], T = b[a];
                        function U(O) {
                            O = O >> 2;
                            var E = oe, n = E[O], i = E[O + 1];
                            return new T(ye, i, n);
                        }
                        p = Y(p), Z(s, {
                            name: p,
                            fromWireType: U,
                            argPackAdvance: 8,
                            readValueFromPointer: U
                        }, {
                            ignoreDuplicateRegistrations: !0
                        });
                    }
                    function Br(s, a) {
                        a = Y(a);
                        var p = a === "std::string";
                        Z(s, {
                            name: a,
                            fromWireType: function(b) {
                                var T = oe[b >> 2], U = b + 4, O;
                                if (p) for(var E = U, n = 0; n <= T; ++n){
                                    var i = U + n;
                                    if (n == T || fe[i] == 0) {
                                        var e = i - E, t = nr(E, e);
                                        O === void 0 ? O = t : (O += "\0", O += t), E = i + 1;
                                    }
                                }
                                else {
                                    for(var o = new Array(T), n = 0; n < T; ++n)o[n] = String.fromCharCode(fe[U + n]);
                                    O = o.join("");
                                }
                                return k(b), O;
                            },
                            toWireType: function(b, T) {
                                T instanceof ArrayBuffer && (T = new Uint8Array(T));
                                var U, O = typeof T == "string";
                                O || T instanceof Uint8Array || T instanceof Uint8ClampedArray || T instanceof Int8Array || ne("Cannot pass non-string to std::string"), p && O ? U = Ge(T) : U = T.length;
                                var E = C(4 + U + 1), n = E + 4;
                                if (oe[E >> 2] = U, p && O) ir(T, n, U + 1);
                                else if (O) for(var i = 0; i < U; ++i){
                                    var e = T.charCodeAt(i);
                                    e > 255 && (k(n), ne("String has UTF-16 code units that do not fit in 8 bits")), fe[n + i] = e;
                                }
                                else for(var i = 0; i < U; ++i)fe[n + i] = T[i];
                                return b !== null && b.push(k, E), E;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: De,
                            destructorFunction: function(b) {
                                k(b);
                            }
                        });
                    }
                    var rr = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
                    function Nr(s, a) {
                        for(var p = s, b = p >> 1, T = b + a / 2; !(b >= T) && ie[b];)++b;
                        if (p = b << 1, p - s > 32 && rr) return rr.decode(fe.subarray(s, p));
                        for(var U = "", O = 0; !(O >= a / 2); ++O){
                            var E = ue[s + O * 2 >> 1];
                            if (E == 0) break;
                            U += String.fromCharCode(E);
                        }
                        return U;
                    }
                    function Ar(s, a, p) {
                        if (p === void 0 && (p = 2147483647), p < 2) return 0;
                        p -= 2;
                        for(var b = a, T = p < s.length * 2 ? p / 2 : s.length, U = 0; U < T; ++U){
                            var O = s.charCodeAt(U);
                            ue[a >> 1] = O, a += 2;
                        }
                        return ue[a >> 1] = 0, a - b;
                    }
                    function vn(s) {
                        return s.length * 2;
                    }
                    function hn(s, a) {
                        for(var p = 0, b = ""; !(p >= a / 4);){
                            var T = ae[s + p * 4 >> 2];
                            if (T == 0) break;
                            if (++p, T >= 65536) {
                                var U = T - 65536;
                                b += String.fromCharCode(55296 | U >> 10, 56320 | U & 1023);
                            } else b += String.fromCharCode(T);
                        }
                        return b;
                    }
                    function gn(s, a, p) {
                        if (p === void 0 && (p = 2147483647), p < 4) return 0;
                        for(var b = a, T = b + p - 4, U = 0; U < s.length; ++U){
                            var O = s.charCodeAt(U);
                            if (O >= 55296 && O <= 57343) {
                                var E = s.charCodeAt(++U);
                                O = 65536 + ((O & 1023) << 10) | E & 1023;
                            }
                            if (ae[a >> 2] = O, a += 4, a + 4 > T) break;
                        }
                        return ae[a >> 2] = 0, a - b;
                    }
                    function yn(s) {
                        for(var a = 0, p = 0; p < s.length; ++p){
                            var b = s.charCodeAt(p);
                            b >= 55296 && b <= 57343 && ++p, a += 4;
                        }
                        return a;
                    }
                    function _n(s, a, p) {
                        p = Y(p);
                        var b, T, U, O, E;
                        a === 2 ? (b = Nr, T = Ar, O = vn, U = ()=>ie, E = 1) : a === 4 && (b = hn, T = gn, O = yn, U = ()=>oe, E = 2), Z(s, {
                            name: p,
                            fromWireType: function(n) {
                                for(var i = oe[n >> 2], e = U(), t, o = n + 4, l = 0; l <= i; ++l){
                                    var d = n + 4 + l * a;
                                    if (l == i || e[d >> E] == 0) {
                                        var h = d - o, g = b(o, h);
                                        t === void 0 ? t = g : (t += "\0", t += g), o = d + a;
                                    }
                                }
                                return k(n), t;
                            },
                            toWireType: function(n, i) {
                                typeof i != "string" && ne("Cannot pass non-string to C++ string type " + p);
                                var e = O(i), t = C(4 + e + a);
                                return oe[t >> 2] = e >> E, T(i, t + 4, e + a), n !== null && n.push(k, t), t;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: De,
                            destructorFunction: function(n) {
                                k(n);
                            }
                        });
                    }
                    function mn(s, a, p, b, T, U) {
                        _t[s] = {
                            name: Y(a),
                            rawConstructor: Qe(p, b),
                            rawDestructor: Qe(T, U),
                            fields: []
                        };
                    }
                    function bn(s, a, p, b, T, U, O, E, n, i) {
                        _t[s].fields.push({
                            fieldName: Y(a),
                            getterReturnType: p,
                            getter: Qe(b, T),
                            getterContext: U,
                            setterArgumentType: O,
                            setter: Qe(E, n),
                            setterContext: i
                        });
                    }
                    function zr(s, a) {
                        a = Y(a), Z(s, {
                            isVoid: !0,
                            name: a,
                            argPackAdvance: 0,
                            fromWireType: function() {},
                            toWireType: function(p, b) {}
                        });
                    }
                    var wn = {};
                    function qr(s) {
                        var a = wn[s];
                        return a === void 0 ? Y(s) : a;
                    }
                    function Gr() {
                        return typeof globalThis == "object" ? globalThis : function() {
                            return Function;
                        }()("return this")();
                    }
                    function Pn(s) {
                        return s === 0 ? qe.toHandle(Gr()) : (s = qr(s), qe.toHandle(Gr()[s]));
                    }
                    function $r(s) {
                        s > 4 && (xe[s].refcount += 1);
                    }
                    function Jr(s, a) {
                        var p = Ne[s];
                        return p === void 0 && ne(a + " has unknown type " + Tr(s)), p;
                    }
                    function Xr(s) {
                        for(var a = "", p = 0; p < s; ++p)a += (p !== 0 ? ", " : "") + "arg" + p;
                        for(var b = ()=>oe, T = "return function emval_allocator_" + s + `(constructor, argTypes, args) {
  var HEAPU32 = getMemory();
`, p = 0; p < s; ++p)T += "var argType" + p + " = requireRegisteredType(HEAPU32[((argTypes)>>2)], 'parameter " + p + `');
var arg` + p + " = argType" + p + `.readValueFromPointer(args);
args += argType` + p + `['argPackAdvance'];
argTypes += 4;
`;
                        return T += "var obj = new constructor(" + a + `);
return valueToHandle(obj);
}
`, new Function("requireRegisteredType", "Module", "valueToHandle", "getMemory", T)(Jr, r, qe.toHandle, b);
                    }
                    var Rr = {};
                    function Tn(s, a, p, b) {
                        s = qe.toValue(s);
                        var T = Rr[a];
                        return T || (T = Xr(a), Rr[a] = T), T(s, p, b);
                    }
                    function Yr(s, a) {
                        s = Jr(s, "_emval_take_value");
                        var p = s.readValueFromPointer(a);
                        return qe.toHandle(p);
                    }
                    function Cn() {
                        jt("");
                    }
                    function Kr() {
                        return 2147483648;
                    }
                    function An() {
                        return Kr();
                    }
                    function $n(s, a, p) {
                        fe.copyWithin(s, a, a + p);
                    }
                    function Rn(s) {
                        try {
                            return Ue.grow(s - ye.byteLength + 65535 >>> 16), Nt(Ue.buffer), 1;
                        } catch  {}
                    }
                    function En(s) {
                        var a = fe.length;
                        s = s >>> 0;
                        var p = Kr();
                        if (s > p) return !1;
                        let b = (n, i)=>n + (i - n % i) % i;
                        for(var T = 1; T <= 4; T *= 2){
                            var U = a * (1 + .2 / T);
                            U = Math.min(U, s + 100663296);
                            var O = Math.min(p, b(Math.max(s, U), 65536)), E = Rn(O);
                            if (E) return !0;
                        }
                        return !1;
                    }
                    var Er = {};
                    function Sr() {
                        return N || "./this.program";
                    }
                    function Ot() {
                        if (!Ot.strings) {
                            var s = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8", a = {
                                USER: "web_user",
                                LOGNAME: "web_user",
                                PATH: "/",
                                PWD: "/",
                                HOME: "/home/web_user",
                                LANG: s,
                                _: Sr()
                            };
                            for(var p in Er)Er[p] === void 0 ? delete a[p] : a[p] = Er[p];
                            var b = [];
                            for(var p in a)b.push(p + "=" + a[p]);
                            Ot.strings = b;
                        }
                        return Ot.strings;
                    }
                    function Mt(s, a, p) {
                        for(var b = 0; b < s.length; ++b)le[a++ >> 0] = s.charCodeAt(b);
                        le[a >> 0] = 0;
                    }
                    function yt(s, a) {
                        var p = 0;
                        return Ot().forEach(function(b, T) {
                            var U = a + p;
                            oe[s + T * 4 >> 2] = U, Mt(b, U), p += b.length + 1;
                        }), 0;
                    }
                    function Qr(s, a) {
                        var p = Ot();
                        oe[s >> 2] = p.length;
                        var b = 0;
                        return p.forEach(function(T) {
                            b += T.length + 1;
                        }), oe[a >> 2] = b, 0;
                    }
                    function Zr(s) {
                        return 52;
                    }
                    function kr(s, a, p, b, T) {
                        return 70;
                    }
                    var en = [
                        null,
                        [],
                        []
                    ];
                    function dr(s, a) {
                        var p = en[s];
                        a === 0 || a === 10 ? ((s === 1 ? ge : we)(Tt(p, 0)), p.length = 0) : p.push(a);
                    }
                    function tn(s, a, p, b) {
                        for(var T = 0, U = 0; U < p; U++){
                            var O = oe[a >> 2], E = oe[a + 4 >> 2];
                            a += 8;
                            for(var n = 0; n < E; n++)dr(s, fe[O + n]);
                            T += E;
                        }
                        return oe[b >> 2] = T, 0;
                    }
                    function u(s) {
                        var a = r["_" + s];
                        return a;
                    }
                    function c(s, a) {
                        le.set(s, a);
                    }
                    function v(s, a, p, b, T) {
                        var U = {
                            string: (d)=>{
                                var h = 0;
                                if (d != null && d !== 0) {
                                    var g = (d.length << 2) + 1;
                                    h = x(g), ir(d, h, g);
                                }
                                return h;
                            },
                            array: (d)=>{
                                var h = x(d.length);
                                return c(d, h), h;
                            }
                        };
                        function O(d) {
                            return a === "string" ? nr(d) : a === "boolean" ? !!d : d;
                        }
                        var E = u(s), n = [], i = 0;
                        if (b) for(var e = 0; e < b.length; e++){
                            var t = U[p[e]];
                            t ? (i === 0 && (i = $()), n[e] = t(b[e])) : n[e] = b[e];
                        }
                        var o = E.apply(null, n);
                        function l(d) {
                            return i !== 0 && F(i), O(d);
                        }
                        return o = l(o), o;
                    }
                    He = r.InternalError = mt(Error, "InternalError"), Ae(), pe = r.BindingError = mt(Error, "BindingError"), Ir(), Ur(), gt(), Ie = r.UnboundTypeError = mt(Error, "UnboundTypeError"), ln();
                    var w = {
                        D: Fr,
                        e: Le,
                        t: $t,
                        B: ze,
                        r: Ze,
                        q: pr,
                        b: me,
                        A: Pt,
                        l: et,
                        d: pn,
                        a: dn,
                        k: Br,
                        f: _n,
                        g: mn,
                        c: bn,
                        C: zr,
                        h: Oe,
                        o: Pn,
                        m: $r,
                        n: Tn,
                        p: Yr,
                        i: Cn,
                        v: An,
                        z: $n,
                        u: En,
                        w: yt,
                        x: Qr,
                        y: Zr,
                        s: kr,
                        j: tn
                    };
                    gr(), r.___wasm_call_ctors = function() {
                        return (r.___wasm_call_ctors = r.asm.F).apply(null, arguments);
                    };
                    var C = r._malloc = function() {
                        return (C = r._malloc = r.asm.H).apply(null, arguments);
                    }, k = r._free = function() {
                        return (k = r._free = r.asm.I).apply(null, arguments);
                    }, D = r.___getTypeName = function() {
                        return (D = r.___getTypeName = r.asm.J).apply(null, arguments);
                    };
                    r.__embind_initialize_bindings = function() {
                        return (r.__embind_initialize_bindings = r.asm.K).apply(null, arguments);
                    };
                    var $ = r.stackSave = function() {
                        return ($ = r.stackSave = r.asm.L).apply(null, arguments);
                    }, F = r.stackRestore = function() {
                        return (F = r.stackRestore = r.asm.M).apply(null, arguments);
                    }, x = r.stackAlloc = function() {
                        return (x = r.stackAlloc = r.asm.N).apply(null, arguments);
                    }, G = r.___cxa_is_pointer_type = function() {
                        return (G = r.___cxa_is_pointer_type = r.asm.O).apply(null, arguments);
                    };
                    r.dynCall_iji = function() {
                        return (r.dynCall_iji = r.asm.P).apply(null, arguments);
                    }, r.dynCall_jji = function() {
                        return (r.dynCall_jji = r.asm.Q).apply(null, arguments);
                    }, r.dynCall_iiji = function() {
                        return (r.dynCall_iiji = r.asm.R).apply(null, arguments);
                    }, r.dynCall_jiji = function() {
                        return (r.dynCall_jiji = r.asm.S).apply(null, arguments);
                    }, r.ccall = v;
                    var J;
                    Ye = function s() {
                        J || K(), J || (Ye = s);
                    };
                    function K(s) {
                        if (Xe > 0 || (Dr(), Xe > 0)) return;
                        function a() {
                            J || (J = !0, r.calledRun = !0, !it && (nn(), L(r), r.onRuntimeInitialized && r.onRuntimeInitialized(), on()));
                        }
                        r.setStatus ? (r.setStatus("Running..."), setTimeout(function() {
                            setTimeout(function() {
                                r.setStatus("");
                            }, 1), a();
                        }, 1)) : a();
                    }
                    if (r.preInit) for(typeof r.preInit == "function" && (r.preInit = [
                        r.preInit
                    ]); r.preInit.length > 0;)r.preInit.pop()();
                    return K(), A.ready;
                };
            })();
            f.exports = _;
        }(Xn)), Xn.exports;
    }
    var co = uo(), fo = zn(co);
    const lo = new URL("/assets/openjpegwasm_decode-C4nnCcr6.wasm", import.meta.url), Un = {
        codec: void 0,
        decoder: void 0,
        decodeConfig: {}
    };
    function po(f) {
        if (Un.decodeConfig = f, Un.codec) return Promise.resolve();
        const y = fo({
            locateFile: (_)=>_.endsWith(".wasm") ? lo.toString() : _
        });
        return new Promise((_, R)=>{
            y.then((A)=>{
                Un.codec = A, Un.decoder = new A.J2KDecoder, _();
            }, R);
        });
    }
    async function ci(f, y) {
        await po();
        const _ = Un.decoder, R = _.getEncodedBuffer(f.length);
        R.set(f), _.decode();
        const A = _.getFrameInfo(), r = _.getDecodedBuffer();
        new Uint8Array(r.length).set(r);
        const j = `x: ${_.getImageOffset().x}, y: ${_.getImageOffset().y}`, W = _.getNumDecompositions(), N = _.getNumLayers(), M = [
            "unknown",
            "LRCP",
            "RLCP",
            "RPCL",
            "PCRL",
            "CPRL"
        ][_.getProgressionOrder() + 1], z = _.getIsReversible(), H = `${_.getBlockDimensions().width} x ${_.getBlockDimensions().height}`, X = `${_.getTileSize().width} x ${_.getTileSize().height}`, q = `${_.getTileOffset().x}, ${_.getTileOffset().y}`, te = _.getColorSpace(), ce = `${r.length.toLocaleString()} bytes`, $e = `${(r.length / R.length).toFixed(2)}:1`, Q = {
            columns: A.width,
            rows: A.height,
            bitsPerPixel: A.bitsPerSample,
            signed: A.isSigned,
            bytesPerPixel: y.bytesPerPixel,
            componentsPerPixel: A.componentCount
        }, _e = vo(A, r), ge = {
            imageOffset: j,
            numDecompositions: W,
            numLayers: N,
            progessionOrder: M,
            reversible: z,
            blockDimensions: H,
            tileSize: X,
            tileOffset: q,
            colorTransform: te,
            decodedSize: ce,
            compressionRatio: $e
        };
        return {
            ...y,
            pixelData: _e,
            imageInfo: Q,
            encodeOptions: ge,
            ...ge,
            ...Q
        };
    }
    function vo(f, y) {
        return f.bitsPerSample > 8 ? f.isSigned ? new Int16Array(y.buffer, y.byteOffset, y.byteLength / 2) : new Uint16Array(y.buffer, y.byteOffset, y.byteLength / 2) : f.isSigned ? new Int8Array(y.buffer, y.byteOffset, y.byteLength) : new Uint8Array(y.buffer, y.byteOffset, y.byteLength);
    }
    var Yn = {
        exports: {}
    }, fi;
    function ho() {
        return fi || (fi = 1, function(f, y) {
            var _ = (()=>{
                var R = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
                return typeof __filename < "u" && (R = R || __filename), function(r) {
                    r = r || {};
                    var r = typeof r < "u" ? r : {}, L, j;
                    r.ready = new Promise(function(n, i) {
                        L = n, j = i;
                    });
                    var W = Object.assign({}, r), N = typeof window == "object", M = typeof importScripts == "function", z = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string", H = "";
                    function X(n) {
                        return r.locateFile ? r.locateFile(n, H) : H + n;
                    }
                    var q, te, ce;
                    if (z) {
                        var $e = rn, Q = rn;
                        M ? H = Q.dirname(H) + "/" : H = __dirname + "/", q = (n, i)=>(n = Te(n) ? new URL(n) : Q.normalize(n), $e.readFileSync(n, i ? void 0 : "utf8")), ce = (n)=>{
                            var i = q(n, !0);
                            return i.buffer || (i = new Uint8Array(i)), i;
                        }, te = (n, i, e)=>{
                            n = Te(n) ? new URL(n) : Q.normalize(n), $e.readFile(n, function(t, o) {
                                t ? e(t) : i(o.buffer);
                            });
                        }, process.argv.length > 1 && process.argv[1].replace(/\\/g, "/"), process.argv.slice(2), process.on("uncaughtException", function(n) {
                            if (!(n instanceof gr)) throw n;
                        }), process.on("unhandledRejection", function(n) {
                            throw n;
                        }), r.inspect = function() {
                            return "[Emscripten Module object]";
                        };
                    } else (N || M) && (M ? H = self.location.href : typeof document < "u" && document.currentScript && (H = document.currentScript.src), R && (H = R), H.indexOf("blob:") !== 0 ? H = H.substr(0, H.replace(/[?#].*/, "").lastIndexOf("/") + 1) : H = "", q = (n)=>{
                        var i = new XMLHttpRequest;
                        return i.open("GET", n, !1), i.send(null), i.responseText;
                    }, M && (ce = (n)=>{
                        var i = new XMLHttpRequest;
                        return i.open("GET", n, !1), i.responseType = "arraybuffer", i.send(null), new Uint8Array(i.response);
                    }), te = (n, i, e)=>{
                        var t = new XMLHttpRequest;
                        t.open("GET", n, !0), t.responseType = "arraybuffer", t.onload = ()=>{
                            if (t.status == 200 || t.status == 0 && t.response) {
                                i(t.response);
                                return;
                            }
                            e();
                        }, t.onerror = e, t.send(null);
                    });
                    var _e = r.print || console.log.bind(console), ge = r.printErr || console.warn.bind(console);
                    Object.assign(r, W), W = null, r.arguments && r.arguments, r.thisProgram && r.thisProgram, r.quit && r.quit;
                    var we;
                    r.wasmBinary && (we = r.wasmBinary), r.noExitRuntime, typeof WebAssembly != "object" && Ut("no native wasm support detected");
                    var Pe, Ue = !1;
                    function it(n, i) {
                        n || Ut(i);
                    }
                    var Vt = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
                    function Ft(n, i, e) {
                        for(var t = i + e, o = i; n[o] && !(o >= t);)++o;
                        if (o - i > 16 && n.buffer && Vt) return Vt.decode(n.subarray(i, o));
                        for(var l = ""; i < o;){
                            var d = n[i++];
                            if (!(d & 128)) {
                                l += String.fromCharCode(d);
                                continue;
                            }
                            var h = n[i++] & 63;
                            if ((d & 224) == 192) {
                                l += String.fromCharCode((d & 31) << 6 | h);
                                continue;
                            }
                            var g = n[i++] & 63;
                            if ((d & 240) == 224 ? d = (d & 15) << 12 | h << 6 | g : d = (d & 7) << 18 | h << 12 | g << 6 | n[i++] & 63, d < 65536) l += String.fromCharCode(d);
                            else {
                                var m = d - 65536;
                                l += String.fromCharCode(55296 | m >> 10, 56320 | m & 1023);
                            }
                        }
                        return l;
                    }
                    function Tt(n, i) {
                        return n ? Ft(le, n, i) : "";
                    }
                    function nr(n, i, e, t) {
                        if (!(t > 0)) return 0;
                        for(var o = e, l = e + t - 1, d = 0; d < n.length; ++d){
                            var h = n.charCodeAt(d);
                            if (h >= 55296 && h <= 57343) {
                                var g = n.charCodeAt(++d);
                                h = 65536 + ((h & 1023) << 10) | g & 1023;
                            }
                            if (h <= 127) {
                                if (e >= l) break;
                                i[e++] = h;
                            } else if (h <= 2047) {
                                if (e + 1 >= l) break;
                                i[e++] = 192 | h >> 6, i[e++] = 128 | h & 63;
                            } else if (h <= 65535) {
                                if (e + 2 >= l) break;
                                i[e++] = 224 | h >> 12, i[e++] = 128 | h >> 6 & 63, i[e++] = 128 | h & 63;
                            } else {
                                if (e + 3 >= l) break;
                                i[e++] = 240 | h >> 18, i[e++] = 128 | h >> 12 & 63, i[e++] = 128 | h >> 6 & 63, i[e++] = 128 | h & 63;
                            }
                        }
                        return i[e] = 0, e - o;
                    }
                    function vr(n, i, e) {
                        return nr(n, le, i, e);
                    }
                    function ir(n) {
                        for(var i = 0, e = 0; e < n.length; ++e){
                            var t = n.charCodeAt(e);
                            t <= 127 ? i++ : t <= 2047 ? i += 2 : t >= 55296 && t <= 57343 ? (i += 4, ++e) : i += 3;
                        }
                        return i;
                    }
                    var Ge, ye, le, fe, ue, ie, ae, oe, ve;
                    function Bt(n) {
                        Ge = n, r.HEAP8 = ye = new Int8Array(n), r.HEAP16 = fe = new Int16Array(n), r.HEAP32 = ie = new Int32Array(n), r.HEAPU8 = le = new Uint8Array(n), r.HEAPU16 = ue = new Uint16Array(n), r.HEAPU32 = ae = new Uint32Array(n), r.HEAPF32 = oe = new Float32Array(n), r.HEAPF64 = ve = new Float64Array(n);
                    }
                    r.INITIAL_MEMORY;
                    var Nt, zt = [], qt = [], or = [];
                    function hr() {
                        if (r.preRun) for(typeof r.preRun == "function" && (r.preRun = [
                            r.preRun
                        ]); r.preRun.length;)on(r.preRun.shift());
                        yr(zt);
                    }
                    function Dr() {
                        yr(qt);
                    }
                    function nn() {
                        if (r.postRun) for(typeof r.postRun == "function" && (r.postRun = [
                            r.postRun
                        ]); r.postRun.length;)Ct(r.postRun.shift());
                        yr(or);
                    }
                    function on(n) {
                        zt.unshift(n);
                    }
                    function an(n) {
                        qt.unshift(n);
                    }
                    function Ct(n) {
                        or.unshift(n);
                    }
                    var Je = 0, Xe = null;
                    function Ye(n) {
                        Je++, r.monitorRunDependencies && r.monitorRunDependencies(Je);
                    }
                    function ot(n) {
                        if (Je--, r.monitorRunDependencies && r.monitorRunDependencies(Je), Je == 0 && Xe) {
                            var i = Xe;
                            Xe = null, i();
                        }
                    }
                    function Ut(n) {
                        r.onAbort && r.onAbort(n), n = "Aborted(" + n + ")", ge(n), Ue = !0, n += ". Build with -sASSERTIONS for more info.";
                        var i = new WebAssembly.RuntimeError(n);
                        throw j(i), i;
                    }
                    var jt = "data:application/octet-stream;base64,";
                    function at(n) {
                        return n.startsWith(jt);
                    }
                    function Te(n) {
                        return n.startsWith("file://");
                    }
                    var be;
                    be = "openjphjs.wasm", at(be) || (be = X(be));
                    function Ce(n) {
                        try {
                            if (n == be && we) return new Uint8Array(we);
                            if (ce) return ce(n);
                            throw "both async and sync fetching of the wasm failed";
                        } catch (i) {
                            Ut(i);
                        }
                    }
                    function Se() {
                        if (!we && (N || M)) {
                            if (typeof fetch == "function" && !Te(be)) return fetch(be, {
                                credentials: "same-origin"
                            }).then(function(n) {
                                if (!n.ok) throw "failed to load wasm binary file at '" + be + "'";
                                return n.arrayBuffer();
                            }).catch(function() {
                                return Ce(be);
                            });
                            if (te) return new Promise(function(n, i) {
                                te(be, function(e) {
                                    n(new Uint8Array(e));
                                }, i);
                            });
                        }
                        return Promise.resolve().then(function() {
                            return Ce(be);
                        });
                    }
                    function Or() {
                        var n = {
                            env: u,
                            wasi_snapshot_preview1: u
                        };
                        function i(d, h) {
                            var g = d.exports;
                            r.asm = g, Pe = r.asm.memory, Bt(Pe.buffer), Nt = r.asm.__indirect_function_table, an(r.asm.__wasm_call_ctors), ot();
                        }
                        Ye();
                        function e(d) {
                            i(d.instance);
                        }
                        function t(d) {
                            return Se().then(function(h) {
                                return WebAssembly.instantiate(h, n);
                            }).then(function(h) {
                                return h;
                            }).then(d, function(h) {
                                ge("failed to asynchronously prepare wasm: " + h), Ut(h);
                            });
                        }
                        function o() {
                            return !we && typeof WebAssembly.instantiateStreaming == "function" && !at(be) && !Te(be) && !z && typeof fetch == "function" ? fetch(be, {
                                credentials: "same-origin"
                            }).then(function(d) {
                                var h = WebAssembly.instantiateStreaming(d, n);
                                return h.then(e, function(g) {
                                    return ge("wasm streaming compile failed: " + g), ge("falling back to ArrayBuffer instantiation"), t(e);
                                });
                            }) : t(e);
                        }
                        if (r.instantiateWasm) try {
                            var l = r.instantiateWasm(n, i);
                            return l;
                        } catch (d) {
                            ge("Module.instantiateWasm callback failed with error: " + d), j(d);
                        }
                        return o().catch(j), {};
                    }
                    function gr(n) {
                        this.name = "ExitStatus", this.message = "Program terminated with exit(" + n + ")", this.status = n;
                    }
                    function yr(n) {
                        for(; n.length > 0;)n.shift()(r);
                    }
                    function ar(n, i, e, t) {
                        Ut("Assertion failed: " + Tt(n) + ", at: " + [
                            i ? Tt(i) : "unknown filename",
                            e,
                            t ? Tt(t) : "unknown function"
                        ]);
                    }
                    var At = [];
                    function Fr(n) {
                        n.add_ref();
                    }
                    function _t(n) {
                        var i = new st(n);
                        return i.get_caught() || i.set_caught(!0), i.set_rethrown(!1), At.push(i), Fr(i), i.get_exception_ptr();
                    }
                    var ke = 0, De = [];
                    function he(n) {
                        var i = De[n];
                        return i || (n >= De.length && (De.length = n + 1), De[n] = i = Nt.get(n)), i;
                    }
                    function Ne(n) {
                        if (n.release_ref() && !n.get_rethrown()) {
                            var i = n.get_destructor();
                            i && he(i)(n.excPtr), w(n.excPtr);
                        }
                    }
                    function tt() {
                        _setThrew(0);
                        var n = At.pop();
                        Ne(n), ke = 0;
                    }
                    function st(n) {
                        this.excPtr = n, this.ptr = n - 24, this.set_type = function(i) {
                            ae[this.ptr + 4 >> 2] = i;
                        }, this.get_type = function() {
                            return ae[this.ptr + 4 >> 2];
                        }, this.set_destructor = function(i) {
                            ae[this.ptr + 8 >> 2] = i;
                        }, this.get_destructor = function() {
                            return ae[this.ptr + 8 >> 2];
                        }, this.set_refcount = function(i) {
                            ie[this.ptr >> 2] = i;
                        }, this.set_caught = function(i) {
                            i = i ? 1 : 0, ye[this.ptr + 12 >> 0] = i;
                        }, this.get_caught = function() {
                            return ye[this.ptr + 12 >> 0] != 0;
                        }, this.set_rethrown = function(i) {
                            i = i ? 1 : 0, ye[this.ptr + 13 >> 0] = i;
                        }, this.get_rethrown = function() {
                            return ye[this.ptr + 13 >> 0] != 0;
                        }, this.init = function(i, e) {
                            this.set_adjusted_ptr(0), this.set_type(i), this.set_destructor(e), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
                        }, this.add_ref = function() {
                            var i = ie[this.ptr >> 2];
                            ie[this.ptr >> 2] = i + 1;
                        }, this.release_ref = function() {
                            var i = ie[this.ptr >> 2];
                            return ie[this.ptr >> 2] = i - 1, i === 1;
                        }, this.set_adjusted_ptr = function(i) {
                            ae[this.ptr + 16 >> 2] = i;
                        }, this.get_adjusted_ptr = function() {
                            return ae[this.ptr + 16 >> 2];
                        }, this.get_exception_ptr = function() {
                            var i = G(this.get_type());
                            if (i) return ae[this.excPtr >> 2];
                            var e = this.get_adjusted_ptr();
                            return e !== 0 ? e : this.excPtr;
                        };
                    }
                    function _r(n) {
                        throw ke || (ke = n), n;
                    }
                    function Gt() {
                        var n = ke;
                        if (!n) return k(0), 0;
                        var i = new st(n);
                        i.set_adjusted_ptr(n);
                        var e = i.get_type();
                        if (!e) return k(0), n;
                        for(var t = 0; t < arguments.length; t++){
                            var o = arguments[t];
                            if (o === 0 || o === e) break;
                            var l = i.ptr + 16;
                            if (x(o, e, l)) return k(o), n;
                        }
                        return k(e), n;
                    }
                    function It() {
                        var n = ke;
                        if (!n) return k(0), 0;
                        var i = new st(n);
                        i.set_adjusted_ptr(n);
                        var e = i.get_type();
                        if (!e) return k(0), n;
                        for(var t = 0; t < arguments.length; t++){
                            var o = arguments[t];
                            if (o === 0 || o === e) break;
                            var l = i.ptr + 16;
                            if (x(o, e, l)) return k(o), n;
                        }
                        return k(e), n;
                    }
                    function mt(n, i, e) {
                        var t = new st(n);
                        throw t.init(i, e), ke = n, n;
                    }
                    var He = {};
                    function xt(n) {
                        for(; n.length;){
                            var i = n.pop(), e = n.pop();
                            e(i);
                        }
                    }
                    function Me(n) {
                        return this.fromWireType(ie[n >> 2]);
                    }
                    var Le = {}, $t = {}, Rt = {}, Ae = 48, Et = 57;
                    function Y(n) {
                        if (n === void 0) return "_unknown";
                        n = n.replace(/[^a-zA-Z0-9_]/g, "$");
                        var i = n.charCodeAt(0);
                        return i >= Ae && i <= Et ? "_" + n : n;
                    }
                    function pe(n, i) {
                        return n = Y(n), new Function("body", "return function " + n + `() {
    "use strict";    return body.apply(this, arguments);
};
`)(i);
                    }
                    function ne(n, i) {
                        var e = pe(i, function(t) {
                            this.name = i, this.message = t;
                            var o = new Error(t).stack;
                            o !== void 0 && (this.stack = this.toString() + `
` + o.replace(/^Error(:[^\n]*)?\n/, ""));
                        });
                        return e.prototype = Object.create(n.prototype), e.prototype.constructor = e, e.prototype.toString = function() {
                            return this.message === void 0 ? this.name : this.name + ": " + this.message;
                        }, e;
                    }
                    var Z = void 0;
                    function ze(n) {
                        throw new Z(n);
                    }
                    function ut(n, i, e) {
                        n.forEach(function(h) {
                            Rt[h] = i;
                        });
                        function t(h) {
                            var g = e(h);
                            g.length !== n.length && ze("Mismatched type converter count");
                            for(var m = 0; m < n.length; ++m)je(n[m], g[m]);
                        }
                        var o = new Array(i.length), l = [], d = 0;
                        i.forEach((h, g)=>{
                            $t.hasOwnProperty(h) ? o[g] = $t[h] : (l.push(h), Le.hasOwnProperty(h) || (Le[h] = []), Le[h].push(()=>{
                                o[g] = $t[h], ++d, d === l.length && t(o);
                            }));
                        }), l.length === 0 && t(o);
                    }
                    function mr(n) {
                        var i = He[n];
                        delete He[n];
                        var e = i.rawConstructor, t = i.rawDestructor, o = i.fields, l = o.map((d)=>d.getterReturnType).concat(o.map((d)=>d.setterArgumentType));
                        ut([
                            n
                        ], l, (d)=>{
                            var h = {};
                            return o.forEach((g, m)=>{
                                var P = g.fieldName, S = d[m], I = g.getter, B = g.getterContext, V = d[m + o.length], re = g.setter, ee = g.setterContext;
                                h[P] = {
                                    read: (de)=>S.fromWireType(I(B, de)),
                                    write: (de, Fe)=>{
                                        var We = [];
                                        re(ee, de, V.toWireType(We, Fe)), xt(We);
                                    }
                                };
                            }), [
                                {
                                    name: i.name,
                                    fromWireType: function(g) {
                                        var m = {};
                                        for(var P in h)m[P] = h[P].read(g);
                                        return t(g), m;
                                    },
                                    toWireType: function(g, m) {
                                        for(var P in h)if (!(P in m)) throw new TypeError('Missing field:  "' + P + '"');
                                        var S = e();
                                        for(P in h)h[P].write(S, m[P]);
                                        return g !== null && g.push(t, S), S;
                                    },
                                    argPackAdvance: 8,
                                    readValueFromPointer: Me,
                                    destructorFunction: t
                                }
                            ];
                        });
                    }
                    function sr(n, i, e, t, o) {}
                    function St(n) {
                        switch(n){
                            case 1:
                                return 0;
                            case 2:
                                return 1;
                            case 4:
                                return 2;
                            case 8:
                                return 3;
                            default:
                                throw new TypeError("Unknown type size: " + n);
                        }
                    }
                    function Jt() {
                        for(var n = new Array(256), i = 0; i < 256; ++i)n[i] = String.fromCharCode(i);
                        ur = n;
                    }
                    var ur = void 0;
                    function Re(n) {
                        for(var i = "", e = n; le[e];)i += ur[le[e++]];
                        return i;
                    }
                    var bt = void 0;
                    function se(n) {
                        throw new bt(n);
                    }
                    function je(n, i, e = {}) {
                        if (!("argPackAdvance" in i)) throw new TypeError("registerType registeredInstance requires argPackAdvance");
                        var t = i.name;
                        if (n || se('type "' + t + '" must have a positive integer typeid pointer'), $t.hasOwnProperty(n)) {
                            if (e.ignoreDuplicateRegistrations) return;
                            se("Cannot register type '" + t + "' twice");
                        }
                        if ($t[n] = i, delete Rt[n], Le.hasOwnProperty(n)) {
                            var o = Le[n];
                            delete Le[n], o.forEach((l)=>l());
                        }
                    }
                    function br(n, i, e, t, o) {
                        var l = St(e);
                        i = Re(i), je(n, {
                            name: i,
                            fromWireType: function(d) {
                                return !!d;
                            },
                            toWireType: function(d, h) {
                                return h ? t : o;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: function(d) {
                                var h;
                                if (e === 1) h = ye;
                                else if (e === 2) h = fe;
                                else if (e === 4) h = ie;
                                else throw new TypeError("Unknown boolean type size: " + i);
                                return this.fromWireType(h[d >> l]);
                            },
                            destructorFunction: null
                        });
                    }
                    function ct(n) {
                        if (!(this instanceof gt) || !(n instanceof gt)) return !1;
                        for(var i = this.$$.ptrType.registeredClass, e = this.$$.ptr, t = n.$$.ptrType.registeredClass, o = n.$$.ptr; i.baseClass;)e = i.upcast(e), i = i.baseClass;
                        for(; t.baseClass;)o = t.upcast(o), t = t.baseClass;
                        return i === t && e === o;
                    }
                    function kt(n) {
                        return {
                            count: n.count,
                            deleteScheduled: n.deleteScheduled,
                            preservePointerOnDelete: n.preservePointerOnDelete,
                            ptr: n.ptr,
                            ptrType: n.ptrType,
                            smartPtr: n.smartPtr,
                            smartPtrType: n.smartPtrType
                        };
                    }
                    function ft(n) {
                        function i(e) {
                            return e.$$.ptrType.registeredClass.name;
                        }
                        se(i(n) + " instance already deleted");
                    }
                    var Ke = !1;
                    function Ur(n) {}
                    function Xt(n) {
                        n.smartPtr ? n.smartPtrType.rawDestructor(n.smartPtr) : n.ptrType.registeredClass.rawDestructor(n.ptr);
                    }
                    function lt(n) {
                        n.count.value -= 1;
                        var i = n.count.value === 0;
                        i && Xt(n);
                    }
                    function jr(n, i, e) {
                        if (i === e) return n;
                        if (e.baseClass === void 0) return null;
                        var t = jr(n, i, e.baseClass);
                        return t === null ? null : e.downcast(t);
                    }
                    var pt = {};
                    function cr() {
                        return Object.keys(Ve).length;
                    }
                    function Yt() {
                        var n = [];
                        for(var i in Ve)Ve.hasOwnProperty(i) && n.push(Ve[i]);
                        return n;
                    }
                    var dt = [];
                    function wr() {
                        for(; dt.length;){
                            var n = dt.pop();
                            n.$$.deleteScheduled = !1, n.delete();
                        }
                    }
                    var Kt = void 0;
                    function wt(n) {
                        Kt = n, dt.length && Kt && Kt(wr);
                    }
                    function Ir() {
                        r.getInheritedInstanceCount = cr, r.getLiveInheritedInstances = Yt, r.flushPendingDeletes = wr, r.setDelayFunction = wt;
                    }
                    var Ve = {};
                    function vt(n, i) {
                        for(i === void 0 && se("ptr should not be undefined"); n.baseClass;)i = n.upcast(i), n = n.baseClass;
                        return i;
                    }
                    function fr(n, i) {
                        return i = vt(n, i), Ve[i];
                    }
                    function lr(n, i) {
                        (!i.ptrType || !i.ptr) && ze("makeClassHandle requires ptr and ptrType");
                        var e = !!i.smartPtrType, t = !!i.smartPtr;
                        return e !== t && ze("Both smartPtrType and smartPtr must be specified"), i.count = {
                            value: 1
                        }, Dt(Object.create(n, {
                            $$: {
                                value: i
                            }
                        }));
                    }
                    function Pr(n) {
                        var i = this.getPointee(n);
                        if (!i) return this.destructor(n), null;
                        var e = fr(this.registeredClass, i);
                        if (e !== void 0) {
                            if (e.$$.count.value === 0) return e.$$.ptr = i, e.$$.smartPtr = n, e.clone();
                            var t = e.clone();
                            return this.destructor(n), t;
                        }
                        function o() {
                            return this.isSmartPointer ? lr(this.registeredClass.instancePrototype, {
                                ptrType: this.pointeeType,
                                ptr: i,
                                smartPtrType: this,
                                smartPtr: n
                            }) : lr(this.registeredClass.instancePrototype, {
                                ptrType: this,
                                ptr: n
                            });
                        }
                        var l = this.registeredClass.getActualType(i), d = pt[l];
                        if (!d) return o.call(this);
                        var h;
                        this.isConst ? h = d.constPointerType : h = d.pointerType;
                        var g = jr(i, this.registeredClass, h.registeredClass);
                        return g === null ? o.call(this) : this.isSmartPointer ? lr(h.registeredClass.instancePrototype, {
                            ptrType: h,
                            ptr: g,
                            smartPtrType: this,
                            smartPtr: n
                        }) : lr(h.registeredClass.instancePrototype, {
                            ptrType: h,
                            ptr: g
                        });
                    }
                    function Dt(n) {
                        return typeof FinalizationRegistry > "u" ? (Dt = (i)=>i, n) : (Ke = new FinalizationRegistry((i)=>{
                            lt(i.$$);
                        }), Dt = (i)=>{
                            var e = i.$$, t = !!e.smartPtr;
                            if (t) {
                                var o = {
                                    $$: e
                                };
                                Ke.register(i, o, i);
                            }
                            return i;
                        }, Ur = (i)=>Ke.unregister(i), Dt(n));
                    }
                    function sn() {
                        if (this.$$.ptr || ft(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
                        var n = Dt(Object.create(Object.getPrototypeOf(this), {
                            $$: {
                                value: kt(this.$$)
                            }
                        }));
                        return n.$$.count.value += 1, n.$$.deleteScheduled = !1, n;
                    }
                    function un() {
                        this.$$.ptr || ft(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && se("Object already scheduled for deletion"), Ur(this), lt(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
                    }
                    function cn() {
                        return !this.$$.ptr;
                    }
                    function fn() {
                        return this.$$.ptr || ft(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && se("Object already scheduled for deletion"), dt.push(this), dt.length === 1 && Kt && Kt(wr), this.$$.deleteScheduled = !0, this;
                    }
                    function ht() {
                        gt.prototype.isAliasOf = ct, gt.prototype.clone = sn, gt.prototype.delete = un, gt.prototype.isDeleted = cn, gt.prototype.deleteLater = fn;
                    }
                    function gt() {}
                    function rt(n, i, e) {
                        if (n[i].overloadTable === void 0) {
                            var t = n[i];
                            n[i] = function() {
                                return n[i].overloadTable.hasOwnProperty(arguments.length) || se("Function '" + e + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + n[i].overloadTable + ")!"), n[i].overloadTable[arguments.length].apply(this, arguments);
                            }, n[i].overloadTable = [], n[i].overloadTable[t.argCount] = t;
                        }
                    }
                    function Be(n, i, e) {
                        r.hasOwnProperty(n) ? ((e === void 0 || r[n].overloadTable !== void 0 && r[n].overloadTable[e] !== void 0) && se("Cannot register public name '" + n + "' twice"), rt(r, n, n), r.hasOwnProperty(e) && se("Cannot register multiple overloads of a function with the same number of arguments (" + e + ")!"), r[n].overloadTable[e] = i) : (r[n] = i, e !== void 0 && (r[n].numArguments = e));
                    }
                    function xr(n, i, e, t, o, l, d, h) {
                        this.name = n, this.constructor = i, this.instancePrototype = e, this.rawDestructor = t, this.baseClass = o, this.getActualType = l, this.upcast = d, this.downcast = h, this.pureVirtualFunctions = [];
                    }
                    function Wt(n, i, e) {
                        for(; i !== e;)i.upcast || se("Expected null or instance of " + e.name + ", got an instance of " + i.name), n = i.upcast(n), i = i.baseClass;
                        return n;
                    }
                    function Qt(n, i) {
                        if (i === null) return this.isReference && se("null is not a valid " + this.name), 0;
                        i.$$ || se('Cannot pass "' + Ar(i) + '" as a ' + this.name), i.$$.ptr || se("Cannot pass deleted object as a pointer of type " + this.name);
                        var e = i.$$.ptrType.registeredClass, t = Wt(i.$$.ptr, e, this.registeredClass);
                        return t;
                    }
                    function Ee(n, i) {
                        var e;
                        if (i === null) return this.isReference && se("null is not a valid " + this.name), this.isSmartPointer ? (e = this.rawConstructor(), n !== null && n.push(this.rawDestructor, e), e) : 0;
                        i.$$ || se('Cannot pass "' + Ar(i) + '" as a ' + this.name), i.$$.ptr || se("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && i.$$.ptrType.isConst && se("Cannot convert argument of type " + (i.$$.smartPtrType ? i.$$.smartPtrType.name : i.$$.ptrType.name) + " to parameter type " + this.name);
                        var t = i.$$.ptrType.registeredClass;
                        if (e = Wt(i.$$.ptr, t, this.registeredClass), this.isSmartPointer) switch(i.$$.smartPtr === void 0 && se("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy){
                            case 0:
                                i.$$.smartPtrType === this ? e = i.$$.smartPtr : se("Cannot convert argument of type " + (i.$$.smartPtrType ? i.$$.smartPtrType.name : i.$$.ptrType.name) + " to parameter type " + this.name);
                                break;
                            case 1:
                                e = i.$$.smartPtr;
                                break;
                            case 2:
                                if (i.$$.smartPtrType === this) e = i.$$.smartPtr;
                                else {
                                    var o = i.clone();
                                    e = this.rawShare(e, rr.toHandle(function() {
                                        o.delete();
                                    })), n !== null && n.push(this.rawDestructor, e);
                                }
                                break;
                            default:
                                se("Unsupporting sharing policy");
                        }
                        return e;
                    }
                    function Wr(n, i) {
                        if (i === null) return this.isReference && se("null is not a valid " + this.name), 0;
                        i.$$ || se('Cannot pass "' + Ar(i) + '" as a ' + this.name), i.$$.ptr || se("Cannot pass deleted object as a pointer of type " + this.name), i.$$.ptrType.isConst && se("Cannot convert argument of type " + i.$$.ptrType.name + " to parameter type " + this.name);
                        var e = i.$$.ptrType.registeredClass, t = Wt(i.$$.ptr, e, this.registeredClass);
                        return t;
                    }
                    function Qe(n) {
                        return this.rawGetPointee && (n = this.rawGetPointee(n)), n;
                    }
                    function Ie(n) {
                        this.rawDestructor && this.rawDestructor(n);
                    }
                    function Tr(n) {
                        n !== null && n.delete();
                    }
                    function Ht() {
                        Ze.prototype.getPointee = Qe, Ze.prototype.destructor = Ie, Ze.prototype.argPackAdvance = 8, Ze.prototype.readValueFromPointer = Me, Ze.prototype.deleteObject = Tr, Ze.prototype.fromWireType = Pr;
                    }
                    function Ze(n, i, e, t, o, l, d, h, g, m, P) {
                        this.name = n, this.registeredClass = i, this.isReference = e, this.isConst = t, this.isSmartPointer = o, this.pointeeType = l, this.sharingPolicy = d, this.rawGetPointee = h, this.rawConstructor = g, this.rawShare = m, this.rawDestructor = P, !o && i.baseClass === void 0 ? t ? (this.toWireType = Qt, this.destructorFunction = null) : (this.toWireType = Wr, this.destructorFunction = null) : this.toWireType = Ee;
                    }
                    function Zt(n, i, e) {
                        r.hasOwnProperty(n) || ze("Replacing nonexistant public symbol"), r[n].overloadTable !== void 0 && e !== void 0 ? r[n].overloadTable[e] = i : (r[n] = i, r[n].argCount = e);
                    }
                    function Hr(n, i, e) {
                        var t = r["dynCall_" + n];
                        return e && e.length ? t.apply(null, [
                            i
                        ].concat(e)) : t.call(null, i);
                    }
                    function Mr(n, i, e) {
                        if (n.includes("j")) return Hr(n, i, e);
                        var t = he(i).apply(null, e);
                        return t;
                    }
                    function pr(n, i) {
                        var e = [];
                        return function() {
                            return e.length = 0, Object.assign(e, arguments), Mr(n, i, e);
                        };
                    }
                    function me(n, i) {
                        n = Re(n);
                        function e() {
                            return n.includes("j") ? pr(n, i) : he(i);
                        }
                        var t = e();
                        return typeof t != "function" && se("unknown function pointer with signature " + n + ": " + i), t;
                    }
                    var er = void 0;
                    function xe(n) {
                        var i = C(n), e = Re(i);
                        return v(i), e;
                    }
                    function Oe(n, i) {
                        var e = [], t = {};
                        function o(l) {
                            if (!t[l] && !$t[l]) {
                                if (Rt[l]) {
                                    Rt[l].forEach(o);
                                    return;
                                }
                                e.push(l), t[l] = !0;
                            }
                        }
                        throw i.forEach(o), new er(n + ": " + e.map(xe).join([
                            ", "
                        ]));
                    }
                    function Lr(n, i, e, t, o, l, d, h, g, m, P, S, I) {
                        P = Re(P), l = me(o, l), h && (h = me(d, h)), m && (m = me(g, m)), I = me(S, I);
                        var B = Y(P);
                        Be(B, function() {
                            Oe("Cannot construct " + P + " due to unbound types", [
                                t
                            ]);
                        }), ut([
                            n,
                            i,
                            e
                        ], t ? [
                            t
                        ] : [], function(V) {
                            V = V[0];
                            var re, ee;
                            t ? (re = V.registeredClass, ee = re.instancePrototype) : ee = gt.prototype;
                            var de = pe(B, function() {
                                if (Object.getPrototypeOf(this) !== Fe) throw new bt("Use 'new' to construct " + P);
                                if (We.constructor_body === void 0) throw new bt(P + " has no accessible constructor");
                                var Fn = We.constructor_body[arguments.length];
                                if (Fn === void 0) throw new bt("Tried to invoke ctor of " + P + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(We.constructor_body).toString() + ") parameters instead!");
                                return Fn.apply(this, arguments);
                            }), Fe = Object.create(ee, {
                                constructor: {
                                    value: de
                                }
                            });
                            de.prototype = Fe;
                            var We = new xr(P, de, Fe, I, re, l, h, m), Sn = new Ze(P, We, !0, !1, !1), Lt = new Ze(P + "*", We, !1, !1, !1), Wn = new Ze(P + " const*", We, !1, !0, !1);
                            return pt[n] = {
                                pointerType: Lt,
                                constPointerType: Wn
                            }, Zt(B, de), [
                                Sn,
                                Lt,
                                Wn
                            ];
                        });
                    }
                    function nt(n, i) {
                        for(var e = [], t = 0; t < n; t++)e.push(ae[i + t * 4 >> 2]);
                        return e;
                    }
                    function ln(n, i) {
                        if (!(n instanceof Function)) throw new TypeError("new_ called with constructor type " + typeof n + " which is not a function");
                        var e = pe(n.name || "unknownFunctionName", function() {});
                        e.prototype = n.prototype;
                        var t = new e, o = n.apply(t, i);
                        return o instanceof Object ? o : t;
                    }
                    function qe(n, i, e, t, o) {
                        var l = i.length;
                        l < 2 && se("argTypes array size mismatch! Must at least get return value and 'this' types!");
                        for(var d = i[1] !== null && e !== null, h = !1, g = 1; g < i.length; ++g)if (i[g] !== null && i[g].destructorFunction === void 0) {
                            h = !0;
                            break;
                        }
                        for(var m = i[0].name !== "void", P = "", S = "", g = 0; g < l - 2; ++g)P += (g !== 0 ? ", " : "") + "arg" + g, S += (g !== 0 ? ", " : "") + "arg" + g + "Wired";
                        var I = "return function " + Y(n) + "(" + P + `) {
if (arguments.length !== ` + (l - 2) + `) {
throwBindingError('function ` + n + " called with ' + arguments.length + ' arguments, expected " + (l - 2) + ` args!');
}
`;
                        h && (I += `var destructors = [];
`);
                        var B = h ? "destructors" : "null", V = [
                            "throwBindingError",
                            "invoker",
                            "fn",
                            "runDestructors",
                            "retType",
                            "classParam"
                        ], re = [
                            se,
                            t,
                            o,
                            xt,
                            i[0],
                            i[1]
                        ];
                        d && (I += "var thisWired = classParam.toWireType(" + B + `, this);
`);
                        for(var g = 0; g < l - 2; ++g)I += "var arg" + g + "Wired = argType" + g + ".toWireType(" + B + ", arg" + g + "); // " + i[g + 2].name + `
`, V.push("argType" + g), re.push(i[g + 2]);
                        if (d && (S = "thisWired" + (S.length > 0 ? ", " : "") + S), I += (m ? "var rv = " : "") + "invoker(fn" + (S.length > 0 ? ", " : "") + S + `);
`, h) I += `runDestructors(destructors);
`;
                        else for(var g = d ? 1 : 2; g < i.length; ++g){
                            var ee = g === 1 ? "thisWired" : "arg" + (g - 2) + "Wired";
                            i[g].destructorFunction !== null && (I += ee + "_dtor(" + ee + "); // " + i[g].name + `
`, V.push(ee + "_dtor"), re.push(i[g].destructorFunction));
                        }
                        m && (I += `var ret = retType.fromWireType(rv);
return ret;
`), I += `}
`, V.push(I);
                        var de = ln(Function, V).apply(null, re);
                        return de;
                    }
                    function Pt(n, i, e, t, o, l) {
                        it(i > 0);
                        var d = nt(i, e);
                        o = me(t, o), ut([], [
                            n
                        ], function(h) {
                            h = h[0];
                            var g = "constructor " + h.name;
                            if (h.registeredClass.constructor_body === void 0 && (h.registeredClass.constructor_body = []), h.registeredClass.constructor_body[i - 1] !== void 0) throw new bt("Cannot register multiple constructors with identical number of parameters (" + (i - 1) + ") for class '" + h.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
                            return h.registeredClass.constructor_body[i - 1] = ()=>{
                                Oe("Cannot construct " + h.name + " due to unbound types", d);
                            }, ut([], d, function(m) {
                                return m.splice(1, 0, null), h.registeredClass.constructor_body[i - 1] = qe(g, m, null, o, l), [];
                            }), [];
                        });
                    }
                    function Cr(n, i, e, t, o, l, d, h) {
                        var g = nt(e, t);
                        i = Re(i), l = me(o, l), ut([], [
                            n
                        ], function(m) {
                            m = m[0];
                            var P = m.name + "." + i;
                            i.startsWith("@@") && (i = Symbol[i.substring(2)]), h && m.registeredClass.pureVirtualFunctions.push(i);
                            function S() {
                                Oe("Cannot call " + P + " due to unbound types", g);
                            }
                            var I = m.registeredClass.instancePrototype, B = I[i];
                            return B === void 0 || B.overloadTable === void 0 && B.className !== m.name && B.argCount === e - 2 ? (S.argCount = e - 2, S.className = m.name, I[i] = S) : (rt(I, i, P), I[i].overloadTable[e - 2] = S), ut([], g, function(V) {
                                var re = qe(P, V, m, l, d);
                                return I[i].overloadTable === void 0 ? (re.argCount = e - 2, I[i] = re) : I[i].overloadTable[e - 2] = re, [];
                            }), [];
                        });
                    }
                    var tr = [], et = [
                        {},
                        {
                            value: void 0
                        },
                        {
                            value: null
                        },
                        {
                            value: !0
                        },
                        {
                            value: !1
                        }
                    ];
                    function Vr(n) {
                        n > 4 && --et[n].refcount === 0 && (et[n] = void 0, tr.push(n));
                    }
                    function pn() {
                        for(var n = 0, i = 5; i < et.length; ++i)et[i] !== void 0 && ++n;
                        return n;
                    }
                    function dn() {
                        for(var n = 5; n < et.length; ++n)if (et[n] !== void 0) return et[n];
                        return null;
                    }
                    function Br() {
                        r.count_emval_handles = pn, r.get_first_emval = dn;
                    }
                    var rr = {
                        toValue: (n)=>(n || se("Cannot use deleted val. handle = " + n), et[n].value),
                        toHandle: (n)=>{
                            switch(n){
                                case void 0:
                                    return 1;
                                case null:
                                    return 2;
                                case !0:
                                    return 3;
                                case !1:
                                    return 4;
                                default:
                                    {
                                        var i = tr.length ? tr.pop() : et.length;
                                        return et[i] = {
                                            refcount: 1,
                                            value: n
                                        }, i;
                                    }
                            }
                        }
                    };
                    function Nr(n, i) {
                        i = Re(i), je(n, {
                            name: i,
                            fromWireType: function(e) {
                                var t = rr.toValue(e);
                                return Vr(e), t;
                            },
                            toWireType: function(e, t) {
                                return rr.toHandle(t);
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: Me,
                            destructorFunction: null
                        });
                    }
                    function Ar(n) {
                        if (n === null) return "null";
                        var i = typeof n;
                        return i === "object" || i === "array" || i === "function" ? n.toString() : "" + n;
                    }
                    function vn(n, i) {
                        switch(i){
                            case 2:
                                return function(e) {
                                    return this.fromWireType(oe[e >> 2]);
                                };
                            case 3:
                                return function(e) {
                                    return this.fromWireType(ve[e >> 3]);
                                };
                            default:
                                throw new TypeError("Unknown float type: " + n);
                        }
                    }
                    function hn(n, i, e) {
                        var t = St(e);
                        i = Re(i), je(n, {
                            name: i,
                            fromWireType: function(o) {
                                return o;
                            },
                            toWireType: function(o, l) {
                                return l;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: vn(i, t),
                            destructorFunction: null
                        });
                    }
                    function gn(n, i, e, t, o, l) {
                        var d = nt(i, e);
                        n = Re(n), o = me(t, o), Be(n, function() {
                            Oe("Cannot call " + n + " due to unbound types", d);
                        }, i - 1), ut([], d, function(h) {
                            var g = [
                                h[0],
                                null
                            ].concat(h.slice(1));
                            return Zt(n, qe(n, g, null, o, l), i - 1), [];
                        });
                    }
                    function yn(n, i, e) {
                        switch(i){
                            case 0:
                                return e ? function(o) {
                                    return ye[o];
                                } : function(o) {
                                    return le[o];
                                };
                            case 1:
                                return e ? function(o) {
                                    return fe[o >> 1];
                                } : function(o) {
                                    return ue[o >> 1];
                                };
                            case 2:
                                return e ? function(o) {
                                    return ie[o >> 2];
                                } : function(o) {
                                    return ae[o >> 2];
                                };
                            default:
                                throw new TypeError("Unknown integer type: " + n);
                        }
                    }
                    function _n(n, i, e, t, o) {
                        i = Re(i);
                        var l = St(e), d = (S)=>S;
                        if (t === 0) {
                            var h = 32 - 8 * e;
                            d = (S)=>S << h >>> h;
                        }
                        var g = i.includes("unsigned"), m = (S, I)=>{}, P;
                        g ? P = function(S, I) {
                            return m(I, this.name), I >>> 0;
                        } : P = function(S, I) {
                            return m(I, this.name), I;
                        }, je(n, {
                            name: i,
                            fromWireType: d,
                            toWireType: P,
                            argPackAdvance: 8,
                            readValueFromPointer: yn(i, l, t !== 0),
                            destructorFunction: null
                        });
                    }
                    function mn(n, i, e) {
                        var t = [
                            Int8Array,
                            Uint8Array,
                            Int16Array,
                            Uint16Array,
                            Int32Array,
                            Uint32Array,
                            Float32Array,
                            Float64Array
                        ], o = t[i];
                        function l(d) {
                            d = d >> 2;
                            var h = ae, g = h[d], m = h[d + 1];
                            return new o(Ge, m, g);
                        }
                        e = Re(e), je(n, {
                            name: e,
                            fromWireType: l,
                            argPackAdvance: 8,
                            readValueFromPointer: l
                        }, {
                            ignoreDuplicateRegistrations: !0
                        });
                    }
                    function bn(n, i) {
                        i = Re(i);
                        var e = i === "std::string";
                        je(n, {
                            name: i,
                            fromWireType: function(t) {
                                var o = ae[t >> 2], l = t + 4, d;
                                if (e) for(var h = l, g = 0; g <= o; ++g){
                                    var m = l + g;
                                    if (g == o || le[m] == 0) {
                                        var P = m - h, S = Tt(h, P);
                                        d === void 0 ? d = S : (d += "\0", d += S), h = m + 1;
                                    }
                                }
                                else {
                                    for(var I = new Array(o), g = 0; g < o; ++g)I[g] = String.fromCharCode(le[l + g]);
                                    d = I.join("");
                                }
                                return v(t), d;
                            },
                            toWireType: function(t, o) {
                                o instanceof ArrayBuffer && (o = new Uint8Array(o));
                                var l, d = typeof o == "string";
                                d || o instanceof Uint8Array || o instanceof Uint8ClampedArray || o instanceof Int8Array || se("Cannot pass non-string to std::string"), e && d ? l = ir(o) : l = o.length;
                                var h = c(4 + l + 1), g = h + 4;
                                if (ae[h >> 2] = l, e && d) vr(o, g, l + 1);
                                else if (d) for(var m = 0; m < l; ++m){
                                    var P = o.charCodeAt(m);
                                    P > 255 && (v(g), se("String has UTF-16 code units that do not fit in 8 bits")), le[g + m] = P;
                                }
                                else for(var m = 0; m < l; ++m)le[g + m] = o[m];
                                return t !== null && t.push(v, h), h;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: Me,
                            destructorFunction: function(t) {
                                v(t);
                            }
                        });
                    }
                    var zr = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
                    function wn(n, i) {
                        for(var e = n, t = e >> 1, o = t + i / 2; !(t >= o) && ue[t];)++t;
                        if (e = t << 1, e - n > 32 && zr) return zr.decode(le.subarray(n, e));
                        for(var l = "", d = 0; !(d >= i / 2); ++d){
                            var h = fe[n + d * 2 >> 1];
                            if (h == 0) break;
                            l += String.fromCharCode(h);
                        }
                        return l;
                    }
                    function qr(n, i, e) {
                        if (e === void 0 && (e = 2147483647), e < 2) return 0;
                        e -= 2;
                        for(var t = i, o = e < n.length * 2 ? e / 2 : n.length, l = 0; l < o; ++l){
                            var d = n.charCodeAt(l);
                            fe[i >> 1] = d, i += 2;
                        }
                        return fe[i >> 1] = 0, i - t;
                    }
                    function Gr(n) {
                        return n.length * 2;
                    }
                    function Pn(n, i) {
                        for(var e = 0, t = ""; !(e >= i / 4);){
                            var o = ie[n + e * 4 >> 2];
                            if (o == 0) break;
                            if (++e, o >= 65536) {
                                var l = o - 65536;
                                t += String.fromCharCode(55296 | l >> 10, 56320 | l & 1023);
                            } else t += String.fromCharCode(o);
                        }
                        return t;
                    }
                    function $r(n, i, e) {
                        if (e === void 0 && (e = 2147483647), e < 4) return 0;
                        for(var t = i, o = t + e - 4, l = 0; l < n.length; ++l){
                            var d = n.charCodeAt(l);
                            if (d >= 55296 && d <= 57343) {
                                var h = n.charCodeAt(++l);
                                d = 65536 + ((d & 1023) << 10) | h & 1023;
                            }
                            if (ie[i >> 2] = d, i += 4, i + 4 > o) break;
                        }
                        return ie[i >> 2] = 0, i - t;
                    }
                    function Jr(n) {
                        for(var i = 0, e = 0; e < n.length; ++e){
                            var t = n.charCodeAt(e);
                            t >= 55296 && t <= 57343 && ++e, i += 4;
                        }
                        return i;
                    }
                    function Xr(n, i, e) {
                        e = Re(e);
                        var t, o, l, d, h;
                        i === 2 ? (t = wn, o = qr, d = Gr, l = ()=>ue, h = 1) : i === 4 && (t = Pn, o = $r, d = Jr, l = ()=>ae, h = 2), je(n, {
                            name: e,
                            fromWireType: function(g) {
                                for(var m = ae[g >> 2], P = l(), S, I = g + 4, B = 0; B <= m; ++B){
                                    var V = g + 4 + B * i;
                                    if (B == m || P[V >> h] == 0) {
                                        var re = V - I, ee = t(I, re);
                                        S === void 0 ? S = ee : (S += "\0", S += ee), I = V + i;
                                    }
                                }
                                return v(g), S;
                            },
                            toWireType: function(g, m) {
                                typeof m != "string" && se("Cannot pass non-string to C++ string type " + e);
                                var P = d(m), S = c(4 + P + i);
                                return ae[S >> 2] = P >> h, o(m, S + 4, P + i), g !== null && g.push(v, S), S;
                            },
                            argPackAdvance: 8,
                            readValueFromPointer: Me,
                            destructorFunction: function(g) {
                                v(g);
                            }
                        });
                    }
                    function Rr(n, i, e, t, o, l) {
                        He[n] = {
                            name: Re(i),
                            rawConstructor: me(e, t),
                            rawDestructor: me(o, l),
                            fields: []
                        };
                    }
                    function Tn(n, i, e, t, o, l, d, h, g, m) {
                        He[n].fields.push({
                            fieldName: Re(i),
                            getterReturnType: e,
                            getter: me(t, o),
                            getterContext: l,
                            setterArgumentType: d,
                            setter: me(h, g),
                            setterContext: m
                        });
                    }
                    function Yr(n, i) {
                        i = Re(i), je(n, {
                            isVoid: !0,
                            name: i,
                            argPackAdvance: 0,
                            fromWireType: function() {},
                            toWireType: function(e, t) {}
                        });
                    }
                    function Cn(n) {
                        n > 4 && (et[n].refcount += 1);
                    }
                    function Kr(n, i) {
                        var e = $t[n];
                        return e === void 0 && se(i + " has unknown type " + xe(n)), e;
                    }
                    function An(n, i) {
                        n = Kr(n, "_emval_take_value");
                        var e = n.readValueFromPointer(i);
                        return rr.toHandle(e);
                    }
                    function $n() {
                        Ut("");
                    }
                    function Rn(n, i, e) {
                        le.copyWithin(n, i, i + e);
                    }
                    function En() {
                        return 2147483648;
                    }
                    function Er(n) {
                        try {
                            return Pe.grow(n - Ge.byteLength + 65535 >>> 16), Bt(Pe.buffer), 1;
                        } catch  {}
                    }
                    function Sr(n) {
                        var i = le.length;
                        n = n >>> 0;
                        var e = En();
                        if (n > e) return !1;
                        let t = (g, m)=>g + (m - g % m) % m;
                        for(var o = 1; o <= 4; o *= 2){
                            var l = i * (1 + .2 / o);
                            l = Math.min(l, n + 100663296);
                            var d = Math.min(e, t(Math.max(n, l), 65536)), h = Er(d);
                            if (h) return !0;
                        }
                        return !1;
                    }
                    function Ot(n) {
                        return 52;
                    }
                    function Mt(n, i, e, t, o) {
                        return 70;
                    }
                    var yt = [
                        null,
                        [],
                        []
                    ];
                    function Qr(n, i) {
                        var e = yt[n];
                        i === 0 || i === 10 ? ((n === 1 ? _e : ge)(Ft(e, 0)), e.length = 0) : e.push(i);
                    }
                    function Zr(n, i, e, t) {
                        for(var o = 0, l = 0; l < e; l++){
                            var d = ae[i >> 2], h = ae[i + 4 >> 2];
                            i += 8;
                            for(var g = 0; g < h; g++)Qr(n, le[d + g]);
                            o += h;
                        }
                        return ae[t >> 2] = o, 0;
                    }
                    function kr(n) {
                        return n;
                    }
                    function en(n) {
                        var i = r["_" + n];
                        return i;
                    }
                    function dr(n, i) {
                        ye.set(n, i);
                    }
                    function tn(n, i, e, t, o) {
                        var l = {
                            string: (V)=>{
                                var re = 0;
                                if (V != null && V !== 0) {
                                    var ee = (V.length << 2) + 1;
                                    re = F(ee), vr(V, re, ee);
                                }
                                return re;
                            },
                            array: (V)=>{
                                var re = F(V.length);
                                return dr(V, re), re;
                            }
                        };
                        function d(V) {
                            return i === "string" ? Tt(V) : i === "boolean" ? !!V : V;
                        }
                        var h = en(n), g = [], m = 0;
                        if (t) for(var P = 0; P < t.length; P++){
                            var S = l[e[P]];
                            S ? (m === 0 && (m = D()), g[P] = S(t[P])) : g[P] = t[P];
                        }
                        var I = h.apply(null, g);
                        function B(V) {
                            return m !== 0 && $(m), d(V);
                        }
                        return I = B(I), I;
                    }
                    Z = r.InternalError = ne(Error, "InternalError"), Jt(), bt = r.BindingError = ne(Error, "BindingError"), ht(), Ir(), Ht(), er = r.UnboundTypeError = ne(Error, "UnboundTypeError"), Br();
                    var u = {
                        __assert_fail: ar,
                        __cxa_begin_catch: _t,
                        __cxa_end_catch: tt,
                        __cxa_find_matching_catch_2: Gt,
                        __cxa_find_matching_catch_3: It,
                        __cxa_throw: mt,
                        __resumeException: _r,
                        _embind_finalize_value_object: mr,
                        _embind_register_bigint: sr,
                        _embind_register_bool: br,
                        _embind_register_class: Lr,
                        _embind_register_class_constructor: Pt,
                        _embind_register_class_function: Cr,
                        _embind_register_emval: Nr,
                        _embind_register_float: hn,
                        _embind_register_function: gn,
                        _embind_register_integer: _n,
                        _embind_register_memory_view: mn,
                        _embind_register_std_string: bn,
                        _embind_register_std_wstring: Xr,
                        _embind_register_value_object: Rr,
                        _embind_register_value_object_field: Tn,
                        _embind_register_void: Yr,
                        _emval_decref: Vr,
                        _emval_incref: Cn,
                        _emval_take_value: An,
                        abort: $n,
                        emscripten_memcpy_big: Rn,
                        emscripten_resize_heap: Sr,
                        fd_close: Ot,
                        fd_seek: Mt,
                        fd_write: Zr,
                        invoke_i: b,
                        invoke_ii: J,
                        invoke_iii: U,
                        invoke_iiii: p,
                        invoke_v: a,
                        invoke_vi: K,
                        invoke_viiii: s,
                        invoke_viiiiii: T,
                        llvm_eh_typeid_for: kr
                    };
                    Or(), r.___wasm_call_ctors = function() {
                        return (r.___wasm_call_ctors = r.asm.__wasm_call_ctors).apply(null, arguments);
                    };
                    var c = r._malloc = function() {
                        return (c = r._malloc = r.asm.malloc).apply(null, arguments);
                    }, v = r._free = function() {
                        return (v = r._free = r.asm.free).apply(null, arguments);
                    }, w = r.___cxa_free_exception = function() {
                        return (w = r.___cxa_free_exception = r.asm.__cxa_free_exception).apply(null, arguments);
                    }, C = r.___getTypeName = function() {
                        return (C = r.___getTypeName = r.asm.__getTypeName).apply(null, arguments);
                    };
                    r.__embind_initialize_bindings = function() {
                        return (r.__embind_initialize_bindings = r.asm._embind_initialize_bindings).apply(null, arguments);
                    }, r.___errno_location = function() {
                        return (r.___errno_location = r.asm.__errno_location).apply(null, arguments);
                    };
                    var k = r.setTempRet0 = function() {
                        return (k = r.setTempRet0 = r.asm.setTempRet0).apply(null, arguments);
                    }, D = r.stackSave = function() {
                        return (D = r.stackSave = r.asm.stackSave).apply(null, arguments);
                    }, $ = r.stackRestore = function() {
                        return ($ = r.stackRestore = r.asm.stackRestore).apply(null, arguments);
                    }, F = r.stackAlloc = function() {
                        return (F = r.stackAlloc = r.asm.stackAlloc).apply(null, arguments);
                    }, x = r.___cxa_can_catch = function() {
                        return (x = r.___cxa_can_catch = r.asm.__cxa_can_catch).apply(null, arguments);
                    }, G = r.___cxa_is_pointer_type = function() {
                        return (G = r.___cxa_is_pointer_type = r.asm.__cxa_is_pointer_type).apply(null, arguments);
                    };
                    r.dynCall_ji = function() {
                        return (r.dynCall_ji = r.asm.dynCall_ji).apply(null, arguments);
                    }, r.dynCall_iiji = function() {
                        return (r.dynCall_iiji = r.asm.dynCall_iiji).apply(null, arguments);
                    }, r.dynCall_jiji = function() {
                        return (r.dynCall_jiji = r.asm.dynCall_jiji).apply(null, arguments);
                    };
                    function J(n, i) {
                        var e = D();
                        try {
                            return he(n)(i);
                        } catch (t) {
                            if ($(e), t !== t + 0) throw t;
                            _setThrew(1, 0);
                        }
                    }
                    function K(n, i) {
                        var e = D();
                        try {
                            he(n)(i);
                        } catch (t) {
                            if ($(e), t !== t + 0) throw t;
                            _setThrew(1, 0);
                        }
                    }
                    function s(n, i, e, t, o) {
                        var l = D();
                        try {
                            he(n)(i, e, t, o);
                        } catch (d) {
                            if ($(l), d !== d + 0) throw d;
                            _setThrew(1, 0);
                        }
                    }
                    function a(n) {
                        var i = D();
                        try {
                            he(n)();
                        } catch (e) {
                            if ($(i), e !== e + 0) throw e;
                            _setThrew(1, 0);
                        }
                    }
                    function p(n, i, e, t) {
                        var o = D();
                        try {
                            return he(n)(i, e, t);
                        } catch (l) {
                            if ($(o), l !== l + 0) throw l;
                            _setThrew(1, 0);
                        }
                    }
                    function b(n) {
                        var i = D();
                        try {
                            return he(n)();
                        } catch (e) {
                            if ($(i), e !== e + 0) throw e;
                            _setThrew(1, 0);
                        }
                    }
                    function T(n, i, e, t, o, l, d) {
                        var h = D();
                        try {
                            he(n)(i, e, t, o, l, d);
                        } catch (g) {
                            if ($(h), g !== g + 0) throw g;
                            _setThrew(1, 0);
                        }
                    }
                    function U(n, i, e) {
                        var t = D();
                        try {
                            return he(n)(i, e);
                        } catch (o) {
                            if ($(t), o !== o + 0) throw o;
                            _setThrew(1, 0);
                        }
                    }
                    r.ccall = tn;
                    var O;
                    Xe = function n() {
                        O || E(), O || (Xe = n);
                    };
                    function E(n) {
                        if (Je > 0 || (hr(), Je > 0)) return;
                        function i() {
                            O || (O = !0, r.calledRun = !0, !Ue && (Dr(), L(r), r.onRuntimeInitialized && r.onRuntimeInitialized(), nn()));
                        }
                        r.setStatus ? (r.setStatus("Running..."), setTimeout(function() {
                            setTimeout(function() {
                                r.setStatus("");
                            }, 1), i();
                        }, 1)) : i();
                    }
                    if (r.preInit) for(typeof r.preInit == "function" && (r.preInit = [
                        r.preInit
                    ]); r.preInit.length > 0;)r.preInit.pop()();
                    return E(), r.ready;
                };
            })();
            f.exports = _;
        }(Yn)), Yn.exports;
    }
    var go = ho(), yo = zn(go);
    const _o = new URL("/assets/openjphjs-C-BUUy4a.wasm", import.meta.url), jn = {
        codec: void 0,
        decoder: void 0,
        decodeConfig: {}
    };
    function mo(f, y, _) {
        const R = {
            width: y,
            height: _
        };
        for(; f > 0;)R.width = Math.ceil(R.width / 2), R.height = Math.ceil(R.height / 2), f--;
        return R;
    }
    function bo(f) {
        if (jn.decodeConfig = f, jn.codec) return Promise.resolve();
        const y = yo({
            locateFile: (_)=>_.endsWith(".wasm") ? _o.toString() : _
        });
        return new Promise((_, R)=>{
            y.then((A)=>{
                jn.codec = A, jn.decoder = new A.HTJ2KDecoder, _();
            }, R);
        });
    }
    async function wo(f, y) {
        await bo();
        const _ = new jn.codec.HTJ2KDecoder, R = _.getEncodedBuffer(f.length);
        R.set(f);
        const A = y.decodeLevel || 0;
        _.decodeSubResolution(A);
        const r = _.getFrameInfo();
        if (y.decodeLevel > 0) {
            const { width: Vt, height: Ft } = mo(y.decodeLevel, r.width, r.height);
            r.width = Vt, r.height = Ft;
        }
        const L = _.getDecodedBuffer();
        new Uint8Array(L.length).set(L);
        const W = `x: ${_.getImageOffset().x}, y: ${_.getImageOffset().y}`, N = _.getNumDecompositions(), M = _.getNumLayers(), z = [
            "unknown",
            "LRCP",
            "RLCP",
            "RPCL",
            "PCRL",
            "CPRL"
        ][_.getProgressionOrder() + 1], H = _.getIsReversible(), X = `${_.getBlockDimensions().width} x ${_.getBlockDimensions().height}`, q = `${_.getTileSize().width} x ${_.getTileSize().height}`, te = `${_.getTileOffset().x}, ${_.getTileOffset().y}`, ce = `${L.length.toLocaleString()} bytes`, $e = `${(L.length / R.length).toFixed(2)}:1`, Q = {
            columns: r.width,
            rows: r.height,
            bitsPerPixel: r.bitsPerSample,
            signed: r.isSigned,
            bytesPerPixel: y.bytesPerPixel,
            componentsPerPixel: r.componentCount
        };
        let _e = Po(r, L);
        const { buffer: ge, byteOffset: we, byteLength: Pe } = _e, Ue = ge.slice(we, we + Pe);
        _e = new _e.constructor(Ue);
        const it = {
            imageOffset: W,
            numDecompositions: N,
            numLayers: M,
            progessionOrder: z,
            reversible: H,
            blockDimensions: X,
            tileSize: q,
            tileOffset: te,
            decodedSize: ce,
            compressionRatio: $e
        };
        return {
            ...y,
            pixelData: _e,
            imageInfo: Q,
            encodeOptions: it,
            ...it,
            ...Q
        };
    }
    function Po(f, y) {
        return f.bitsPerSample > 8 ? f.isSigned ? new Int16Array(y.buffer, y.byteOffset, y.byteLength / 2) : new Uint16Array(y.buffer, y.byteOffset, y.byteLength / 2) : f.isSigned ? new Int8Array(y.buffer, y.byteOffset, y.byteLength) : new Uint8Array(y.buffer, y.byteOffset, y.byteLength);
    }
    function To(f, y) {
        const _ = f.length, { rescaleSlope: R, rescaleIntercept: A, suvbw: r, doseGridScaling: L } = y;
        if (y.modality === "PT" && typeof r == "number" && !isNaN(r)) for(let j = 0; j < _; j++)f[j] = r * (f[j] * R + A);
        else if (y.modality === "RTDOSE" && typeof L == "number" && !isNaN(L)) for(let j = 0; j < _; j++)f[j] = f[j] * L;
        else for(let j = 0; j < _; j++)f[j] = f[j] * R + A;
        return !0;
    }
    function Co(f) {
        let y = f[0], _ = f[0], R;
        const A = f.length;
        for(let r = 1; r < A; r++)R = f[r], y = Math.min(y, R), _ = Math.max(_, R);
        return {
            min: y,
            max: _
        };
    }
    function _i(f, y) {
        let _;
        return Number.isInteger(f) && Number.isInteger(y) && (f >= 0 ? y <= 255 ? _ = Uint8Array : y <= 65535 ? _ = Uint16Array : y <= 4294967295 && (_ = Uint32Array) : f >= -128 && y <= 127 ? _ = Int8Array : f >= -32768 && y <= 32767 && (_ = Int16Array)), _ || Float32Array;
    }
    function Ao(f, y, _) {
        return _i(f, y) === _;
    }
    function $o(f) {
        return f === "RGB" || f === "PALETTE COLOR" || f === "YBR_FULL" || f === "YBR_FULL_422" || f === "YBR_PARTIAL_422" || f === "YBR_PARTIAL_420" || f === "YBR_RCT" || f === "YBR_ICT";
    }
    const Ro = {
        bilinear: wi,
        replicate: Pi
    }, li = {
        Uint8Array,
        Uint16Array,
        Int16Array,
        Float32Array,
        Uint32Array
    };
    function Eo(f, y, _, R) {
        const A = f.pixelRepresentation !== void 0 && f.pixelRepresentation === 1, r = A && f.bitsStored !== void 0 ? 32 - f.bitsStored : void 0;
        if (A && r !== void 0) for(let Q = 0; Q < f.pixelData.length; Q++)f.pixelData[Q] = f.pixelData[Q] << r >> r;
        let L = f.pixelData;
        f.pixelDataLength = f.pixelData.length;
        const { min: j, max: W } = Co(f.pixelData), N = typeof y.allowFloatRendering < "u" ? y.allowFloatRendering : !0;
        let M = $o(f.photometricInterpretation) && y.targetBuffer?.offset === void 0;
        const H = y.preScale?.enabled && Object.values(y.preScale.scalingParameters).some((Q)=>typeof Q == "number" && !Number.isInteger(Q)), X = !y.preScale.enabled || !N && H, q = y.targetBuffer?.type;
        if (q && y.preScale.enabled && !X) {
            const Q = y.preScale.scalingParameters, _e = Qn(j, W, Q);
            M = !Ao(_e.min, _e.max, li[q]);
        }
        q && !M ? L = ko(y, f, li, L) : y.preScale.enabled && !X ? L = Do(y, j, W, f) : L = mi(j, W, f);
        let te = j, ce = W;
        if (y.preScale.enabled && !X) {
            const Q = y.preScale.scalingParameters;
            if (bi(Q), So(Q)) {
                To(L, Q), f.preScale = {
                    ...y.preScale,
                    scaled: !0
                };
                const ge = Qn(j, W, Q);
                te = ge.min, ce = ge.max;
            }
        } else X && (f.preScale = {
            enabled: !0,
            scaled: !1
        }, te = j, ce = W);
        f.pixelData = L, f.smallestPixelValue = te, f.largestPixelValue = ce;
        const $e = new Date().getTime();
        return f.decodeTimeInMS = $e - _, f;
    }
    function So(f) {
        const { rescaleSlope: y, rescaleIntercept: _, modality: R, doseGridScaling: A, suvbw: r } = f;
        return typeof y == "number" && typeof _ == "number" || R === "RTDOSE" && typeof A == "number" || R === "PT" && typeof r == "number";
    }
    function ko(f, y, _, R) {
        const { arrayBuffer: A, type: r, offset: L = 0, length: j, rows: W } = f.targetBuffer, N = _[r];
        if (!N) throw new Error(`target array ${r} is not supported, or doesn't exist.`);
        W && W != y.rows && Fo(y, f.targetBuffer, N);
        const M = y.pixelDataLength, z = L, H = j ?? M - z, X = y.pixelData;
        if (H !== X.length) throw new Error(`target array for image does not have the same length (${H}) as the decoded image length (${X.length}).`);
        const q = A ? new N(A, z, H) : new N(H);
        return q.set(X, 0), R = q, R;
    }
    function Do(f, y, _, R) {
        const A = f.preScale.scalingParameters;
        bi(A);
        const r = Qn(y, _, A);
        return mi(r.min, r.max, R);
    }
    function mi(f, y, _) {
        const R = _i(f, y), A = new R(_.pixelData.length);
        return A.set(_.pixelData, 0), A;
    }
    function Qn(f, y, _) {
        const { rescaleSlope: R, rescaleIntercept: A, modality: r, doseGridScaling: L, suvbw: j } = _;
        return r === "PT" && typeof j == "number" && !isNaN(j) ? {
            min: j * (f * R + A),
            max: j * (y * R + A)
        } : r === "RTDOSE" && typeof L == "number" && !isNaN(L) ? {
            min: f * L,
            max: y * L
        } : typeof R == "number" && typeof A == "number" ? {
            min: R * f + A,
            max: R * y + A
        } : {
            min: f,
            max: y
        };
    }
    function bi(f) {
        if (!f) throw new Error("options.preScale.scalingParameters must be defined if preScale.enabled is true, and scalingParameters cannot be derived from the metadata providers.");
    }
    function Oo(f, y, _) {
        const { samplesPerPixel: R } = f, { rows: A, columns: r } = y, L = A * r * R, j = new _(L), W = j.byteLength / L;
        return {
            pixelData: j,
            rows: A,
            columns: r,
            frameInfo: {
                ...f.frameInfo,
                rows: A,
                columns: r
            },
            imageInfo: {
                ...f.imageInfo,
                rows: A,
                columns: r,
                bytesPerPixel: W
            }
        };
    }
    function Fo(f, y, _) {
        const R = Oo(f, y, _), { scalingType: A = "replicate" } = y;
        return Ro[A](f, R), Object.assign(f, R), f.pixelDataLength = f.pixelData.length, f;
    }
    async function Uo(f, y, _, R, A, r) {
        const L = new Date().getTime();
        let j = null, W;
        switch(y){
            case "1.2.840.10008.1.2":
            case "1.2.840.10008.1.2.1":
                j = ni(f, _);
                break;
            case "1.2.840.10008.1.2.2":
                j = xi(f, _);
                break;
            case "1.2.840.10008.1.2.1.99":
                j = ni(f, _);
                break;
            case "1.2.840.10008.1.2.5":
                j = Wi(f, _);
                break;
            case "1.2.840.10008.1.2.4.50":
                W = {
                    ...f
                }, j = Yi(_, W);
                break;
            case "1.2.840.10008.1.2.4.51":
                j = Zi(f, _);
                break;
            case "1.2.840.10008.1.2.4.57":
                j = oi(f, _);
                break;
            case "1.2.840.10008.1.2.4.70":
                j = oi(f, _);
                break;
            case "1.2.840.10008.1.2.4.80":
                W = {
                    signed: f.pixelRepresentation === 1,
                    bytesPerPixel: f.bitsAllocated <= 8 ? 1 : 2,
                    ...f
                }, j = si(_, W);
                break;
            case "1.2.840.10008.1.2.4.81":
                W = {
                    signed: f.pixelRepresentation === 1,
                    bytesPerPixel: f.bitsAllocated <= 8 ? 1 : 2,
                    ...f
                }, j = si(_, W);
                break;
            case "1.2.840.10008.1.2.4.90":
                W = {
                    ...f
                }, j = ci(_, W);
                break;
            case "1.2.840.10008.1.2.4.91":
                W = {
                    ...f
                }, j = ci(_, W);
                break;
            case "3.2.840.10008.1.2.4.96":
            case "1.2.840.10008.1.2.4.201":
            case "1.2.840.10008.1.2.4.202":
            case "1.2.840.10008.1.2.4.203":
                W = {
                    ...f
                }, j = wo(_, W);
                break;
            default:
                throw new Error(`no decoder for transfer syntax ${y}`);
        }
        if (!j) throw new Error("decodePromise not defined");
        const N = await j, M = Eo(N, A, L);
        return r?.(M), M;
    }
    const jo = {
        decodeTask ({ imageFrame: f, transferSyntax: y, decodeConfig: _, options: R, pixelData: A, callbackFn: r }) {
            return Uo(f, y, A, _, R, r);
        }
    };
    Zn(jo);
})();
