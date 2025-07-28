/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const proxyMarker = Symbol("Comlink.proxy");
const createEndpoint = Symbol("Comlink.endpoint");
const releaseProxy = Symbol("Comlink.releaseProxy");
const finalizer = Symbol("Comlink.finalizer");
const throwMarker = Symbol("Comlink.thrown");
const isObject = (val) => typeof val === "object" && val !== null || typeof val === "function";
const proxyTransferHandler = {
  canHandle: (val) => isObject(val) && val[proxyMarker],
  serialize(obj) {
    const { port1, port2 } = new MessageChannel();
    expose(obj, port1);
    return [port2, [port2]];
  },
  deserialize(port) {
    port.start();
    return wrap(port);
  }
};
const throwTransferHandler = {
  canHandle: (value) => isObject(value) && throwMarker in value,
  serialize({ value }) {
    let serialized;
    if (value instanceof Error) {
      serialized = {
        isError: true,
        value: {
          message: value.message,
          name: value.name,
          stack: value.stack
        }
      };
    } else {
      serialized = { isError: false, value };
    }
    return [serialized, []];
  },
  deserialize(serialized) {
    if (serialized.isError) {
      throw Object.assign(new Error(serialized.value.message), serialized.value);
    }
    throw serialized.value;
  }
};
const transferHandlers = /* @__PURE__ */ new Map([
  ["proxy", proxyTransferHandler],
  ["throw", throwTransferHandler]
]);
function isAllowedOrigin(allowedOrigins, origin) {
  for (const allowedOrigin of allowedOrigins) {
    if (origin === allowedOrigin || allowedOrigin === "*") {
      return true;
    }
    if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
      return true;
    }
  }
  return false;
}
function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
  ep.addEventListener("message", function callback(ev) {
    if (!ev || !ev.data) {
      return;
    }
    if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
      console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
      return;
    }
    const { id, type, path } = Object.assign({ path: [] }, ev.data);
    const argumentList = (ev.data.argumentList || []).map(fromWireValue);
    let returnValue;
    try {
      const parent = path.slice(0, -1).reduce((obj2, prop) => obj2[prop], obj);
      const rawValue = path.reduce((obj2, prop) => obj2[prop], obj);
      switch (type) {
        case "GET":
          {
            returnValue = rawValue;
          }
          break;
        case "SET":
          {
            parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
            returnValue = true;
          }
          break;
        case "APPLY":
          {
            returnValue = rawValue.apply(parent, argumentList);
          }
          break;
        case "CONSTRUCT":
          {
            const value = new rawValue(...argumentList);
            returnValue = proxy$1(value);
          }
          break;
        case "ENDPOINT":
          {
            const { port1, port2 } = new MessageChannel();
            expose(obj, port2);
            returnValue = transfer(port1, [port1]);
          }
          break;
        case "RELEASE":
          {
            returnValue = void 0;
          }
          break;
        default:
          return;
      }
    } catch (value) {
      returnValue = { value, [throwMarker]: 0 };
    }
    Promise.resolve(returnValue).catch((value) => {
      return { value, [throwMarker]: 0 };
    }).then((returnValue2) => {
      const [wireValue, transferables] = toWireValue(returnValue2);
      ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
      if (type === "RELEASE") {
        ep.removeEventListener("message", callback);
        closeEndPoint(ep);
        if (finalizer in obj && typeof obj[finalizer] === "function") {
          obj[finalizer]();
        }
      }
    }).catch((error) => {
      const [wireValue, transferables] = toWireValue({
        value: new TypeError("Unserializable return value"),
        [throwMarker]: 0
      });
      ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
    });
  });
  if (ep.start) {
    ep.start();
  }
}
function isMessagePort(endpoint) {
  return endpoint.constructor.name === "MessagePort";
}
function closeEndPoint(endpoint) {
  if (isMessagePort(endpoint))
    endpoint.close();
}
function wrap(ep, target) {
  const pendingListeners = /* @__PURE__ */ new Map();
  ep.addEventListener("message", function handleMessage(ev) {
    const { data } = ev;
    if (!data || !data.id) {
      return;
    }
    const resolver = pendingListeners.get(data.id);
    if (!resolver) {
      return;
    }
    try {
      resolver(data);
    } finally {
      pendingListeners.delete(data.id);
    }
  });
  return createProxy(ep, pendingListeners, [], target);
}
function throwIfProxyReleased(isReleased) {
  if (isReleased) {
    throw new Error("Proxy has been released and is not useable");
  }
}
function releaseEndpoint(ep) {
  return requestResponseMessage(ep, /* @__PURE__ */ new Map(), {
    type: "RELEASE"
  }).then(() => {
    closeEndPoint(ep);
  });
}
const proxyCounter = /* @__PURE__ */ new WeakMap();
const proxyFinalizers = "FinalizationRegistry" in globalThis && new FinalizationRegistry((ep) => {
  const newCount = (proxyCounter.get(ep) || 0) - 1;
  proxyCounter.set(ep, newCount);
  if (newCount === 0) {
    releaseEndpoint(ep);
  }
});
function registerProxy(proxy2, ep) {
  const newCount = (proxyCounter.get(ep) || 0) + 1;
  proxyCounter.set(ep, newCount);
  if (proxyFinalizers) {
    proxyFinalizers.register(proxy2, ep, proxy2);
  }
}
function unregisterProxy(proxy2) {
  if (proxyFinalizers) {
    proxyFinalizers.unregister(proxy2);
  }
}
function createProxy(ep, pendingListeners, path = [], target = function() {
}) {
  let isProxyReleased = false;
  const proxy2 = new Proxy(target, {
    get(_target, prop) {
      throwIfProxyReleased(isProxyReleased);
      if (prop === releaseProxy) {
        return () => {
          unregisterProxy(proxy2);
          releaseEndpoint(ep);
          pendingListeners.clear();
          isProxyReleased = true;
        };
      }
      if (prop === "then") {
        if (path.length === 0) {
          return { then: () => proxy2 };
        }
        const r = requestResponseMessage(ep, pendingListeners, {
          type: "GET",
          path: path.map((p) => p.toString())
        }).then(fromWireValue);
        return r.then.bind(r);
      }
      return createProxy(ep, pendingListeners, [...path, prop]);
    },
    set(_target, prop, rawValue) {
      throwIfProxyReleased(isProxyReleased);
      const [value, transferables] = toWireValue(rawValue);
      return requestResponseMessage(ep, pendingListeners, {
        type: "SET",
        path: [...path, prop].map((p) => p.toString()),
        value
      }, transferables).then(fromWireValue);
    },
    apply(_target, _thisArg, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const last = path[path.length - 1];
      if (last === createEndpoint) {
        return requestResponseMessage(ep, pendingListeners, {
          type: "ENDPOINT"
        }).then(fromWireValue);
      }
      if (last === "bind") {
        return createProxy(ep, pendingListeners, path.slice(0, -1));
      }
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(ep, pendingListeners, {
        type: "APPLY",
        path: path.map((p) => p.toString()),
        argumentList
      }, transferables).then(fromWireValue);
    },
    construct(_target, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(ep, pendingListeners, {
        type: "CONSTRUCT",
        path: path.map((p) => p.toString()),
        argumentList
      }, transferables).then(fromWireValue);
    }
  });
  registerProxy(proxy2, ep);
  return proxy2;
}
function myFlat(arr) {
  return Array.prototype.concat.apply([], arr);
}
function processArguments(argumentList) {
  const processed = argumentList.map(toWireValue);
  return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
}
const transferCache = /* @__PURE__ */ new WeakMap();
function transfer(obj, transfers) {
  transferCache.set(obj, transfers);
  return obj;
}
function proxy$1(obj) {
  return Object.assign(obj, { [proxyMarker]: true });
}
function toWireValue(value) {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const [serializedValue, transferables] = handler.serialize(value);
      return [
        {
          type: "HANDLER",
          name,
          value: serializedValue
        },
        transferables
      ];
    }
  }
  return [
    {
      type: "RAW",
      value
    },
    transferCache.get(value) || []
  ];
}
function fromWireValue(value) {
  switch (value.type) {
    case "HANDLER":
      return transferHandlers.get(value.name).deserialize(value.value);
    case "RAW":
      return value.value;
  }
}
function requestResponseMessage(ep, pendingListeners, msg, transfers) {
  return new Promise((resolve) => {
    const id = generateUUID();
    pendingListeners.set(id, resolve);
    if (ep.start) {
      ep.start();
    }
    ep.postMessage(Object.assign({ id }, msg), transfers);
  });
}
function generateUUID() {
  return new Array(4).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
}

function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      var isInstance = false;
      try {
        isInstance = this instanceof a2;
      } catch {
      }
      if (isInstance) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}

var fastDeepEqual;
var hasRequiredFastDeepEqual;

function requireFastDeepEqual () {
	if (hasRequiredFastDeepEqual) return fastDeepEqual;
	hasRequiredFastDeepEqual = 1;

	// do not edit .js files directly - edit src/index.jst



	fastDeepEqual = function equal(a, b) {
	  if (a === b) return true;

	  if (a && b && typeof a == 'object' && typeof b == 'object') {
	    if (a.constructor !== b.constructor) return false;

	    var length, i, keys;
	    if (Array.isArray(a)) {
	      length = a.length;
	      if (length != b.length) return false;
	      for (i = length; i-- !== 0;)
	        if (!equal(a[i], b[i])) return false;
	      return true;
	    }



	    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
	    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
	    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

	    keys = Object.keys(a);
	    length = keys.length;
	    if (length !== Object.keys(b).length) return false;

	    for (i = length; i-- !== 0;)
	      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

	    for (i = length; i-- !== 0;) {
	      var key = keys[i];

	      if (!equal(a[key], b[key])) return false;
	    }

	    return true;
	  }

	  // true if both NaN, false otherwise
	  return a!==a && b!==b;
	};
	return fastDeepEqual;
}

var fastDeepEqualExports = requireFastDeepEqual();
var DeepEqual = /*@__PURE__*/getDefaultExportFromCjs(fastDeepEqualExports);

var isArguments;
var hasRequiredIsArguments;

function requireIsArguments () {
	if (hasRequiredIsArguments) return isArguments;
	hasRequiredIsArguments = 1;

	var toStr = Object.prototype.toString;

	isArguments = function isArguments(value) {
		var str = toStr.call(value);
		var isArgs = str === '[object Arguments]';
		if (!isArgs) {
			isArgs = str !== '[object Array]' &&
				value !== null &&
				typeof value === 'object' &&
				typeof value.length === 'number' &&
				value.length >= 0 &&
				toStr.call(value.callee) === '[object Function]';
		}
		return isArgs;
	};
	return isArguments;
}

var implementation;
var hasRequiredImplementation;

function requireImplementation () {
	if (hasRequiredImplementation) return implementation;
	hasRequiredImplementation = 1;
	var keysShim;
	if (!Object.keys) {
	  var has = Object.prototype.hasOwnProperty;
	  var toStr = Object.prototype.toString;
	  var isArgs = requireIsArguments();
	  var isEnumerable = Object.prototype.propertyIsEnumerable;
	  var hasDontEnumBug = !isEnumerable.call({ toString: null }, "toString");
	  var hasProtoEnumBug = isEnumerable.call(function() {
	  }, "prototype");
	  var dontEnums = [
	    "toString",
	    "toLocaleString",
	    "valueOf",
	    "hasOwnProperty",
	    "isPrototypeOf",
	    "propertyIsEnumerable",
	    "constructor"
	  ];
	  var equalsConstructorPrototype = function(o) {
	    var ctor = o.constructor;
	    return ctor && ctor.prototype === o;
	  };
	  var excludedKeys = {
	    $applicationCache: true,
	    $console: true,
	    $external: true,
	    $frame: true,
	    $frameElement: true,
	    $frames: true,
	    $innerHeight: true,
	    $innerWidth: true,
	    $onmozfullscreenchange: true,
	    $onmozfullscreenerror: true,
	    $outerHeight: true,
	    $outerWidth: true,
	    $pageXOffset: true,
	    $pageYOffset: true,
	    $parent: true,
	    $scrollLeft: true,
	    $scrollTop: true,
	    $scrollX: true,
	    $scrollY: true,
	    $self: true,
	    $webkitIndexedDB: true,
	    $webkitStorageInfo: true,
	    $window: true
	  };
	  var hasAutomationEqualityBug = function() {
	    if (typeof window === "undefined") {
	      return false;
	    }
	    for (var k in window) {
	      try {
	        if (!excludedKeys["$" + k] && has.call(window, k) && window[k] !== null && typeof window[k] === "object") {
	          try {
	            equalsConstructorPrototype(window[k]);
	          } catch (e) {
	            return true;
	          }
	        }
	      } catch (e) {
	        return true;
	      }
	    }
	    return false;
	  }();
	  var equalsConstructorPrototypeIfNotBuggy = function(o) {
	    if (typeof window === "undefined" || !hasAutomationEqualityBug) {
	      return equalsConstructorPrototype(o);
	    }
	    try {
	      return equalsConstructorPrototype(o);
	    } catch (e) {
	      return false;
	    }
	  };
	  keysShim = function keys(object) {
	    var isObject = object !== null && typeof object === "object";
	    var isFunction = toStr.call(object) === "[object Function]";
	    var isArguments = isArgs(object);
	    var isString = isObject && toStr.call(object) === "[object String]";
	    var theKeys = [];
	    if (!isObject && !isFunction && !isArguments) {
	      throw new TypeError("Object.keys called on a non-object");
	    }
	    var skipProto = hasProtoEnumBug && isFunction;
	    if (isString && object.length > 0 && !has.call(object, 0)) {
	      for (var i = 0; i < object.length; ++i) {
	        theKeys.push(String(i));
	      }
	    }
	    if (isArguments && object.length > 0) {
	      for (var j = 0; j < object.length; ++j) {
	        theKeys.push(String(j));
	      }
	    } else {
	      for (var name in object) {
	        if (!(skipProto && name === "prototype") && has.call(object, name)) {
	          theKeys.push(String(name));
	        }
	      }
	    }
	    if (hasDontEnumBug) {
	      var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);
	      for (var k = 0; k < dontEnums.length; ++k) {
	        if (!(skipConstructor && dontEnums[k] === "constructor") && has.call(object, dontEnums[k])) {
	          theKeys.push(dontEnums[k]);
	        }
	      }
	    }
	    return theKeys;
	  };
	}
	implementation = keysShim;
	return implementation;
}

var objectKeys;
var hasRequiredObjectKeys;

function requireObjectKeys () {
	if (hasRequiredObjectKeys) return objectKeys;
	hasRequiredObjectKeys = 1;

	var slice = Array.prototype.slice;
	var isArgs = requireIsArguments();

	var origKeys = Object.keys;
	var keysShim = origKeys ? function keys(o) { return origKeys(o); } : requireImplementation();

	var originalKeys = Object.keys;

	keysShim.shim = function shimObjectKeys() {
		if (Object.keys) {
			var keysWorksWithArguments = (function () {
				// Safari 5.0 bug
				var args = Object.keys(arguments);
				return args && args.length === arguments.length;
			}(1, 2));
			if (!keysWorksWithArguments) {
				Object.keys = function keys(object) { // eslint-disable-line func-name-matching
					if (isArgs(object)) {
						return originalKeys(slice.call(object));
					}
					return originalKeys(object);
				};
			}
		} else {
			Object.keys = keysShim;
		}
		return Object.keys || keysShim;
	};

	objectKeys = keysShim;
	return objectKeys;
}

var esDefineProperty;
var hasRequiredEsDefineProperty;

function requireEsDefineProperty () {
	if (hasRequiredEsDefineProperty) return esDefineProperty;
	hasRequiredEsDefineProperty = 1;

	/** @type {import('.')} */
	var $defineProperty = Object.defineProperty || false;
	if ($defineProperty) {
		try {
			$defineProperty({}, 'a', { value: 1 });
		} catch (e) {
			// IE 8 has a broken defineProperty
			$defineProperty = false;
		}
	}

	esDefineProperty = $defineProperty;
	return esDefineProperty;
}

var syntax;
var hasRequiredSyntax;

function requireSyntax () {
	if (hasRequiredSyntax) return syntax;
	hasRequiredSyntax = 1;

	/** @type {import('./syntax')} */
	syntax = SyntaxError;
	return syntax;
}

var type;
var hasRequiredType;

function requireType () {
	if (hasRequiredType) return type;
	hasRequiredType = 1;

	/** @type {import('./type')} */
	type = TypeError;
	return type;
}

var gOPD;
var hasRequiredGOPD;

function requireGOPD () {
	if (hasRequiredGOPD) return gOPD;
	hasRequiredGOPD = 1;

	/** @type {import('./gOPD')} */
	gOPD = Object.getOwnPropertyDescriptor;
	return gOPD;
}

var gopd;
var hasRequiredGopd;

function requireGopd () {
	if (hasRequiredGopd) return gopd;
	hasRequiredGopd = 1;

	/** @type {import('.')} */
	var $gOPD = /*@__PURE__*/ requireGOPD();

	if ($gOPD) {
		try {
			$gOPD([], 'length');
		} catch (e) {
			// IE 8 has a broken gOPD
			$gOPD = null;
		}
	}

	gopd = $gOPD;
	return gopd;
}

var defineDataProperty;
var hasRequiredDefineDataProperty;

function requireDefineDataProperty () {
	if (hasRequiredDefineDataProperty) return defineDataProperty;
	hasRequiredDefineDataProperty = 1;

	var $defineProperty = /*@__PURE__*/ requireEsDefineProperty();

	var $SyntaxError = /*@__PURE__*/ requireSyntax();
	var $TypeError = /*@__PURE__*/ requireType();

	var gopd = /*@__PURE__*/ requireGopd();

	/** @type {import('.')} */
	defineDataProperty = function defineDataProperty(
		obj,
		property,
		value
	) {
		if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
			throw new $TypeError('`obj` must be an object or a function`');
		}
		if (typeof property !== 'string' && typeof property !== 'symbol') {
			throw new $TypeError('`property` must be a string or a symbol`');
		}
		if (arguments.length > 3 && typeof arguments[3] !== 'boolean' && arguments[3] !== null) {
			throw new $TypeError('`nonEnumerable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 4 && typeof arguments[4] !== 'boolean' && arguments[4] !== null) {
			throw new $TypeError('`nonWritable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 5 && typeof arguments[5] !== 'boolean' && arguments[5] !== null) {
			throw new $TypeError('`nonConfigurable`, if provided, must be a boolean or null');
		}
		if (arguments.length > 6 && typeof arguments[6] !== 'boolean') {
			throw new $TypeError('`loose`, if provided, must be a boolean');
		}

		var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
		var nonWritable = arguments.length > 4 ? arguments[4] : null;
		var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
		var loose = arguments.length > 6 ? arguments[6] : false;

		/* @type {false | TypedPropertyDescriptor<unknown>} */
		var desc = !!gopd && gopd(obj, property);

		if ($defineProperty) {
			$defineProperty(obj, property, {
				configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
				enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
				value: value,
				writable: nonWritable === null && desc ? desc.writable : !nonWritable
			});
		} else if (loose || (!nonEnumerable && !nonWritable && !nonConfigurable)) {
			// must fall back to [[Set]], and was not explicitly asked to make non-enumerable, non-writable, or non-configurable
			obj[property] = value; // eslint-disable-line no-param-reassign
		} else {
			throw new $SyntaxError('This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.');
		}
	};
	return defineDataProperty;
}

var hasPropertyDescriptors_1;
var hasRequiredHasPropertyDescriptors;

function requireHasPropertyDescriptors () {
	if (hasRequiredHasPropertyDescriptors) return hasPropertyDescriptors_1;
	hasRequiredHasPropertyDescriptors = 1;

	var $defineProperty = /*@__PURE__*/ requireEsDefineProperty();

	var hasPropertyDescriptors = function hasPropertyDescriptors() {
		return !!$defineProperty;
	};

	hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
		// node v0.6 has a bug where array lengths can be Set but not Defined
		if (!$defineProperty) {
			return null;
		}
		try {
			return $defineProperty([], 'length', { value: 1 }).length !== 1;
		} catch (e) {
			// In Firefox 4-22, defining length on an array throws an exception.
			return true;
		}
	};

	hasPropertyDescriptors_1 = hasPropertyDescriptors;
	return hasPropertyDescriptors_1;
}

var defineProperties_1;
var hasRequiredDefineProperties;

function requireDefineProperties () {
	if (hasRequiredDefineProperties) return defineProperties_1;
	hasRequiredDefineProperties = 1;

	var keys = requireObjectKeys();
	var hasSymbols = typeof Symbol === 'function' && typeof Symbol('foo') === 'symbol';

	var toStr = Object.prototype.toString;
	var concat = Array.prototype.concat;
	var defineDataProperty = /*@__PURE__*/ requireDefineDataProperty();

	var isFunction = function (fn) {
		return typeof fn === 'function' && toStr.call(fn) === '[object Function]';
	};

	var supportsDescriptors = /*@__PURE__*/ requireHasPropertyDescriptors()();

	var defineProperty = function (object, name, value, predicate) {
		if (name in object) {
			if (predicate === true) {
				if (object[name] === value) {
					return;
				}
			} else if (!isFunction(predicate) || !predicate()) {
				return;
			}
		}

		if (supportsDescriptors) {
			defineDataProperty(object, name, value, true);
		} else {
			defineDataProperty(object, name, value);
		}
	};

	var defineProperties = function (object, map) {
		var predicates = arguments.length > 2 ? arguments[2] : {};
		var props = keys(map);
		if (hasSymbols) {
			props = concat.call(props, Object.getOwnPropertySymbols(map));
		}
		for (var i = 0; i < props.length; i += 1) {
			defineProperty(object, props[i], map[props[i]], predicates[props[i]]);
		}
	};

	defineProperties.supportsDescriptors = !!supportsDescriptors;

	defineProperties_1 = defineProperties;
	return defineProperties_1;
}

var implementation_browser = {exports: {}};

/* eslint no-negated-condition: 0, no-new-func: 0 */

var hasRequiredImplementation_browser;

function requireImplementation_browser () {
	if (hasRequiredImplementation_browser) return implementation_browser.exports;
	hasRequiredImplementation_browser = 1;

	if (typeof self !== 'undefined') {
		implementation_browser.exports = self;
	} else if (typeof window !== 'undefined') {
		implementation_browser.exports = window;
	} else {
		implementation_browser.exports = Function('return this')();
	}
	return implementation_browser.exports;
}

var polyfill;
var hasRequiredPolyfill;

function requirePolyfill () {
	if (hasRequiredPolyfill) return polyfill;
	hasRequiredPolyfill = 1;
	var implementation = requireImplementation_browser();
	polyfill = function getPolyfill() {
	  if (typeof globalThis !== "object" || !globalThis || globalThis.Math !== Math || globalThis.Array !== Array) {
	    return implementation;
	  }
	  return globalThis;
	};
	return polyfill;
}

var shim;
var hasRequiredShim;

function requireShim () {
	if (hasRequiredShim) return shim;
	hasRequiredShim = 1;
	var define = requireDefineProperties();
	var getPolyfill = requirePolyfill();
	shim = function shimGlobal() {
	  var polyfill = getPolyfill();
	  if (define.supportsDescriptors) {
	    var descriptor = Object.getOwnPropertyDescriptor(polyfill, "globalThis");
	    if (!descriptor || descriptor.configurable && (descriptor.enumerable || !descriptor.writable || globalThis !== polyfill)) {
	      Object.defineProperty(polyfill, "globalThis", {
	        configurable: true,
	        enumerable: false,
	        value: polyfill,
	        writable: true
	      });
	    }
	  } else if (typeof globalThis !== "object" || globalThis !== polyfill) {
	    polyfill.globalThis = polyfill;
	  }
	  return polyfill;
	};
	return shim;
}

var globalthis;
var hasRequiredGlobalthis;

function requireGlobalthis () {
	if (hasRequiredGlobalthis) return globalthis;
	hasRequiredGlobalthis = 1;

	var defineProperties = requireDefineProperties();

	var implementation = requireImplementation_browser();
	var getPolyfill = requirePolyfill();
	var shim = requireShim();

	var polyfill = getPolyfill();

	var getGlobal = function () { return polyfill; };

	defineProperties(getGlobal, {
		getPolyfill: getPolyfill,
		implementation: implementation,
		shim: shim
	});

	globalthis = getGlobal;
	return globalthis;
}

var globalthisExports = requireGlobalthis();
var globalThisShim = /* @__PURE__ */ getDefaultExportFromCjs(globalthisExports);

const vtkGlobal = globalThisShim();
const factoryMapping = {
  vtkObject: () => null
};
function vtk(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (obj.isA) {
    return obj;
  }
  if (!obj.vtkClass) {
    if (vtkGlobal.console && vtkGlobal.console.error) {
      vtkGlobal.console.error("Invalid VTK object");
    }
    return null;
  }
  const constructor = factoryMapping[obj.vtkClass];
  if (!constructor) {
    if (vtkGlobal.console && vtkGlobal.console.error) {
      vtkGlobal.console.error(`No vtk class found for Object of type ${obj.vtkClass}`);
    }
    return null;
  }
  const model = {
    ...obj
  };
  Object.keys(model).forEach((keyName) => {
    if (model[keyName] && typeof model[keyName] === "object" && model[keyName].vtkClass) {
      model[keyName] = vtk(model[keyName]);
    }
  });
  const newInst = constructor(model);
  if (newInst && newInst.modified) {
    newInst.modified();
  }
  return newInst;
}
function register(vtkClassName, constructor) {
  factoryMapping[vtkClassName] = constructor;
}
vtk.register = register;

/* eslint-disable prefer-rest-params */
class ClassHierarchy extends Array {
  push() {
    for (let i = 0; i < arguments.length; i++) {
      if (!this.includes(arguments[i])) {
        super.push(arguments[i]);
      }
    }
    return this.length;
  }
}

let globalMTime = 0;
const VOID = Symbol("void");
function getCurrentGlobalMTime() {
  return globalMTime;
}
const fakeConsole = {};
function noOp() {
}
const consoleMethods = ["log", "debug", "info", "warn", "error", "time", "timeEnd", "group", "groupEnd"];
consoleMethods.forEach((methodName) => {
  fakeConsole[methodName] = noOp;
});
vtkGlobal.console = console.hasOwnProperty("log") ? console : fakeConsole;
const loggerFunctions = {
  debug: noOp,
  // Don't print debug by default
  error: vtkGlobal.console.error || noOp,
  info: vtkGlobal.console.info || noOp,
  log: vtkGlobal.console.log || noOp,
  warn: vtkGlobal.console.warn || noOp
};
function setLoggerFunction(name, fn) {
  if (loggerFunctions[name]) {
    loggerFunctions[name] = fn || noOp;
  }
}
function vtkLogMacro() {
  loggerFunctions.log(...arguments);
}
function vtkInfoMacro() {
  loggerFunctions.info(...arguments);
}
function vtkDebugMacro() {
  loggerFunctions.debug(...arguments);
}
function vtkErrorMacro$6() {
  loggerFunctions.error(...arguments);
}
function vtkWarningMacro$4() {
  loggerFunctions.warn(...arguments);
}
const ERROR_ONCE_MAP = {};
function vtkOnceErrorMacro(str) {
  if (!ERROR_ONCE_MAP[str]) {
    loggerFunctions.error(str);
    ERROR_ONCE_MAP[str] = true;
  }
}
const TYPED_ARRAYS = /* @__PURE__ */ Object.create(null);
TYPED_ARRAYS.Float32Array = Float32Array;
TYPED_ARRAYS.Float64Array = Float64Array;
TYPED_ARRAYS.Uint8Array = Uint8Array;
TYPED_ARRAYS.Int8Array = Int8Array;
TYPED_ARRAYS.Uint16Array = Uint16Array;
TYPED_ARRAYS.Int16Array = Int16Array;
TYPED_ARRAYS.Uint32Array = Uint32Array;
TYPED_ARRAYS.Int32Array = Int32Array;
TYPED_ARRAYS.Uint8ClampedArray = Uint8ClampedArray;
try {
  TYPED_ARRAYS.BigInt64Array = BigInt64Array;
  TYPED_ARRAYS.BigUint64Array = BigUint64Array;
} catch {
}
function newTypedArray(type) {
  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }
  return new (TYPED_ARRAYS[type] || Float64Array)(...args);
}
function newTypedArrayFrom(type) {
  for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    args[_key2 - 1] = arguments[_key2];
  }
  return (TYPED_ARRAYS[type] || Float64Array).from(...args);
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function _capitalize(str) {
  return capitalize(str[0] === "_" ? str.slice(1) : str);
}
function uncapitalize(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
function formatBytesToProperUnit(size) {
  let precision = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 2;
  let chunkSize = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 1e3;
  const units = ["TB", "GB", "MB", "KB"];
  let value = Number(size);
  let currentUnit = "B";
  while (value > chunkSize) {
    value /= chunkSize;
    currentUnit = units.pop();
  }
  return `${value.toFixed(precision)} ${currentUnit}`;
}
function formatNumbersWithThousandSeparator(n) {
  let separator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : " ";
  const sections = [];
  let size = n;
  while (size > 1e3) {
    sections.push(`000${size % 1e3}`.slice(-3));
    size = Math.floor(size / 1e3);
  }
  if (size > 0) {
    sections.push(size);
  }
  sections.reverse();
  return sections.join(separator);
}
function safeArrays(model) {
  Object.keys(model).forEach((key) => {
    if (Array.isArray(model[key])) {
      model[key] = [].concat(model[key]);
    }
  });
}
function isTypedArray(value) {
  return Object.values(TYPED_ARRAYS).some((ctor) => value instanceof ctor);
}
function shallowEquals(a, b) {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  return false;
}
function enumToString(e, value) {
  return Object.keys(e).find((key) => e[key] === value);
}
function getStateArrayMapFunc(item) {
  if (item && item.isA) {
    return item.getState();
  }
  return item;
}
function setImmediateVTK(fn) {
  setTimeout(fn, 0);
}
function measurePromiseExecution(promise, callback) {
  const start = performance.now();
  promise.finally(() => {
    const delta = performance.now() - start;
    callback(delta);
  });
}
function obj() {
  let publicAPI = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
  let model = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  safeArrays(model);
  const callbacks = [];
  if (!Number.isInteger(model.mtime)) {
    model.mtime = ++globalMTime;
  }
  if (!("classHierarchy" in model)) {
    model.classHierarchy = new ClassHierarchy("vtkObject");
  } else if (!(model.classHierarchy instanceof ClassHierarchy)) {
    const hierarchy = new ClassHierarchy();
    for (let i = 0; i < model.classHierarchy.length; i++) {
      hierarchy.push(model.classHierarchy[i]);
    }
    model.classHierarchy = hierarchy;
  }
  function off(index) {
    callbacks[index] = null;
  }
  function on(index) {
    function unsubscribe() {
      off(index);
    }
    return Object.freeze({
      unsubscribe
    });
  }
  publicAPI.isDeleted = () => !!model.deleted;
  publicAPI.modified = (otherMTime) => {
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    if (otherMTime && otherMTime < publicAPI.getMTime()) {
      return;
    }
    model.mtime = ++globalMTime;
    callbacks.forEach((callback) => callback && callback(publicAPI));
  };
  publicAPI.onModified = (callback) => {
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return null;
    }
    const index = callbacks.length;
    callbacks.push(callback);
    return on(index);
  };
  publicAPI.getMTime = () => model.mtime;
  publicAPI.isA = (className) => {
    let count = model.classHierarchy.length;
    while (count--) {
      if (model.classHierarchy[count] === className) {
        return true;
      }
    }
    return false;
  };
  publicAPI.getClassName = function() {
    let depth = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
    return model.classHierarchy[model.classHierarchy.length - 1 - depth];
  };
  publicAPI.set = function() {
    let map = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    let noWarning = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
    let noFunction = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    let ret = false;
    Object.keys(map).forEach((name) => {
      const fn = noFunction ? null : publicAPI[`set${capitalize(name)}`];
      if (fn && Array.isArray(map[name]) && fn.length > 1) {
        ret = fn(...map[name]) || ret;
      } else if (fn) {
        ret = fn(map[name]) || ret;
      } else {
        if (["mtime"].indexOf(name) === -1 && !noWarning) {
          vtkWarningMacro$4(`Warning: Set value to model directly ${name}, ${map[name]}`);
        }
        ret = model[name] !== map[name] || ret;
        model[name] = map[name];
      }
    });
    return ret;
  };
  publicAPI.get = function() {
    for (var _len3 = arguments.length, list = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      list[_key3] = arguments[_key3];
    }
    if (!list.length) {
      return model;
    }
    const subset = {};
    list.forEach((name) => {
      subset[name] = model[name];
    });
    return subset;
  };
  publicAPI.getReferenceByName = (val) => model[val];
  publicAPI.delete = () => {
    Object.keys(model).forEach((field) => delete model[field]);
    callbacks.forEach((el, index) => off(index));
    model.deleted = true;
  };
  publicAPI.getState = () => {
    if (model.deleted) {
      return null;
    }
    const jsonArchive = {
      ...model,
      vtkClass: publicAPI.getClassName()
    };
    Object.keys(jsonArchive).forEach((keyName) => {
      if (jsonArchive[keyName] === null || jsonArchive[keyName] === void 0 || keyName[0] === "_") {
        delete jsonArchive[keyName];
      } else if (jsonArchive[keyName].isA) {
        jsonArchive[keyName] = jsonArchive[keyName].getState();
      } else if (Array.isArray(jsonArchive[keyName])) {
        jsonArchive[keyName] = jsonArchive[keyName].map(getStateArrayMapFunc);
      } else if (isTypedArray(jsonArchive[keyName])) {
        jsonArchive[keyName] = Array.from(jsonArchive[keyName]);
      }
    });
    const sortedObj = {};
    Object.keys(jsonArchive).sort().forEach((name) => {
      sortedObj[name] = jsonArchive[name];
    });
    if (sortedObj.mtime) {
      delete sortedObj.mtime;
    }
    return sortedObj;
  };
  publicAPI.shallowCopy = function(other) {
    let debug = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
    if (other.getClassName() !== publicAPI.getClassName()) {
      throw new Error(`Cannot ShallowCopy ${other.getClassName()} into ${publicAPI.getClassName()}`);
    }
    const otherModel = other.get();
    const keyList = Object.keys(model).sort();
    const otherKeyList = Object.keys(otherModel).sort();
    otherKeyList.forEach((key) => {
      const keyIdx = keyList.indexOf(key);
      if (keyIdx === -1) {
        if (debug) {
          vtkDebugMacro(`add ${key} in shallowCopy`);
        }
      } else {
        keyList.splice(keyIdx, 1);
      }
      model[key] = otherModel[key];
    });
    if (keyList.length && debug) {
      vtkDebugMacro(`Untouched keys: ${keyList.join(", ")}`);
    }
    publicAPI.modified();
  };
  publicAPI.toJSON = function vtkObjToJSON() {
    return publicAPI.getState();
  };
  return publicAPI;
}
const objectGetterMap = {
  object(publicAPI, model, field) {
    return function getter() {
      return {
        ...model[field.name]
      };
    };
  }
};
function get(publicAPI, model, fieldNames) {
  fieldNames.forEach((field) => {
    if (typeof field === "object") {
      const getter = objectGetterMap[field.type];
      if (getter) {
        publicAPI[`get${_capitalize(field.name)}`] = getter(publicAPI, model, field);
      } else {
        publicAPI[`get${_capitalize(field.name)}`] = () => model[field.name];
      }
    } else {
      publicAPI[`get${_capitalize(field)}`] = () => model[field];
    }
  });
}
const objectSetterMap = {
  enum(publicAPI, model, field) {
    const onChanged = `_on${_capitalize(field.name)}Changed`;
    return (value) => {
      if (typeof value === "string") {
        if (field.enum[value] !== void 0) {
          if (model[field.name] !== field.enum[value]) {
            model[field.name] = field.enum[value];
            publicAPI.modified();
            return true;
          }
          return false;
        }
        vtkErrorMacro$6(`Set Enum with invalid argument ${field}, ${value}`);
        throw new RangeError("Set Enum with invalid string argument");
      }
      if (typeof value === "number") {
        if (model[field.name] !== value) {
          if (Object.keys(field.enum).map((key) => field.enum[key]).indexOf(value) !== -1) {
            const previousValue = model[field.name];
            model[field.name] = value;
            model[onChanged]?.(publicAPI, model, value, previousValue);
            publicAPI.modified();
            return true;
          }
          vtkErrorMacro$6(`Set Enum outside numeric range ${field}, ${value}`);
          throw new RangeError("Set Enum outside numeric range");
        }
        return false;
      }
      vtkErrorMacro$6(`Set Enum with invalid argument (String/Number) ${field}, ${value}`);
      throw new TypeError("Set Enum with invalid argument (String/Number)");
    };
  },
  object(publicAPI, model, field) {
    const onChanged = `_on${_capitalize(field.name)}Changed`;
    return (value) => {
      if (!DeepEqual(model[field.name], value)) {
        const previousValue = model[field.name];
        model[field.name] = value;
        model[onChanged]?.(publicAPI, model, value, previousValue);
        publicAPI.modified();
        return true;
      }
      return false;
    };
  }
};
function findSetter(field) {
  if (typeof field === "object") {
    const fn = objectSetterMap[field.type];
    if (fn) {
      return (publicAPI, model) => fn(publicAPI, model, field);
    }
    vtkErrorMacro$6(`No setter for field ${field}`);
    throw new TypeError("No setter for field");
  }
  return function getSetter(publicAPI, model) {
    const onChanged = `_on${_capitalize(field)}Changed`;
    return function setter(value) {
      if (model.deleted) {
        vtkErrorMacro$6("instance deleted - cannot call any method");
        return false;
      }
      if (model[field] !== value) {
        const previousValue = model[field.name];
        model[field] = value;
        model[onChanged]?.(publicAPI, model, value, previousValue);
        publicAPI.modified();
        return true;
      }
      return false;
    };
  };
}
function set(publicAPI, model, fields) {
  fields.forEach((field) => {
    if (typeof field === "object") {
      publicAPI[`set${_capitalize(field.name)}`] = findSetter(field)(publicAPI, model);
    } else {
      publicAPI[`set${_capitalize(field)}`] = findSetter(field)(publicAPI, model);
    }
  });
}
function setGet(publicAPI, model, fieldNames) {
  get(publicAPI, model, fieldNames);
  set(publicAPI, model, fieldNames);
}
function getArray(publicAPI, model, fieldNames) {
  fieldNames.forEach((field) => {
    publicAPI[`get${_capitalize(field)}`] = () => model[field] ? Array.from(model[field]) : model[field];
    publicAPI[`get${_capitalize(field)}ByReference`] = () => model[field];
  });
}
function setArray(publicAPI, model, fieldNames, size) {
  let defaultVal = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : void 0;
  fieldNames.forEach((field) => {
    if (model[field] && size && model[field].length !== size) {
      throw new RangeError(`Invalid initial number of values for array (${field})`);
    }
    const onChanged = `_on${_capitalize(field)}Changed`;
    publicAPI[`set${_capitalize(field)}`] = function() {
      if (model.deleted) {
        vtkErrorMacro$6("instance deleted - cannot call any method");
        return false;
      }
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      let array = args;
      let changeDetected;
      let needCopy = false;
      if (array.length === 1 && (array[0] == null || array[0].length >= 0)) {
        array = array[0];
        needCopy = true;
      }
      if (array == null) {
        changeDetected = model[field] !== array;
      } else {
        if (size && array.length !== size) {
          if (array.length < size && defaultVal !== void 0) {
            array = Array.from(array);
            needCopy = false;
            while (array.length < size) array.push(defaultVal);
          } else {
            throw new RangeError(`Invalid number of values for array setter (${field})`);
          }
        }
        changeDetected = model[field] == null || model[field].length !== array.length;
        for (let i = 0; !changeDetected && i < array.length; ++i) {
          changeDetected = model[field][i] !== array[i];
        }
        if (changeDetected && needCopy) {
          array = Array.from(array);
        }
      }
      if (changeDetected) {
        const previousValue = model[field.name];
        model[field] = array;
        model[onChanged]?.(publicAPI, model, array, previousValue);
        publicAPI.modified();
      }
      return changeDetected;
    };
    publicAPI[`set${_capitalize(field)}From`] = (otherArray) => {
      const target = model[field];
      otherArray.forEach((v, i) => {
        target[i] = v;
      });
    };
  });
}
function setGetArray(publicAPI, model, fieldNames, size) {
  let defaultVal = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : void 0;
  getArray(publicAPI, model, fieldNames);
  setArray(publicAPI, model, fieldNames, size, defaultVal);
}
function moveToProtected(publicAPI, model, fieldNames) {
  for (let i = 0; i < fieldNames.length; i++) {
    const fieldName = fieldNames[i];
    if (model[fieldName] !== void 0) {
      model[`_${fieldName}`] = model[fieldName];
      delete model[fieldName];
    }
  }
}
function algo(publicAPI, model, numberOfInputs, numberOfOutputs) {
  if (model.inputData) {
    model.inputData = model.inputData.map(vtk);
  } else {
    model.inputData = [];
  }
  if (model.inputConnection) {
    model.inputConnection = model.inputConnection.map(vtk);
  } else {
    model.inputConnection = [];
  }
  if (model.output) {
    model.output = model.output.map(vtk);
  } else {
    model.output = [];
  }
  if (model.inputArrayToProcess) {
    model.inputArrayToProcess = model.inputArrayToProcess.map(vtk);
  } else {
    model.inputArrayToProcess = [];
  }
  model.numberOfInputs = numberOfInputs;
  function setInputData(dataset) {
    let port = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    if (port >= model.numberOfInputs) {
      vtkErrorMacro$6(`algorithm ${publicAPI.getClassName()} only has ${model.numberOfInputs} input ports. To add more input ports, use addInputData()`);
      return;
    }
    if (model.inputData[port] !== dataset || model.inputConnection[port]) {
      model.inputData[port] = dataset;
      model.inputConnection[port] = null;
      if (publicAPI.modified) {
        publicAPI.modified();
      }
    }
  }
  function getInputData() {
    let port = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
    if (model.inputConnection[port]) {
      model.inputData[port] = model.inputConnection[port]();
    }
    return model.inputData[port];
  }
  function setInputConnection(outputPort) {
    let port = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    if (port >= model.numberOfInputs) {
      let msg = `algorithm ${publicAPI.getClassName()} only has `;
      msg += `${model.numberOfInputs}`;
      msg += " input ports. To add more input ports, use addInputConnection()";
      vtkErrorMacro$6(msg);
      return;
    }
    model.inputData[port] = null;
    model.inputConnection[port] = outputPort;
  }
  function getInputConnection() {
    let port = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
    return model.inputConnection[port];
  }
  function getPortToFill() {
    let portToFill = model.numberOfInputs;
    while (portToFill && !model.inputData[portToFill - 1] && !model.inputConnection[portToFill - 1]) {
      portToFill--;
    }
    if (portToFill === model.numberOfInputs) {
      model.numberOfInputs++;
    }
    return portToFill;
  }
  function addInputConnection(outputPort) {
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    setInputConnection(outputPort, getPortToFill());
  }
  function addInputData(dataset) {
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    setInputData(dataset, getPortToFill());
  }
  function getOutputData() {
    let port = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return null;
    }
    if (publicAPI.shouldUpdate()) {
      publicAPI.update();
    }
    return model.output[port];
  }
  publicAPI.shouldUpdate = () => {
    const localMTime = publicAPI.getMTime();
    let minOutputMTime = Infinity;
    let count = numberOfOutputs;
    while (count--) {
      if (!model.output[count] || model.output[count].isDeleted()) {
        return true;
      }
      const mt = model.output[count].getMTime();
      if (mt < localMTime) {
        return true;
      }
      if (mt < minOutputMTime) {
        minOutputMTime = mt;
      }
    }
    count = model.numberOfInputs;
    while (count--) {
      if (model.inputConnection[count]?.filter.shouldUpdate() || publicAPI.getInputData(count)?.getMTime() > minOutputMTime) {
        return true;
      }
    }
    return false;
  };
  function getOutputPort() {
    let port = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
    const outputPortAccess = () => getOutputData(port);
    outputPortAccess.filter = publicAPI;
    return outputPortAccess;
  }
  if (model.numberOfInputs) {
    let count = model.numberOfInputs;
    while (count--) {
      model.inputData.push(null);
      model.inputConnection.push(null);
    }
    publicAPI.setInputData = setInputData;
    publicAPI.setInputConnection = setInputConnection;
    publicAPI.addInputData = addInputData;
    publicAPI.addInputConnection = addInputConnection;
    publicAPI.getInputData = getInputData;
    publicAPI.getInputConnection = getInputConnection;
  }
  if (numberOfOutputs) {
    publicAPI.getOutputData = getOutputData;
    publicAPI.getOutputPort = getOutputPort;
  }
  publicAPI.update = () => {
    const ins = [];
    if (model.numberOfInputs) {
      let count = 0;
      while (count < model.numberOfInputs) {
        ins[count] = publicAPI.getInputData(count);
        count++;
      }
    }
    if (publicAPI.shouldUpdate() && publicAPI.requestData) {
      publicAPI.requestData(ins, model.output);
    }
  };
  publicAPI.getNumberOfInputPorts = () => model.numberOfInputs;
  publicAPI.getNumberOfOutputPorts = () => numberOfOutputs || model.output.length;
  publicAPI.getInputArrayToProcess = (inputPort) => {
    const arrayDesc = model.inputArrayToProcess[inputPort];
    const ds = model.inputData[inputPort];
    if (arrayDesc && ds) {
      return ds[`get${arrayDesc.fieldAssociation}`]().getArray(arrayDesc.arrayName);
    }
    return null;
  };
  publicAPI.setInputArrayToProcess = function(inputPort, arrayName, fieldAssociation) {
    let attributeType = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : "Scalars";
    while (model.inputArrayToProcess.length < inputPort) {
      model.inputArrayToProcess.push(null);
    }
    model.inputArrayToProcess[inputPort] = {
      arrayName,
      fieldAssociation,
      attributeType
    };
  };
}
const EVENT_ABORT = Symbol("Event abort");
function event(publicAPI, model, eventName) {
  const callbacks = [];
  const previousDelete = publicAPI.delete;
  let curCallbackID = 1;
  function off(callbackID) {
    for (let i = 0; i < callbacks.length; ++i) {
      const [cbID] = callbacks[i];
      if (cbID === callbackID) {
        callbacks.splice(i, 1);
        return;
      }
    }
  }
  function on(callbackID) {
    function unsubscribe() {
      off(callbackID);
    }
    return Object.freeze({
      unsubscribe
    });
  }
  function invoke() {
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return;
    }
    const currentCallbacks = callbacks.slice();
    for (let index = 0; index < currentCallbacks.length; ++index) {
      const [, cb, priority] = currentCallbacks[index];
      if (!cb) {
        continue;
      }
      if (priority < 0) {
        setTimeout(() => cb.apply(publicAPI, arguments), 1 - priority);
      } else {
        const continueNext = cb.apply(publicAPI, arguments);
        if (continueNext === EVENT_ABORT) {
          break;
        }
      }
    }
  }
  publicAPI[`invoke${_capitalize(eventName)}`] = invoke;
  publicAPI[`on${_capitalize(eventName)}`] = function(callback) {
    let priority = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (!callback.apply) {
      console.error(`Invalid callback for event ${eventName}`);
      return null;
    }
    if (model.deleted) {
      vtkErrorMacro$6("instance deleted - cannot call any method");
      return null;
    }
    const callbackID = curCallbackID++;
    callbacks.push([callbackID, callback, priority]);
    callbacks.sort((cb1, cb2) => cb2[2] - cb1[2]);
    return on(callbackID);
  };
  publicAPI.delete = () => {
    previousDelete();
    callbacks.forEach((_ref) => {
      let [cbID] = _ref;
      return off(cbID);
    });
  };
}
function newInstance$i(extend, className) {
  const constructor = function() {
    let initialValues = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const model = {};
    const publicAPI = {};
    extend(publicAPI, model, initialValues);
    return Object.freeze(publicAPI);
  };
  if (className) {
    vtk.register(className, constructor);
  }
  return constructor;
}
function chain() {
  for (var _len5 = arguments.length, fn = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    fn[_key5] = arguments[_key5];
  }
  return function() {
    for (var _len6 = arguments.length, args = new Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
      args[_key6] = arguments[_key6];
    }
    return fn.filter((i) => !!i).map((i) => i(...args));
  };
}
function isVtkObject(instance) {
  return instance && instance.isA && instance.isA("vtkObject");
}
function traverseInstanceTree(instance, extractFunction) {
  let accumulator = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
  let visitedInstances = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : [];
  if (isVtkObject(instance)) {
    if (visitedInstances.indexOf(instance) >= 0) {
      return accumulator;
    }
    visitedInstances.push(instance);
    const result = extractFunction(instance);
    if (result !== void 0) {
      accumulator.push(result);
    }
    const model = instance.get();
    Object.keys(model).forEach((key) => {
      const modelObj = model[key];
      if (Array.isArray(modelObj)) {
        modelObj.forEach((subObj) => {
          traverseInstanceTree(subObj, extractFunction, accumulator, visitedInstances);
        });
      } else {
        traverseInstanceTree(modelObj, extractFunction, accumulator, visitedInstances);
      }
    });
  }
  return accumulator;
}
function debounce(func, wait, immediate) {
  var _this = this;
  let timeout;
  const debounced = function() {
    for (var _len7 = arguments.length, args = new Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
      args[_key7] = arguments[_key7];
    }
    const context = _this;
    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}
function throttle(callback, delay) {
  let isThrottled = false;
  let argsToUse = null;
  function next() {
    isThrottled = false;
    if (argsToUse !== null) {
      wrapper(...argsToUse);
      argsToUse = null;
    }
  }
  function wrapper() {
    for (var _len8 = arguments.length, args = new Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
      args[_key8] = arguments[_key8];
    }
    if (isThrottled) {
      argsToUse = args;
      return;
    }
    isThrottled = true;
    callback(...args);
    setTimeout(next, delay);
  }
  return wrapper;
}
function keystore(publicAPI, model) {
  let initialKeystore = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  model.keystore = Object.assign(model.keystore || {}, initialKeystore);
  publicAPI.setKey = (key, value) => {
    model.keystore[key] = value;
  };
  publicAPI.getKey = (key) => model.keystore[key];
  publicAPI.getAllKeys = () => Object.keys(model.keystore);
  publicAPI.deleteKey = (key) => delete model.keystore[key];
  publicAPI.clearKeystore = () => publicAPI.getAllKeys().forEach((key) => delete model.keystore[key]);
}
let nextProxyId = 1;
const ROOT_GROUP_NAME = "__root__";
function proxy(publicAPI, model) {
  keystore(publicAPI, model);
  const parentDelete = publicAPI.delete;
  model.proxyId = `${nextProxyId++}`;
  model.ui = JSON.parse(JSON.stringify(model.ui || []));
  get(publicAPI, model, ["proxyId", "proxyGroup", "proxyName"]);
  setGet(publicAPI, model, ["proxyManager"]);
  const propertyMap = {};
  const groupChildrenNames = {};
  function registerProperties(descriptionList, currentGroupName) {
    if (!groupChildrenNames[currentGroupName]) {
      groupChildrenNames[currentGroupName] = [];
    }
    const childrenNames = groupChildrenNames[currentGroupName];
    for (let i = 0; i < descriptionList.length; i++) {
      childrenNames.push(descriptionList[i].name);
      propertyMap[descriptionList[i].name] = descriptionList[i];
      if (descriptionList[i].children && descriptionList[i].children.length) {
        registerProperties(descriptionList[i].children, descriptionList[i].name);
      }
    }
  }
  registerProperties(model.ui, ROOT_GROUP_NAME);
  publicAPI.updateUI = (ui) => {
    model.ui = JSON.parse(JSON.stringify(ui || []));
    Object.keys(propertyMap).forEach((k) => delete propertyMap[k]);
    Object.keys(groupChildrenNames).forEach((k) => delete groupChildrenNames[k]);
    registerProperties(model.ui, ROOT_GROUP_NAME);
    publicAPI.modified();
  };
  function listProxyProperties() {
    let gName = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : ROOT_GROUP_NAME;
    return groupChildrenNames[gName];
  }
  publicAPI.updateProxyProperty = (propertyName, propUI) => {
    const prop = propertyMap[propertyName];
    if (prop) {
      Object.assign(prop, propUI);
    } else {
      propertyMap[propertyName] = {
        ...propUI
      };
    }
  };
  publicAPI.activate = () => {
    if (model.proxyManager) {
      const setActiveMethod = `setActive${_capitalize(publicAPI.getProxyGroup().slice(0, -1))}`;
      if (model.proxyManager[setActiveMethod]) {
        model.proxyManager[setActiveMethod](publicAPI);
      }
    }
  };
  model.propertyLinkSubscribers = {};
  publicAPI.registerPropertyLinkForGC = (otherLink, type) => {
    if (!(type in model.propertyLinkSubscribers)) {
      model.propertyLinkSubscribers[type] = [];
    }
    model.propertyLinkSubscribers[type].push(otherLink);
  };
  publicAPI.gcPropertyLinks = (type) => {
    const subscribers = model.propertyLinkSubscribers[type] || [];
    while (subscribers.length) {
      subscribers.pop().unbind(publicAPI);
    }
  };
  model.propertyLinkMap = {};
  publicAPI.getPropertyLink = function(id) {
    let persistent = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
    if (model.propertyLinkMap[id]) {
      return model.propertyLinkMap[id];
    }
    let value = null;
    const links = [];
    let count = 0;
    let updateInProgress = false;
    function update(source) {
      let force = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      if (updateInProgress) {
        return null;
      }
      const needUpdate = [];
      let sourceLink = null;
      count = links.length;
      while (count--) {
        const link = links[count];
        if (link.instance === source) {
          sourceLink = link;
        } else {
          needUpdate.push(link);
        }
      }
      if (!sourceLink) {
        return null;
      }
      const newValue = sourceLink.instance[`get${_capitalize(sourceLink.propertyName)}`]();
      if (!shallowEquals(newValue, value) || force) {
        value = newValue;
        updateInProgress = true;
        while (needUpdate.length) {
          const linkToUpdate = needUpdate.pop();
          linkToUpdate.instance.set({
            [linkToUpdate.propertyName]: value
          });
        }
        updateInProgress = false;
      }
      if (model.propertyLinkMap[id].persistent) {
        model.propertyLinkMap[id].value = newValue;
      }
      return newValue;
    }
    function unbind(instance, propertyName) {
      const indexToDelete = [];
      count = links.length;
      while (count--) {
        const link = links[count];
        if (link.instance === instance && (link.propertyName === propertyName || propertyName === void 0)) {
          link.subscription.unsubscribe();
          indexToDelete.push(count);
        }
      }
      while (indexToDelete.length) {
        links.splice(indexToDelete.pop(), 1);
      }
    }
    function bind(instance, propertyName) {
      let updateMe = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
      const subscription = instance.onModified(update);
      const other = links[0];
      links.push({
        instance,
        propertyName,
        subscription
      });
      if (updateMe) {
        if (model.propertyLinkMap[id].persistent && model.propertyLinkMap[id].value !== void 0) {
          instance.set({
            [propertyName]: model.propertyLinkMap[id].value
          });
        } else if (other) {
          update(other.instance, true);
        }
      }
      return {
        unsubscribe: () => unbind(instance, propertyName)
      };
    }
    function unsubscribe() {
      while (links.length) {
        links.pop().subscription.unsubscribe();
      }
    }
    const linkHandler = {
      bind,
      unbind,
      unsubscribe,
      persistent
    };
    model.propertyLinkMap[id] = linkHandler;
    return linkHandler;
  };
  function getProperties() {
    let groupName = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : ROOT_GROUP_NAME;
    const values = [];
    const id = model.proxyId;
    const propertyNames = listProxyProperties(groupName) || [];
    for (let i = 0; i < propertyNames.length; i++) {
      const name = propertyNames[i];
      const method = publicAPI[`get${_capitalize(name)}`];
      const value = method ? method() : void 0;
      const prop = {
        id,
        name,
        value
      };
      const children = getProperties(name);
      if (children.length) {
        prop.children = children;
      }
      values.push(prop);
    }
    return values;
  }
  publicAPI.listPropertyNames = () => getProperties().map((p) => p.name);
  publicAPI.getPropertyByName = (name) => getProperties().find((p) => p.name === name);
  publicAPI.getPropertyDomainByName = (name) => (propertyMap[name] || {}).domain;
  publicAPI.getProxySection = () => ({
    id: model.proxyId,
    name: model.proxyGroup,
    ui: model.ui,
    properties: getProperties()
  });
  publicAPI.delete = () => {
    const list = Object.keys(model.propertyLinkMap);
    let count = list.length;
    while (count--) {
      model.propertyLinkMap[list[count]].unsubscribe();
    }
    Object.keys(model.propertyLinkSubscribers).forEach(publicAPI.gcPropertyLinks);
    parentDelete();
  };
  publicAPI.getState = () => null;
  function registerLinks() {
    if (model.links) {
      for (let i = 0; i < model.links.length; i++) {
        const {
          link,
          property,
          persistent,
          updateOnBind,
          type
        } = model.links[i];
        if (type === "application") {
          const sLink = model.proxyManager.getPropertyLink(link, persistent);
          publicAPI.registerPropertyLinkForGC(sLink, "application");
          sLink.bind(publicAPI, property, updateOnBind);
        }
      }
    }
  }
  setImmediateVTK(registerLinks);
}
function proxyPropertyMapping(publicAPI, model, map) {
  const parentDelete = publicAPI.delete;
  const subscriptions = [];
  const propertyNames = Object.keys(map);
  let count = propertyNames.length;
  while (count--) {
    const propertyName = propertyNames[count];
    const {
      modelKey,
      property,
      modified = true
    } = map[propertyName];
    const methodSrc = _capitalize(property);
    const methodDst = _capitalize(propertyName);
    publicAPI[`get${methodDst}`] = model[modelKey][`get${methodSrc}`];
    publicAPI[`set${methodDst}`] = model[modelKey][`set${methodSrc}`];
    if (modified) {
      subscriptions.push(model[modelKey].onModified(publicAPI.modified));
    }
  }
  publicAPI.delete = () => {
    while (subscriptions.length) {
      subscriptions.pop().unsubscribe();
    }
    parentDelete();
  };
}
function proxyPropertyState(publicAPI, model) {
  let state = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  let defaults = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
  model.this = publicAPI;
  function applyState(map) {
    const modelKeys2 = Object.keys(map);
    let count2 = modelKeys2.length;
    while (count2--) {
      const modelKey = modelKeys2[count2];
      model[modelKey].set(map[modelKey]);
    }
  }
  const modelKeys = Object.keys(defaults);
  let count = modelKeys.length;
  while (count--) {
    const key = modelKeys[count];
    model[key] = defaults[key];
    const mapping = state[key];
    publicAPI[`set${_capitalize(key)}`] = (value) => {
      if (value !== model[key]) {
        model[key] = value;
        const propValues = mapping[value];
        applyState(propValues);
        publicAPI.modified();
      }
    };
  }
  if (modelKeys.length) {
    get(publicAPI, model, modelKeys);
  }
}
const PIXEL_STEP = 10;
const LINE_HEIGHT = 40;
const PAGE_HEIGHT = 800;
function normalizeWheel(wheelEvent) {
  let sX = 0;
  let sY = 0;
  let pX = 0;
  let pY = 0;
  if ("detail" in wheelEvent) {
    sY = wheelEvent.detail;
  }
  if ("wheelDelta" in wheelEvent) {
    sY = -wheelEvent.wheelDelta / 120;
  }
  if ("wheelDeltaY" in wheelEvent) {
    sY = -wheelEvent.wheelDeltaY / 120;
  }
  if ("wheelDeltaX" in wheelEvent) {
    sX = -wheelEvent.wheelDeltaX / 120;
  }
  if ("axis" in wheelEvent && wheelEvent.axis === wheelEvent.HORIZONTAL_AXIS) {
    sX = sY;
    sY = 0;
  }
  pX = sX * PIXEL_STEP;
  pY = sY * PIXEL_STEP;
  if ("deltaY" in wheelEvent) {
    pY = wheelEvent.deltaY;
  }
  if ("deltaX" in wheelEvent) {
    pX = wheelEvent.deltaX;
  }
  if ((pX || pY) && wheelEvent.deltaMode) {
    if (wheelEvent.deltaMode === 1) {
      pX *= LINE_HEIGHT;
      pY *= LINE_HEIGHT;
    } else {
      pX *= PAGE_HEIGHT;
      pY *= PAGE_HEIGHT;
    }
  }
  if (pX && !sX) {
    sX = pX < 1 ? -1 : 1;
  }
  if (pY && !sY) {
    sY = pY < 1 ? -1 : 1;
  }
  return {
    spinX: sX,
    spinY: sY || sX,
    pixelX: pX,
    pixelY: pY || pX
  };
}
var macro = {
  algo,
  capitalize,
  chain,
  debounce,
  enumToString,
  event,
  EVENT_ABORT,
  formatBytesToProperUnit,
  formatNumbersWithThousandSeparator,
  get,
  getArray,
  getCurrentGlobalMTime,
  getStateArrayMapFunc,
  isVtkObject,
  keystore,
  measurePromiseExecution,
  moveToProtected,
  newInstance: newInstance$i,
  newTypedArray,
  newTypedArrayFrom,
  normalizeWheel,
  obj,
  proxy,
  proxyPropertyMapping,
  proxyPropertyState,
  safeArrays,
  set,
  setArray,
  setGet,
  setGetArray,
  setImmediate: setImmediateVTK,
  setLoggerFunction,
  throttle,
  traverseInstanceTree,
  TYPED_ARRAYS,
  // deprecated todo remove on breaking API revision
  uncapitalize,
  VOID,
  vtkDebugMacro,
  vtkErrorMacro: vtkErrorMacro$6,
  vtkInfoMacro,
  vtkLogMacro,
  vtkOnceErrorMacro,
  vtkWarningMacro: vtkWarningMacro$4
};
var macro$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  VOID,
  setLoggerFunction,
  vtkLogMacro,
  vtkInfoMacro,
  vtkDebugMacro,
  vtkErrorMacro: vtkErrorMacro$6,
  vtkWarningMacro: vtkWarningMacro$4,
  vtkOnceErrorMacro,
  TYPED_ARRAYS,
  newTypedArray,
  newTypedArrayFrom,
  capitalize,
  _capitalize,
  uncapitalize,
  formatBytesToProperUnit,
  formatNumbersWithThousandSeparator,
  setImmediateVTK,
  measurePromiseExecution,
  obj,
  get,
  set,
  setGet,
  getArray,
  setArray,
  setGetArray,
  moveToProtected,
  algo,
  EVENT_ABORT,
  event,
  newInstance: newInstance$i,
  chain,
  isVtkObject,
  traverseInstanceTree,
  debounce,
  throttle,
  keystore,
  proxy,
  proxyPropertyMapping,
  proxyPropertyState,
  normalizeWheel,
  "default": macro
});

var alea$1 = {exports: {}};

var alea = alea$1.exports;

var hasRequiredAlea;

function requireAlea () {
	if (hasRequiredAlea) return alea$1.exports;
	hasRequiredAlea = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function Alea(seed) {
		    var me = this, mash = Mash();
		    me.next = function() {
		      var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
		      me.s0 = me.s1;
		      me.s1 = me.s2;
		      return me.s2 = t - (me.c = t | 0);
		    };
		    me.c = 1;
		    me.s0 = mash(" ");
		    me.s1 = mash(" ");
		    me.s2 = mash(" ");
		    me.s0 -= mash(seed);
		    if (me.s0 < 0) {
		      me.s0 += 1;
		    }
		    me.s1 -= mash(seed);
		    if (me.s1 < 0) {
		      me.s1 += 1;
		    }
		    me.s2 -= mash(seed);
		    if (me.s2 < 0) {
		      me.s2 += 1;
		    }
		    mash = null;
		  }
		  function copy(f, t) {
		    t.c = f.c;
		    t.s0 = f.s0;
		    t.s1 = f.s1;
		    t.s2 = f.s2;
		    return t;
		  }
		  function impl(seed, opts) {
		    var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
		    prng.int32 = function() {
		      return xg.next() * 4294967296 | 0;
		    };
		    prng.double = function() {
		      return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
		    };
		    prng.quick = prng;
		    if (state) {
		      if (typeof state == "object") copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  function Mash() {
		    var n = 4022871197;
		    var mash = function(data) {
		      data = String(data);
		      for (var i = 0; i < data.length; i++) {
		        n += data.charCodeAt(i);
		        var h = 0.02519603282416938 * n;
		        n = h >>> 0;
		        h -= n;
		        h *= n;
		        n = h >>> 0;
		        h -= n;
		        n += h * 4294967296;
		      }
		      return (n >>> 0) * 23283064365386963e-26;
		    };
		    return mash;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.alea = impl;
		  }
		})(
		  alea,
		  module); 
	} (alea$1));
	return alea$1.exports;
}

var xor128$1 = {exports: {}};

var xor128 = xor128$1.exports;

var hasRequiredXor128;

function requireXor128 () {
	if (hasRequiredXor128) return xor128$1.exports;
	hasRequiredXor128 = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function XorGen(seed) {
		    var me = this, strseed = "";
		    me.x = 0;
		    me.y = 0;
		    me.z = 0;
		    me.w = 0;
		    me.next = function() {
		      var t = me.x ^ me.x << 11;
		      me.x = me.y;
		      me.y = me.z;
		      me.z = me.w;
		      return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
		    };
		    if (seed === (seed | 0)) {
		      me.x = seed;
		    } else {
		      strseed += seed;
		    }
		    for (var k = 0; k < strseed.length + 64; k++) {
		      me.x ^= strseed.charCodeAt(k) | 0;
		      me.next();
		    }
		  }
		  function copy(f, t) {
		    t.x = f.x;
		    t.y = f.y;
		    t.z = f.z;
		    t.w = f.w;
		    return t;
		  }
		  function impl(seed, opts) {
		    var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
		      return (xg.next() >>> 0) / 4294967296;
		    };
		    prng.double = function() {
		      do {
		        var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
		      } while (result === 0);
		      return result;
		    };
		    prng.int32 = xg.next;
		    prng.quick = prng;
		    if (state) {
		      if (typeof state == "object") copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.xor128 = impl;
		  }
		})(
		  xor128,
		  module); 
	} (xor128$1));
	return xor128$1.exports;
}

var xorwow$1 = {exports: {}};

var xorwow = xorwow$1.exports;

var hasRequiredXorwow;

function requireXorwow () {
	if (hasRequiredXorwow) return xorwow$1.exports;
	hasRequiredXorwow = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function XorGen(seed) {
		    var me = this, strseed = "";
		    me.next = function() {
		      var t = me.x ^ me.x >>> 2;
		      me.x = me.y;
		      me.y = me.z;
		      me.z = me.w;
		      me.w = me.v;
		      return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
		    };
		    me.x = 0;
		    me.y = 0;
		    me.z = 0;
		    me.w = 0;
		    me.v = 0;
		    if (seed === (seed | 0)) {
		      me.x = seed;
		    } else {
		      strseed += seed;
		    }
		    for (var k = 0; k < strseed.length + 64; k++) {
		      me.x ^= strseed.charCodeAt(k) | 0;
		      if (k == strseed.length) {
		        me.d = me.x << 10 ^ me.x >>> 4;
		      }
		      me.next();
		    }
		  }
		  function copy(f, t) {
		    t.x = f.x;
		    t.y = f.y;
		    t.z = f.z;
		    t.w = f.w;
		    t.v = f.v;
		    t.d = f.d;
		    return t;
		  }
		  function impl(seed, opts) {
		    var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
		      return (xg.next() >>> 0) / 4294967296;
		    };
		    prng.double = function() {
		      do {
		        var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
		      } while (result === 0);
		      return result;
		    };
		    prng.int32 = xg.next;
		    prng.quick = prng;
		    if (state) {
		      if (typeof state == "object") copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.xorwow = impl;
		  }
		})(
		  xorwow,
		  module); 
	} (xorwow$1));
	return xorwow$1.exports;
}

var xorshift7$1 = {exports: {}};

var xorshift7 = xorshift7$1.exports;

var hasRequiredXorshift7;

function requireXorshift7 () {
	if (hasRequiredXorshift7) return xorshift7$1.exports;
	hasRequiredXorshift7 = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function XorGen(seed) {
		    var me = this;
		    me.next = function() {
		      var X = me.x, i = me.i, t, v;
		      t = X[i];
		      t ^= t >>> 7;
		      v = t ^ t << 24;
		      t = X[i + 1 & 7];
		      v ^= t ^ t >>> 10;
		      t = X[i + 3 & 7];
		      v ^= t ^ t >>> 3;
		      t = X[i + 4 & 7];
		      v ^= t ^ t << 7;
		      t = X[i + 7 & 7];
		      t = t ^ t << 13;
		      v ^= t ^ t << 9;
		      X[i] = v;
		      me.i = i + 1 & 7;
		      return v;
		    };
		    function init(me2, seed2) {
		      var j, X = [];
		      if (seed2 === (seed2 | 0)) {
		        X[0] = seed2;
		      } else {
		        seed2 = "" + seed2;
		        for (j = 0; j < seed2.length; ++j) {
		          X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
		        }
		      }
		      while (X.length < 8) X.push(0);
		      for (j = 0; j < 8 && X[j] === 0; ++j) ;
		      if (j == 8) X[7] = -1;
		      else X[j];
		      me2.x = X;
		      me2.i = 0;
		      for (j = 256; j > 0; --j) {
		        me2.next();
		      }
		    }
		    init(me, seed);
		  }
		  function copy(f, t) {
		    t.x = f.x.slice();
		    t.i = f.i;
		    return t;
		  }
		  function impl(seed, opts) {
		    if (seed == null) seed = +/* @__PURE__ */ new Date();
		    var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
		      return (xg.next() >>> 0) / 4294967296;
		    };
		    prng.double = function() {
		      do {
		        var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
		      } while (result === 0);
		      return result;
		    };
		    prng.int32 = xg.next;
		    prng.quick = prng;
		    if (state) {
		      if (state.x) copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.xorshift7 = impl;
		  }
		})(
		  xorshift7,
		  module); 
	} (xorshift7$1));
	return xorshift7$1.exports;
}

var xor4096$1 = {exports: {}};

var xor4096 = xor4096$1.exports;

var hasRequiredXor4096;

function requireXor4096 () {
	if (hasRequiredXor4096) return xor4096$1.exports;
	hasRequiredXor4096 = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function XorGen(seed) {
		    var me = this;
		    me.next = function() {
		      var w = me.w, X = me.X, i = me.i, t, v;
		      me.w = w = w + 1640531527 | 0;
		      v = X[i + 34 & 127];
		      t = X[i = i + 1 & 127];
		      v ^= v << 13;
		      t ^= t << 17;
		      v ^= v >>> 15;
		      t ^= t >>> 12;
		      v = X[i] = v ^ t;
		      me.i = i;
		      return v + (w ^ w >>> 16) | 0;
		    };
		    function init(me2, seed2) {
		      var t, v, i, j, w, X = [], limit = 128;
		      if (seed2 === (seed2 | 0)) {
		        v = seed2;
		        seed2 = null;
		      } else {
		        seed2 = seed2 + "\0";
		        v = 0;
		        limit = Math.max(limit, seed2.length);
		      }
		      for (i = 0, j = -32; j < limit; ++j) {
		        if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
		        if (j === 0) w = v;
		        v ^= v << 10;
		        v ^= v >>> 15;
		        v ^= v << 4;
		        v ^= v >>> 13;
		        if (j >= 0) {
		          w = w + 1640531527 | 0;
		          t = X[j & 127] ^= v + w;
		          i = 0 == t ? i + 1 : 0;
		        }
		      }
		      if (i >= 128) {
		        X[(seed2 && seed2.length || 0) & 127] = -1;
		      }
		      i = 127;
		      for (j = 4 * 128; j > 0; --j) {
		        v = X[i + 34 & 127];
		        t = X[i = i + 1 & 127];
		        v ^= v << 13;
		        t ^= t << 17;
		        v ^= v >>> 15;
		        t ^= t >>> 12;
		        X[i] = v ^ t;
		      }
		      me2.w = w;
		      me2.X = X;
		      me2.i = i;
		    }
		    init(me, seed);
		  }
		  function copy(f, t) {
		    t.i = f.i;
		    t.w = f.w;
		    t.X = f.X.slice();
		    return t;
		  }
		  function impl(seed, opts) {
		    if (seed == null) seed = +/* @__PURE__ */ new Date();
		    var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
		      return (xg.next() >>> 0) / 4294967296;
		    };
		    prng.double = function() {
		      do {
		        var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
		      } while (result === 0);
		      return result;
		    };
		    prng.int32 = xg.next;
		    prng.quick = prng;
		    if (state) {
		      if (state.X) copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.xor4096 = impl;
		  }
		})(
		  xor4096,
		  // window object or global
		  module); 
	} (xor4096$1));
	return xor4096$1.exports;
}

var tychei$1 = {exports: {}};

var tychei = tychei$1.exports;

var hasRequiredTychei;

function requireTychei () {
	if (hasRequiredTychei) return tychei$1.exports;
	hasRequiredTychei = 1;
	(function (module) {
		(function(global, module2, define2) {
		  function XorGen(seed) {
		    var me = this, strseed = "";
		    me.next = function() {
		      var b = me.b, c = me.c, d = me.d, a = me.a;
		      b = b << 25 ^ b >>> 7 ^ c;
		      c = c - d | 0;
		      d = d << 24 ^ d >>> 8 ^ a;
		      a = a - b | 0;
		      me.b = b = b << 20 ^ b >>> 12 ^ c;
		      me.c = c = c - d | 0;
		      me.d = d << 16 ^ c >>> 16 ^ a;
		      return me.a = a - b | 0;
		    };
		    me.a = 0;
		    me.b = 0;
		    me.c = 2654435769 | 0;
		    me.d = 1367130551;
		    if (seed === Math.floor(seed)) {
		      me.a = seed / 4294967296 | 0;
		      me.b = seed | 0;
		    } else {
		      strseed += seed;
		    }
		    for (var k = 0; k < strseed.length + 20; k++) {
		      me.b ^= strseed.charCodeAt(k) | 0;
		      me.next();
		    }
		  }
		  function copy(f, t) {
		    t.a = f.a;
		    t.b = f.b;
		    t.c = f.c;
		    t.d = f.d;
		    return t;
		  }
		  function impl(seed, opts) {
		    var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
		      return (xg.next() >>> 0) / 4294967296;
		    };
		    prng.double = function() {
		      do {
		        var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
		      } while (result === 0);
		      return result;
		    };
		    prng.int32 = xg.next;
		    prng.quick = prng;
		    if (state) {
		      if (typeof state == "object") copy(state, xg);
		      prng.state = function() {
		        return copy(xg, {});
		      };
		    }
		    return prng;
		  }
		  if (module2 && module2.exports) {
		    module2.exports = impl;
		  } else {
		    this.tychei = impl;
		  }
		})(
		  tychei,
		  module); 
	} (tychei$1));
	return tychei$1.exports;
}

var seedrandom$2 = {exports: {}};

var __viteBrowserExternal = {};

var __viteBrowserExternal$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: __viteBrowserExternal
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(__viteBrowserExternal$1);

var seedrandom$1 = seedrandom$2.exports;

var hasRequiredSeedrandom$1;

function requireSeedrandom$1 () {
	if (hasRequiredSeedrandom$1) return seedrandom$2.exports;
	hasRequiredSeedrandom$1 = 1;
	(function (module) {
		(function(global, pool, math) {
		  var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
		  function seedrandom(seed, options, callback) {
		    var key = [];
		    options = options == true ? { entropy: true } : options || {};
		    var shortseed = mixkey(flatten(
		      options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
		      3
		    ), key);
		    var arc4 = new ARC4(key);
		    var prng = function() {
		      var n = arc4.g(chunks), d = startdenom, x = 0;
		      while (n < significance) {
		        n = (n + x) * width;
		        d *= width;
		        x = arc4.g(1);
		      }
		      while (n >= overflow) {
		        n /= 2;
		        d /= 2;
		        x >>>= 1;
		      }
		      return (n + x) / d;
		    };
		    prng.int32 = function() {
		      return arc4.g(4) | 0;
		    };
		    prng.quick = function() {
		      return arc4.g(4) / 4294967296;
		    };
		    prng.double = prng;
		    mixkey(tostring(arc4.S), pool);
		    return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
		      if (state) {
		        if (state.S) {
		          copy(state, arc4);
		        }
		        prng2.state = function() {
		          return copy(arc4, {});
		        };
		      }
		      if (is_math_call) {
		        math[rngname] = prng2;
		        return seed2;
		      } else return prng2;
		    })(
		      prng,
		      shortseed,
		      "global" in options ? options.global : this == math,
		      options.state
		    );
		  }
		  function ARC4(key) {
		    var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
		    if (!keylen) {
		      key = [keylen++];
		    }
		    while (i < width) {
		      s[i] = i++;
		    }
		    for (i = 0; i < width; i++) {
		      s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
		      s[j] = t;
		    }
		    (me.g = function(count) {
		      var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
		      while (count--) {
		        t2 = s2[i2 = mask & i2 + 1];
		        r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
		      }
		      me.i = i2;
		      me.j = j2;
		      return r;
		    })(width);
		  }
		  function copy(f, t) {
		    t.i = f.i;
		    t.j = f.j;
		    t.S = f.S.slice();
		    return t;
		  }
		  function flatten(obj, depth) {
		    var result = [], typ = typeof obj, prop;
		    if (depth && typ == "object") {
		      for (prop in obj) {
		        try {
		          result.push(flatten(obj[prop], depth - 1));
		        } catch (e) {
		        }
		      }
		    }
		    return result.length ? result : typ == "string" ? obj : obj + "\0";
		  }
		  function mixkey(seed, key) {
		    var stringseed = seed + "", smear, j = 0;
		    while (j < stringseed.length) {
		      key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
		    }
		    return tostring(key);
		  }
		  function autoseed() {
		    try {
		      var out;
		      if (nodecrypto && (out = nodecrypto.randomBytes)) {
		        out = out(width);
		      } else {
		        out = new Uint8Array(width);
		        (global.crypto || global.msCrypto).getRandomValues(out);
		      }
		      return tostring(out);
		    } catch (e) {
		      var browser = global.navigator, plugins = browser && browser.plugins;
		      return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
		    }
		  }
		  function tostring(a) {
		    return String.fromCharCode.apply(0, a);
		  }
		  mixkey(math.random(), pool);
		  if (module.exports) {
		    module.exports = seedrandom;
		    try {
		      nodecrypto = require$$0;
		    } catch (ex) {
		    }
		  } else {
		    math["seed" + rngname] = seedrandom;
		  }
		})(
		  // global: `self` in browsers (including strict mode and web workers),
		  // otherwise `this` in Node and other environments
		  typeof self !== "undefined" ? self : seedrandom$1,
		  [],
		  // pool: entropy pool starts empty
		  Math
		  // math: package containing random, pow, and seedrandom
		); 
	} (seedrandom$2));
	return seedrandom$2.exports;
}

var seedrandom;
var hasRequiredSeedrandom;

function requireSeedrandom () {
	if (hasRequiredSeedrandom) return seedrandom;
	hasRequiredSeedrandom = 1;
	// A library of seedable RNGs implemented in Javascript.
	//
	// Usage:
	//
	// var seedrandom = require('seedrandom');
	// var random = seedrandom(1); // or any seed.
	// var x = random();       // 0 <= x < 1.  Every bit is random.
	// var x = random.quick(); // 0 <= x < 1.  32 bits of randomness.

	// alea, a 53-bit multiply-with-carry generator by Johannes Baagøe.
	// Period: ~2^116
	// Reported to pass all BigCrush tests.
	var alea = requireAlea();

	// xor128, a pure xor-shift generator by George Marsaglia.
	// Period: 2^128-1.
	// Reported to fail: MatrixRank and LinearComp.
	var xor128 = requireXor128();

	// xorwow, George Marsaglia's 160-bit xor-shift combined plus weyl.
	// Period: 2^192-2^32
	// Reported to fail: CollisionOver, SimpPoker, and LinearComp.
	var xorwow = requireXorwow();

	// xorshift7, by François Panneton and Pierre L'ecuyer, takes
	// a different approach: it adds robustness by allowing more shifts
	// than Marsaglia's original three.  It is a 7-shift generator
	// with 256 bits, that passes BigCrush with no systmatic failures.
	// Period 2^256-1.
	// No systematic BigCrush failures reported.
	var xorshift7 = requireXorshift7();

	// xor4096, by Richard Brent, is a 4096-bit xor-shift with a
	// very long period that also adds a Weyl generator. It also passes
	// BigCrush with no systematic failures.  Its long period may
	// be useful if you have many generators and need to avoid
	// collisions.
	// Period: 2^4128-2^32.
	// No systematic BigCrush failures reported.
	var xor4096 = requireXor4096();

	// Tyche-i, by Samuel Neves and Filipe Araujo, is a bit-shifting random
	// number generator derived from ChaCha, a modern stream cipher.
	// https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf
	// Period: ~2^127
	// No systematic BigCrush failures reported.
	var tychei = requireTychei();

	// The original ARC4-based prng included in this library.
	// Period: ~2^1600
	var sr = requireSeedrandom$1();

	sr.alea = alea;
	sr.xor128 = xor128;
	sr.xorwow = xorwow;
	sr.xorshift7 = xorshift7;
	sr.xor4096 = xor4096;
	sr.tychei = tychei;

	seedrandom = sr;
	return seedrandom;
}

requireSeedrandom();

const VTK_SMALL_NUMBER = 1.0e-12;

const {
  vtkErrorMacro: vtkErrorMacro$5,
  vtkWarningMacro: vtkWarningMacro$3
} = macro;
function createArray() {
  let size = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 3;
  const res = Array(size);
  for (let i = 0; i < size; ++i) {
    res[i] = 0;
  }
  return res;
}
function add$1(a, b, out) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
function subtract(a, b, out) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
function multiplyAccumulate(a, b, scalar, out) {
  out[0] = a[0] + b[0] * scalar;
  out[1] = a[1] + b[1] * scalar;
  out[2] = a[2] + b[2] * scalar;
  return out;
}
function dot$1(x, y) {
  return x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
}
function cross$1(x, y, out) {
  const Zx = x[1] * y[2] - x[2] * y[1];
  const Zy = x[2] * y[0] - x[0] * y[2];
  const Zz = x[0] * y[1] - x[1] * y[0];
  out[0] = Zx;
  out[1] = Zy;
  out[2] = Zz;
  return out;
}
function norm(x) {
  let n = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 3;
  switch (n) {
    case 1:
      return Math.abs(x);
    case 2:
      return Math.sqrt(x[0] * x[0] + x[1] * x[1]);
    case 3:
      return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    default: {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += x[i] * x[i];
      }
      return Math.sqrt(sum);
    }
  }
}
function normalize$3(x) {
  const den = norm(x);
  if (den !== 0) {
    x[0] /= den;
    x[1] /= den;
    x[2] /= den;
  }
  return den;
}
function distance2BetweenPoints(x, y) {
  return (x[0] - y[0]) * (x[0] - y[0]) + (x[1] - y[1]) * (x[1] - y[1]) + (x[2] - y[2]) * (x[2] - y[2]);
}
function determinant2x2() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  if (args.length === 2) {
    return args[0][0] * args[1][1] - args[1][0] * args[0][1];
  }
  if (args.length === 4) {
    return args[0] * args[3] - args[1] * args[2];
  }
  return Number.NaN;
}
function roundNumber(num) {
  let digits = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
  if (!`${num}`.includes("e")) {
    return +`${Math.round(`${num}e+${digits}`)}e-${digits}`;
  }
  const arr = `${num}`.split("e");
  let sig = "";
  if (+arr[1] + digits > 0) {
    sig = "+";
  }
  return +`${Math.round(`${+arr[0]}e${sig}${+arr[1] + digits}`)}e-${digits}`;
}
function roundVector(vector) {
  let out = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [0, 0, 0];
  let digits = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
  out[0] = roundNumber(vector[0], digits);
  out[1] = roundNumber(vector[1], digits);
  out[2] = roundNumber(vector[2], digits);
  return out;
}
function luFactorLinearSystem(A, index, size) {
  let i;
  let j;
  let k;
  let largest;
  let maxI = 0;
  let sum;
  let temp1;
  let temp2;
  const scale = createArray(size);
  for (i = 0; i < size; i++) {
    for (largest = 0, j = 0; j < size; j++) {
      if ((temp2 = Math.abs(A[i * size + j])) > largest) {
        largest = temp2;
      }
    }
    if (largest === 0) {
      vtkWarningMacro$3("Unable to factor linear system");
      return 0;
    }
    scale[i] = 1 / largest;
  }
  for (j = 0; j < size; j++) {
    for (i = 0; i < j; i++) {
      sum = A[i * size + j];
      for (k = 0; k < i; k++) {
        sum -= A[i * size + k] * A[k * size + j];
      }
      A[i * size + j] = sum;
    }
    for (largest = 0, i = j; i < size; i++) {
      sum = A[i * size + j];
      for (k = 0; k < j; k++) {
        sum -= A[i * size + k] * A[k * size + j];
      }
      A[i * size + j] = sum;
      if ((temp1 = scale[i] * Math.abs(sum)) >= largest) {
        largest = temp1;
        maxI = i;
      }
    }
    if (j !== maxI) {
      for (k = 0; k < size; k++) {
        temp1 = A[maxI * size + k];
        A[maxI * size + k] = A[j * size + k];
        A[j * size + k] = temp1;
      }
      scale[maxI] = scale[j];
    }
    index[j] = maxI;
    if (Math.abs(A[j * size + j]) <= VTK_SMALL_NUMBER) {
      vtkWarningMacro$3("Unable to factor linear system");
      return 0;
    }
    if (j !== size - 1) {
      temp1 = 1 / A[j * size + j];
      for (i = j + 1; i < size; i++) {
        A[i * size + j] *= temp1;
      }
    }
  }
  return 1;
}
function luSolveLinearSystem(A, index, x, size) {
  let i;
  let j;
  let ii;
  let idx;
  let sum;
  for (ii = -1, i = 0; i < size; i++) {
    idx = index[i];
    sum = x[idx];
    x[idx] = x[i];
    if (ii >= 0) {
      for (j = ii; j <= i - 1; j++) {
        sum -= A[i * size + j] * x[j];
      }
    } else if (sum !== 0) {
      ii = i;
    }
    x[i] = sum;
  }
  for (i = size - 1; i >= 0; i--) {
    sum = x[i];
    for (j = i + 1; j < size; j++) {
      sum -= A[i * size + j] * x[j];
    }
    x[i] = sum / A[i * size + i];
  }
}
function solveLinearSystem(A, x, size) {
  if (size === 2) {
    const y = createArray(2);
    const det = determinant2x2(A[0], A[1], A[2], A[3]);
    if (det === 0) {
      return 0;
    }
    y[0] = (A[3] * x[0] - A[1] * x[1]) / det;
    y[1] = (-(A[2] * x[0]) + A[0] * x[1]) / det;
    x[0] = y[0];
    x[1] = y[1];
    return 1;
  }
  if (size === 1) {
    if (A[0] === 0) {
      return 0;
    }
    x[0] /= A[0];
    return 1;
  }
  const index = createArray(size);
  if (luFactorLinearSystem(A, index, size) === 0) {
    return 0;
  }
  luSolveLinearSystem(A, index, x, size);
  return 1;
}
function uninitializeBounds(bounds) {
  bounds[0] = 1;
  bounds[1] = -1;
  bounds[2] = 1;
  bounds[3] = -1;
  bounds[4] = 1;
  bounds[5] = -1;
  return bounds;
}
function clampValue(value, minValue, maxValue) {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}
function clampVector(vector, minVector, maxVector) {
  let out = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : [0, 0, 0];
  out[0] = clampValue(vector[0], minVector[0], maxVector[0]);
  out[1] = clampValue(vector[1], minVector[1], maxVector[1]);
  out[2] = clampValue(vector[2], minVector[2], maxVector[2]);
  return out;
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON$1 = 0.000001;
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
/**
 * Tests whether or not the arguments have approximately the same value, within an absolute
 * or relative tolerance of glMatrix.EPSILON (an absolute tolerance is used for values less
 * than or equal to 1.0, and a relative tolerance is used for larger values)
 *
 * @param {Number} a The first number to test.
 * @param {Number} b The second number to test.
 * @returns {Boolean} True if the numbers are approximately equal, false otherwise.
 */

function equals$1(a, b) {
  return Math.abs(a - b) <= EPSILON$1 * Math.max(1.0, Math.abs(a), Math.abs(b));
}
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 3x3 Matrix
 * @module mat3
 */

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */

function create$3() {
  var out = new ARRAY_TYPE(9);

  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }

  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}
/**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */

function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */

function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }

  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
/**
 * Scales the mat4 by the dimensions in the given vec3 not using vectorization
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {ReadonlyVec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/

function scale$1(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, dest, vec);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {ReadonlyVec3} v Translation vector
 * @returns {mat4} out
 */

function fromTranslation(out, v) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create$2() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {ReadonlyVec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */

function clone(a) {
  var out = new ARRAY_TYPE(3);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
/**
 * Calculates the length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate length of
 * @returns {Number} length of a
 */

function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */

function fromValues(x, y, z) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the source vector
 * @returns {vec3} out
 */

function copy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize$2(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
/**
 * Alias for {@link vec3.length}
 * @function
 */

var len = length;
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$2();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

/**
 * 4 Dimensional Vector
 * @module vec4
 */

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */

function create$1() {
  var out = new ARRAY_TYPE(4);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }

  return out;
}
/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to normalize
 * @returns {vec4} out
 */

function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  var len = x * x + y * y + z * z + w * w;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }

  out[0] = x * len;
  out[1] = y * len;
  out[2] = z * len;
  out[3] = w * len;
  return out;
}
/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$1();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 4;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }

    return a;
  };
})();

/**
 * Quaternion
 * @module quat
 */

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */

function create() {
  var out = new ARRAY_TYPE(4);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  out[3] = 1;
  return out;
}
/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyVec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/

function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

function slerp(out, a, b, t) {
  // benchmarks:
  //    http://jsperf.com/quaternion-slerp-implementations
  var ax = a[0],
      ay = a[1],
      az = a[2],
      aw = a[3];
  var bx = b[0],
      by = b[1],
      bz = b[2],
      bw = b[3];
  var omega, cosom, sinom, scale0, scale1; // calc cosine

  cosom = ax * bx + ay * by + az * bz + aw * bw; // adjust signs (if necessary)

  if (cosom < 0.0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  } // calculate coefficients


  if (1.0 - cosom > EPSILON$1) {
    // standard case (slerp)
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1.0 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    // "from" and "to" quaternions are very close
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t;
    scale1 = t;
  } // calculate final values


  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyMat3} m rotation matrix
 * @returns {quat} out
 * @function
 */

function fromMat3(out, m) {
  // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
  // article "Quaternion Calculus and Fast Animation".
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;

  if (fTrace > 0.0) {
    // |w| > 1/2, may as well choose w > 1/2
    fRoot = Math.sqrt(fTrace + 1.0); // 2w

    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot; // 1/(4w)

    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    // |w| <= 1/2
    var i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }

  return out;
}
/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */

var normalize = normalize$1;
/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {ReadonlyVec3} a the initial vector
 * @param {ReadonlyVec3} b the destination vector
 * @returns {quat} out
 */

(function () {
  var tmpvec3 = create$2();
  var xUnitVec3 = fromValues(1, 0, 0);
  var yUnitVec3 = fromValues(0, 1, 0);
  return function (out, a, b) {
    var dot$1 = dot(a, b);

    if (dot$1 < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 0.000001) cross(tmpvec3, yUnitVec3, a);
      normalize$2(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot$1 > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot$1;
      return normalize(out, out);
    }
  };
})();
/**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {ReadonlyQuat} c the third operand
 * @param {ReadonlyQuat} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

(function () {
  var temp1 = create();
  var temp2 = create();
  return function (out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
})();
/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {ReadonlyVec3} view  the vector representing the viewing direction
 * @param {ReadonlyVec3} right the vector representing the local "right" direction
 * @param {ReadonlyVec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */

(function () {
  var matr = create$3();
  return function (out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize(out, fromMat3(out, matr));
  };
})();

const PLANE_TOLERANCE = 1.0e-6;
const COINCIDE = 'coincide';
const DISJOINT = 'disjoint';

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

function evaluate(normal, origin, x) {
  return normal[0] * (x[0] - origin[0]) + normal[1] * (x[1] - origin[1]) + normal[2] * (x[2] - origin[2]);
}
function distanceToPlane(x, origin, normal) {
  const distance = normal[0] * (x[0] - origin[0]) + normal[1] * (x[1] - origin[1]) + normal[2] * (x[2] - origin[2]);
  return Math.abs(distance);
}
function projectPoint(x, origin, normal, xproj) {
  const xo = [];
  subtract(x, origin, xo);
  const t = dot$1(normal, xo);
  xproj[0] = x[0] - t * normal[0];
  xproj[1] = x[1] - t * normal[1];
  xproj[2] = x[2] - t * normal[2];
}
function projectVector(v, normal, vproj) {
  const t = dot$1(v, normal);
  let n2 = dot$1(normal, normal);
  if (n2 === 0) {
    n2 = 1.0;
  }
  vproj[0] = v[0] - t * normal[0] / n2;
  vproj[1] = v[1] - t * normal[1] / n2;
  vproj[2] = v[2] - t * normal[2] / n2;
  return vproj;
}
function generalizedProjectPoint(x, origin, normal, xproj) {
  const xo = [];
  subtract(x, origin, xo);
  const t = dot$1(normal, xo);
  const n2 = dot$1(normal, normal);
  if (n2 !== 0) {
    xproj[0] = x[0] - t * normal[0] / n2;
    xproj[1] = x[1] - t * normal[1] / n2;
    xproj[2] = x[2] - t * normal[2] / n2;
  } else {
    xproj[0] = x[0];
    xproj[1] = x[1];
    xproj[2] = x[2];
  }
}
function intersectWithLine(p1, p2, origin, normal) {
  const outObj = {
    intersection: false,
    betweenPoints: false,
    t: Number.MAX_VALUE,
    x: []
  };
  const p21 = [];
  const p1Origin = [];
  // Compute line vector
  subtract(p2, p1, p21);
  subtract(origin, p1, p1Origin);

  // Compute denominator.  If ~0, line and plane are parallel.
  // const num = vtkMath.dot(normal, origin) - vtkMath.dot(normal, p1);
  const num = dot$1(normal, p1Origin);
  const den = dot$1(normal, p21);

  // If denominator with respect to numerator is "zero", then the line and
  // plane are considered parallel.
  let fabsden;
  let fabstolerance;

  // Trying to avoid an expensive call to fabs()
  if (den < 0.0) {
    fabsden = -den;
  } else {
    fabsden = den;
  }
  if (num < 0.0) {
    fabstolerance = -num * PLANE_TOLERANCE;
  } else {
    fabstolerance = num * PLANE_TOLERANCE;
  }
  if (fabsden <= fabstolerance) {
    return outObj;
  }

  // Where on the line between p1 and p2 is the intersection
  // If between 0 and 1, it is between the two points. If < 0 it's before p1, if > 1 it's after p2
  outObj.t = num / den;
  outObj.x[0] = p1[0] + outObj.t * p21[0];
  outObj.x[1] = p1[1] + outObj.t * p21[1];
  outObj.x[2] = p1[2] + outObj.t * p21[2];
  outObj.intersection = true;
  outObj.betweenPoints = outObj.t >= 0.0 && outObj.t <= 1.0;
  return outObj;
}
function intersectWithPlane(plane1Origin, plane1Normal, plane2Origin, plane2Normal) {
  const outObj = {
    intersection: false,
    l0: [],
    l1: [],
    error: null
  };
  const cross$1$1 = [];
  cross$1(plane1Normal, plane2Normal, cross$1$1);
  const absCross = cross$1$1.map(n => Math.abs(n));

  // test if the two planes are parallel
  if (absCross[0] + absCross[1] + absCross[2] < PLANE_TOLERANCE) {
    // test if disjoint or coincide
    const v = [];
    subtract(plane1Origin, plane2Origin, v);
    if (dot$1(plane1Normal, v) === 0) {
      outObj.error = COINCIDE;
    } else {
      outObj.error = DISJOINT;
    }
    return outObj;
  }

  // Plane1 and Plane2 intersect in a line
  // first determine max abs coordinate of the cross product
  let maxc;
  if (absCross[0] > absCross[1] && absCross[0] > absCross[2]) {
    maxc = 'x';
  } else if (absCross[1] > absCross[2]) {
    maxc = 'y';
  } else {
    maxc = 'z';
  }

  // To get a point on the intersect line, zero the max coord, and solve for the other two
  const iP = []; // intersectionPoint
  // the constants in the 2 plane equations
  const d1 = -dot$1(plane1Normal, plane1Origin);
  const d2 = -dot$1(plane2Normal, plane2Origin);

  // eslint-disable-next-line default-case
  switch (maxc) {
    case 'x':
      // intersect with x=0
      iP[0] = 0;
      iP[1] = (d2 * plane1Normal[2] - d1 * plane2Normal[2]) / cross$1$1[0];
      iP[2] = (d1 * plane2Normal[1] - d2 * plane1Normal[1]) / cross$1$1[0];
      break;
    case 'y':
      // intersect with y=0
      iP[0] = (d1 * plane2Normal[2] - d2 * plane1Normal[2]) / cross$1$1[1];
      iP[1] = 0;
      iP[2] = (d2 * plane1Normal[0] - d1 * plane2Normal[0]) / cross$1$1[1];
      break;
    case 'z':
      // intersect with z=0
      iP[0] = (d2 * plane1Normal[1] - d1 * plane2Normal[1]) / cross$1$1[2];
      iP[1] = (d1 * plane2Normal[0] - d2 * plane1Normal[0]) / cross$1$1[2];
      iP[2] = 0;
      break;
  }
  outObj.l0 = iP;
  add$1(iP, cross$1$1, outObj.l1);
  outObj.intersection = true;
  return outObj;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$6 = {
  evaluate,
  distanceToPlane,
  projectPoint,
  projectVector,
  generalizedProjectPoint,
  intersectWithLine,
  intersectWithPlane,
  DISJOINT,
  COINCIDE
};

// ----------------------------------------------------------------------------
// vtkPlane methods
// ----------------------------------------------------------------------------

function vtkPlane(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPlane');
  publicAPI.distanceToPlane = x => distanceToPlane(x, model.origin, model.normal);
  publicAPI.projectPoint = (x, xproj) => {
    projectPoint(x, model.origin, model.normal, xproj);
  };
  publicAPI.projectVector = (v, vproj) => projectVector(v, model.normal, vproj);
  publicAPI.push = distance => {
    if (distance === 0.0) {
      return;
    }
    for (let i = 0; i < 3; i++) {
      model.origin[i] += distance * model.normal[i];
    }
  };
  publicAPI.generalizedProjectPoint = (x, xproj) => {
    generalizedProjectPoint(x, model.origin, model.normal, xproj);
  };
  publicAPI.evaluateFunction = (x, y, z) => {
    if (!Array.isArray(x)) {
      return model.normal[0] * (x - model.origin[0]) + model.normal[1] * (y - model.origin[1]) + model.normal[2] * (z - model.origin[2]);
    }
    return model.normal[0] * (x[0] - model.origin[0]) + model.normal[1] * (x[1] - model.origin[1]) + model.normal[2] * (x[2] - model.origin[2]);
  };
  publicAPI.evaluateGradient = xyz => {
    const retVal = [model.normal[0], model.normal[1], model.normal[2]];
    return retVal;
  };
  publicAPI.intersectWithLine = (p1, p2) => intersectWithLine(p1, p2, model.origin, model.normal);
  publicAPI.intersectWithPlane = (planeOrigin, planeNormal) => intersectWithPlane(planeOrigin, planeNormal, model.origin, model.normal);
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$f = {
  normal: [0.0, 0.0, 1.0],
  origin: [0.0, 0.0, 0.0]
};

// ----------------------------------------------------------------------------

function extend$g(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$f, initialValues);

  // Object methods
  macro.obj(publicAPI, model);
  macro.setGetArray(publicAPI, model, ['normal', 'origin'], 3);
  vtkPlane(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$h = macro.newInstance(extend$g, 'vtkPlane');

// ----------------------------------------------------------------------------

var vtkPlane$1 = {
  newInstance: newInstance$h,
  extend: extend$g,
  ...STATIC$6
};

const INIT_BOUNDS = [Number.MAX_VALUE, -Number.MAX_VALUE,
// X
Number.MAX_VALUE, -Number.MAX_VALUE,
// Y
Number.MAX_VALUE, -Number.MAX_VALUE // Z
];

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

function equals(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5];
}
function isValid(bounds) {
  return bounds?.length >= 6 && bounds[0] <= bounds[1] && bounds[2] <= bounds[3] && bounds[4] <= bounds[5];
}
function setBounds(bounds, otherBounds) {
  bounds[0] = otherBounds[0];
  bounds[1] = otherBounds[1];
  bounds[2] = otherBounds[2];
  bounds[3] = otherBounds[3];
  bounds[4] = otherBounds[4];
  bounds[5] = otherBounds[5];
  return bounds;
}
function reset(bounds) {
  return setBounds(bounds, INIT_BOUNDS);
}
function addPoint(bounds, x, y, z) {
  const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
  bounds[0] = xMin < x ? xMin : x;
  bounds[1] = xMax > x ? xMax : x;
  bounds[2] = yMin < y ? yMin : y;
  bounds[3] = yMax > y ? yMax : y;
  bounds[4] = zMin < z ? zMin : z;
  bounds[5] = zMax > z ? zMax : z;
  return bounds;
}
function addPoints(bounds, points) {
  if (points.length === 0) {
    return bounds;
  }
  if (Array.isArray(points[0])) {
    for (let i = 0; i < points.length; ++i) {
      addPoint(bounds, ...points[i]);
    }
  } else {
    for (let i = 0; i < points.length; i += 3) {
      addPoint(bounds, ...points.slice(i, i + 3));
    }
  }
  return bounds;
}
function addBounds(bounds, xMin, xMax, yMin, yMax, zMin, zMax) {
  const [_xMin, _xMax, _yMin, _yMax, _zMin, _zMax] = bounds;
  if (zMax === undefined) {
    bounds[0] = Math.min(xMin[0], _xMin);
    bounds[1] = Math.max(xMin[1], _xMax);
    bounds[2] = Math.min(xMin[2], _yMin);
    bounds[3] = Math.max(xMin[3], _yMax);
    bounds[4] = Math.min(xMin[4], _zMin);
    bounds[5] = Math.max(xMin[5], _zMax);
  } else {
    bounds[0] = Math.min(xMin, _xMin);
    bounds[1] = Math.max(xMax, _xMax);
    bounds[2] = Math.min(yMin, _yMin);
    bounds[3] = Math.max(yMax, _yMax);
    bounds[4] = Math.min(zMin, _zMin);
    bounds[5] = Math.max(zMax, _zMax);
  }
  return bounds;
}
function setMinPoint(bounds, x, y, z) {
  const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
  bounds[0] = x;
  bounds[1] = x > xMax ? x : xMax;
  bounds[2] = y;
  bounds[3] = y > yMax ? y : yMax;
  bounds[4] = z;
  bounds[5] = z > zMax ? z : zMax;
  return xMin !== x || yMin !== y || zMin !== z;
}
function setMaxPoint(bounds, x, y, z) {
  const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
  bounds[0] = x < xMin ? x : xMin;
  bounds[1] = x;
  bounds[2] = y < yMin ? y : yMin;
  bounds[3] = y;
  bounds[4] = z < zMin ? z : zMin;
  bounds[5] = z;
  return xMax !== x || yMax !== y || zMax !== z;
}
function inflate(bounds, delta) {
  bounds[0] -= delta;
  bounds[1] += delta;
  bounds[2] -= delta;
  bounds[3] += delta;
  bounds[4] -= delta;
  bounds[5] += delta;
  return bounds;
}
function scale(bounds, sx, sy, sz) {
  if (!isValid(bounds)) {
    return false;
  }
  if (sx >= 0.0) {
    bounds[0] *= sx;
    bounds[1] *= sx;
  } else {
    bounds[0] = sx * bounds[1];
    bounds[1] = sx * bounds[0];
  }
  if (sy >= 0.0) {
    bounds[2] *= sy;
    bounds[3] *= sy;
  } else {
    bounds[2] = sy * bounds[3];
    bounds[3] = sy * bounds[2];
  }
  if (sz >= 0.0) {
    bounds[4] *= sz;
    bounds[5] *= sz;
  } else {
    bounds[4] = sz * bounds[5];
    bounds[5] = sz * bounds[4];
  }
  return true;
}
function getCenter(bounds) {
  return [0.5 * (bounds[0] + bounds[1]), 0.5 * (bounds[2] + bounds[3]), 0.5 * (bounds[4] + bounds[5])];
}
function scaleAboutCenter(bounds, sx, sy, sz) {
  if (!isValid(bounds)) {
    return false;
  }
  const center = getCenter(bounds);
  bounds[0] -= center[0];
  bounds[1] -= center[0];
  bounds[2] -= center[1];
  bounds[3] -= center[1];
  bounds[4] -= center[2];
  bounds[5] -= center[2];
  scale(bounds, sx, sy, sz);
  bounds[0] += center[0];
  bounds[1] += center[0];
  bounds[2] += center[1];
  bounds[3] += center[1];
  bounds[4] += center[2];
  bounds[5] += center[2];
  return true;
}
function getLength(bounds, index) {
  return bounds[index * 2 + 1] - bounds[index * 2];
}
function getLengths(bounds) {
  return [getLength(bounds, 0), getLength(bounds, 1), getLength(bounds, 2)];
}
function getXRange(bounds) {
  return bounds.slice(0, 2);
}
function getYRange(bounds) {
  return bounds.slice(2, 4);
}
function getZRange(bounds) {
  return bounds.slice(4, 6);
}
function getMaxLength(bounds) {
  const l = getLengths(bounds);
  if (l[0] > l[1]) {
    if (l[0] > l[2]) {
      return l[0];
    }
    return l[2];
  }
  if (l[1] > l[2]) {
    return l[1];
  }
  return l[2];
}
function getDiagonalLength(bounds) {
  if (isValid(bounds)) {
    const l = getLengths(bounds);
    return Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]);
  }
  return null;
}
function getMinPoint(bounds) {
  return [bounds[0], bounds[2], bounds[4]];
}
function getMaxPoint(bounds) {
  return [bounds[1], bounds[3], bounds[5]];
}
function oppositeSign(a, b) {
  return a <= 0 && b >= 0 || a >= 0 && b <= 0;
}
function getCorners(bounds, corners) {
  let count = 0;
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 2; iy < 4; iy++) {
      for (let iz = 4; iz < 6; iz++) {
        corners[count++] = [bounds[ix], bounds[iy], bounds[iz]];
      }
    }
  }
  return corners;
}

// Computes the two corners with minimal and maximal coordinates
function computeCornerPoints(bounds, point1, point2) {
  point1[0] = bounds[0];
  point1[1] = bounds[2];
  point1[2] = bounds[4];
  point2[0] = bounds[1];
  point2[1] = bounds[3];
  point2[2] = bounds[5];
  return point1;
}
function transformBounds(bounds, transform) {
  let out = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  const corners = getCorners(bounds, []);
  for (let i = 0; i < corners.length; ++i) {
    transformMat4(corners[i], corners[i], transform);
  }
  reset(out);
  return addPoints(out, corners);
}
function computeScale3(bounds) {
  let scale3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  scale3[0] = 0.5 * (bounds[1] - bounds[0]);
  scale3[1] = 0.5 * (bounds[3] - bounds[2]);
  scale3[2] = 0.5 * (bounds[5] - bounds[4]);
  return scale3;
}

/**
 * Compute local bounds.
 * Not as fast as vtkPoints.getBounds() if u, v, w form a natural basis.
 * @param {vtkPoints} points
 * @param {array} u first vector
 * @param {array} v second vector
 * @param {array} w third vector
 */
function computeLocalBounds(points, u, v, w) {
  const bounds = [].concat(INIT_BOUNDS);
  const pointsData = points.getData();
  for (let i = 0; i < pointsData.length; i += 3) {
    const point = [pointsData[i], pointsData[i + 1], pointsData[i + 2]];
    const du = dot$1(point, u);
    bounds[0] = Math.min(du, bounds[0]);
    bounds[1] = Math.max(du, bounds[1]);
    const dv = dot$1(point, v);
    bounds[2] = Math.min(dv, bounds[2]);
    bounds[3] = Math.max(dv, bounds[3]);
    const dw = dot$1(point, w);
    bounds[4] = Math.min(dw, bounds[4]);
    bounds[5] = Math.max(dw, bounds[5]);
  }
  return bounds;
}

// The method returns a non-zero value if the bounding box is hit.
// Origin[3] starts the ray, dir[3] is the vector components of the ray in the x-y-z
// directions, coord[3] is the location of hit, and t is the parametric
// coordinate along line. (Notes: the intersection ray dir[3] is NOT
// normalized.  Valid intersections will only occur between 0<=t<=1.)
function intersectBox(bounds, origin, dir, coord, tolerance) {
  let inside = true;
  const quadrant = [];
  let whichPlane = 0;
  const maxT = [];
  const candidatePlane = [0.0, 0.0, 0.0];
  const RIGHT = 0;
  const LEFT = 1;
  const MIDDLE = 2;

  // First find closest planes
  for (let i = 0; i < 3; i++) {
    if (origin[i] < bounds[2 * i]) {
      quadrant[i] = LEFT;
      candidatePlane[i] = bounds[2 * i];
      inside = false;
    } else if (origin[i] > bounds[2 * i + 1]) {
      quadrant[i] = RIGHT;
      candidatePlane[i] = bounds[2 * i + 1];
      inside = false;
    } else {
      quadrant[i] = MIDDLE;
    }
  }

  // Check whether origin of ray is inside bbox
  if (inside) {
    coord[0] = origin[0];
    coord[1] = origin[1];
    coord[2] = origin[2];
    tolerance[0] = 0;
    return 1;
  }

  // Calculate parametric distance to plane
  for (let i = 0; i < 3; i++) {
    if (quadrant[i] !== MIDDLE && dir[i] !== 0.0) {
      maxT[i] = (candidatePlane[i] - origin[i]) / dir[i];
    } else {
      maxT[i] = -1;
    }
  }

  // Find the largest parametric value of intersection
  for (let i = 0; i < 3; i++) {
    if (maxT[whichPlane] < maxT[i]) {
      whichPlane = i;
    }
  }

  // Check for value intersection along line
  if (maxT[whichPlane] > 1.0 || maxT[whichPlane] < 0.0) {
    return 0;
  }
  tolerance[0] = maxT[whichPlane];

  // Intersection point along line is okay. Check bbox.
  for (let i = 0; i < 3; i++) {
    if (whichPlane !== i) {
      coord[i] = origin[i] + maxT[whichPlane] * dir[i];
      if (coord[i] < bounds[2 * i] || coord[i] > bounds[2 * i + 1]) {
        return 0;
      }
    } else {
      coord[i] = candidatePlane[i];
    }
  }
  return 1;
}

// Plane intersection with box
// The plane is infinite in extent and defined by an origin and normal.The function indicates
// whether the plane intersects, not the particulars of intersection points and such
// The function returns non-zero if the plane and box intersect; zero otherwise.
function intersectPlane(bounds, origin, normal) {
  const p = [];
  let d = 0;
  let sign = 1;
  let firstOne = 1;

  // Evaluate the eight points. If there is a sign change, there is an intersection
  for (let z = 4; z <= 5; ++z) {
    p[2] = bounds[z];
    for (let y = 2; y <= 3; ++y) {
      p[1] = bounds[y];
      for (let x = 0; x <= 1; ++x) {
        p[0] = bounds[x];
        d = vtkPlane$1.evaluate(normal, origin, p);
        if (firstOne) {
          sign = d >= 0 ? 1 : -1;
          firstOne = 0;
        }
        if (d === 0.0 || sign > 0 && d < 0.0 || sign < 0 && d > 0.0) {
          return 1;
        }
      }
    }
  }
  return 0; // no intersection
}

function intersect(bounds, bBounds) {
  if (!(isValid(bounds) && isValid(bBounds))) {
    return false;
  }
  const newBounds = [0, 0, 0, 0, 0, 0];
  let intersection;
  for (let i = 0; i < 3; i++) {
    intersection = false;
    if (bBounds[i * 2] >= bounds[i * 2] && bBounds[i * 2] <= bounds[i * 2 + 1]) {
      intersection = true;
      newBounds[i * 2] = bBounds[i * 2];
    } else if (bounds[i * 2] >= bBounds[i * 2] && bounds[i * 2] <= bBounds[i * 2 + 1]) {
      intersection = true;
      newBounds[i * 2] = bounds[i * 2];
    }
    if (bBounds[i * 2 + 1] >= bounds[i * 2] && bBounds[i * 2 + 1] <= bounds[i * 2 + 1]) {
      intersection = true;
      newBounds[i * 2 + 1] = bBounds[2 * i + 1];
    } else if (bounds[i * 2 + 1] >= bBounds[i * 2] && bounds[i * 2 + 1] <= bBounds[i * 2 + 1]) {
      intersection = true;
      newBounds[i * 2 + 1] = bounds[i * 2 + 1];
    }
    if (!intersection) {
      return false;
    }
  }

  // OK they did intersect - set the box to be the result
  bounds[0] = newBounds[0];
  bounds[1] = newBounds[1];
  bounds[2] = newBounds[2];
  bounds[3] = newBounds[3];
  bounds[4] = newBounds[4];
  bounds[5] = newBounds[5];
  return true;
}
function intersects(bounds, bBounds) {
  if (!(isValid(bounds) && isValid(bBounds))) {
    return false;
  }
  /* eslint-disable no-continue */
  for (let i = 0; i < 3; i++) {
    if (bBounds[i * 2] >= bounds[i * 2] && bBounds[i * 2] <= bounds[i * 2 + 1]) {
      continue;
    } else if (bounds[i * 2] >= bBounds[i * 2] && bounds[i * 2] <= bBounds[i * 2 + 1]) {
      continue;
    }
    if (bBounds[i * 2 + 1] >= bounds[i * 2] && bBounds[i * 2 + 1] <= bounds[i * 2 + 1]) {
      continue;
    } else if (bounds[i * 2 + 1] >= bBounds[i * 2] && bounds[i * 2 + 1] <= bBounds[i * 2 + 1]) {
      continue;
    }
    return false;
  }
  /* eslint-enable no-continue */

  return true;
}
function containsPoint$1(bounds, x, y, z) {
  if (x < bounds[0] || x > bounds[1]) {
    return false;
  }
  if (y < bounds[2] || y > bounds[3]) {
    return false;
  }
  if (z < bounds[4] || z > bounds[5]) {
    return false;
  }
  return true;
}
function contains(bounds, otherBounds) {
  // if either box is not valid or they don't intersect
  if (!intersects(bounds, otherBounds)) {
    return false;
  }
  if (!containsPoint$1(bounds, ...getMinPoint(otherBounds))) {
    return false;
  }
  if (!containsPoint$1(bounds, ...getMaxPoint(otherBounds))) {
    return false;
  }
  return true;
}

/**
 * Returns true if plane intersects bounding box.
 * If so, the box is cut by the plane
 * @param {array} origin
 * @param {array} normal
 */
function cutWithPlane(bounds, origin, normal) {
  // Index[0..2] represents the order of traversing the corners of a cube
  // in (x,y,z), (y,x,z) and (z,x,y) ordering, respectively
  const index = [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 4, 5, 2, 3, 6, 7], [0, 2, 4, 6, 1, 3, 5, 7]];

  // stores the signed distance to a plane
  const d = [0, 0, 0, 0, 0, 0, 0, 0];
  let idx = 0;
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 2; iy < 4; iy++) {
      for (let iz = 4; iz < 6; iz++) {
        const x = [bounds[ix], bounds[iy], bounds[iz]];
        d[idx++] = vtkPlane$1.evaluate(normal, origin, x);
      }
    }
  }
  let dir = 2;
  while (dir--) {
    // in each direction, we test if the vertices of two orthogonal faces
    // are on either side of the plane
    if (oppositeSign(d[index[dir][0]], d[index[dir][4]]) && oppositeSign(d[index[dir][1]], d[index[dir][5]]) && oppositeSign(d[index[dir][2]], d[index[dir][6]]) && oppositeSign(d[index[dir][3]], d[index[dir][7]])) {
      break;
    }
  }
  if (dir < 0) {
    return false;
  }
  const sign = Math.sign(normal[dir]);
  const size = Math.abs((bounds[dir * 2 + 1] - bounds[dir * 2]) * normal[dir]);
  let t = sign > 0 ? 1 : 0;
  /* eslint-disable no-continue */
  for (let i = 0; i < 4; i++) {
    if (size === 0) {
      continue; // shouldn't happen
    }

    const ti = Math.abs(d[index[dir][i]]) / size;
    if (sign > 0 && ti < t) {
      t = ti;
    }
    if (sign < 0 && ti > t) {
      t = ti;
    }
  }
  /* eslint-enable no-continue */
  const bound = (1.0 - t) * bounds[dir * 2] + t * bounds[dir * 2 + 1];
  if (sign > 0) {
    bounds[dir * 2] = bound;
  } else {
    bounds[dir * 2 + 1] = bound;
  }
  return true;
}

// ----------------------------------------------------------------------------
// Light Weight class
// ----------------------------------------------------------------------------

class BoundingBox {
  constructor(refBounds) {
    this.bounds = refBounds;
    if (!this.bounds) {
      this.bounds = new Float64Array(INIT_BOUNDS);
    }
  }
  getBounds() {
    return this.bounds;
  }
  equals(otherBounds) {
    return equals(this.bounds, otherBounds);
  }
  isValid() {
    return isValid(this.bounds);
  }
  setBounds(otherBounds) {
    return setBounds(this.bounds, otherBounds);
  }
  reset() {
    return reset(this.bounds);
  }
  addPoint() {
    for (var _len = arguments.length, xyz = new Array(_len), _key = 0; _key < _len; _key++) {
      xyz[_key] = arguments[_key];
    }
    return addPoint(this.bounds, ...xyz);
  }
  addPoints(points) {
    return addPoints(this.bounds, points);
  }
  addBounds(xMin, xMax, yMin, yMax, zMin, zMax) {
    return addBounds(this.bounds, xMin, xMax, yMin, yMax, zMin, zMax);
  }
  setMinPoint(x, y, z) {
    return setMinPoint(this.bounds, x, y, z);
  }
  setMaxPoint(x, y, z) {
    return setMaxPoint(this.bounds, x, y, z);
  }
  inflate(delta) {
    return inflate(this.bounds, delta);
  }
  scale(sx, sy, sz) {
    return scale(this.bounds, sx, sy, sz);
  }
  getCenter() {
    return getCenter(this.bounds);
  }
  getLength(index) {
    return getLength(this.bounds, index);
  }
  getLengths() {
    return getLengths(this.bounds);
  }
  getMaxLength() {
    return getMaxLength(this.bounds);
  }
  getDiagonalLength() {
    return getDiagonalLength(this.bounds);
  }
  getMinPoint() {
    return getMinPoint(this.bounds);
  }
  getMaxPoint() {
    return getMaxPoint(this.bounds);
  }
  getXRange() {
    return getXRange(this.bounds);
  }
  getYRange() {
    return getYRange(this.bounds);
  }
  getZRange() {
    return getZRange(this.bounds);
  }
  getCorners(corners) {
    return getCorners(this.bounds, corners);
  }
  computeCornerPoints(point1, point2) {
    return computeCornerPoints(this.bounds, point1, point2);
  }
  computeLocalBounds(u, v, w) {
    return computeLocalBounds(this.bounds, u, v, w);
  }
  transformBounds(transform) {
    let out = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    return transformBounds(this.bounds, transform, out);
  }
  computeScale3(scale3) {
    return computeScale3(this.bounds, scale3);
  }
  cutWithPlane(origin, normal) {
    return cutWithPlane(this.bounds, origin, normal);
  }
  intersectBox(origin, dir, coord, tolerance) {
    return intersectBox(this.bounds, origin, dir, coord, tolerance);
  }
  intersectPlane(origin, normal) {
    return intersectPlane(this.bounds, origin, normal);
  }
  intersect(otherBounds) {
    return intersect(this.bounds, otherBounds);
  }
  intersects(otherBounds) {
    return intersects(this.bounds, otherBounds);
  }
  containsPoint(x, y, z) {
    return containsPoint$1(this.bounds, x, y, z);
  }
  contains(otherBounds) {
    return intersects(this.bounds, otherBounds);
  }
}
function newInstance$g(initialValues) {
  const bounds = initialValues && initialValues.bounds;
  return new BoundingBox(bounds);
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$5 = {
  equals,
  isValid,
  setBounds,
  reset,
  addPoint,
  addPoints,
  addBounds,
  setMinPoint,
  setMaxPoint,
  inflate,
  scale,
  scaleAboutCenter,
  getCenter,
  getLength,
  getLengths,
  getMaxLength,
  getDiagonalLength,
  getMinPoint,
  getMaxPoint,
  getXRange,
  getYRange,
  getZRange,
  getCorners,
  computeCornerPoints,
  computeLocalBounds,
  transformBounds,
  computeScale3,
  cutWithPlane,
  intersectBox,
  intersectPlane,
  intersect,
  intersects,
  containsPoint: containsPoint$1,
  contains,
  INIT_BOUNDS
};
var vtkBoundingBox = {
  newInstance: newInstance$g,
  ...STATIC$5
};

const DataTypeByteSize = {
  Int8Array: 1,
  Uint8Array: 1,
  Uint8ClampedArray: 1,
  Int16Array: 2,
  Uint16Array: 2,
  Int32Array: 4,
  Uint32Array: 4,
  Float32Array: 4,
  Float64Array: 8
};
const VtkDataTypes = {
  VOID: '',
  // not sure to know what that should be
  CHAR: 'Int8Array',
  SIGNED_CHAR: 'Int8Array',
  UNSIGNED_CHAR: 'Uint8Array',
  UNSIGNED_CHAR_CLAMPED: 'Uint8ClampedArray',
  // should be used for VTK.js internal purpose only
  SHORT: 'Int16Array',
  UNSIGNED_SHORT: 'Uint16Array',
  INT: 'Int32Array',
  UNSIGNED_INT: 'Uint32Array',
  FLOAT: 'Float32Array',
  DOUBLE: 'Float64Array'
};
const DefaultDataType$1 = VtkDataTypes.FLOAT;
var Constants$4 = {
  DefaultDataType: DefaultDataType$1,
  DataTypeByteSize,
  VtkDataTypes
};

const {
  vtkErrorMacro: vtkErrorMacro$4
} = macro$1;
const {
  DefaultDataType
} = Constants$4;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------
const EPSILON = 1e-6;

// Original source from https://www.npmjs.com/package/compute-range
// Modified to accept type arrays
function fastComputeRange(arr, offset, numberOfComponents) {
  const len = arr.length;
  let min = Number.MAX_VALUE;
  let max = -Number.MAX_VALUE;
  let x;
  let i;

  // find first non-NaN value
  for (i = offset; i < len; i += numberOfComponents) {
    if (!Number.isNaN(arr[i])) {
      min = arr[i];
      max = min;
      break;
    }
  }
  for (; i < len; i += numberOfComponents) {
    x = arr[i];
    if (x < min) {
      min = x;
    } else if (x > max) {
      max = x;
    }
  }
  return {
    min,
    max
  };
}

/**
 * @deprecated please use fastComputeRange instead
 */
function createRangeHelper() {
  let min = Number.MAX_VALUE;
  let max = -Number.MAX_VALUE;
  let count = 0;
  let sum = 0;
  return {
    add(value) {
      if (min > value) {
        min = value;
      }
      if (max < value) {
        max = value;
      }
      count++;
      sum += value;
    },
    get() {
      return {
        min,
        max,
        count,
        sum,
        mean: sum / count
      };
    },
    getRange() {
      return {
        min,
        max
      };
    }
  };
}
function computeRange(values) {
  let component = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  let numberOfComponents = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  if (component < 0 && numberOfComponents > 1) {
    // Compute magnitude
    const size = values.length;
    const numberOfValues = size / numberOfComponents;
    const data = new Float64Array(numberOfValues);
    for (let i = 0, j = 0; i < numberOfValues; ++i) {
      for (let nextJ = j + numberOfComponents; j < nextJ; ++j) {
        data[i] += values[j] * values[j];
      }
      data[i] **= 0.5;
    }
    return fastComputeRange(data, 0, 1);
  }
  return fastComputeRange(values, component < 0 ? 0 : component, numberOfComponents);
}
function ensureRangeSize(rangeArray) {
  let size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  const ranges = rangeArray || [];
  // Pad ranges with null value to get the
  while (ranges.length <= size) {
    ranges.push(null);
  }
  return ranges;
}
function getDataType(typedArray) {
  // Expects toString() to return "[object ...Array]"
  return Object.prototype.toString.call(typedArray).slice(8, -1);
}
function getMaxNorm(normArray) {
  const numComps = normArray.getNumberOfComponents();
  let maxNorm = 0.0;
  const tuple = new Array(numComps);
  for (let i = 0; i < normArray.getNumberOfTuples(); ++i) {
    normArray.getTuple(i, tuple);
    const norm$1 = norm(tuple, numComps);
    if (norm$1 > maxNorm) {
      maxNorm = norm$1;
    }
  }
  return maxNorm;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$4 = {
  computeRange,
  createRangeHelper,
  fastComputeRange,
  getDataType,
  getMaxNorm
};

// ----------------------------------------------------------------------------
// vtkDataArray methods
// ----------------------------------------------------------------------------

function vtkDataArray(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkDataArray');

  /**
   * Resize model.values and copy the old values to the new array.
   * @param {Number} requestedNumTuples Final expected number of tuples; must be >= 0
   * @returns {Boolean} True if a resize occured, false otherwise
   */
  function resize(requestedNumTuples) {
    if (requestedNumTuples < 0) {
      return false;
    }
    const numComps = publicAPI.getNumberOfComponents();
    const curNumTuples = model.values.length / (numComps > 0 ? numComps : 1);
    if (requestedNumTuples === curNumTuples) {
      return true;
    }
    if (requestedNumTuples > curNumTuples) {
      // Requested size is bigger than current size.  Allocate enough
      // memory to fit the requested size and be more than double the
      // currently allocated memory.
      const oldValues = model.values;
      model.values = newTypedArray(model.dataType, (requestedNumTuples + curNumTuples) * numComps);
      model.values.set(oldValues);
      return true;
    }

    // Requested size is smaller than currently allocated size
    if (model.size > requestedNumTuples * numComps) {
      model.size = requestedNumTuples * numComps;
      publicAPI.dataChange();
    }
    return true;
  }
  publicAPI.dataChange = () => {
    model.ranges = null;
    publicAPI.modified();
  };
  publicAPI.resize = requestedNumTuples => {
    resize(requestedNumTuples);
    const newSize = requestedNumTuples * publicAPI.getNumberOfComponents();
    if (model.size !== newSize) {
      model.size = newSize;
      publicAPI.dataChange();
      return true;
    }
    return false;
  };

  // FIXME, to rename into "clear()" or "reset()"
  publicAPI.initialize = () => {
    publicAPI.resize(0);
  };
  publicAPI.getElementComponentSize = () => model.values.BYTES_PER_ELEMENT;

  // Description:
  // Return the data component at the location specified by tupleIdx and
  // compIdx.
  publicAPI.getComponent = function (tupleIdx) {
    let compIdx = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    return model.values[tupleIdx * model.numberOfComponents + compIdx];
  };

  // Description:
  // Set the data component at the location specified by tupleIdx and compIdx
  // to value.
  // Note that i is less than NumberOfTuples and j is less than
  //  NumberOfComponents. Make sure enough memory has been allocated
  // (use SetNumberOfTuples() and SetNumberOfComponents()).
  publicAPI.setComponent = (tupleIdx, compIdx, value) => {
    if (value !== model.values[tupleIdx * model.numberOfComponents + compIdx]) {
      model.values[tupleIdx * model.numberOfComponents + compIdx] = value;
      publicAPI.dataChange();
    }
  };
  publicAPI.getValue = valueIdx => {
    const idx = valueIdx / model.numberOfComponents;
    const comp = valueIdx % model.numberOfComponents;
    return publicAPI.getComponent(idx, comp);
  };
  publicAPI.setValue = (valueIdx, value) => {
    const idx = valueIdx / model.numberOfComponents;
    const comp = valueIdx % model.numberOfComponents;
    publicAPI.setComponent(idx, comp, value);
  };
  publicAPI.getData = () => model.size === model.values.length ? model.values : model.values.subarray(0, model.size);
  publicAPI.getRange = function () {
    let componentIndex = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : -1;
    let rangeIdx = componentIndex;
    if (rangeIdx < 0) {
      // If scalar data, then store in slot 0 (same as componentIndex = 0).
      // If vector data, then store in last slot.
      rangeIdx = model.numberOfComponents === 1 ? 0 : model.numberOfComponents;
    }
    let range = null;
    if (!model.ranges) {
      model.ranges = ensureRangeSize(model.ranges, model.numberOfComponents);
    }
    range = model.ranges[rangeIdx];
    if (range) {
      model.rangeTuple[0] = range.min;
      model.rangeTuple[1] = range.max;
      return model.rangeTuple;
    }

    // Need to compute ranges...
    range = computeRange(publicAPI.getData(), componentIndex, model.numberOfComponents);
    model.ranges[rangeIdx] = range;
    model.rangeTuple[0] = range.min;
    model.rangeTuple[1] = range.max;
    return model.rangeTuple;
  };
  publicAPI.setRange = (rangeValue, componentIndex) => {
    if (!model.ranges) {
      model.ranges = ensureRangeSize(model.ranges, model.numberOfComponents);
    }
    const range = {
      min: rangeValue.min,
      max: rangeValue.max
    };
    model.ranges[componentIndex] = range;
    model.rangeTuple[0] = range.min;
    model.rangeTuple[1] = range.max;
    return model.rangeTuple;
  };
  publicAPI.setTuple = (idx, tuple) => {
    const offset = idx * model.numberOfComponents;
    for (let i = 0; i < model.numberOfComponents; i++) {
      model.values[offset + i] = tuple[i];
    }
  };
  publicAPI.setTuples = (idx, tuples) => {
    let i = idx * model.numberOfComponents;
    const last = Math.min(tuples.length, model.size - i);
    for (let j = 0; j < last;) {
      model.values[i++] = tuples[j++];
    }
  };
  publicAPI.insertTuple = (idx, tuple) => {
    if (model.size <= idx * model.numberOfComponents) {
      model.size = (idx + 1) * model.numberOfComponents;
      resize(idx + 1);
    }
    publicAPI.setTuple(idx, tuple);
    return idx;
  };
  publicAPI.insertTuples = (idx, tuples) => {
    const end = idx + tuples.length / model.numberOfComponents;
    if (model.size < end * model.numberOfComponents) {
      model.size = end * model.numberOfComponents;
      resize(end);
    }
    publicAPI.setTuples(idx, tuples);
    return end;
  };
  publicAPI.insertNextTuple = tuple => {
    const idx = model.size / model.numberOfComponents;
    return publicAPI.insertTuple(idx, tuple);
  };
  publicAPI.insertNextTuples = tuples => {
    const idx = model.size / model.numberOfComponents;
    return publicAPI.insertTuples(idx, tuples);
  };
  publicAPI.findTuple = function (tuple) {
    let precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : EPSILON;
    for (let i = 0; i < model.size; i += model.numberOfComponents) {
      if (Math.abs(tuple[0] - model.values[i]) <= precision) {
        let match = true;
        for (let j = 1; j < model.numberOfComponents; ++j) {
          if (Math.abs(tuple[j] - model.values[i + j]) > precision) {
            match = false;
            break;
          }
        }
        if (match) {
          return i / model.numberOfComponents;
        }
      }
    }
    return -1;
  };
  publicAPI.getTuple = function (idx) {
    let tupleToFill = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    const numberOfComponents = model.numberOfComponents || 1;
    const offset = idx * numberOfComponents;
    // Check most common component sizes first
    // to avoid doing a for loop if possible
    switch (numberOfComponents) {
      case 4:
        tupleToFill[3] = model.values[offset + 3];
      // eslint-disable-next-line no-fallthrough
      case 3:
        tupleToFill[2] = model.values[offset + 2];
      // eslint-disable-next-line no-fallthrough
      case 2:
        tupleToFill[1] = model.values[offset + 1];
      // eslint-disable-next-line no-fallthrough
      case 1:
        tupleToFill[0] = model.values[offset];
        break;
      default:
        for (let i = numberOfComponents - 1; i >= 0; --i) {
          tupleToFill[i] = model.values[offset + i];
        }
    }
    return tupleToFill;
  };
  publicAPI.getTuples = (fromId, toId) => {
    const from = (fromId ?? 0) * model.numberOfComponents;
    const to = (toId ?? publicAPI.getNumberOfTuples()) * model.numberOfComponents;
    const arr = publicAPI.getData().subarray(from, to);
    return arr.length > 0 ? arr : null;
  };
  publicAPI.getTupleLocation = function () {
    let idx = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    return idx * model.numberOfComponents;
  };
  publicAPI.getNumberOfComponents = () => model.numberOfComponents;
  publicAPI.getNumberOfValues = () => model.size;
  publicAPI.getNumberOfTuples = () => model.size / model.numberOfComponents;
  publicAPI.getDataType = () => model.dataType;
  /* eslint-disable no-use-before-define */
  publicAPI.newClone = () => newInstance$f({
    empty: true,
    name: model.name,
    dataType: model.dataType,
    numberOfComponents: model.numberOfComponents
  });
  /* eslint-enable no-use-before-define */

  publicAPI.getName = () => {
    if (!model.name) {
      publicAPI.modified();
      model.name = `vtkDataArray${publicAPI.getMTime()}`;
    }
    return model.name;
  };
  publicAPI.setData = (typedArray, numberOfComponents) => {
    model.values = typedArray;
    model.size = typedArray.length;
    model.dataType = getDataType(typedArray);
    if (numberOfComponents) {
      model.numberOfComponents = numberOfComponents;
    }
    if (model.size % model.numberOfComponents !== 0) {
      model.numberOfComponents = 1;
    }
    publicAPI.dataChange();
  };

  // Override serialization support
  publicAPI.getState = () => {
    if (model.deleted) {
      return null;
    }
    const jsonArchive = {
      ...model,
      vtkClass: publicAPI.getClassName()
    };

    // Convert typed array to regular array
    jsonArchive.values = Array.from(jsonArchive.values);
    delete jsonArchive.buffer;

    // Clean any empty data
    Object.keys(jsonArchive).forEach(keyName => {
      if (!jsonArchive[keyName]) {
        delete jsonArchive[keyName];
      }
    });

    // Sort resulting object by key name
    const sortedObj = {};
    Object.keys(jsonArchive).sort().forEach(name => {
      sortedObj[name] = jsonArchive[name];
    });

    // Remove mtime
    if (sortedObj.mtime) {
      delete sortedObj.mtime;
    }
    return sortedObj;
  };
  publicAPI.deepCopy = other => {
    // Retain current dataType and array reference before shallowCopy call.
    const currentType = publicAPI.getDataType();
    const currentArray = model.values;
    publicAPI.shallowCopy(other);

    // Avoid array reallocation if size already sufficient
    // and dataTypes match.
    if (currentArray?.length >= other.getNumberOfValues() && currentType === other.getDataType()) {
      currentArray.set(other.getData());
      model.values = currentArray;
      publicAPI.dataChange();
    } else {
      publicAPI.setData(other.getData().slice());
    }
  };
  publicAPI.interpolateTuple = (idx, source1, source1Idx, source2, source2Idx, t) => {
    const numberOfComponents = model.numberOfComponents || 1;
    if (numberOfComponents !== source1.getNumberOfComponents() || numberOfComponents !== source2.getNumberOfComponents()) {
      vtkErrorMacro$4('numberOfComponents must match');
    }
    const tuple1 = source1.getTuple(source1Idx);
    const tuple2 = source2.getTuple(source2Idx);
    const out = [];
    out.length = numberOfComponents;

    // Check most common component sizes first
    // to avoid doing a for loop if possible
    switch (numberOfComponents) {
      case 4:
        out[3] = tuple1[3] + (tuple2[3] - tuple1[3]) * t;
      // eslint-disable-next-line no-fallthrough
      case 3:
        out[2] = tuple1[2] + (tuple2[2] - tuple1[2]) * t;
      // eslint-disable-next-line no-fallthrough
      case 2:
        out[1] = tuple1[1] + (tuple2[1] - tuple1[1]) * t;
      // eslint-disable-next-line no-fallthrough
      case 1:
        out[0] = tuple1[0] + (tuple2[0] - tuple1[0]) * t;
        break;
      default:
        for (let i = 0; i < numberOfComponents; i++) {
          out[i] = tuple1[i] + (tuple2[i] - tuple1[i]) * t;
        }
    }
    return publicAPI.insertTuple(idx, out);
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

// size: The current size of the dataArray.
// NOTE: The underlying typed array may be larger than 'size'.
const DEFAULT_VALUES$e = {
  name: '',
  numberOfComponents: 1,
  dataType: DefaultDataType,
  rangeTuple: [0, 0]
  // size: undefined,
  // values: null,
  // ranges: null,
};

// ----------------------------------------------------------------------------

function extend$f(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$e, initialValues);
  if (!model.empty && !model.values && !model.size) {
    throw new TypeError('Cannot create vtkDataArray object without: size > 0, values');
  }
  if (!model.values) {
    model.values = newTypedArray(model.dataType, model.size);
  } else if (Array.isArray(model.values)) {
    model.values = newTypedArrayFrom(model.dataType, model.values);
  }
  if (model.values) {
    // Takes the size if provided (can be lower than `model.values`) otherwise the actual length of `values`.
    model.size = model.size ?? model.values.length;
    model.dataType = getDataType(model.values);
  }

  // Object methods
  obj(publicAPI, model);
  set(publicAPI, model, ['name', 'numberOfComponents']);
  if (model.size % model.numberOfComponents !== 0) {
    throw new RangeError('model.size is not a multiple of model.numberOfComponents');
  }

  // Object specific methods
  vtkDataArray(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$f = newInstance$i(extend$f, 'vtkDataArray');

// ----------------------------------------------------------------------------

var vtkDataArray$1 = {
  newInstance: newInstance$f,
  extend: extend$f,
  ...STATIC$4,
  ...Constants$4
};

const {
  vtkErrorMacro: vtkErrorMacro$3,
  vtkWarningMacro: vtkWarningMacro$2
} = macro;

// ----------------------------------------------------------------------------
// vtkFieldData methods
// ----------------------------------------------------------------------------

function vtkFieldData(publicAPI, model) {
  model.classHierarchy.push('vtkFieldData');
  const superGetState = publicAPI.getState;

  // Decode serialized data if any
  if (model.arrays) {
    model.arrays = model.arrays.map(item => ({
      data: vtk(item.data)
    }));
  }
  publicAPI.initialize = () => {
    publicAPI.initializeFields();
    publicAPI.copyAllOn();
    publicAPI.clearFieldFlags();
  };
  publicAPI.initializeFields = () => {
    model.arrays = [];
    model.copyFieldFlags = {};
    publicAPI.modified();
  };
  publicAPI.copyStructure = other => {
    publicAPI.initializeFields();
    model.copyFieldFlags = other.getCopyFieldFlags().map(x => x); // Deep-copy
    model.arrays = other.arrays().map(x => ({
      array: x
    })); // Deep-copy
    // TODO: Copy array information objects (once we support information objects)
  };

  publicAPI.getNumberOfArrays = () => model.arrays.length;
  publicAPI.getNumberOfActiveArrays = () => model.arrays.length;
  publicAPI.addArray = arr => {
    const name = arr.getName();
    const {
      array,
      index
    } = publicAPI.getArrayWithIndex(name);
    if (array != null) {
      model.arrays[index] = {
        data: arr
      };
      return index;
    }
    model.arrays = [].concat(model.arrays, {
      data: arr
    });
    return model.arrays.length - 1;
  };
  publicAPI.removeAllArrays = () => {
    model.arrays = [];
  };
  publicAPI.removeArray = arrayName => {
    const index = model.arrays.findIndex(array => array.data.getName() === arrayName);
    return publicAPI.removeArrayByIndex(index);
  };
  publicAPI.removeArrayByIndex = arrayIdx => {
    if (arrayIdx !== -1 && arrayIdx < model.arrays.length) {
      model.arrays.splice(arrayIdx, 1);
      // TBD modified() ?
      return true;
    }
    return false;
  };
  publicAPI.getArrays = () => model.arrays.map(entry => entry.data);
  publicAPI.getArray = arraySpec => typeof arraySpec === 'number' ? publicAPI.getArrayByIndex(arraySpec) : publicAPI.getArrayByName(arraySpec);
  publicAPI.getArrayByName = arrayName => model.arrays.reduce((a, b, i) => b.data.getName() === arrayName ? b.data : a, null);
  publicAPI.getArrayWithIndex = arrayName => {
    const index = model.arrays.findIndex(array => array.data.getName() === arrayName);
    return {
      array: index !== -1 ? model.arrays[index].data : null,
      index
    };
  };
  publicAPI.getArrayByIndex = idx => idx >= 0 && idx < model.arrays.length ? model.arrays[idx].data : null;
  publicAPI.hasArray = arrayName => publicAPI.getArrayWithIndex(arrayName).index >= 0;
  publicAPI.getArrayName = idx => {
    const arr = model.arrays[idx];
    return arr ? arr.data.getName() : '';
  };
  publicAPI.getCopyFieldFlags = () => model.copyFieldFlags;
  publicAPI.getFlag = arrayName => model.copyFieldFlags[arrayName];
  publicAPI.passData = function (other) {
    let fromId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    let toId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    other.getArrays().forEach(arr => {
      const copyFlag = publicAPI.getFlag(arr.getName());
      if (copyFlag !== false && !(model.doCopyAllOff && copyFlag !== true) && arr) {
        let destArr = publicAPI.getArrayByName(arr.getName());
        if (!destArr) {
          if (fromId < 0 || fromId > arr.getNumberOfTuples()) {
            // TBD: should this be a deep or a shallow copy?
            publicAPI.addArray(arr);
            other.getAttributes(arr).forEach(attrType => {
              publicAPI.setAttribute(arr, attrType);
            });
          } else {
            const ncomps = arr.getNumberOfComponents();
            let newSize = arr.getNumberOfValues();
            const tId = toId > -1 ? toId : fromId;
            if (newSize <= tId * ncomps) {
              newSize = (tId + 1) * ncomps;
            }
            destArr = vtkDataArray$1.newInstance({
              name: arr.getName(),
              dataType: arr.getDataType(),
              numberOfComponents: ncomps,
              values: macro.newTypedArray(arr.getDataType(), newSize),
              size: 0
            });
            destArr.insertTuple(tId, arr.getTuple(fromId));
            publicAPI.addArray(destArr);
            other.getAttributes(arr).forEach(attrType => {
              publicAPI.setAttribute(destArr, attrType);
            });
          }
        } else if (arr.getNumberOfComponents() === destArr.getNumberOfComponents()) {
          if (fromId > -1 && fromId < arr.getNumberOfTuples()) {
            const tId = toId > -1 ? toId : fromId;
            destArr.insertTuple(tId, arr.getTuple(fromId));
          } else {
            // if `fromId` is not provided, just copy all (or as much possible)
            // from `arr` to `destArr`.
            destArr.insertTuples(0, arr.getTuples());
          }
        } else {
          vtkErrorMacro$3('Unhandled case in passData');
        }
      }
    });
  };
  publicAPI.interpolateData = function (other) {
    let fromId1 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    let fromId2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    let toId = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
    let t = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0.5;
    other.getArrays().forEach(arr => {
      const copyFlag = publicAPI.getFlag(arr.getName());
      if (copyFlag !== false && !(model.doCopyAllOff && copyFlag !== true) && arr) {
        let destArr = publicAPI.getArrayByName(arr.getName());
        if (!destArr) {
          if (fromId1 < 0 || fromId2 < 0 || fromId1 > arr.getNumberOfTuples()) {
            // TBD: should this be a deep or a shallow copy?
            publicAPI.addArray(arr);
            other.getAttributes(arr).forEach(attrType => {
              publicAPI.setAttribute(arr, attrType);
            });
          } else {
            const ncomps = arr.getNumberOfComponents();
            let newSize = arr.getNumberOfValues();
            // TODO: Is this supposed to happen?
            const tId = toId > -1 ? toId : fromId1;
            if (newSize <= tId * ncomps) {
              newSize = (tId + 1) * ncomps;
            }
            destArr = vtkDataArray$1.newInstance({
              name: arr.getName(),
              dataType: arr.getDataType(),
              numberOfComponents: ncomps,
              values: macro.newTypedArray(arr.getDataType(), newSize),
              size: 0
            });
            destArr.interpolateTuple(tId, arr, fromId1, arr, fromId2, t);
            publicAPI.addArray(destArr);
            other.getAttributes(arr).forEach(attrType => {
              publicAPI.setAttribute(destArr, attrType);
            });
          }
        } else if (arr.getNumberOfComponents() === destArr.getNumberOfComponents()) {
          if (fromId1 > -1 && fromId1 < arr.getNumberOfTuples()) {
            const tId = toId > -1 ? toId : fromId1;
            destArr.interpolateTuple(tId, arr, fromId1, arr, fromId2, t);
            vtkWarningMacro$2('Unexpected case in interpolateData');
          } else {
            // if `fromId` is not provided, just copy all (or as much possible)
            // from `arr` to `destArr`.
            destArr.insertTuples(arr.getTuples());
          }
        } else {
          vtkErrorMacro$3('Unhandled case in interpolateData');
        }
      }
    });
  };
  publicAPI.copyFieldOn = arrayName => {
    model.copyFieldFlags[arrayName] = true;
  };
  publicAPI.copyFieldOff = arrayName => {
    model.copyFieldFlags[arrayName] = false;
  };
  publicAPI.copyAllOn = () => {
    if (!model.doCopyAllOn || model.doCopyAllOff) {
      model.doCopyAllOn = true;
      model.doCopyAllOff = false;
      publicAPI.modified();
    }
  };
  publicAPI.copyAllOff = () => {
    if (model.doCopyAllOn || !model.doCopyAllOff) {
      model.doCopyAllOn = false;
      model.doCopyAllOff = true;
      publicAPI.modified();
    }
  };
  publicAPI.clearFieldFlags = () => {
    model.copyFieldFlags = {};
  };
  publicAPI.deepCopy = other => {
    model.arrays = other.getArrays().map(arr => {
      const arrNew = arr.newClone();
      arrNew.deepCopy(arr);
      return {
        data: arrNew
      };
    });
  };
  publicAPI.copyFlags = other => other.getCopyFieldFlags().map(x => x);
  // TODO: publicAPI.squeeze = () => model.arrays.forEach(entry => entry.data.squeeze());
  publicAPI.reset = () => model.arrays.forEach(entry => entry.data.reset());
  // TODO: getActualMemorySize
  publicAPI.getMTime = () => model.arrays.reduce((a, b) => b.data.getMTime() > a ? b.data.getMTime() : a, model.mtime);
  // TODO: publicAPI.getField = (ids, other) => { copy ids from other into this model's arrays }
  // TODO: publicAPI.getArrayContainingComponent = (component) => ...
  publicAPI.getNumberOfComponents = () => model.arrays.reduce((a, b) => a + b.data.getNumberOfComponents(), 0);
  publicAPI.getNumberOfTuples = () => model.arrays.length > 0 ? model.arrays[0].getNumberOfTuples() : 0;
  publicAPI.getState = () => {
    const result = superGetState();
    if (result) {
      result.arrays = model.arrays.map(item => ({
        data: item.data.getState()
      }));
    }
    return result;
  };
}
const DEFAULT_VALUES$d = {
  arrays: [],
  copyFieldFlags: [],
  // fields not to copy
  doCopyAllOn: true,
  doCopyAllOff: false
};
function extend$e(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$d, initialValues);
  macro.obj(publicAPI, model);
  vtkFieldData(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$e = macro.newInstance(extend$e, 'vtkFieldData');

// ----------------------------------------------------------------------------

var vtkFieldData$1 = {
  newInstance: newInstance$e,
  extend: extend$e
};

const AttributeTypes$1 = {
  SCALARS: 0,
  VECTORS: 1,
  NORMALS: 2,
  TCOORDS: 3,
  TENSORS: 4,
  GLOBALIDS: 5,
  PEDIGREEIDS: 6,
  EDGEFLAG: 7,
  NUM_ATTRIBUTES: 8
};
const AttributeLimitTypes = {
  MAX: 0,
  EXACT: 1,
  NOLIMIT: 2
};
const CellGhostTypes = {
  DUPLICATECELL: 1,
  // the cell is present on multiple processors
  HIGHCONNECTIVITYCELL: 2,
  // the cell has more neighbors than in a regular mesh
  LOWCONNECTIVITYCELL: 4,
  // the cell has less neighbors than in a regular mesh
  REFINEDCELL: 8,
  // other cells are present that refines it.
  EXTERIORCELL: 16,
  // the cell is on the exterior of the data set
  HIDDENCELL: 32 // the cell is needed to maintain connectivity, but the data values should be ignored.
};

const PointGhostTypes = {
  DUPLICATEPOINT: 1,
  // the cell is present on multiple processors
  HIDDENPOINT: 2 // the point is needed to maintain connectivity, but the data values should be ignored.
};

const AttributeCopyOperations$1 = {
  COPYTUPLE: 0,
  INTERPOLATE: 1,
  PASSDATA: 2,
  ALLCOPY: 3 // all of the above
};

const ghostArrayName = 'vtkGhostType';
const DesiredOutputPrecision = {
  DEFAULT: 0,
  // use the point type that does not truncate any data
  SINGLE: 1,
  // use Float32Array
  DOUBLE: 2 // use Float64Array
};

var Constants$3 = {
  AttributeCopyOperations: AttributeCopyOperations$1,
  AttributeLimitTypes,
  AttributeTypes: AttributeTypes$1,
  CellGhostTypes,
  DesiredOutputPrecision,
  PointGhostTypes,
  ghostArrayName
};

const {
  AttributeTypes,
  AttributeCopyOperations
} = Constants$3;
const {
  vtkWarningMacro: vtkWarningMacro$1
} = macro;

// ----------------------------------------------------------------------------
// vtkDataSetAttributes methods
// ----------------------------------------------------------------------------

function vtkDataSetAttributes(publicAPI, model) {
  const attrTypes = ['Scalars', 'Vectors', 'Normals', 'TCoords', 'Tensors', 'GlobalIds', 'PedigreeIds'];
  function cleanAttributeType(attType) {
    // Given an integer or string, convert the result to one of the
    // strings in the "attrTypes" array above or null (if
    // no match is found)
    let cleanAttType = attrTypes.find(ee => AttributeTypes[ee.toUpperCase()] === attType || typeof attType !== 'number' && ee.toLowerCase() === attType.toLowerCase());
    if (typeof cleanAttType === 'undefined') {
      cleanAttType = null;
    }
    return cleanAttType;
  }

  // Set our className
  model.classHierarchy.push('vtkDataSetAttributes');
  const superClass = {
    ...publicAPI
  };
  publicAPI.checkNumberOfComponents = x => true; // TODO

  publicAPI.setAttribute = (arr, uncleanAttType) => {
    const attType = cleanAttributeType(uncleanAttType);
    if (arr && attType.toUpperCase() === 'PEDIGREEIDS' && !arr.isA('vtkDataArray')) {
      vtkWarningMacro$1(`Cannot set attribute ${attType}. The attribute must be a vtkDataArray.`);
      return -1;
    }
    if (arr && !publicAPI.checkNumberOfComponents(arr, attType)) {
      vtkWarningMacro$1(`Cannot set attribute ${attType}. Incorrect number of components.`);
      return -1;
    }
    let currentAttribute = model[`active${attType}`];
    if (currentAttribute >= 0 && currentAttribute < model.arrays.length) {
      if (model.arrays[currentAttribute] === arr) {
        return currentAttribute;
      }
      // FIXME setting an array actually changes its index
      publicAPI.removeArrayByIndex(currentAttribute);
    }
    if (arr) {
      currentAttribute = publicAPI.addArray(arr);
      model[`active${attType}`] = currentAttribute;
    } else {
      model[`active${attType}`] = -1;
    }
    publicAPI.modified();
    return model[`active${attType}`];
  };
  publicAPI.getAttributes = arr => attrTypes.filter(attrType => publicAPI[`get${attrType}`]() === arr);
  publicAPI.setActiveAttributeByName = (arrayName, attType) => publicAPI.setActiveAttributeByIndex(publicAPI.getArrayWithIndex(arrayName).index, attType);
  publicAPI.setActiveAttributeByIndex = (arrayIdx, uncleanAttType) => {
    const attType = cleanAttributeType(uncleanAttType);
    if (arrayIdx >= 0 && arrayIdx < model.arrays.length) {
      if (attType.toUpperCase() !== 'PEDIGREEIDS') {
        const arr = publicAPI.getArrayByIndex(arrayIdx);
        if (!arr.isA('vtkDataArray')) {
          vtkWarningMacro$1(`Cannot set attribute ${attType}. Only vtkDataArray subclasses can be set as active attributes.`);
          return -1;
        }
        if (!publicAPI.checkNumberOfComponents(arr, attType)) {
          vtkWarningMacro$1(`Cannot set attribute ${attType}. Incorrect number of components.`);
          return -1;
        }
      }
      model[`active${attType}`] = arrayIdx;
      publicAPI.modified();
      return arrayIdx;
    }
    if (arrayIdx === -1) {
      model[`active${attType}`] = arrayIdx;
      publicAPI.modified();
    }
    return -1;
  };
  publicAPI.getActiveAttribute = attType => {
    // Given an integer enum value or a string (with random capitalization),
    // find the matching string in attrTypes.
    const cleanAttType = cleanAttributeType(attType);
    return publicAPI[`get${cleanAttType}`]();
  };

  // Override to allow proper handling of active attributes
  publicAPI.removeAllArrays = () => {
    attrTypes.forEach(attType => {
      model[`active${attType}`] = -1;
    });
    superClass.removeAllArrays();
  };

  // Override to allow proper handling of active attributes
  publicAPI.removeArrayByIndex = arrayIdx => {
    if (arrayIdx !== -1) {
      attrTypes.forEach(attType => {
        if (arrayIdx === model[`active${attType}`]) {
          model[`active${attType}`] = -1;
        } else if (arrayIdx < model[`active${attType}`]) {
          model[`active${attType}`] -= 1;
        }
      });
    }
    return superClass.removeArrayByIndex(arrayIdx);
  };
  attrTypes.forEach(value => {
    const activeVal = `active${value}`;
    publicAPI[`get${value}`] = () => publicAPI.getArrayByIndex(model[activeVal]);
    publicAPI[`set${value}`] = da => publicAPI.setAttribute(da, value);
    publicAPI[`setActive${value}`] = arrayName => publicAPI.setActiveAttributeByIndex(publicAPI.getArrayWithIndex(arrayName).index, value);
    publicAPI[`copy${value}Off`] = () => {
      const attType = value.toUpperCase();
      model.copyAttributeFlags[AttributeCopyOperations.PASSDATA][AttributeTypes[attType]] = false;
    };
    publicAPI[`copy${value}On`] = () => {
      const attType = value.toUpperCase();
      model.copyAttributeFlags[AttributeCopyOperations.PASSDATA][AttributeTypes[attType]] = true;
    };
  });
  publicAPI.initializeAttributeCopyFlags = () => {
    // Default to copying all attributes in every circumstance:
    model.copyAttributeFlags = [];
    Object.keys(AttributeCopyOperations).filter(op => op !== 'ALLCOPY').forEach(attCopyOp => {
      model.copyAttributeFlags[AttributeCopyOperations[attCopyOp]] = Object.keys(AttributeTypes).filter(ty => ty !== 'NUM_ATTRIBUTES').reduce((a, b) => {
        a[AttributeTypes[b]] = true;
        return a;
      }, []);
    });
    // Override some operations where we don't want to copy:
    model.copyAttributeFlags[AttributeCopyOperations.COPYTUPLE][AttributeTypes.GLOBALIDS] = false;
    model.copyAttributeFlags[AttributeCopyOperations.INTERPOLATE][AttributeTypes.GLOBALIDS] = false;
    model.copyAttributeFlags[AttributeCopyOperations.COPYTUPLE][AttributeTypes.PEDIGREEIDS] = false;
  };
  publicAPI.initialize = macro.chain(publicAPI.initialize, publicAPI.initializeAttributeCopyFlags);

  // Process dataArrays if any
  if (model.dataArrays && Object.keys(model.dataArrays).length) {
    Object.keys(model.dataArrays).forEach(name => {
      if (!model.dataArrays[name].ref && model.dataArrays[name].type === 'vtkDataArray') {
        publicAPI.addArray(vtkDataArray$1.newInstance(model.dataArrays[name]));
      }
    });
  }
  const superShallowCopy = publicAPI.shallowCopy;
  publicAPI.shallowCopy = (other, debug) => {
    superShallowCopy(other, debug);
    model.arrays = other.getArrays().map(arr => {
      const arrNew = arr.newClone();
      arrNew.shallowCopy(arr, debug);
      return {
        data: arrNew
      };
    });
  };
  publicAPI.initializeAttributeCopyFlags();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$c = {
  activeScalars: -1,
  activeVectors: -1,
  activeTensors: -1,
  activeNormals: -1,
  activeTCoords: -1,
  activeGlobalIds: -1,
  activePedigreeIds: -1
};

// ----------------------------------------------------------------------------

function extend$d(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$c, initialValues);

  // Object methods
  vtkFieldData$1.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['activeScalars', 'activeNormals', 'activeTCoords', 'activeVectors', 'activeTensors', 'activeGlobalIds', 'activePedigreeIds']);
  if (!model.arrays) {
    model.arrays = {};
  }

  // Object specific methods
  vtkDataSetAttributes(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$d = macro.newInstance(extend$d, 'vtkDataSetAttributes');

// ----------------------------------------------------------------------------

var vtkDataSetAttributes$1 = {
  newInstance: newInstance$d,
  extend: extend$d,
  ...Constants$3
};

// Specify how data arrays can be used by data objects
const FieldDataTypes = {
  UNIFORM: 0,
  // data that does not vary over points/cells/etc.
  DATA_OBJECT_FIELD: 0,
  // to match VTK

  COORDINATE: 1,
  // data that specifies the location of each point
  POINT_DATA: 1,
  // to match VTK

  POINT: 2,
  // data defined at each point, but that does not specify the point location
  POINT_FIELD_DATA: 2,
  // to match VTK

  CELL: 3,
  // data defined at each cell, but that does not specify the cell
  CELL_FIELD_DATA: 3,
  // to match VTK

  VERTEX: 4,
  // data defined at each graph vertex, but that does not specify the graph vertex
  VERTEX_FIELD_DATA: 4,
  // to match VTK

  EDGE: 5,
  // data defined at each graph edge, but that does not specify the graph edge
  EDGE_FIELD_DATA: 5,
  // to match VTK

  ROW: 6,
  // data specifying a table row
  ROW_DATA: 6 // to match VTK
};

const FieldAssociations = {
  FIELD_ASSOCIATION_POINTS: 0,
  FIELD_ASSOCIATION_CELLS: 1,
  FIELD_ASSOCIATION_NONE: 2,
  FIELD_ASSOCIATION_POINTS_THEN_CELLS: 3,
  FIELD_ASSOCIATION_VERTICES: 4,
  FIELD_ASSOCIATION_EDGES: 5,
  FIELD_ASSOCIATION_ROWS: 6,
  NUMBER_OF_ASSOCIATIONS: 7
};
var Constants$2 = {
  FieldDataTypes,
  FieldAssociations
};

// import vtkBoundingBox from '../BoundingBox';
// import * as vtkMath from '../../Core/Math';
//
// function getBounds(dataset) {
//   if (dataset.bounds) {
//     return dataset.bounds;
//   }
//   if (dataset.type && dataset[dataset.type]) {
//     const ds = dataset[dataset.type];
//     if (ds.bounds) {
//       return ds.bounds;
//     }
//     if (ds.Points && ds.Points.bounds) {
//       return ds.Points.bounds;
//     }

//     if (ds.Points && ds.Points.values) {
//       const array = ds.Points.values;
//       const bbox = [...vtkBoundingBox.INIT_BOUNDS];
//       const size = array.length;
//       const delta = ds.Points.numberOfComponents ? ds.Points.numberOfComponents : 3;
//       for (let idx = 0; idx < size; idx += delta) {
//         vtkBoundingBox.addPoint(bbox, array[idx * delta], array[(idx * delta) + 1], array[(idx * delta) + 2]);
//       }
//       ds.Points.bounds = bbox;
//       return ds.Points.bounds;
//     }
//   }
//   return vtkMath.createUninitializedBounds();
// }

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

const DATASET_FIELDS = ['pointData', 'cellData', 'fieldData'];

// ----------------------------------------------------------------------------
// vtkDataSet methods
// ----------------------------------------------------------------------------

function vtkDataSet(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkDataSet');

  // Add dataset attributes
  DATASET_FIELDS.forEach(fieldName => {
    if (!model[fieldName]) {
      model[fieldName] = vtkDataSetAttributes$1.newInstance();
    } else {
      model[fieldName] = vtk(model[fieldName]);
    }
  });
  const superShallowCopy = publicAPI.shallowCopy;
  publicAPI.shallowCopy = function (other) {
    let debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    superShallowCopy(other, debug);
    DATASET_FIELDS.forEach(fieldName => {
      model[fieldName] = vtkDataSetAttributes$1.newInstance();
      model[fieldName].shallowCopy(other.getReferenceByName(fieldName));
    });
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$b = {
  // pointData: null,
  // cellData: null,
  // fieldData: null,
};

// ----------------------------------------------------------------------------

function extend$c(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$b, initialValues);

  // Object methods
  macro.obj(publicAPI, model);
  macro.setGet(publicAPI, model, DATASET_FIELDS);

  // Object specific methods
  vtkDataSet(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$c = macro.newInstance(extend$c, 'vtkDataSet');

// ----------------------------------------------------------------------------

var vtkDataSet$1 = {
  newInstance: newInstance$c,
  extend: extend$c,
  ...Constants$2
};

const StructuredType$1 = {
  UNCHANGED: 0,
  SINGLE_POINT: 1,
  X_LINE: 2,
  Y_LINE: 3,
  Z_LINE: 4,
  XY_PLANE: 5,
  YZ_PLANE: 6,
  XZ_PLANE: 7,
  XYZ_GRID: 8,
  EMPTY: 9
};
var Constants$1 = {
  StructuredType: StructuredType$1
};

const {
  StructuredType
} = Constants$1;
function getDataDescriptionFromExtent(inExt) {
  let dataDim = 0;
  for (let i = 0; i < 3; ++i) {
    if (inExt[i * 2] < inExt[i * 2 + 1]) {
      dataDim++;
    }
  }
  if (inExt[0] > inExt[1] || inExt[2] > inExt[3] || inExt[4] > inExt[5]) {
    return StructuredType.EMPTY;
  }
  if (dataDim === 3) {
    return StructuredType.XYZ_GRID;
  }
  if (dataDim === 2) {
    if (inExt[0] === inExt[1]) {
      return StructuredType.YZ_PLANE;
    }
    if (inExt[2] === inExt[3]) {
      return StructuredType.XZ_PLANE;
    }
    return StructuredType.XY_PLANE;
  }
  if (dataDim === 1) {
    if (inExt[0] < inExt[1]) {
      return StructuredType.X_LINE;
    }
    if (inExt[2] < inExt[3]) {
      return StructuredType.Y_LINE;
    }
    return StructuredType.Z_LINE;
  }
  return StructuredType.SINGLE_POINT;
}
var vtkStructuredData = {
  getDataDescriptionFromExtent,
  ...Constants$1
};

const {
  vtkErrorMacro: vtkErrorMacro$2
} = macro;

// ----------------------------------------------------------------------------
// vtkImageData methods
// ----------------------------------------------------------------------------

function vtkImageData(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkImageData');
  publicAPI.setExtent = function () {
    if (model.deleted) {
      vtkErrorMacro$2('instance deleted - cannot call any method');
      return false;
    }
    for (var _len = arguments.length, inExtent = new Array(_len), _key = 0; _key < _len; _key++) {
      inExtent[_key] = arguments[_key];
    }
    const extentArray = inExtent.length === 1 ? inExtent[0] : inExtent;
    if (extentArray.length !== 6) {
      return false;
    }
    const changeDetected = model.extent.some((item, index) => item !== extentArray[index]);
    if (changeDetected) {
      model.extent = extentArray.slice();
      model.dataDescription = vtkStructuredData.getDataDescriptionFromExtent(model.extent);
      publicAPI.modified();
    }
    return changeDetected;
  };
  publicAPI.setDimensions = function () {
    let i;
    let j;
    let k;
    if (model.deleted) {
      vtkErrorMacro$2('instance deleted - cannot call any method');
      return;
    }
    if (arguments.length === 1) {
      const array = arguments.length <= 0 ? undefined : arguments[0];
      i = array[0];
      j = array[1];
      k = array[2];
    } else if (arguments.length === 3) {
      i = arguments.length <= 0 ? undefined : arguments[0];
      j = arguments.length <= 1 ? undefined : arguments[1];
      k = arguments.length <= 2 ? undefined : arguments[2];
    } else {
      vtkErrorMacro$2('Bad dimension specification');
      return;
    }
    publicAPI.setExtent(0, i - 1, 0, j - 1, 0, k - 1);
  };
  publicAPI.getDimensions = () => [model.extent[1] - model.extent[0] + 1, model.extent[3] - model.extent[2] + 1, model.extent[5] - model.extent[4] + 1];
  publicAPI.getNumberOfCells = () => {
    const dims = publicAPI.getDimensions();
    let nCells = 1;
    for (let i = 0; i < 3; i++) {
      if (dims[i] === 0) {
        return 0;
      }
      if (dims[i] > 1) {
        nCells *= dims[i] - 1;
      }
    }
    return nCells;
  };
  publicAPI.getNumberOfPoints = () => {
    const dims = publicAPI.getDimensions();
    return dims[0] * dims[1] * dims[2];
  };
  publicAPI.getPoint = index => {
    const dims = publicAPI.getDimensions();
    if (dims[0] === 0 || dims[1] === 0 || dims[2] === 0) {
      vtkErrorMacro$2('Requesting a point from an empty image.');
      return null;
    }
    const ijk = new Float64Array(3);
    switch (model.dataDescription) {
      case StructuredType$1.EMPTY:
        return null;
      case StructuredType$1.SINGLE_POINT:
        break;
      case StructuredType$1.X_LINE:
        ijk[0] = index;
        break;
      case StructuredType$1.Y_LINE:
        ijk[1] = index;
        break;
      case StructuredType$1.Z_LINE:
        ijk[2] = index;
        break;
      case StructuredType$1.XY_PLANE:
        ijk[0] = index % dims[0];
        ijk[1] = index / dims[0];
        break;
      case StructuredType$1.YZ_PLANE:
        ijk[1] = index % dims[1];
        ijk[2] = index / dims[1];
        break;
      case StructuredType$1.XZ_PLANE:
        ijk[0] = index % dims[0];
        ijk[2] = index / dims[0];
        break;
      case StructuredType$1.XYZ_GRID:
        ijk[0] = index % dims[0];
        ijk[1] = index / dims[0] % dims[1];
        ijk[2] = index / (dims[0] * dims[1]);
        break;
      default:
        vtkErrorMacro$2('Invalid dataDescription');
        break;
    }
    const coords = [0, 0, 0];
    publicAPI.indexToWorld(ijk, coords);
    return coords;
  };

  // vtkCell *GetCell(vtkIdType cellId) VTK_OVERRIDE;
  // void GetCell(vtkIdType cellId, vtkGenericCell *cell) VTK_OVERRIDE;
  // void GetCellBounds(vtkIdType cellId, double bounds[6]) VTK_OVERRIDE;
  // virtual vtkIdType FindPoint(double x, double y, double z)
  // {
  //   return this->vtkDataSet::FindPoint(x, y, z);
  // }
  // vtkIdType FindPoint(double x[3]) VTK_OVERRIDE;
  // vtkIdType FindCell(
  //   double x[3], vtkCell *cell, vtkIdType cellId, double tol2,
  //   int& subId, double pcoords[3], double *weights) VTK_OVERRIDE;
  // vtkIdType FindCell(
  //   double x[3], vtkCell *cell, vtkGenericCell *gencell,
  //   vtkIdType cellId, double tol2, int& subId,
  //   double pcoords[3], double *weights) VTK_OVERRIDE;
  // vtkCell *FindAndGetCell(double x[3], vtkCell *cell, vtkIdType cellId,
  //                                 double tol2, int& subId, double pcoords[3],
  //                                 double *weights) VTK_OVERRIDE;
  // int GetCellType(vtkIdType cellId) VTK_OVERRIDE;
  // void GetCellPoints(vtkIdType cellId, vtkIdList *ptIds) VTK_OVERRIDE
  //   {vtkStructuredData::GetCellPoints(cellId,ptIds,this->DataDescription,
  //                                     this->GetDimensions());}
  // void GetPointCells(vtkIdType ptId, vtkIdList *cellIds) VTK_OVERRIDE
  //   {vtkStructuredData::GetPointCells(ptId,cellIds,this->GetDimensions());}
  // void ComputeBounds() VTK_OVERRIDE;
  // int GetMaxCellSize() VTK_OVERRIDE {return 8;}; //voxel is the largest

  publicAPI.getBounds = () => publicAPI.extentToBounds(publicAPI.getSpatialExtent());
  publicAPI.extentToBounds = ex => vtkBoundingBox.transformBounds(ex, model.indexToWorld);
  publicAPI.getSpatialExtent = () => vtkBoundingBox.inflate([...model.extent], 0.5);

  // Internal, shouldn't need to call this manually.
  publicAPI.computeTransforms = () => {
    fromTranslation(model.indexToWorld, model.origin);
    model.indexToWorld[0] = model.direction[0];
    model.indexToWorld[1] = model.direction[1];
    model.indexToWorld[2] = model.direction[2];
    model.indexToWorld[4] = model.direction[3];
    model.indexToWorld[5] = model.direction[4];
    model.indexToWorld[6] = model.direction[5];
    model.indexToWorld[8] = model.direction[6];
    model.indexToWorld[9] = model.direction[7];
    model.indexToWorld[10] = model.direction[8];
    scale$1(model.indexToWorld, model.indexToWorld, model.spacing);
    invert(model.worldToIndex, model.indexToWorld);
  };
  publicAPI.indexToWorld = function (ain) {
    let aout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    transformMat4(aout, ain, model.indexToWorld);
    return aout;
  };
  publicAPI.indexToWorldVec3 = publicAPI.indexToWorld;
  publicAPI.worldToIndex = function (ain) {
    let aout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    transformMat4(aout, ain, model.worldToIndex);
    return aout;
  };
  publicAPI.worldToIndexVec3 = publicAPI.worldToIndex;
  publicAPI.indexToWorldBounds = function (bin) {
    let bout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    return vtkBoundingBox.transformBounds(bin, model.indexToWorld, bout);
  };
  publicAPI.worldToIndexBounds = function (bin) {
    let bout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    return vtkBoundingBox.transformBounds(bin, model.worldToIndex, bout);
  };

  // Make sure the transform is correct
  publicAPI.onModified(publicAPI.computeTransforms);
  publicAPI.computeTransforms();
  publicAPI.getCenter = () => vtkBoundingBox.getCenter(publicAPI.getBounds());
  publicAPI.computeHistogram = function (worldBounds) {
    let voxelFunc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    const bounds = [0, 0, 0, 0, 0, 0];
    publicAPI.worldToIndexBounds(worldBounds, bounds);
    const point1 = [0, 0, 0];
    const point2 = [0, 0, 0];
    vtkBoundingBox.computeCornerPoints(bounds, point1, point2);
    roundVector(point1, point1);
    roundVector(point2, point2);
    const dimensions = publicAPI.getDimensions();
    clampVector(point1, [0, 0, 0], [dimensions[0] - 1, dimensions[1] - 1, dimensions[2] - 1], point1);
    clampVector(point2, [0, 0, 0], [dimensions[0] - 1, dimensions[1] - 1, dimensions[2] - 1], point2);
    const yStride = dimensions[0];
    const zStride = dimensions[0] * dimensions[1];
    const pixels = publicAPI.getPointData().getScalars().getData();
    let maximum = -Infinity;
    let minimum = Infinity;
    let sumOfSquares = 0;
    let isum = 0;
    let inum = 0;
    for (let z = point1[2]; z <= point2[2]; z++) {
      for (let y = point1[1]; y <= point2[1]; y++) {
        let index = point1[0] + y * yStride + z * zStride;
        for (let x = point1[0]; x <= point2[0]; x++) {
          if (!voxelFunc || voxelFunc([x, y, z], bounds)) {
            const pixel = pixels[index];
            if (pixel > maximum) maximum = pixel;
            if (pixel < minimum) minimum = pixel;
            sumOfSquares += pixel * pixel;
            isum += pixel;
            inum += 1;
          }
          ++index;
        }
      }
    }
    const average = inum > 0 ? isum / inum : 0;
    const variance = inum ? Math.abs(sumOfSquares / inum - average * average) : 0;
    const sigma = Math.sqrt(variance);
    return {
      minimum,
      maximum,
      average,
      variance,
      sigma,
      count: inum
    };
  };

  // TODO: use the unimplemented `vtkDataSetAttributes` for scalar length, that is currently also a TODO (GetNumberOfComponents).
  // Scalar data could be tuples for color information?
  publicAPI.computeIncrements = function (extent) {
    let numberOfComponents = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
    const increments = [];
    let incr = numberOfComponents;

    // Calculate array increment offsets
    // similar to c++ vtkImageData::ComputeIncrements
    for (let idx = 0; idx < 3; ++idx) {
      increments[idx] = incr;
      incr *= extent[idx * 2 + 1] - extent[idx * 2] + 1;
    }
    return increments;
  };

  /**
   * @param {Number[]} index the localized `[i,j,k]` pixel array position. Float values will be rounded.
   * @return {Number} the corresponding flattened index in the scalar array
   */
  publicAPI.computeOffsetIndex = _ref => {
    let [i, j, k] = _ref;
    const extent = publicAPI.getExtent();
    const numberOfComponents = publicAPI.getPointData().getScalars().getNumberOfComponents();
    const increments = publicAPI.computeIncrements(extent, numberOfComponents);
    // Use the array increments to find the pixel index
    // similar to c++ vtkImageData::GetArrayPointer
    // Math.floor to catch "practically 0" e^-15 scenarios.
    return Math.floor((Math.round(i) - extent[0]) * increments[0] + (Math.round(j) - extent[2]) * increments[1] + (Math.round(k) - extent[4]) * increments[2]);
  };

  /**
   * @param {Number[]} xyz the [x,y,z] Array in world coordinates
   * @return {Number|NaN} the corresponding pixel's index in the scalar array
   */
  publicAPI.getOffsetIndexFromWorld = xyz => {
    const extent = publicAPI.getExtent();
    const index = publicAPI.worldToIndex(xyz);

    // Confirm indexed i,j,k coords are within the bounds of the volume
    for (let idx = 0; idx < 3; ++idx) {
      if (index[idx] < extent[idx * 2] || index[idx] > extent[idx * 2 + 1]) {
        vtkErrorMacro$2(`GetScalarPointer: Pixel ${index} is not in memory. Current extent = ${extent}`);
        return NaN;
      }
    }

    // Assumed the index here is within 0 <-> scalarData.length, but doesn't hurt to check upstream
    return publicAPI.computeOffsetIndex(index);
  };
  /**
   * @param {Number[]} xyz the [x,y,z] Array in world coordinates
   * @param {Number?} comp the scalar component index for multi-component scalars
   * @return {Number|NaN} the corresponding pixel's scalar value
   */
  publicAPI.getScalarValueFromWorld = function (xyz) {
    let comp = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    const numberOfComponents = publicAPI.getPointData().getScalars().getNumberOfComponents();
    if (comp < 0 || comp >= numberOfComponents) {
      vtkErrorMacro$2(`GetScalarPointer: Scalar Component ${comp} is not within bounds. Current Scalar numberOfComponents: ${numberOfComponents}`);
      return NaN;
    }
    const offsetIndex = publicAPI.getOffsetIndexFromWorld(xyz);
    if (Number.isNaN(offsetIndex)) {
      // VTK Error Macro will have been tripped already, no need to do it again,
      return offsetIndex;
    }
    return publicAPI.getPointData().getScalars().getComponent(offsetIndex, comp);
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$a = {
  direction: null,
  // a mat3
  indexToWorld: null,
  // a mat4
  worldToIndex: null,
  // a mat4
  spacing: [1.0, 1.0, 1.0],
  origin: [0.0, 0.0, 0.0],
  extent: [0, -1, 0, -1, 0, -1],
  dataDescription: StructuredType$1.EMPTY
};

// ----------------------------------------------------------------------------

function extend$b(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$a, initialValues);

  // Inheritance
  vtkDataSet$1.extend(publicAPI, model, initialValues);
  if (!model.direction) {
    model.direction = identity(new Float64Array(9));
  } else if (Array.isArray(model.direction)) {
    model.direction = new Float64Array(model.direction.slice(0, 9));
  }
  model.indexToWorld = new Float64Array(16);
  model.worldToIndex = new Float64Array(16);

  // Set/Get methods
  macro.get(publicAPI, model, ['indexToWorld', 'worldToIndex']);
  macro.setGetArray(publicAPI, model, ['origin', 'spacing'], 3);
  macro.setGetArray(publicAPI, model, ['direction'], 9);
  macro.getArray(publicAPI, model, ['extent'], 6);

  // Object specific methods
  vtkImageData(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$b = macro.newInstance(extend$b, 'vtkImageData');

// ----------------------------------------------------------------------------

var vtkImageData$1 = {
  newInstance: newInstance$b,
  extend: extend$b
};

var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["FATAL"] = 4] = "FATAL";
  return LogLevel2;
})(LogLevel || {});
class Logger {
  currentLevel = 1;
  isProduction = true;
  logs = [];
  maxLogHistory = 1e3;
  /**
   * Set the minimum log level
   */
  setLevel(level) {
    this.currentLevel = level;
  }
  /**
   * Get current log level
   */
  getLevel() {
    return this.currentLevel;
  }
  /**
   * Debug level logging - development only
   */
  debug(message, context) {
    if (this.shouldLog(
      0
      /* DEBUG */
    )) {
      this.log(0, message, context);
    }
  }
  /**
   * Info level logging - general information
   */
  info(message, context) {
    if (this.shouldLog(
      1
      /* INFO */
    )) {
      this.log(1, message, context);
    }
  }
  /**
   * Warning level logging - potential issues
   */
  warn(message, context, error) {
    if (this.shouldLog(
      2
      /* WARN */
    )) {
      this.log(2, message, context, error);
    }
  }
  /**
   * Error level logging - recoverable errors
   */
  error(message, context, error) {
    if (this.shouldLog(
      3
      /* ERROR */
    )) {
      this.log(3, message, context, error);
    }
  }
  /**
   * Fatal level logging - critical system errors
   */
  fatal(message, context, error) {
    if (this.shouldLog(
      4
      /* FATAL */
    )) {
      this.log(4, message, context, error);
    }
  }
  /**
   * Medical operation logging with structured context
   */
  medical(message, context) {
    this.info(`[MEDICAL] ${message}`, context);
  }
  /**
   * Performance logging for monitoring
   */
  performance(message, duration, context) {
    this.info(`[PERF] ${message} (${duration.toFixed(2)}ms)`, {
      ...context,
      metadata: { ...context?.metadata, duration }
    });
  }
  /**
   * Security-related logging
   */
  security(message, context, error) {
    this.warn(`[SECURITY] ${message}`, context, error);
  }
  /**
   * User interaction logging
   */
  interaction(message, context) {
    this.debug(`[UI] ${message}`, context);
  }
  /**
   * Core logging method
   */
  log(level, message, context, error) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      message,
      context,
      error
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogHistory) {
      this.logs.shift();
    }
    this.outputToConsole(entry);
    if (this.isProduction && level >= 3) {
      this.sendToMonitoring(entry);
    }
  }
  /**
   * Check if message should be logged based on level
   */
  shouldLog(level) {
    return level >= this.currentLevel;
  }
  /**
   * Format and output to console
   */
  outputToConsole(entry) {
    const levelName = LogLevel[entry.level];
    const emoji = this.getLevelEmoji(entry.level);
    const timestamp = this.isProduction ? entry.timestamp : entry.timestamp.split("T")[1].slice(0, 8);
    let formattedMessage = `${emoji} [${timestamp}] ${levelName}: ${entry.message}`;
    if (entry.context?.component) {
      formattedMessage += ` (${entry.context.component})`;
    }
    const consoleMethod = this.getConsoleMethod(entry.level);
    if (entry.error) {
      consoleMethod(formattedMessage, entry.context, entry.error);
    } else if (entry.context) {
      consoleMethod(formattedMessage, entry.context);
    } else {
      consoleMethod(formattedMessage);
    }
  }
  /**
   * Get emoji for log level
   */
  getLevelEmoji(level) {
    switch (level) {
      case 0:
        return "🔍";
      case 1:
        return "📄";
      case 2:
        return "⚠️";
      case 3:
        return "❌";
      case 4:
        return "🚨";
      default:
        return "📝";
    }
  }
  /**
   * Get appropriate console method for level
   */
  getConsoleMethod(level) {
    switch (level) {
      // eslint-disable-next-line no-console
      case 0:
        return console.debug;
      // eslint-disable-next-line no-console
      case 1:
        return console.info;
      case 2:
        return console.warn;
      case 3:
      case 4:
        return console.error;
      default:
        return console.log;
    }
  }
  /**
   * Send high-priority logs to monitoring service
   */
  sendToMonitoring(entry) {
    try {
      if (entry.level >= 4) {
        console.error("🚨 CRITICAL ERROR - IMMEDIATE ATTENTION REQUIRED:", {
          message: entry.message,
          context: entry.context,
          error: entry.error,
          timestamp: entry.timestamp
        });
      }
    } catch (error) {
      console.error("Failed to send log to monitoring service:", error);
    }
  }
  /**
   * Get recent log history for debugging
   */
  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }
  /**
   * Clear log history
   */
  clearLogs() {
    this.logs = [];
  }
  /**
   * Export logs for debugging or support
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}
const logger = new Logger();
{
  logger.setLevel(
    1
    /* INFO */
  );
}
const log = {
  debug: (message, context) => logger.debug(message, context),
  info: (message, context) => logger.info(message, context),
  warn: (message, context, error) => logger.warn(message, context, error),
  error: (message, context, error) => logger.error(message, context, error),
  fatal: (message, context, error) => logger.fatal(message, context, error),
  medical: (message, context) => logger.medical(message, context),
  performance: (message, duration, context) => logger.performance(message, duration, context),
  security: (message, context, error) => logger.security(message, context, error),
  interaction: (message, context) => logger.interaction(message, context)
};

class ICRPolySeg {
  initialized = false;
  constructor() {
    log.info("Canvas-based polygon segmentation initialized", {
      component: "ICRPolySeg"
    });
  }
  static getInstance() {
    return new ICRPolySeg();
  }
  async init() {
    this.initialized = true;
    return Promise.resolve();
  }
  /**
   * Process image data for polygon segmentation using canvas-based algorithms
   */
  async process(imageData, width, height, options = {}) {
    if (!this.initialized) {
      log.warn("ICRPolySeg not initialized, call init() first", {
        component: "ICRPolySeg"
      });
      return null;
    }
    const {
      threshold = 128,
      minArea = 100,
      smoothing = true,
      tolerance = 2
    } = options;
    try {
      const pixels = this.normalizeImageData(imageData, width, height);
      const binaryImage = this.applyThreshold(pixels, width, height, threshold);
      const rawContours = this.findContours(binaryImage, width, height);
      const filteredContours = rawContours.filter(
        (contour) => this.calculatePolygonArea(contour) >= minArea
      );
      const finalContours = smoothing ? filteredContours.map((contour) => this.smoothContour(contour, tolerance)) : filteredContours;
      const areas = finalContours.map((contour) => this.calculatePolygonArea(contour));
      const boundingBoxes = finalContours.map((contour) => this.calculateBoundingBox(contour));
      log.info(`Found ${finalContours.length} polygon segments`, {
        component: "ICRPolySeg",
        metadata: { segmentCount: finalContours.length }
      });
      return {
        contours: finalContours,
        areas,
        boundingBoxes
      };
    } catch (error) {
      log.error("Polygon segmentation failed", {
        component: "ICRPolySeg"
      }, error);
      return null;
    }
  }
  /**
   * Normalize different image data formats to Uint8Array
   */
  normalizeImageData(imageData, width, height) {
    if (imageData instanceof ImageData) {
      const grayscale = new Uint8Array(width * height);
      for (let i = 0; i < grayscale.length; i++) {
        const rgbaIndex = i * 4;
        grayscale[i] = Math.round(
          imageData.data[rgbaIndex] * 0.299 + imageData.data[rgbaIndex + 1] * 0.587 + imageData.data[rgbaIndex + 2] * 0.114
        );
      }
      return grayscale;
    }
    if (imageData instanceof Uint16Array) {
      const normalized = new Uint8Array(imageData.length);
      const max = Math.max(...imageData);
      const scale = max > 0 ? 255 / max : 0;
      for (let i = 0; i < imageData.length; i++) {
        normalized[i] = Math.round(imageData[i] * scale);
      }
      return normalized;
    }
    return imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);
  }
  /**
   * Apply threshold to create binary image
   */
  applyThreshold(pixels, _width, _height, threshold) {
    const binary = new Uint8Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
      binary[i] = pixels[i] > threshold ? 255 : 0;
    }
    return binary;
  }
  /**
   * Find contours using Moore's boundary tracing algorithm
   */
  findContours(binaryImage, width, height) {
    const contours = [];
    const visited = /* @__PURE__ */ new Set();
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
      [1, 0],
      [1, -1],
      [0, -1]
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (binaryImage[index] === 255 && !visited.has(index)) {
          const contour = this.traceContour(
            binaryImage,
            width,
            height,
            x,
            y,
            directions,
            visited
          );
          if (contour.length > 3) {
            contours.push(contour);
          }
        }
      }
    }
    return contours;
  }
  /**
   * Trace contour starting from given point using Moore's algorithm
   */
  traceContour(binaryImage, width, height, startX, startY, directions, visited) {
    const contour = [];
    let x = startX, y = startY;
    let direction = 0;
    do {
      const index = y * width + x;
      visited.add(index);
      contour.push({ x, y });
      let found = false;
      for (let i = 0; i < 8; i++) {
        const dir = (direction + i) % 8;
        const [dx, dy] = directions[dir];
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = ny * width + nx;
          if (binaryImage[nIndex] === 255) {
            x = nx;
            y = ny;
            direction = (dir + 6) % 8;
            found = true;
            break;
          }
        }
      }
      if (!found) break;
    } while (!(x === startX && y === startY) && contour.length < width * height);
    return contour;
  }
  /**
   * Smooth contour using Douglas-Peucker algorithm
   */
  smoothContour(contour, tolerance) {
    if (contour.length <= 2) return contour;
    return this.douglasPeucker(contour, tolerance);
  }
  /**
   * Douglas-Peucker line simplification algorithm
   */
  douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points;
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.pointToLineDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    }
    return [start, end];
  }
  /**
   * Calculate distance from point to line
   */
  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }
    const param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  /**
   * Calculate polygon area using shoelace formula
   */
  calculatePolygonArea(contour) {
    if (contour.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    return Math.abs(area) / 2;
  }
  /**
   * Calculate bounding box for contour
   */
  calculateBoundingBox(contour) {
    if (contour.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    let minX = contour[0].x;
    let maxX = contour[0].x;
    let minY = contour[0].y;
    let maxY = contour[0].y;
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
module.exports = ICRPolySeg;

function areNumbersEqualWithTolerance(num1, num2, tolerance) {
    return Math.abs(num1 - num2) <= tolerance;
}
function areArraysEqual(arr1, arr2, tolerance = 1e-5) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (!areNumbersEqualWithTolerance(arr1[i], arr2[i], tolerance)) {
            return false;
        }
    }
    return true;
}
function isNumberType(value) {
    return typeof value === 'number';
}
function isNumberArrayLike(value) {
    return 'length' in value && typeof value[0] === 'number';
}
function isEqual(v1, v2, tolerance = 1e-5) {
    if (typeof v1 !== typeof v2 || v1 === null || v2 === null) {
        return false;
    }
    if (isNumberType(v1) && isNumberType(v2)) {
        return areNumbersEqualWithTolerance(v1, v2, tolerance);
    }
    if (isNumberArrayLike(v1) && isNumberArrayLike(v2)) {
        return areArraysEqual(v1, v2, tolerance);
    }
    return false;
}

const {
  vtkErrorMacro: vtkErrorMacro$1
} = macro;
const INVALID_BOUNDS = [1, -1, 1, -1, 1, -1];

// ----------------------------------------------------------------------------
// vtkPoints methods
// ----------------------------------------------------------------------------

function vtkPoints(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPoints');

  // Forwarding methods
  publicAPI.getNumberOfPoints = publicAPI.getNumberOfTuples;
  publicAPI.setNumberOfPoints = function (nbPoints) {
    let dimension = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;
    if (publicAPI.getNumberOfPoints() !== nbPoints) {
      model.size = nbPoints * dimension;
      model.values = macro.newTypedArray(model.dataType, model.size);
      publicAPI.setNumberOfComponents(dimension);
      publicAPI.modified();
    }
  };
  publicAPI.setPoint = function (idx) {
    for (var _len = arguments.length, xyz = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      xyz[_key - 1] = arguments[_key];
    }
    publicAPI.setTuple(idx, xyz);
  };
  publicAPI.getPoint = publicAPI.getTuple;
  publicAPI.findPoint = publicAPI.findTuple;
  publicAPI.insertNextPoint = (x, y, z) => publicAPI.insertNextTuple([x, y, z]);
  publicAPI.getBounds = () => {
    if (publicAPI.getNumberOfComponents() === 3) {
      const xRange = publicAPI.getRange(0);
      model.bounds[0] = xRange[0];
      model.bounds[1] = xRange[1];
      const yRange = publicAPI.getRange(1);
      model.bounds[2] = yRange[0];
      model.bounds[3] = yRange[1];
      const zRange = publicAPI.getRange(2);
      model.bounds[4] = zRange[0];
      model.bounds[5] = zRange[1];
      return model.bounds;
    }
    if (publicAPI.getNumberOfComponents() !== 2) {
      vtkErrorMacro$1(`getBounds called on an array with components of
        ${publicAPI.getNumberOfComponents()}`);
      return INVALID_BOUNDS;
    }
    const xRange = publicAPI.getRange(0);
    model.bounds[0] = xRange[0];
    model.bounds[1] = xRange[1];
    const yRange = publicAPI.getRange(1);
    model.bounds[2] = yRange[0];
    model.bounds[3] = yRange[1];
    model.bounds[4] = 0;
    model.bounds[5] = 0;
    return model.bounds;
  };

  // Trigger the computation of bounds
  publicAPI.computeBounds = publicAPI.getBounds;

  // Initialize
  publicAPI.setNumberOfComponents(model.numberOfComponents < 2 ? 3 : model.numberOfComponents);
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$9 = {
  empty: true,
  numberOfComponents: 3,
  dataType: VtkDataTypes.FLOAT,
  bounds: [1, -1, 1, -1, 1, -1]
};

// ----------------------------------------------------------------------------

function extend$a(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$9, initialValues);
  vtkDataArray$1.extend(publicAPI, model, initialValues);
  vtkPoints(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$a = macro.newInstance(extend$a, 'vtkPoints');

// ----------------------------------------------------------------------------

var vtkPoints$1 = {
  newInstance: newInstance$a,
  extend: extend$a
};

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

function extractCellSizes(cellArray) {
  let currentIdx = 0;
  return cellArray.filter((value, index) => {
    if (index === currentIdx) {
      currentIdx += value + 1;
      return true;
    }
    return false;
  });
}
function getNumberOfCells(cellArray) {
  let cellId = 0;
  for (let cellArrayIndex = 0; cellArrayIndex < cellArray.length;) {
    cellArrayIndex += cellArray[cellArrayIndex] + 1;
    cellId++;
  }
  return cellId;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$3 = {
  extractCellSizes,
  getNumberOfCells
};

// ----------------------------------------------------------------------------
// vtkCellArray methods
// ----------------------------------------------------------------------------

function vtkCellArray(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCellArray');
  const superClass = {
    ...publicAPI
  };
  publicAPI.getNumberOfCells = recompute => {
    if (model.numberOfCells !== undefined && !recompute) {
      return model.numberOfCells;
    }
    if (model.cellSizes) {
      model.numberOfCells = model.cellSizes.length;
    } else {
      model.numberOfCells = getNumberOfCells(publicAPI.getData());
    }
    return model.numberOfCells;
  };
  publicAPI.getCellSizes = recompute => {
    if (model.cellSizes !== undefined && !recompute) {
      return model.cellSizes;
    }
    model.cellSizes = extractCellSizes(publicAPI.getData());
    return model.cellSizes;
  };

  /**
   * When `resize()` is being used, you then MUST use `insertNextCell()`.
   */
  publicAPI.resize = requestedNumTuples => {
    const oldNumTuples = publicAPI.getNumberOfTuples();
    superClass.resize(requestedNumTuples);
    const newNumTuples = publicAPI.getNumberOfTuples();
    if (newNumTuples < oldNumTuples) {
      if (newNumTuples === 0) {
        model.numberOfCells = 0;
        model.cellSizes = [];
      } else {
        // We do not know how many cells are left.
        // Set to undefined to ensure insertNextCell works correctly.
        model.numberOfCells = undefined;
        model.cellSizes = undefined;
      }
    }
  };
  publicAPI.setData = typedArray => {
    superClass.setData(typedArray, 1);
    model.numberOfCells = undefined;
    model.cellSizes = undefined;
  };
  publicAPI.getCell = loc => {
    let cellLoc = loc;
    const numberOfPoints = model.values[cellLoc++];
    return model.values.subarray(cellLoc, cellLoc + numberOfPoints);
  };
  publicAPI.insertNextCell = cellPointIds => {
    const cellId = publicAPI.getNumberOfCells();
    publicAPI.insertNextTuples([cellPointIds.length, ...cellPointIds]);
    // By computing the number of cells earlier, we made sure that numberOfCells is defined
    ++model.numberOfCells;
    if (model.cellSizes != null) {
      model.cellSizes.push(cellPointIds.length);
    }
    return cellId;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

function defaultValues(initialValues) {
  return {
    empty: true,
    numberOfComponents: 1,
    dataType: VtkDataTypes.UNSIGNED_INT,
    ...initialValues
  };
}

// ----------------------------------------------------------------------------

function extend$9(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  vtkDataArray$1.extend(publicAPI, model, defaultValues(initialValues));
  vtkCellArray(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$9 = macro.newInstance(extend$9, 'vtkCellArray');

// ----------------------------------------------------------------------------

var vtkCellArray$1 = {
  newInstance: newInstance$9,
  extend: extend$9,
  ...STATIC$3
};

// ----------------------------------------------------------------------------
// vtkCell methods
// ----------------------------------------------------------------------------

function vtkCell(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCell');
  publicAPI.initialize = function (points) {
    let pointIdsList = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!pointIdsList) {
      model.points = points;
      model.pointsIds = new Array(points.getNumberOfPoints());
      for (let i = points.getNumberOfPoints() - 1; i >= 0; --i) {
        model.pointsIds[i] = i;
      }
    } else {
      model.pointsIds = pointIdsList;
      let triangleData = model.points.getData();
      if (triangleData.length !== 3 * model.pointsIds.length) {
        triangleData = macro.newTypedArray(points.getDataType(), 3 * model.pointsIds.length);
      }
      const pointsData = points.getData();
      model.pointsIds.forEach((pointId, index) => {
        // const start = 3 * pointId;
        // pointsData.set(p.subarray(start, start + 3), 3 * index);
        let pointOffset = 3 * pointId;
        let trianglePointOffset = 3 * index;
        triangleData[trianglePointOffset] = pointsData[pointOffset];
        triangleData[++trianglePointOffset] = pointsData[++pointOffset];
        triangleData[++trianglePointOffset] = pointsData[++pointOffset];
      });
      model.points.setData(triangleData);
    }
  };
  publicAPI.getBounds = () => {
    const nbPoints = model.points.getNumberOfPoints();
    const x = [];
    if (nbPoints) {
      model.points.getPoint(0, x);
      model.bounds[0] = x[0];
      model.bounds[1] = x[0];
      model.bounds[2] = x[1];
      model.bounds[3] = x[1];
      model.bounds[4] = x[2];
      model.bounds[5] = x[2];
      for (let i = 1; i < nbPoints; i++) {
        model.points.getPoint(i, x);
        model.bounds[0] = x[0] < model.bounds[0] ? x[0] : model.bounds[0];
        model.bounds[1] = x[0] > model.bounds[1] ? x[0] : model.bounds[1];
        model.bounds[2] = x[1] < model.bounds[2] ? x[1] : model.bounds[2];
        model.bounds[3] = x[1] > model.bounds[3] ? x[1] : model.bounds[3];
        model.bounds[4] = x[2] < model.bounds[4] ? x[2] : model.bounds[4];
        model.bounds[5] = x[2] > model.bounds[5] ? x[2] : model.bounds[5];
      }
    } else {
      uninitializeBounds(model.bounds);
    }
    return model.bounds;
  };
  publicAPI.getLength2 = () => {
    publicAPI.getBounds();
    let length = 0.0;
    let diff = 0;
    for (let i = 0; i < 3; i++) {
      diff = model.bounds[2 * i + 1] - model.bounds[2 * i];
      length += diff * diff;
    }
    return length;
  };
  publicAPI.getParametricDistance = pcoords => {
    let pDist;
    let pDistMax = 0.0;
    for (let i = 0; i < 3; i++) {
      if (pcoords[i] < 0.0) {
        pDist = -pcoords[i];
      } else if (pcoords[i] > 1.0) {
        pDist = pcoords[i] - 1.0;
      } else {
        // inside the cell in the parametric direction
        pDist = 0.0;
      }
      if (pDist > pDistMax) {
        pDistMax = pDist;
      }
    }
    return pDistMax;
  };
  publicAPI.getNumberOfPoints = () => model.points.getNumberOfPoints();
  publicAPI.deepCopy = cell => {
    cell.initialize(model.points, model.pointsIds);
  };
  publicAPI.getCellDimension = () => {}; // virtual
  publicAPI.intersectWithLine = (p1, p2, tol, t, x, pcoords, subId) => {}; // virtual
  publicAPI.evaluatePosition = (x, closestPoint, subId, pcoords, dist2, weights) => {
    macro.vtkErrorMacro('vtkCell.evaluatePosition is not implemented.');
  }; // virtual
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$8 = {
  bounds: [-1, -1, -1, -1, -1, -1],
  pointsIds: []
};

// ----------------------------------------------------------------------------

function extend$8(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$8, initialValues);
  macro.obj(publicAPI, model);
  if (!model.points) {
    model.points = vtkPoints$1.newInstance();
  }
  macro.get(publicAPI, model, ['points', 'pointsIds']);
  vtkCell(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$8 = macro.newInstance(extend$8, 'vtkCell');

// ----------------------------------------------------------------------------

var vtkCell$1 = {
  newInstance: newInstance$8,
  extend: extend$8
};

function resize(model, sz) {
  let newSize = sz;
  if (sz >= model.array.length) {
    newSize += model.array.length;
  }
  while (newSize > model.array.length) model.array.push({
    ncells: 0,
    cells: null
  });
  model.array.length = newSize;
}

// ----------------------------------------------------------------------------
// vtkCellLinks methods
// ----------------------------------------------------------------------------

function vtkCellLinks(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCellLinks');

  /**
   * Build the link list array. All subclasses of vtkAbstractCellLinks
   * must support this method.
   */
  publicAPI.buildLinks = data => {
    const numPts = data.getPoints().getNumberOfPoints();
    const numCells = data.getNumberOfCells();

    // fill out lists with number of references to cells
    const linkLoc = new Uint32Array(numPts);

    // Use fast path if polydata
    if (data.isA('vtkPolyData')) {
      // traverse data to determine number of uses of each point
      for (let cellId = 0; cellId < numCells; ++cellId) {
        const {
          cellPointIds
        } = data.getCellPoints(cellId);
        cellPointIds.forEach(cellPointId => {
          publicAPI.incrementLinkCount(cellPointId);
        });
      }

      // now allocate storage for the links
      publicAPI.allocateLinks(numPts);
      model.maxId = numPts - 1;
      for (let cellId = 0; cellId < numCells; ++cellId) {
        const {
          cellPointIds
        } = data.getCellPoints(cellId);
        cellPointIds.forEach(cellPointId => {
          publicAPI.insertCellReference(cellPointId, linkLoc[cellPointId]++, cellId);
        });
      }
    } // any other type of dataset
    else {
      // traverse data to determine number of uses of each point
      for (let cellId = 0; cellId < numCells; cellId++) {
        // TODO: Currently not supported: const cell = data.getCell(cellId);
        const cell = vtkCell$1.newInstance();
        cell.getPointsIds().forEach(cellPointId => {
          publicAPI.incrementLinkCount(cellPointId);
        });
      }

      // now allocate storage for the links
      publicAPI.allocateLinks(numPts);
      model.maxId = numPts - 1;
      for (let cellId = 0; cellId < numCells; ++cellId) {
        // TODO: Currently not supported: const cell = data.getCell(cellId);
        const cell = vtkCell$1.newInstance();
        cell.getPointsIds().forEach(cellPointId => {
          publicAPI.insertCellReference(cellPointId, linkLoc[cellPointId]++, cellId);
        });
      }
    } // end else
  };

  /**
   * Build the link list array with a provided connectivity array.
   */
  // publicAPI.buildLinks = (data, connectivity) => {};

  /**
   * Allocate the specified number of links (i.e., number of points) that
   * will be built.
   */
  publicAPI.allocate = function (numLinks) {
    let ext = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
    model.array = Array(numLinks).fill().map(() => ({
      ncells: 0,
      cells: null
    }));
    model.extend = ext;
    model.maxId = -1;
  };
  publicAPI.initialize = () => {
    model.array = null;
  };

  /**
   * Get a link structure given a point id.
   */
  publicAPI.getLink = ptId => model.array[ptId];

  /**
   * Get the number of cells using the point specified by ptId.
   */
  publicAPI.getNcells = ptId => model.array[ptId].ncells;

  /**
   * Return a list of cell ids using the point.
   */
  publicAPI.getCells = ptId => model.array[ptId].cells;

  /**
   * Insert a new point into the cell-links data structure. The size parameter
   * is the initial size of the list.
   */
  publicAPI.insertNextPoint = numLinks => {
    model.array.push({
      ncells: numLinks,
      cells: Array(numLinks)
    });
    ++model.maxId;
  };

  /**
   * Insert a cell id into the list of cells (at the end) using the cell id
   * provided. (Make sure to extend the link list (if necessary) using the
   * method resizeCellList().)
   */
  publicAPI.insertNextCellReference = (ptId, cellId) => {
    model.array[ptId].cells[model.array[ptId].ncells++] = cellId;
  };

  /**
   * Delete point (and storage) by destroying links to using cells.
   */
  publicAPI.deletePoint = ptId => {
    model.array[ptId].ncells = 0;
    model.array[ptId].cells = null;
  };

  /**
   * Delete the reference to the cell (cellId) from the point (ptId). This
   * removes the reference to the cellId from the cell list, but does not
   * resize the list (recover memory with resizeCellList(), if necessary).
   */
  publicAPI.removeCellReference = (cellId, ptId) => {
    model.array[ptId].cells = model.array[ptId].cells.filter(cell => cell !== cellId);
    model.array[ptId].ncells = model.array[ptId].cells.length;
  };

  /**
   * Add the reference to the cell (cellId) from the point (ptId). This
   * adds a reference to the cellId from the cell list, but does not resize
   * the list (extend memory with resizeCellList(), if necessary).
   */
  publicAPI.addCellReference = (cellId, ptId) => {
    model.array[ptId].cells[model.array[ptId].ncells++] = cellId;
  };

  /**
   * Change the length of a point's link list (i.e., list of cells using a
   * point) by the size specified.
   */
  publicAPI.resizeCellList = (ptId, size) => {
    model.array[ptId].cells.length = size;
  };

  /**
   * Reclaim any unused memory.
   */
  publicAPI.squeeze = () => {
    resize(model, model.maxId + 1);
  };

  /**
   * Reset to a state of no entries without freeing the memory.
   */
  publicAPI.reset = () => {
    model.maxId = -1;
  };

  /**
   * Standard DeepCopy method.  Since this object contains no reference
   * to other objects, there is no ShallowCopy.
   */
  publicAPI.deepCopy = src => {
    model.array = [...src.array];
    model.extend = src.extend;
    model.maxId = src.maxId;
  };

  /**
   * Increment the count of the number of cells using the point.
   */
  publicAPI.incrementLinkCount = ptId => {
    ++model.array[ptId].ncells;
  };
  publicAPI.allocateLinks = n => {
    for (let i = 0; i < n; ++i) {
      model.array[i].cells = new Array(model.array[i].ncells);
    }
  };

  /**
   * Insert a cell id into the list of cells using the point.
   */
  publicAPI.insertCellReference = (ptId, pos, cellId) => {
    model.array[ptId].cells[pos] = cellId;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$7 = {
  array: null,
  // pointer to data
  maxId: 0,
  // maximum index inserted thus far
  extend: 0 // grow array by this point
};

// ----------------------------------------------------------------------------

function extend$7(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$7, initialValues);
  macro.obj(publicAPI, model);
  vtkCellLinks(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$7 = macro.newInstance(extend$7, 'vtkCellLinks');

// ----------------------------------------------------------------------------

var vtkCellLinks$1 = {
  newInstance: newInstance$7,
  extend: extend$7
};

const CellType = {
  // Linear cells
  VTK_EMPTY_CELL: 0,
  VTK_VERTEX: 1,
  VTK_POLY_VERTEX: 2,
  VTK_LINE: 3,
  VTK_POLY_LINE: 4,
  VTK_TRIANGLE: 5,
  VTK_TRIANGLE_STRIP: 6,
  VTK_POLYGON: 7,
  VTK_QUAD: 9,
  // Quadratic, isoparametric cells
  VTK_QUADRATIC_EDGE: 21,
  // Special class of cells formed by convex group of points
  VTK_CONVEX_POINT_SET: 41,
  // Polyhedron cell (consisting of polygonal faces)
  VTK_POLYHEDRON: 42};

// This list should contain the cell class names in
// the same order as in CellType.
const CellTypesStrings = ['vtkEmptyCell', 'vtkVertex', 'vtkPolyVertex', 'vtkLine', 'vtkPolyLine', 'vtkTriangle', 'vtkTriangleStrip', 'vtkPolygon', 'vtkPixel', 'vtkQuad', 'vtkTetra', 'vtkVoxel', 'vtkHexahedron', 'vtkWedge', 'vtkPyramid', 'vtkPentagonalPrism', 'vtkHexagonalPrism', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'vtkQuadraticEdge', 'vtkQuadraticTriangle', 'vtkQuadraticQuad', 'vtkQuadraticTetra', 'vtkQuadraticHexahedron', 'vtkQuadraticWedge', 'vtkQuadraticPyramid', 'vtkBiQuadraticQuad', 'vtkTriQuadraticHexahedron', 'vtkQuadraticLinearQuad', 'vtkQuadraticLinearWedge', 'vtkBiQuadraticQuadraticWedge', 'vtkBiQuadraticQuadraticHexahedron', 'vtkBiQuadraticTriangle', 'vtkCubicLine', 'vtkQuadraticPolygon', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'vtkConvexPointSet', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'vtkParametricCurve', 'vtkParametricSurface', 'vtkParametricTriSurface', 'vtkParametricQuadSurface', 'vtkParametricTetraRegion', 'vtkParametricHexRegion', 'UnknownClass', 'UnknownClass', 'UnknownClass', 'vtkHigherOrderEdge', 'vtkHigherOrderTriangle', 'vtkHigherOrderQuad', 'vtkHigherOrderPolygon', 'vtkHigherOrderTetrahedron', 'vtkHigherOrderWedge', 'vtkHigherOrderPyramid', 'vtkHigherOrderHexahedron'];

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

/**
 * Given an int (as defined in vtkCellType.h) identifier for a class
 * return it's classname.
 */
function getClassNameFromTypeId(typeId) {
  return typeId < CellTypesStrings.length ? CellTypesStrings[typeId] : 'UnknownClass';
}

/**
 * Given a data object classname, return it's int identified (as
 * defined in vtkCellType.h)
 */
function getTypeIdFromClassName(cellTypeString) {
  return CellTypesStrings.findIndex(cellTypeString);
}

/**
 * This convenience method is a fast check to determine if a cell type
 * represents a linear or nonlinear cell.  This is generally much more
 * efficient than getting the appropriate vtkCell and checking its IsLinear
 * method.
 */
function isLinear(type) {
  return type < CellType.VTK_QUADRATIC_EDGE || type === CellType.VTK_CONVEX_POINT_SET || type === CellType.VTK_POLYHEDRON;
}
function hasSubCells(cellType) {
  return cellType === CellType.VTK_TRIANGLE_STRIP || cellType === CellType.VTK_POLY_LINE || cellType === CellType.VTK_POLY_VERTEX;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$2 = {
  getClassNameFromTypeId,
  getTypeIdFromClassName,
  isLinear,
  hasSubCells
};

// ----------------------------------------------------------------------------
// vtkCellTypes methods
// ----------------------------------------------------------------------------

function vtkCellTypes(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCellTypes');

  /**
   * Allocate memory for this array. Delete old storage only if necessary.
   */
  publicAPI.allocate = function () {
    let sz = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 512;
    let ext = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
    model.size = sz > 0 ? sz : 1;
    model.extend = ext > 0 ? ext : 1;
    model.maxId = -1;
    model.typeArray = new Uint8Array(sz);
    model.locationArray = new Uint32Array(sz);
  };

  /**
   * Add a cell at specified id.
   */
  publicAPI.insertCell = (cellId, type, loc) => {
    model.typeArray[cellId] = type;
    model.locationArray[cellId] = loc;
    if (cellId > model.maxId) {
      model.maxId = cellId;
    }
  };

  /**
   * Add a cell to the object in the next available slot.
   */
  publicAPI.insertNextCell = (type, loc) => {
    publicAPI.insertCell(++model.maxId, type, loc);
    return model.maxId;
  };

  /**
   * Specify a group of cell types. This version is provided to maintain
   * backwards compatibility and does a copy of the cellLocations
   */
  publicAPI.setCellTypes = (ncells, cellTypes, cellLocations) => {
    model.size = ncells;
    model.typeArray = cellTypes;
    model.locationArray = cellLocations;
    model.maxId = ncells - 1;
  };

  /**
   * Return the location of the cell in the associated vtkCellArray.
   */
  publicAPI.getCellLocation = cellId => model.locationArray[cellId];

  /**
   * Delete cell by setting to nullptr cell type.
   */
  publicAPI.deleteCell = cellId => {
    model.typeArray[cellId] = CellType.VTK_EMPTY_CELL;
  };

  /**
   * Return the number of types in the list.
   */
  publicAPI.getNumberOfTypes = () => model.maxId + 1;

  /**
   * Return true if type specified is contained in list; false otherwise.
   */
  publicAPI.isType = type => {
    const numTypes = publicAPI.getNumberOfTypes();
    for (let i = 0; i < numTypes; ++i) {
      if (type === publicAPI.getCellType(i)) {
        return true;
      }
    }
    return false;
  };

  /**
   * Add the type specified to the end of the list. Range checking is performed.
   */
  publicAPI.insertNextType = type => publicAPI.insertNextCell(type, -1);

  /**
   * Return the type of cell.
   */
  publicAPI.getCellType = cellId => model.typeArray[cellId];

  /**
   * Reclaim any extra memory.
   */
  // TODO: publicAPI.squeeze = () =>  {};

  /**
   * Initialize object without releasing memory.
   */
  publicAPI.reset = () => {
    model.maxId = -1;
  };

  /**
   * Standard DeepCopy method.  Since this object contains no reference
   * to other objects, there is no ShallowCopy.
   */
  publicAPI.deepCopy = src => {
    publicAPI.allocate(src.getSize(), src.getExtend());
    model.typeArray.set(src.getTypeArray());
    model.locationArray.set(src.getLocationArray());
    model.maxId = src.getMaxId();
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$6 = {
  // typeArray: null, // pointer to types array
  // locationArray: null;   // pointer to array of offsets
  size: 0,
  // allocated size of data
  maxId: -1,
  // maximum index inserted thus far
  extend: 1000 // grow array by this point
};

// ----------------------------------------------------------------------------

function extend$6(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$6, initialValues);
  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['size', 'maxId', 'extend']);
  macro.getArray(publicAPI, model, ['typeArray', 'locationArray']);
  vtkCellTypes(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$6 = macro.newInstance(extend$6, 'vtkCellTypes');

// ----------------------------------------------------------------------------

var vtkCellTypes$1 = {
  newInstance: newInstance$6,
  extend: extend$6,
  ...STATIC$2
};

const IntersectionState$1 = {
  NO_INTERSECTION: 0,
  YES_INTERSECTION: 1,
  ON_LINE: 2
};
var Constants = {
  IntersectionState: IntersectionState$1
};

const {
  IntersectionState
} = Constants;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------
function distanceToLine(x, p1, p2) {
  let closestPoint = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  const outObj = {
    t: Number.MIN_VALUE,
    distance: 0
  };
  const p21 = [];
  let closest;
  // Determine appropriate vector
  p21[0] = p2[0] - p1[0];
  p21[1] = p2[1] - p1[1];
  p21[2] = p2[2] - p1[2];

  // Get parametric location
  const num = p21[0] * (x[0] - p1[0]) + p21[1] * (x[1] - p1[1]) + p21[2] * (x[2] - p1[2]);
  const denom = dot$1(p21, p21);

  // trying to avoid an expensive fabs
  let tolerance = 1e-5 * num;
  if (denom !== 0.0) {
    outObj.t = num / denom;
  }
  if (tolerance < 0.0) {
    tolerance = -tolerance;
  }
  if (-tolerance < denom && denom < tolerance) {
    closest = p1;
  } else if (denom <= 0.0 || outObj.t < 0.0) {
    // If parametric coordinate is within 0<=p<=1, then the point is closest to
    // the line.  Otherwise, it's closest to a point at the end of the line.
    closest = p1;
  } else if (outObj.t > 1.0) {
    closest = p2;
  } else {
    closest = p21;
    p21[0] = p1[0] + outObj.t * p21[0];
    p21[1] = p1[1] + outObj.t * p21[1];
    p21[2] = p1[2] + outObj.t * p21[2];
  }
  if (closestPoint) {
    closestPoint[0] = closest[0];
    closestPoint[1] = closest[1];
    closestPoint[2] = closest[2];
  }
  outObj.distance = distance2BetweenPoints(closest, x);
  return outObj;
}
function intersection(a1, a2, b1, b2, u, v) {
  const a21 = [];
  const b21 = [];
  const b1a1 = [];
  u[0] = 0.0;
  v[0] = 0.0;

  // Determine line vectors.
  subtract(a2, a1, a21);
  subtract(b2, b1, b21);
  subtract(b1, a1, b1a1);

  // Compute the system (least squares) matrix.
  const A = [dot$1(a21, a21), -dot$1(a21, b21), -dot$1(a21, b21), dot$1(b21, b21)];

  // Compute the least squares system constant term.
  const c = [];
  c[0] = dot$1(a21, b1a1);
  c[1] = -dot$1(b21, b1a1);
  // Solve the system of equations
  if (solveLinearSystem(A, c, 2) === 0) {
    // The lines are colinear. Therefore, one of the four endpoints is the
    // point of closest approach
    let minDist = Number.MAX_VALUE;
    const p = [a1, a2, b1, b2];
    const l1 = [b1, b1, a1, a1];
    const l2 = [b2, b2, a2, a2];
    [v[0], v[0], u[0], u[0]];
    [u[0], u[0], v[0], v[0]];
    let obj;
    for (let i = 0; i < 4; i++) {
      obj = distanceToLine(p[i], l1[i], l2[i]);
      if (obj.distance < minDist) {
        minDist = obj.distance;
      }
    }
    return IntersectionState.ON_LINE;
  }
  u[0] = c[0];
  v[0] = c[1];

  // Check parametric coordinates for intersection.
  if (u[0] >= 0.0 && u[0] <= 1.0 && v[0] >= 0.0 && v[0] <= 1.0) {
    return IntersectionState.YES_INTERSECTION;
  }
  return IntersectionState.NO_INTERSECTION;
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC$1 = {
  distanceToLine,
  intersection
};

// ----------------------------------------------------------------------------
// vtkLine methods
// ----------------------------------------------------------------------------

function vtkLine(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLine');
  function isBetweenPoints(t) {
    return t >= 0.0 && t <= 1.0;
  }
  publicAPI.getCellDimension = () => 1;
  publicAPI.intersectWithLine = (p1, p2, tol, x, pcoords) => {
    const outObj = {
      intersect: 0,
      t: Number.MAX_VALUE,
      subId: 0,
      betweenPoints: null
    };
    pcoords[1] = 0.0;
    pcoords[2] = 0.0;
    const projXYZ = [];
    const a1 = [];
    const a2 = [];
    model.points.getPoint(0, a1);
    model.points.getPoint(1, a2);
    const u = [];
    const v = [];
    const intersect = intersection(p1, p2, a1, a2, u, v);
    outObj.t = u[0];
    outObj.betweenPoints = isBetweenPoints(outObj.t);
    pcoords[0] = v[0];
    if (intersect === IntersectionState.YES_INTERSECTION) {
      // make sure we are within tolerance
      for (let i = 0; i < 3; i++) {
        x[i] = a1[i] + pcoords[0] * (a2[i] - a1[i]);
        projXYZ[i] = p1[i] + outObj.t * (p2[i] - p1[i]);
      }
      if (distance2BetweenPoints(x, projXYZ) <= tol * tol) {
        outObj.intersect = 1;
        return outObj;
      }
    } else {
      let outDistance;
      // check to see if it lies within tolerance
      // one of the parametric coords must be outside 0-1
      if (outObj.t < 0.0) {
        outDistance = distanceToLine(p1, a1, a2, x);
        if (outDistance.distance <= tol * tol) {
          outObj.t = 0.0;
          outObj.intersect = 1;
          outObj.betweenPoints = true; // Intersection is near p1
          return outObj;
        }
        return outObj;
      }
      if (outObj.t > 1.0) {
        outDistance = distanceToLine(p2, a1, a2, x);
        if (outDistance.distance <= tol * tol) {
          outObj.t = 1.0;
          outObj.intersect = 1;
          outObj.betweenPoints = true; // Intersection is near p2
          return outObj;
        }
        return outObj;
      }
      if (pcoords[0] < 0.0) {
        pcoords[0] = 0.0;
        outDistance = distanceToLine(a1, p1, p2, x);
        outObj.t = outDistance.t;
        if (outDistance.distance <= tol * tol) {
          outObj.intersect = 1;
          return outObj;
        }
        return outObj;
      }
      if (pcoords[0] > 1.0) {
        pcoords[0] = 1.0;
        outDistance = distanceToLine(a2, p1, p2, x);
        outObj.t = outDistance.t;
        if (outDistance.distance <= tol * tol) {
          outObj.intersect = 1;
          return outObj;
        }
        return outObj;
      }
    }
    return outObj;
  };
  publicAPI.evaluateLocation = (pcoords, x, weights) => {
    const a1 = [];
    const a2 = [];
    model.points.getPoint(0, a1);
    model.points.getPoint(1, a2);
    for (let i = 0; i < 3; i++) {
      x[i] = a1[i] + pcoords[0] * (a2[i] - a1[i]);
    }
    weights[0] = 1.0 - pcoords[0];
    weights[1] = pcoords[0];
  };
  publicAPI.evaluateOrientation = (pcoords, q, weights) => {
    if (model.orientations) {
      slerp(q, model.orientations[0], model.orientations[1], pcoords[0]);
      weights[0] = 1.0 - pcoords[0];
      weights[1] = pcoords[0];
      return true;
    }
    return false;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$5 = {
  orientations: null // an array of two quat or null
};

// ----------------------------------------------------------------------------

function extend$5(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$5, initialValues);
  vtkCell$1.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['orientations']);
  vtkLine(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$5 = macro.newInstance(extend$5, 'vtkLine');

// ----------------------------------------------------------------------------

var vtkLine$1 = {
  newInstance: newInstance$5,
  extend: extend$5,
  ...STATIC$1,
  ...Constants
};

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkPointSet methods
// ----------------------------------------------------------------------------

function vtkPointSet(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPointSet');

  // Create empty points
  if (!model.points) {
    model.points = vtkPoints$1.newInstance();
  } else {
    model.points = vtk(model.points);
  }
  publicAPI.getNumberOfPoints = () => model.points.getNumberOfPoints();
  publicAPI.getBounds = () => model.points.getBounds();
  publicAPI.computeBounds = () => {
    publicAPI.getBounds();
  };
  const superShallowCopy = publicAPI.shallowCopy;
  publicAPI.shallowCopy = function (other) {
    let debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    superShallowCopy(other, debug);
    model.points = vtkPoints$1.newInstance();
    model.points.shallowCopy(other.getPoints());
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$4 = {
  // points: null,
};

// ----------------------------------------------------------------------------

function extend$4(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$4, initialValues);

  // Inheritance
  vtkDataSet$1.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['points']);

  // Object specific methods
  vtkPointSet(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$4 = macro.newInstance(extend$4, 'vtkPointSet');

// ----------------------------------------------------------------------------

var vtkPointSet$1 = {
  newInstance: newInstance$4,
  extend: extend$4
};

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

function computeNormalDirection(v1, v2, v3, n) {
  // order is important!!! maintain consistency with triangle vertex order
  const ax = v3[0] - v2[0];
  const ay = v3[1] - v2[1];
  const az = v3[2] - v2[2];
  const bx = v1[0] - v2[0];
  const by = v1[1] - v2[1];
  const bz = v1[2] - v2[2];
  n[0] = ay * bz - az * by;
  n[1] = az * bx - ax * bz;
  n[2] = ax * by - ay * bx;
}
function computeNormal(v1, v2, v3, n) {
  computeNormalDirection(v1, v2, v3, n);
  const length = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  if (length !== 0.0) {
    n[0] /= length;
    n[1] /= length;
    n[2] /= length;
  }
}
function intersectWithTriangle(p1, q1, r1, p2, q2, r2) {
  let tolerance = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : 1e-6;
  let coplanar = false;
  const pt1 = [];
  const pt2 = [];
  const surfaceId = [];
  const n1 = [];
  const n2 = [];

  // Compute supporting plane normals.
  computeNormal(p1, q1, r1, n1);
  computeNormal(p2, q2, r2, n2);
  const s1 = -dot$1(n1, p1);
  const s2 = -dot$1(n2, p2);

  // Compute signed distances of points p1, q1, r1 from supporting
  // plane of second triangle.
  const dist1 = [dot$1(n2, p1) + s2, dot$1(n2, q1) + s2, dot$1(n2, r1) + s2];

  // If signs of all points are the same, all the points lie on the
  // same side of the supporting plane, and we can exit early.
  if (dist1[0] * dist1[1] > tolerance && dist1[0] * dist1[2] > tolerance) {
    // vtkDebugMacro(<<"Same side supporting plane 1!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    };
  }
  // Do the same for p2, q2, r2 and supporting plane of first
  // triangle.
  const dist2 = [dot$1(n1, p2) + s1, dot$1(n1, q2) + s1, dot$1(n1, r2) + s1];

  // If signs of all points are the same, all the points lie on the
  // same side of the supporting plane, and we can exit early.
  if (dist2[0] * dist2[1] > tolerance && dist2[0] * dist2[2] > tolerance) {
    // vtkDebugMacro(<<"Same side supporting plane 2!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    };
  }
  // Check for coplanarity of the supporting planes.
  if (Math.abs(n1[0] - n2[0]) < 1e-9 && Math.abs(n1[1] - n2[1]) < 1e-9 && Math.abs(n1[2] - n2[2]) < 1e-9 && Math.abs(s1 - s2) < 1e-9) {
    coplanar = true;
    // vtkDebugMacro(<<"Coplanar!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    };
  }

  // There are more efficient ways to find the intersection line (if
  // it exists), but this is clear enough.
  const pts1 = [p1, q1, r1];
  const pts2 = [p2, q2, r2];

  // Find line of intersection (L = p + t*v) between two planes.
  const n1n2 = dot$1(n1, n2);
  const a = (s1 - s2 * n1n2) / (n1n2 * n1n2 - 1.0);
  const b = (s2 - s1 * n1n2) / (n1n2 * n1n2 - 1.0);
  const p = [a * n1[0] + b * n2[0], a * n1[1] + b * n2[1], a * n1[2] + b * n2[2]];
  const v = cross$1(n1, n2, []);
  normalize$3(v);
  let index1 = 0;
  let index2 = 0;
  const t1 = [];
  const t2 = [];
  let ts1 = 50;
  let ts2 = 50;
  for (let i = 0; i < 3; i++) {
    const id1 = i;
    const id2 = (i + 1) % 3;

    // Find t coordinate on line of intersection between two planes.
    const val1 = vtkPlane$1.intersectWithLine(pts1[id1], pts1[id2], p2, n2);
    if (val1.intersection && val1.t > 0 - tolerance && val1.t < 1 + tolerance) {
      if (val1.t < 1 + tolerance && val1.t > 1 - tolerance) {
        ts1 = index1;
      }
      t1[index1++] = dot$1(val1.x, v) - dot$1(p, v);
    }
    const val2 = vtkPlane$1.intersectWithLine(pts2[id1], pts2[id2], p1, n1);
    if (val2.intersection && val2.t > 0 - tolerance && val2.t < 1 + tolerance) {
      if (val2.t < 1 + tolerance && val2.t > 1 - tolerance) {
        ts2 = index2;
      }
      t2[index2++] = dot$1(val2.x, v) - dot$1(p, v);
    }
  }

  // If the value of the index is greater than 2, the intersecting point
  // actually is intersected by all three edges. In this case, set the two
  // edges to the two edges where the intersecting point is not the end point
  if (index1 > 2) {
    index1--;
    // swap
    const t12 = t1[2];
    t1[2] = t1[ts1];
    t1[ts1] = t12;
  }
  if (index2 > 2) {
    index2--;
    const t22 = t2[2];
    t2[2] = t2[ts2];
    t2[ts2] = t22;
  }
  // Check if only one edge or all edges intersect the supporting
  // planes intersection.
  if (index1 !== 2 || index2 !== 2) {
    // vtkDebugMacro(<<"Only one edge intersecting!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    };
  }

  // Check for NaNs
  if (Number.isNaN(t1[0]) || Number.isNaN(t1[1]) || Number.isNaN(t2[0]) || Number.isNaN(t2[1])) {
    // vtkWarningMacro(<<"NaNs!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    };
  }
  if (t1[0] > t1[1]) {
    // swap
    const t11 = t1[1];
    t1[1] = t1[0];
    t1[0] = t11;
  }
  if (t2[0] > t2[1]) {
    // swap
    const t21 = t2[1];
    t2[1] = t2[0];
    t2[0] = t21;
  }
  // Handle the different interval configuration cases.
  let tt1;
  let tt2;
  if (t1[1] < t2[0] || t2[1] < t1[0]) {
    // vtkDebugMacro(<<"No Overlap!");
    return {
      intersect: false,
      coplanar,
      pt1,
      pt2,
      surfaceId
    }; // No overlap
  }

  if (t1[0] < t2[0]) {
    if (t1[1] < t2[1]) {
      // First point on surface 2, second point on surface 1
      surfaceId[0] = 2;
      surfaceId[1] = 1;
      tt1 = t2[0];
      tt2 = t1[1];
    } else {
      // Both points belong to lines on surface 2
      surfaceId[0] = 2;
      surfaceId[1] = 2;
      tt1 = t2[0];
      tt2 = t2[1];
    }
  } // t1[0] >= t2[0]
  else if (t1[1] < t2[1]) {
    // Both points belong to lines on surface 1
    surfaceId[0] = 1;
    surfaceId[1] = 1;
    tt1 = t1[0];
    tt2 = t1[1];
  } else {
    // First point on surface 1, second point on surface 2
    surfaceId[0] = 1;
    surfaceId[1] = 2;
    tt1 = t1[0];
    tt2 = t2[1];
  }

  // Create actual intersection points.
  multiplyAccumulate(p, v, tt1, pt1);
  multiplyAccumulate(p, v, tt2, pt2);
  return {
    intersect: true,
    coplanar,
    pt1,
    pt2,
    surfaceId
  };
}

// ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------

const STATIC = {
  computeNormalDirection,
  computeNormal,
  intersectWithTriangle
};

// ----------------------------------------------------------------------------
// vtkTriangle methods
// ----------------------------------------------------------------------------

function vtkTriangle(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkTriangle');
  publicAPI.getCellDimension = () => 2;
  publicAPI.intersectWithLine = (p1, p2, tol, x, pcoords) => {
    const outObj = {
      subId: 0,
      t: Number.MAX_VALUE,
      intersect: 0,
      betweenPoints: false
    };
    pcoords[2] = 0.0;
    const closestPoint = [];
    const tol2 = tol * tol;

    // Get normal for triangle
    const pt1 = [];
    const pt2 = [];
    const pt3 = [];
    model.points.getPoint(0, pt1);
    model.points.getPoint(1, pt2);
    model.points.getPoint(2, pt3);
    const n = [];
    const weights = [];
    computeNormal(pt1, pt2, pt3, n);
    if (n[0] !== 0 || n[1] !== 0 || n[2] !== 0) {
      // Intersect plane of triangle with line
      const plane = vtkPlane$1.intersectWithLine(p1, p2, pt1, n);
      outObj.betweenPoints = plane.betweenPoints;
      outObj.t = plane.t;
      x[0] = plane.x[0];
      x[1] = plane.x[1];
      x[2] = plane.x[2];
      if (!plane.intersection) {
        pcoords[0] = 0.0;
        pcoords[1] = 0.0;
        outObj.intersect = 0;
        return outObj;
      }

      // Evaluate position
      const inside = publicAPI.evaluatePosition(x, closestPoint, pcoords, weights);
      if (inside.evaluation >= 0) {
        if (inside.dist2 <= tol2) {
          outObj.intersect = 1;
          return outObj;
        }
        outObj.intersect = inside.evaluation;
        return outObj;
      }
    }

    // Normals are null, so the triangle is degenerated and
    // we still need to check intersection between line and
    // the longest edge.
    const dist2Pt1Pt2 = distance2BetweenPoints(pt1, pt2);
    const dist2Pt2Pt3 = distance2BetweenPoints(pt2, pt3);
    const dist2Pt3Pt1 = distance2BetweenPoints(pt3, pt1);
    if (!model.line) {
      model.line = vtkLine$1.newInstance();
    }
    if (dist2Pt1Pt2 > dist2Pt2Pt3 && dist2Pt1Pt2 > dist2Pt3Pt1) {
      model.line.getPoints().setPoint(0, pt1);
      model.line.getPoints().setPoint(1, pt2);
    } else if (dist2Pt2Pt3 > dist2Pt3Pt1 && dist2Pt2Pt3 > dist2Pt1Pt2) {
      model.line.getPoints().setPoint(0, pt2);
      model.line.getPoints().setPoint(1, pt3);
    } else {
      model.line.getPoints().setPoint(0, pt3);
      model.line.getPoints().setPoint(1, pt1);
    }
    const intersectLine = model.line.intersectWithLine(p1, p2, tol, x, pcoords);
    outObj.betweenPoints = intersectLine.betweenPoints;
    outObj.t = intersectLine.t;
    if (intersectLine.intersect) {
      const pt3Pt1 = [];
      const pt3Pt2 = [];
      const pt3X = [];
      // Compute r and s manually, using dot and norm.
      for (let i = 0; i < 3; i++) {
        pt3Pt1[i] = pt1[i] - pt3[i];
        pt3Pt2[i] = pt2[i] - pt3[i];
        pt3X[i] = x[i] - pt3[i];
      }
      pcoords[0] = dot$1(pt3X, pt3Pt1) / dist2Pt3Pt1;
      pcoords[1] = dot$1(pt3X, pt3Pt2) / dist2Pt2Pt3;
      outObj.intersect = 1;
      return outObj;
    }
    pcoords[0] = 0.0;
    pcoords[1] = 0.0;
    outObj.intersect = 0;
    return outObj;
  };
  publicAPI.evaluatePosition = (x, closestPoint, pcoords, weights) => {
    // will return obj
    const outObj = {
      subId: 0,
      dist2: 0,
      evaluation: -1
    };
    let i;
    let j;
    const pt1 = [];
    const pt2 = [];
    const pt3 = [];
    const n = [];
    let fabsn;
    const rhs = [];
    const c1 = [];
    const c2 = [];
    let det = 0;
    let idx = 0;
    const indices = [];
    let dist2Point;
    let dist2Line1;
    let dist2Line2;
    let closest = [];
    const closestPoint1 = [];
    const closestPoint2 = [];
    const cp = [];
    outObj.subId = 0;
    pcoords[2] = 0.0;

    // Get normal for triangle, only the normal direction is needed, i.e. the
    // normal need not be normalized (unit length)
    //
    model.points.getPoint(1, pt1);
    model.points.getPoint(2, pt2);
    model.points.getPoint(0, pt3);
    computeNormalDirection(pt1, pt2, pt3, n);

    // Project point to plane
    vtkPlane$1.generalizedProjectPoint(x, pt1, n, cp);

    // Construct matrices.  Since we have over determined system, need to find
    // which 2 out of 3 equations to use to develop equations. (Any 2 should
    // work since we've projected point to plane.)
    let maxComponent = 0.0;
    for (i = 0; i < 3; i++) {
      // trying to avoid an expensive call to fabs()
      if (n[i] < 0) {
        fabsn = -n[i];
      } else {
        fabsn = n[i];
      }
      if (fabsn > maxComponent) {
        maxComponent = fabsn;
        idx = i;
      }
    }
    for (j = 0, i = 0; i < 3; i++) {
      if (i !== idx) {
        indices[j++] = i;
      }
    }
    for (i = 0; i < 2; i++) {
      rhs[i] = cp[indices[i]] - pt3[indices[i]];
      c1[i] = pt1[indices[i]] - pt3[indices[i]];
      c2[i] = pt2[indices[i]] - pt3[indices[i]];
    }
    det = determinant2x2(c1, c2);
    if (det === 0.0) {
      pcoords[0] = 0.0;
      pcoords[1] = 0.0;
      outObj.evaluation = -1;
      return outObj;
    }
    pcoords[0] = determinant2x2(rhs, c2) / det;
    pcoords[1] = determinant2x2(c1, rhs) / det;

    // Okay, now find closest point to element
    weights[0] = 1 - (pcoords[0] + pcoords[1]);
    weights[1] = pcoords[0];
    weights[2] = pcoords[1];
    if (weights[0] >= 0.0 && weights[0] <= 1.0 && weights[1] >= 0.0 && weights[1] <= 1.0 && weights[2] >= 0.0 && weights[2] <= 1.0) {
      // projection distance
      if (closestPoint) {
        outObj.dist2 = distance2BetweenPoints(cp, x);
        closestPoint[0] = cp[0];
        closestPoint[1] = cp[1];
        closestPoint[2] = cp[2];
      }
      outObj.evaluation = 1;
    } else {
      let t;
      if (closestPoint) {
        if (weights[1] < 0.0 && weights[2] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt3);
          dist2Line1 = vtkLine$1.distanceToLine(x, pt1, pt3, t, closestPoint1);
          dist2Line2 = vtkLine$1.distanceToLine(x, pt3, pt2, t, closestPoint2);
          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt3;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }
          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }
          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[2] < 0.0 && weights[0] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt1);
          dist2Line1 = vtkLine$1.distanceToLine(x, pt1, pt3, t, closestPoint1);
          dist2Line2 = vtkLine$1.distanceToLine(x, pt1, pt2, t, closestPoint2);
          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt1;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }
          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }
          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[1] < 0.0 && weights[0] < 0.0) {
          dist2Point = distance2BetweenPoints(x, pt2);
          dist2Line1 = vtkLine$1.distanceToLine(x, pt2, pt3, t, closestPoint1);
          dist2Line2 = vtkLine$1.distanceToLine(x, pt1, pt2, t, closestPoint2);
          if (dist2Point < dist2Line1) {
            outObj.dist2 = dist2Point;
            closest = pt2;
          } else {
            outObj.dist2 = dist2Line1;
            closest = closestPoint1;
          }
          if (dist2Line2 < outObj.dist2) {
            outObj.dist2 = dist2Line2;
            closest = closestPoint2;
          }
          for (i = 0; i < 3; i++) {
            closestPoint[i] = closest[i];
          }
        } else if (weights[0] < 0.0) {
          const lineDistance = vtkLine$1.distanceToLine(x, pt1, pt2, closestPoint);
          outObj.dist2 = lineDistance.distance;
        } else if (weights[1] < 0.0) {
          const lineDistance = vtkLine$1.distanceToLine(x, pt2, pt3, closestPoint);
          outObj.dist2 = lineDistance.distance;
        } else if (weights[2] < 0.0) {
          const lineDistance = vtkLine$1.distanceToLine(x, pt1, pt3, closestPoint);
          outObj.dist2 = lineDistance.distance;
        }
      }
      outObj.evaluation = 0;
    }
    return outObj;
  };
  publicAPI.evaluateLocation = (pcoords, x, weights) => {
    const p0 = [];
    const p1 = [];
    const p2 = [];
    model.points.getPoint(0, p0);
    model.points.getPoint(1, p1);
    model.points.getPoint(2, p2);
    const u3 = 1.0 - pcoords[0] - pcoords[1];
    for (let i = 0; i < 3; i++) {
      x[i] = p0[i] * u3 + p1[i] * pcoords[0] + p2[i] * pcoords[1];
    }
    weights[0] = u3;
    weights[1] = pcoords[0];
    weights[2] = pcoords[1];
  };
  publicAPI.getParametricDistance = pcoords => {
    let pDist;
    let pDistMax = 0.0;
    const pc = [];
    pc[0] = pcoords[0];
    pc[1] = pcoords[1];
    pc[2] = 1.0 - pcoords[0] - pcoords[1];
    for (let i = 0; i < 3; i++) {
      if (pc[i] < 0.0) {
        pDist = -pc[i];
      } else if (pc[i] > 1.0) {
        pDist = pc[i] - 1.0;
      } else {
        // inside the cell in the parametric direction
        pDist = 0.0;
      }
      if (pDist > pDistMax) {
        pDistMax = pDist;
      }
    }
    return pDistMax;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$3 = {};

// ----------------------------------------------------------------------------

function extend$3(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$3, initialValues);
  vtkCell$1.extend(publicAPI, model, initialValues);
  vtkTriangle(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$3 = macro.newInstance(extend$3, 'vtkTriangle');

// ----------------------------------------------------------------------------

var vtkTriangle$1 = {
  newInstance: newInstance$3,
  extend: extend$3,
  ...STATIC
};

const POLYDATA_FIELDS = ['verts', 'lines', 'polys', 'strips'];

const {
  vtkWarningMacro
} = macro;
const CELL_FACTORY = {
  [CellType.VTK_LINE]: vtkLine$1,
  [CellType.VTK_POLY_LINE]: vtkLine$1,
  [CellType.VTK_TRIANGLE]: vtkTriangle$1
};

// ----------------------------------------------------------------------------
// vtkPolyData methods
// ----------------------------------------------------------------------------

function vtkPolyData(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPolyData');
  function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, letter => letter.toUpperCase()).replace(/\s+/g, '');
  }

  // build empty cell arrays and set methods
  POLYDATA_FIELDS.forEach(type => {
    publicAPI[`getNumberOf${camelize(type)}`] = () => model[type].getNumberOfCells();
    if (!model[type]) {
      model[type] = vtkCellArray$1.newInstance();
    } else {
      model[type] = vtk(model[type]);
    }
  });
  publicAPI.getNumberOfCells = () => POLYDATA_FIELDS.reduce((num, cellType) => num + model[cellType].getNumberOfCells(), 0);
  const superShallowCopy = publicAPI.shallowCopy;
  publicAPI.shallowCopy = function (other) {
    let debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    superShallowCopy(other, debug);
    POLYDATA_FIELDS.forEach(type => {
      model[type] = vtkCellArray$1.newInstance();
      model[type].shallowCopy(other.getReferenceByName(type));
    });
  };
  publicAPI.buildCells = () => {
    // here are the number of cells we have
    const nVerts = publicAPI.getNumberOfVerts();
    const nLines = publicAPI.getNumberOfLines();
    const nPolys = publicAPI.getNumberOfPolys();
    const nStrips = publicAPI.getNumberOfStrips();

    // pre-allocate the space we need
    const nCells = nVerts + nLines + nPolys + nStrips;
    const types = new Uint8Array(nCells);
    let pTypes = types;
    const locs = new Uint32Array(nCells);
    let pLocs = locs;

    // record locations and type of each cell.
    // verts
    if (nVerts) {
      let nextCellPts = 0;
      model.verts.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        pTypes[index] = numCellPts > 1 ? CellType.VTK_POLY_VERTEX : CellType.VTK_VERTEX;
        nextCellPts += numCellPts + 1;
      });
      pLocs = pLocs.subarray(nVerts);
      pTypes = pTypes.subarray(nVerts);
    }

    // lines
    if (nLines) {
      let nextCellPts = 0;
      model.lines.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        pTypes[index] = numCellPts > 2 ? CellType.VTK_POLY_LINE : CellType.VTK_LINE;
        if (numCellPts === 1) {
          vtkWarningMacro('Building VTK_LINE ', index, ' with only one point, but VTK_LINE needs at least two points. Check the input.');
        }
        nextCellPts += numCellPts + 1;
      });
      pLocs = pLocs.subarray(nLines);
      pTypes = pTypes.subarray(nLines);
    }

    // polys
    if (nPolys) {
      let nextCellPts = 0;
      model.polys.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        switch (numCellPts) {
          case 3:
            pTypes[index] = CellType.VTK_TRIANGLE;
            break;
          case 4:
            pTypes[index] = CellType.VTK_QUAD;
            break;
          default:
            pTypes[index] = CellType.VTK_POLYGON;
            break;
        }
        if (numCellPts < 3) {
          vtkWarningMacro('Building VTK_TRIANGLE ', index, ' with less than three points, but VTK_TRIANGLE needs at least three points. Check the input.');
        }
        nextCellPts += numCellPts + 1;
      });
      pLocs += pLocs.subarray(nPolys);
      pTypes += pTypes.subarray(nPolys);
    }

    // strips
    if (nStrips) {
      let nextCellPts = 0;
      pTypes.fill(CellType.VTK_TRIANGLE_STRIP, 0, nStrips);
      model.strips.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        nextCellPts += numCellPts + 1;
      });
    }

    // set up the cell types data structure
    model.cells = vtkCellTypes$1.newInstance();
    model.cells.setCellTypes(nCells, types, locs);
  };

  /**
   * Create upward links from points to cells that use each point. Enables
   * topologically complex queries.
   */
  publicAPI.buildLinks = function () {
    let initialSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    if (model.cells === undefined) {
      publicAPI.buildCells();
    }
    model.links = vtkCellLinks$1.newInstance();
    if (initialSize > 0) {
      model.links.allocate(initialSize);
    } else {
      model.links.allocate(publicAPI.getPoints().getNumberOfPoints());
    }
    model.links.buildLinks(publicAPI);
  };
  publicAPI.getCellType = cellId => model.cells.getCellType(cellId);
  publicAPI.getCellPoints = cellId => {
    const cellType = publicAPI.getCellType(cellId);
    let cells = null;
    switch (cellType) {
      case CellType.VTK_VERTEX:
      case CellType.VTK_POLY_VERTEX:
        cells = model.verts;
        break;
      case CellType.VTK_LINE:
      case CellType.VTK_POLY_LINE:
        cells = model.lines;
        break;
      case CellType.VTK_TRIANGLE:
      case CellType.VTK_QUAD:
      case CellType.VTK_POLYGON:
        cells = model.polys;
        break;
      case CellType.VTK_TRIANGLE_STRIP:
        cells = model.strips;
        break;
      default:
        cells = null;
        return {
          type: 0,
          cellPointIds: null
        };
    }
    const loc = model.cells.getCellLocation(cellId);
    const cellPointIds = cells.getCell(loc);
    return {
      cellType,
      cellPointIds
    };
  };
  publicAPI.getPointCells = ptId => model.links.getCells(ptId);
  publicAPI.getCellEdgeNeighbors = (cellId, point1, point2) => {
    const link1 = model.links.getLink(point1);
    const link2 = model.links.getLink(point2);
    return link1.cells.filter(cell => cell !== cellId && link2.cells.indexOf(cell) !== -1);
  };

  /**
   * If you know the type of cell, you may provide it to improve performances.
   */
  publicAPI.getCell = function (cellId) {
    let cellHint = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    const cellInfo = publicAPI.getCellPoints(cellId);
    const cell = cellHint || CELL_FACTORY[cellInfo.cellType].newInstance();
    cell.initialize(publicAPI.getPoints(), cellInfo.cellPointIds);
    return cell;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$2 = {
  // verts: null,
  // lines: null,
  // polys: null,
  // strips: null,
  // cells: null,
  // links: null,
};

// ----------------------------------------------------------------------------

function extend$2(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$2, initialValues);

  // Inheritance
  vtkPointSet$1.extend(publicAPI, model, initialValues);
  macro.get(publicAPI, model, ['cells', 'links']);
  macro.setGet(publicAPI, model, ['verts', 'lines', 'polys', 'strips']);

  // Object specific methods
  vtkPolyData(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$2 = macro.newInstance(extend$2, 'vtkPolyData');

// ----------------------------------------------------------------------------

var vtkPolyData$1 = {
  newInstance: newInstance$2,
  extend: extend$2
};

const {
  vtkErrorMacro
} = macro$1;
function initPolyIterator(pd) {
  const polys = pd.getPolys().getData();
  const strips = pd.getStrips().getData();
  const it = {
    cellSize: 0,
    cell: [],
    done: false,
    polyIdx: 0,
    stripIdx: 0,
    remainingStripLength: 0,
    // returns a single poly cell
    next() {
      if (it.polyIdx < polys.length) {
        it.cellSize = polys[it.polyIdx];
        const start = it.polyIdx + 1;
        const end = start + it.cellSize;
        it.polyIdx = end;
        let p = 0;
        for (let i = start; i < end; ++i) {
          it.cell[p++] = polys[i];
        }
      } else if (it.stripIdx < strips.length) {
        it.cellSize = 3;
        if (it.remainingStripLength === 0) {
          it.remainingStripLength = strips[it.stripIdx] - 2; // sliding window of 3 points
          // stripIdx points to the last point in a triangle 3-tuple
          it.stripIdx += 3;
        }
        const start = it.stripIdx - 2;
        const end = it.stripIdx + 1;
        it.stripIdx++;
        it.remainingStripLength--;
        let p = 0;
        for (let i = start; i < end; ++i) {
          it.cell[p++] = strips[i];
        }
      } else if (!it.done) {
        it.done = true;
      } else {
        throw new Error('Iterator is done');
      }
    }
  };
  it.next();
  return it;
}

// ----------------------------------------------------------------------------
// vtkCutter methods
// ----------------------------------------------------------------------------

function vtkCutter(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCutter');

  // Capture "parentClass" api for internal use
  const superClass = {
    ...publicAPI
  };
  publicAPI.getMTime = () => {
    let mTime = superClass.getMTime();
    if (!model.cutFunction) {
      return mTime;
    }
    mTime = Math.max(mTime, model.cutFunction.getMTime());
    return mTime;
  };
  function dataSetCutter(input, output) {
    const points = input.getPoints();
    const pointsData = points.getData();
    const numPts = points.getNumberOfPoints();
    const newPointsData = [];
    const newLinesData = [];
    const newPolysData = [];
    if (!model.cutScalars || model.cutScalars.length < numPts) {
      model.cutScalars = new Float32Array(numPts);
    }

    // Loop over all points evaluating scalar function at each point
    let inOffset = 0;
    let outOffset = 0;
    while (inOffset < pointsData.length) {
      model.cutScalars[outOffset++] = model.cutFunction.evaluateFunction(pointsData[inOffset++], pointsData[inOffset++], pointsData[inOffset++]);
    }
    const crossedEdges = [];
    const x1 = new Array(3);
    const x2 = new Array(3);
    const cellPointsScalars = [];

    // Loop over all cells; get scalar values for all cell points
    // and process each cell.
    /* eslint-disable no-continue */
    for (const it = initPolyIterator(input); !it.done; it.next()) {
      // cell contains the point IDs/indices

      // Check that cells have at least 3 points
      if (it.cellSize <= 2) {
        continue;
      }

      // Get associated scalar of points that constitute the current cell
      for (let i = 0; i < it.cellSize;) {
        cellPointsScalars[i] = model.cutScalars[it.cell[i++]];
      }

      // Check if all cell points are on same side (same side == cell not crossed by cut function)
      // TODO: won't work if one point scalar is = 0 ?
      const sideFirstPoint = cellPointsScalars[0] > 0;
      let allPointsSameSide = true;
      for (let i = 1; i < it.cell.length; i++) {
        const sideCurrentPoint = cellPointsScalars[i] > 0;
        if (sideCurrentPoint !== sideFirstPoint) {
          allPointsSameSide = false;
          break;
        }
      }

      // Go to next cell if cell is not crossed by cut function
      if (allPointsSameSide) {
        continue;
      }

      // Find and compute edges which intersect cells
      const intersectedEdgesList = [];
      for (let i = 0; i < it.cellSize; i++) {
        const idNext = i + 1 === it.cellSize ? 0 : i + 1;

        // Go to next edge if edge is not crossed
        // TODO: in most come cases, (numberOfPointsInCell - 1) or 0 edges of the cell
        // will be crossed, but if it crosses right at a point, it could be intersecting
        // with (numberOfPoints) or 1 edge(s). Do we account for that?
        const signPoint0 = cellPointsScalars[i] > 0;
        const signPoint1 = cellPointsScalars[idNext] > 0;
        if (signPoint1 === signPoint0) {
          continue;
        }

        // Compute preferred interpolation direction
        let e1 = i;
        let e2 = idNext;
        let deltaScalar = cellPointsScalars[e2] - cellPointsScalars[e1];
        if (deltaScalar <= 0) {
          e1 = idNext;
          e2 = i;
          deltaScalar *= -1;
        }

        // linear interpolation
        let t = 0.0;
        if (deltaScalar !== 0.0) {
          t = (model.cutValue - cellPointsScalars[e1]) / deltaScalar;
        }

        // points position
        const pointID1 = it.cell[e1];
        const pointID2 = it.cell[e2];
        x1[0] = pointsData[pointID1 * 3];
        x1[1] = pointsData[pointID1 * 3 + 1];
        x1[2] = pointsData[pointID1 * 3 + 2];
        x2[0] = pointsData[pointID2 * 3];
        x2[1] = pointsData[pointID2 * 3 + 1];
        x2[2] = pointsData[pointID2 * 3 + 2];

        // Compute the intersected point on edge
        const computedIntersectedPoint = [x1[0] + t * (x2[0] - x1[0]), x1[1] + t * (x2[1] - x1[1]), x1[2] + t * (x2[2] - x1[2])];

        // Keep track of it
        intersectedEdgesList.push({
          pointEdge1: pointID1,
          // id of one point of the edge
          pointEdge2: pointID2,
          // id of one point of the edge
          intersectedPoint: computedIntersectedPoint,
          // 3D coordinate of points that intersected edge
          newPointID: -1 // id of the intersected point when it will be added into vtkPoints
        });
      }

      // Add points into newPointList
      for (let i = 0; i < intersectedEdgesList.length; i++) {
        const intersectedEdge = intersectedEdgesList[i];
        let alreadyAdded = false;
        // Check if point/edge already added
        for (let j = 0; j < crossedEdges.length; j++) {
          const crossedEdge = crossedEdges[j];
          const sameEdge = intersectedEdge.pointEdge1 === crossedEdge.pointEdge1 && intersectedEdge.pointEdge2 === crossedEdge.pointEdge2;
          const samePoint = intersectedEdge.intersectedPoint[0] === crossedEdge.intersectedPoint[0] && intersectedEdge.intersectedPoint[1] === crossedEdge.intersectedPoint[1] && intersectedEdge.intersectedPoint[2] === crossedEdge.intersectedPoint[2];
          if (sameEdge || samePoint) {
            alreadyAdded = true;
            intersectedEdgesList[i].newPointID = crossedEdges[j].newPointID;
            break;
          }
        }
        if (!alreadyAdded) {
          newPointsData.push(intersectedEdge.intersectedPoint[0]);
          newPointsData.push(intersectedEdge.intersectedPoint[1]);
          newPointsData.push(intersectedEdge.intersectedPoint[2]);
          intersectedEdgesList[i].newPointID = newPointsData.length / 3 - 1;
          crossedEdges.push(intersectedEdgesList[i]);
        }
      }

      // Store cells
      const cellSize = intersectedEdgesList.length;
      if (cellSize === 2) {
        newLinesData.push(cellSize, intersectedEdgesList[0].newPointID, intersectedEdgesList[1].newPointID);
      } else if (cellSize > 2) {
        newPolysData.push(cellSize);
        intersectedEdgesList.forEach(edge => {
          newPolysData.push(edge.newPointID);
        });
      }
    }

    // Set points
    const outputPoints = output.getPoints();
    outputPoints.setData(newTypedArrayFrom(points.getDataType(), newPointsData), 3);

    // Set lines
    if (newLinesData.length !== 0) {
      output.getLines().setData(Uint16Array.from(newLinesData));
    }

    // Set polys
    if (newPolysData.length !== 0) {
      output.getPolys().setData(Uint16Array.from(newPolysData));
    }
  }

  // expose requestData
  publicAPI.requestData = (inData, outData) => {
    // implement requestData
    const input = inData[0];
    if (!input) {
      vtkErrorMacro('Invalid or missing input');
      return;
    }
    if (!model.cutFunction) {
      vtkErrorMacro('Missing cut function');
      return;
    }
    const output = vtkPolyData$1.newInstance();
    dataSetCutter(input, output);
    outData[0] = output;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES$1 = {
  cutFunction: null,
  // support method with evaluateFunction method
  cutScalars: null,
  cutValue: 0.0
};

// ----------------------------------------------------------------------------

function extend$1(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES$1, initialValues);

  // Make this a VTK object
  obj(publicAPI, model);

  // Also make it an algorithm with one input and one output
  algo(publicAPI, model, 1, 1);

  // Set implicit function use to cut the input data (is vtkPlane)
  setGet(publicAPI, model, ['cutFunction', 'cutValue']);

  // Object specific methods
  vtkCutter(publicAPI, model);
}

// ----------------------------------------------------------------------------

const newInstance$1 = newInstance$i(extend$1, 'vtkCutter');

// ----------------------------------------------------------------------------

var vtkCutter$1 = {
  newInstance: newInstance$1,
  extend: extend$1
};

function transformWorldToIndex(imageData, worldPos) {
    const continuousIndex = imageData.worldToIndex(worldPos);
    const index = continuousIndex.map(Math.round);
    return index;
}

class RLEVoxelMap {
    constructor(width, height, depth = 1) {
        this.rows = new Map();
        this.height = 1;
        this.width = 1;
        this.depth = 1;
        this.jMultiple = 1;
        this.kMultiple = 1;
        this.numComps = 1;
        this.defaultValue = 0;
        this.pixelDataConstructor = Uint8Array;
        this.get = (index) => {
            const i = index % this.jMultiple;
            const j = (index - i) / this.jMultiple;
            const rle = this.getRLE(i, j);
            return rle?.value || this.defaultValue;
        };
        this.getRun = (j, k) => {
            const runIndex = j + k * this.height;
            return this.rows.get(runIndex);
        };
        this.set = (index, value) => {
            if (value === undefined) {
                throw new Error(`Can't set undefined at ${index % this.width}`);
            }
            const i = index % this.width;
            const j = (index - i) / this.width;
            const row = this.rows.get(j);
            if (!row) {
                this.rows.set(j, [{ start: i, end: i + 1, value }]);
                return;
            }
            const rleIndex = this.findIndex(row, i);
            const rle1 = row[rleIndex];
            const rle0 = row[rleIndex - 1];
            if (!rle1) {
                if (!rle0 || rle0.value !== value || rle0.end !== i) {
                    row[rleIndex] = { start: i, end: i + 1, value };
                    return;
                }
                rle0.end++;
                return;
            }
            const { start, end, value: oldValue } = rle1;
            if (value === oldValue && i >= start) {
                return;
            }
            const rleInsert = { start: i, end: i + 1, value };
            const isAfter = i > start;
            const insertIndex = isAfter ? rleIndex + 1 : rleIndex;
            const rlePrev = isAfter ? rle1 : rle0;
            let rleNext = isAfter ? row[rleIndex + 1] : rle1;
            if (rlePrev?.value === value && rlePrev?.end === i) {
                rlePrev.end++;
                if (rleNext?.value === value && rleNext.start === i + 1) {
                    rlePrev.end = rleNext.end;
                    row.splice(rleIndex, 1);
                }
                else if (rleNext?.start === i) {
                    rleNext.start++;
                    if (rleNext.start === rleNext.end) {
                        row.splice(rleIndex, 1);
                        rleNext = row[rleIndex];
                        if (rleNext?.start === i + 1 && rleNext.value === value) {
                            rlePrev.end = rleNext.end;
                            row.splice(rleIndex, 1);
                        }
                    }
                }
                return;
            }
            if (rleNext?.value === value && rleNext.start === i + 1) {
                rleNext.start--;
                if (rlePrev?.end > i) {
                    rlePrev.end = i;
                    if (rlePrev.end === rlePrev.start) {
                        row.splice(rleIndex, 1);
                    }
                }
                return;
            }
            if (rleNext?.start === i && rleNext.end === i + 1) {
                rleNext.value = value;
                const nextnext = row[rleIndex + 1];
                if (nextnext?.start == i + 1 && nextnext.value === value) {
                    row.splice(rleIndex + 1, 1);
                    rleNext.end = nextnext.end;
                }
                return;
            }
            if (i === rleNext?.start) {
                rleNext.start++;
            }
            if (isAfter && end > i + 1) {
                row.splice(insertIndex, 0, rleInsert, {
                    start: i + 1,
                    end: rlePrev.end,
                    value: rlePrev.value,
                });
            }
            else {
                row.splice(insertIndex, 0, rleInsert);
            }
            if (rlePrev?.end > i) {
                rlePrev.end = i;
            }
        };
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.jMultiple = width;
        this.kMultiple = this.jMultiple * height;
    }
    getRLE(i, j, k = 0) {
        const row = this.rows.get(j + k * this.height);
        if (!row) {
            return;
        }
        const index = this.findIndex(row, i);
        const rle = row[index];
        return i >= rle?.start ? rle : undefined;
    }
    findIndex(row, i) {
        for (let index = 0; index < row.length; index++) {
            const { end: iEnd } = row[index];
            if (i < iEnd) {
                return index;
            }
        }
        return row.length;
    }
    clear() {
        this.rows.clear();
    }
    keys() {
        return [...this.rows.keys()];
    }
    getPixelData(k = 0, pixelData) {
        if (!pixelData) {
            pixelData = new this.pixelDataConstructor(this.width * this.height * this.numComps);
        }
        else {
            pixelData.fill(0);
        }
        const { width, height, numComps } = this;
        for (let j = 0; j < height; j++) {
            const row = this.getRun(j, k);
            if (!row) {
                continue;
            }
            if (numComps === 1) {
                for (const rle of row) {
                    const rowOffset = j * width;
                    const { start, end, value } = rle;
                    for (let i = start; i < end; i++) {
                        pixelData[rowOffset + i] = value;
                    }
                }
            }
            else {
                for (const rle of row) {
                    const rowOffset = j * width * numComps;
                    const { start, end, value } = rle;
                    for (let i = start; i < end; i += numComps) {
                        for (let comp = 0; comp < numComps; comp++) {
                            pixelData[rowOffset + i + comp] = value[comp];
                        }
                    }
                }
            }
        }
        return pixelData;
    }
}

const DEFAULT_RLE_SIZE = 5 * 1024;
class VoxelManager {
    constructor(dimensions, _get, _set) {
        this.modifiedSlices = new Set();
        this.boundsIJK = [
            [Infinity, -Infinity],
            [Infinity, -Infinity],
            [Infinity, -Infinity],
        ];
        this.numComps = 1;
        this.getAtIJK = (i, j, k) => {
            const index = i + j * this.width + k * this.frameSize;
            return this._get(index);
        };
        this.setAtIJK = (i, j, k, v) => {
            const index = i + j * this.width + k * this.frameSize;
            if (this._set(index, v) !== false) {
                this.modifiedSlices.add(k);
                VoxelManager.addBounds(this.boundsIJK, [i, j, k]);
            }
        };
        this.getAtIJKPoint = ([i, j, k]) => this.getAtIJK(i, j, k);
        this.setAtIJKPoint = ([i, j, k], v) => this.setAtIJK(i, j, k, v);
        this.getAtIndex = (index) => this._get(index);
        this.setAtIndex = (index, v) => {
            if (this._set(index, v) !== false) {
                const pointIJK = this.toIJK(index);
                this.modifiedSlices.add(pointIJK[2]);
                VoxelManager.addBounds(this.boundsIJK, pointIJK);
            }
        };
        this.forEach = (callback, options) => {
            const boundsIJK = options?.boundsIJK || this.getBoundsIJK();
            const { isWithinObject } = options || {};
            if (this.map) {
                for (const index of this.map.keys()) {
                    const pointIJK = this.toIJK(index);
                    const value = this._get(index);
                    const callbackArguments = { value, index, pointIJK };
                    if (isWithinObject?.(callbackArguments) === false) {
                        continue;
                    }
                    callback(callbackArguments);
                }
            }
            else {
                for (let k = boundsIJK[2][0]; k <= boundsIJK[2][1]; k++) {
                    const kIndex = k * this.frameSize;
                    for (let j = boundsIJK[1][0]; j <= boundsIJK[1][1]; j++) {
                        const jIndex = kIndex + j * this.width;
                        for (let i = boundsIJK[0][0], index = jIndex + i; i <= boundsIJK[0][1]; i++, index++) {
                            const value = this.getAtIndex(index);
                            const callbackArguments = { value, index, pointIJK: [i, j, k] };
                            if (isWithinObject?.(callbackArguments) === false) {
                                continue;
                            }
                            callback(callbackArguments);
                        }
                    }
                }
            }
        };
        this.dimensions = dimensions;
        this.width = dimensions[0];
        this.frameSize = this.width * dimensions[1];
        this._get = _get;
        this._set = _set;
    }
    addPoint(point) {
        const index = Array.isArray(point)
            ? point[0] + this.width * point[1] + this.frameSize * point[2]
            : point;
        if (!this.points) {
            this.points = new Set();
        }
        this.points.add(index);
    }
    getPoints() {
        return this.points
            ? [...this.points].map((index) => this.toIJK(index))
            : [];
    }
    getPointIndices() {
        return this.points ? [...this.points] : [];
    }
    toIJK(index) {
        return [
            index % this.width,
            Math.floor((index % this.frameSize) / this.width),
            Math.floor(index / this.frameSize),
        ];
    }
    toIndex(ijk) {
        return ijk[0] + ijk[1] * this.width + ijk[2] * this.frameSize;
    }
    getBoundsIJK() {
        if (this.boundsIJK[0][0] < this.dimensions[0]) {
            return this.boundsIJK;
        }
        return this.dimensions.map((dimension) => [0, dimension - 1]);
    }
    clear() {
        if (this.map) {
            this.map.clear();
        }
        this.boundsIJK.map((bound) => {
            bound[0] = Infinity;
            bound[1] = -Infinity;
        });
        this.modifiedSlices.clear();
        this.points?.clear();
    }
    getArrayOfSlices() {
        return Array.from(this.modifiedSlices);
    }
    static addBounds(bounds, point) {
        if (!bounds) {
            bounds = [
                [Infinity, -Infinity],
                [Infinity, -Infinity],
                [Infinity, -Infinity],
            ];
        }
        bounds[0][0] = Math.min(point[0], bounds[0][0]);
        bounds[0][1] = Math.max(point[0], bounds[0][1]);
        bounds[1][0] = Math.min(point[1], bounds[1][0]);
        bounds[1][1] = Math.max(point[1], bounds[1][1]);
        bounds[2][0] = Math.min(point[2], bounds[2][0]);
        bounds[2][1] = Math.max(point[2], bounds[2][1]);
    }
    static createRGBVolumeVoxelManager(dimensions, scalarData, numComponents) {
        const voxels = new VoxelManager(dimensions, (index) => {
            index *= numComponents;
            return [scalarData[index++], scalarData[index++], scalarData[index++]];
        }, (index, v) => {
            index *= 3;
            const isChanged = !isEqual(scalarData[index], v);
            scalarData[index++] = v[0];
            scalarData[index++] = v[1];
            scalarData[index++] = v[2];
            return isChanged;
        });
        voxels.numComps = numComponents;
        voxels.scalarData = scalarData;
        return voxels;
    }
    static createVolumeVoxelManager(dimensions, scalarData, numComponents = 0) {
        if (dimensions.length !== 3) {
            throw new Error('Dimensions must be provided as [number, number, number] for [width, height, depth]');
        }
        if (!numComponents) {
            numComponents =
                scalarData.length / dimensions[0] / dimensions[1] / dimensions[2];
            if (numComponents > 4 || numComponents < 1 || numComponents === 2) {
                throw new Error(`Number of components ${numComponents} must be 1, 3 or 4`);
            }
        }
        if (numComponents > 1) {
            return VoxelManager.createRGBVolumeVoxelManager(dimensions, scalarData, numComponents);
        }
        return VoxelManager.createNumberVolumeVoxelManager(dimensions, scalarData);
    }
    static createNumberVolumeVoxelManager(dimensions, scalarData) {
        const voxels = new VoxelManager(dimensions, (index) => scalarData[index], (index, v) => {
            const isChanged = scalarData[index] !== v;
            scalarData[index] = v;
            return isChanged;
        });
        voxels.scalarData = scalarData;
        return voxels;
    }
    static createMapVoxelManager(dimension) {
        const map = new Map();
        const voxelManager = new VoxelManager(dimension, map.get.bind(map), (index, v) => map.set(index, v) && true);
        voxelManager.map = map;
        return voxelManager;
    }
    static createHistoryVoxelManager(sourceVoxelManager) {
        const map = new Map();
        const { dimensions } = sourceVoxelManager;
        const voxelManager = new VoxelManager(dimensions, (index) => map.get(index), function (index, v) {
            if (!map.has(index)) {
                const oldV = this.sourceVoxelManager.getAtIndex(index);
                if (oldV === v) {
                    return false;
                }
                map.set(index, oldV);
            }
            else if (v === map.get(index)) {
                map.delete(index);
            }
            this.sourceVoxelManager.setAtIndex(index, v);
        });
        voxelManager.map = map;
        voxelManager.scalarData = sourceVoxelManager.scalarData;
        voxelManager.sourceVoxelManager = sourceVoxelManager;
        return voxelManager;
    }
    static createLazyVoxelManager(dimensions, planeFactory) {
        const map = new Map();
        const [width, height, depth] = dimensions;
        const planeSize = width * height;
        const voxelManager = new VoxelManager(dimensions, (index) => map.get(Math.floor(index / planeSize))?.[index % planeSize], (index, v) => {
            const k = Math.floor(index / planeSize);
            let layer = map.get(k);
            if (!layer) {
                layer = planeFactory(width, height);
                map.set(k, layer);
            }
            layer[index % planeSize] = v;
        });
        voxelManager.map = map;
        return voxelManager;
    }
    static createRLEVoxelManager(dimensions) {
        const [width, height, depth] = dimensions;
        const map = new RLEVoxelMap(width, height, depth);
        const voxelManager = new VoxelManager(dimensions, (index) => map.get(index), (index, v) => map.set(index, v));
        voxelManager.map = map;
        voxelManager.getPixelData = map.getPixelData.bind(map);
        return voxelManager;
    }
    static addInstanceToImage(image) {
        const { width, height } = image;
        const scalarData = image.getPixelData();
        if (scalarData?.length >= width * height) {
            image.voxelManager = VoxelManager.createVolumeVoxelManager([width, height, 1], scalarData);
            return;
        }
        image.voxelManager = VoxelManager.createRLEVoxelManager([
            width,
            height,
            1,
        ]);
        image.getPixelData = image.voxelManager.getPixelData;
        image.sizeInBytes = DEFAULT_RLE_SIZE;
    }
}

function getRandomSampleFromArray(array, size) {
    const clonedArray = [...array];
    if (size >= clonedArray.length) {
        shuffleArray(clonedArray);
        return clonedArray;
    }
    shuffleArray(clonedArray);
    return clonedArray.slice(0, size);
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

const Dir = {
  Forward: 1,
  Backward: -1
};
const visited = new Set();
function vtkContourLoopExtraction(publicAPI, model) {
  publicAPI.requestData = (inData, outData) => {
    const [input] = inData;
    if (!outData[0]) {
      outData[0] = vtkPolyData$1.newInstance();
    }
    const [output] = outData;
    publicAPI.extractContours(input, output);
    output.modified();
  };
  publicAPI.traverseLoop = (pd, dir, startLineId, startPtId, loopPoints) => {
    let lineId = startLineId;
    let lastPtId = startPtId;
    let terminated = false;
    let numInserted = 0;
    while (!terminated) {
      const {
        cellPointIds
      } = pd.getCellPoints(lineId);
      if (!cellPointIds) {
        // eslint-disable-next-line no-continue
        continue;
      }
      lastPtId = cellPointIds[0] !== lastPtId ? cellPointIds[0] : cellPointIds[1];
      numInserted++;

      // parametric point value
      const t = dir * numInserted;
      loopPoints.push({
        t,
        ptId: lastPtId
      });
      const lineCell = pd.getPointCells(lastPtId);
      if (lineCell.length !== 2 || lastPtId === startPtId) {
        // looped
        return lastPtId;
      }
      if (lineCell.length === 2) {
        // continue along loop
        lineId = lineCell[0] !== lineId ? lineCell[0] : lineCell[1];
        visited.add(lineId);
      } else {
        // empty or invalid cell
        terminated = true;
      }
    }
    return lastPtId;
  };
  publicAPI.extractContours = (input, output) => {
    const loops = [];
    visited.clear();
    const inLines = input.getLines();
    output.getPoints().setData(Float32Array.from(input.getPoints().getData()));

    // TODO skip if cached input mtime hasn't changed.
    // iterate over input lines
    for (let li = 0; li < inLines.getNumberOfCells(); li++) {
      if (visited.has(li)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const {
        cellPointIds
      } = input.getCellPoints(li);
      if (!cellPointIds) {
        // eslint-disable-next-line no-continue
        continue;
      }
      visited.add(li);
      const startPtId = cellPointIds[0];
      const loopPoints = [];
      loopPoints.push({
        t: 0,
        ptId: startPtId
      });
      const endPtId = publicAPI.traverseLoop(input, Dir.Forward, li, startPtId, loopPoints);
      if (startPtId !== endPtId) {
        // didn't find a loop. Go other direction to see where we end up
        publicAPI.traverseLoop(input, Dir.Backward, li, startPtId, loopPoints);
        loopPoints.sort((a, b) => a.t < b.t ? -1 : 1);
        // make closed contour
        if (loopPoints.length && loopPoints[0].ptId !== loopPoints[loopPoints.length - 1]?.ptId) {
          loopPoints.push({
            ...loopPoints[loopPoints.length - 1]
          });
        }
      }
      if (loopPoints.length) {
        loops.push(loopPoints);
      }
    }

    // clear output lines
    const outLines = output.getLines();
    outLines.resize(0);
    loops.forEach(loop => {
      outLines.insertNextCell(loop.map(pt => pt.ptId));
    });
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  let initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model);
  macro.algo(publicAPI, model, 1, 1);
  vtkContourLoopExtraction(publicAPI);
}

// ----------------------------------------------------------------------------

const newInstance = macro.newInstance(extend, 'vtkContourLoopExtraction');

// ----------------------------------------------------------------------------

var index = {
  newInstance,
  extend
};

function calculateBoundingBox(points, dimensions, isWorld = false) {
    let xMin = Infinity;
    let xMax = isWorld ? -Infinity : 0;
    let yMin = Infinity;
    let yMax = isWorld ? -Infinity : 0;
    let zMin = Infinity;
    let zMax = isWorld ? -Infinity : 0;
    const is3D = points[0]?.length === 3;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        xMin = Math.min(p[0], xMin);
        xMax = Math.max(p[0], xMax);
        yMin = Math.min(p[1], yMin);
        yMax = Math.max(p[1], yMax);
        if (is3D) {
            zMin = Math.min(p[2] ?? zMin, zMin);
            zMax = Math.max(p[2] ?? zMax, zMax);
        }
    }
    if (!isWorld) {
        xMin = Math.max(0, xMin);
        xMax = Math.min(Infinity, xMax);
        yMin = Math.max(0, yMin);
        yMax = Math.min(Infinity, yMax);
        if (is3D) {
            zMin = Math.max(0, zMin);
            zMax = Math.min(Infinity, zMax);
        }
    }
    return is3D
        ? [
            [xMin, xMax],
            [yMin, yMax],
            [zMin, zMax],
        ]
        : [[xMin, xMax], [yMin, yMax], null];
}
function getBoundingBoxAroundShapeWorld(points, clipBounds) {
    return calculateBoundingBox(points, clipBounds, true);
}

function pointInShapeCallback(imageData, pointInShapeFn, callback, boundsIJK) {
    let iMin, iMax, jMin, jMax, kMin, kMax;
    let scalarData;
    const { numComps } = imageData;
    if (imageData.getScalarData) {
        scalarData = imageData.getScalarData();
    }
    else {
        scalarData = imageData
            .getPointData()
            .getScalars()
            .getData();
    }
    if (!scalarData) {
        console.warn('No scalar data found for imageData', imageData);
        return;
    }
    const dimensions = imageData.getDimensions();
    if (!boundsIJK) {
        iMin = 0;
        iMax = dimensions[0];
        jMin = 0;
        jMax = dimensions[1];
        kMin = 0;
        kMax = dimensions[2];
    }
    else {
        [[iMin, iMax], [jMin, jMax], [kMin, kMax]] = boundsIJK;
    }
    const start = fromValues(iMin, jMin, kMin);
    const direction = imageData.getDirection();
    const rowCosines = direction.slice(0, 3);
    const columnCosines = direction.slice(3, 6);
    const scanAxisNormal = direction.slice(6, 9);
    const spacing = imageData.getSpacing();
    const [rowSpacing, columnSpacing, scanAxisSpacing] = spacing;
    const worldPosStart = imageData.indexToWorld(start);
    const rowStep = fromValues(rowCosines[0] * rowSpacing, rowCosines[1] * rowSpacing, rowCosines[2] * rowSpacing);
    const columnStep = fromValues(columnCosines[0] * columnSpacing, columnCosines[1] * columnSpacing, columnCosines[2] * columnSpacing);
    const scanAxisStep = fromValues(scanAxisNormal[0] * scanAxisSpacing, scanAxisNormal[1] * scanAxisSpacing, scanAxisNormal[2] * scanAxisSpacing);
    const xMultiple = numComps ||
        scalarData.length / dimensions[2] / dimensions[1] / dimensions[0];
    const yMultiple = dimensions[0] * xMultiple;
    const zMultiple = dimensions[1] * yMultiple;
    const pointsInShape = [];
    const currentPos = clone(worldPosStart);
    for (let k = kMin; k <= kMax; k++) {
        const startPosJ = clone(currentPos);
        for (let j = jMin; j <= jMax; j++) {
            const startPosI = clone(currentPos);
            for (let i = iMin; i <= iMax; i++) {
                const pointIJK = [i, j, k];
                if (pointInShapeFn(currentPos, pointIJK)) {
                    const index = k * zMultiple + j * yMultiple + i * xMultiple;
                    let value;
                    if (xMultiple > 2) {
                        value = [
                            scalarData[index],
                            scalarData[index + 1],
                            scalarData[index + 2],
                        ];
                    }
                    else {
                        value = scalarData[index];
                    }
                    pointsInShape.push({
                        value,
                        index,
                        pointIJK,
                        pointLPS: currentPos.slice(),
                    });
                    if (callback) {
                        callback({ value, index, pointIJK, pointLPS: currentPos });
                    }
                }
                add(currentPos, currentPos, rowStep);
            }
            copy(currentPos, startPosI);
            add(currentPos, currentPos, columnStep);
        }
        copy(currentPos, startPosJ);
        add(currentPos, currentPos, scanAxisStep);
    }
    return pointsInShape;
}

function distanceToPointSquared(p1, p2) {
    if (p1.length !== p2.length) {
        throw Error('Both points should have the same dimensionality');
    }
    const [x1, y1, z1 = 0] = p1;
    const [x2, y2, z2 = 0] = p2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return dx * dx + dy * dy + dz * dz;
}

function isClosed(polyline) {
    if (polyline.length < 3) {
        return false;
    }
    const numPolylinePoints = polyline.length;
    const firstPoint = polyline[0];
    const lastPoint = polyline[numPolylinePoints - 1];
    const distFirstToLastPoints = distanceToPointSquared(firstPoint, lastPoint);
    return equals$1(0, distFirstToLastPoints);
}

function containsPoint(polyline, point, options = {
    closed: undefined,
}) {
    if (polyline.length < 3) {
        return false;
    }
    const numPolylinePoints = polyline.length;
    let numIntersections = 0;
    const { closed, holes } = options;
    if (holes?.length) {
        for (const hole of holes) {
            if (containsPoint(hole, point)) {
                return false;
            }
        }
    }
    const shouldClose = !(closed === undefined ? isClosed(polyline) : closed);
    const maxSegmentIndex = polyline.length - (shouldClose ? 1 : 2);
    for (let i = 0; i <= maxSegmentIndex; i++) {
        const p1 = polyline[i];
        const p2Index = i === numPolylinePoints - 1 ? 0 : i + 1;
        const p2 = polyline[p2Index];
        const maxX = p1[0] >= p2[0] ? p1[0] : p2[0];
        const maxY = p1[1] >= p2[1] ? p1[1] : p2[1];
        const minY = p1[1] <= p2[1] ? p1[1] : p2[1];
        const mayIntersectLineSegment = point[0] <= maxX && point[1] >= minY && point[1] < maxY;
        if (mayIntersectLineSegment) {
            const isVerticalLine = p1[0] === p2[0];
            let intersects = isVerticalLine;
            if (!intersects) {
                const xIntersection = ((point[1] - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]) + p1[0];
                intersects = point[0] <= xIntersection;
            }
            numIntersections += intersects ? 1 : 0;
        }
    }
    return !!(numIntersections % 2);
}

function getAABB(polyline, options) {
    let polylineToUse = polyline;
    const numDimensions = options?.numDimensions || 2;
    const is3D = numDimensions === 3;
    if (!Array.isArray(polyline[0])) {
        const currentPolyline = polyline;
        const totalPoints = currentPolyline.length / numDimensions;
        polylineToUse = new Array(currentPolyline.length / numDimensions);
        for (let i = 0, len = totalPoints; i < len; i++) {
            polylineToUse[i] = [
                currentPolyline[i * numDimensions],
                currentPolyline[i * numDimensions + 1],
            ];
            if (is3D) {
                polylineToUse[i].push(currentPolyline[i * numDimensions + 2]);
            }
        }
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    polylineToUse = polylineToUse;
    for (let i = 0, len = polylineToUse.length; i < len; i++) {
        const [x, y, z] = polylineToUse[i];
        minX = minX < x ? minX : x;
        minY = minY < y ? minY : y;
        maxX = maxX > x ? maxX : x;
        maxY = maxY > y ? maxY : y;
        if (is3D) {
            minZ = minZ < z ? minZ : z;
            maxZ = maxZ > z ? maxZ : z;
        }
    }
    return is3D
        ? { minX, maxX, minY, maxY, minZ, maxZ }
        : { minX, maxX, minY, maxY };
}

const epsilon = 1e-6;
function projectTo2D(polyline) {
    let sharedDimensionIndex;
    const testPoints = getRandomSampleFromArray(polyline, 50);
    for (let i = 0; i < 3; i++) {
        if (testPoints.every((point, index, array) => Math.abs(point[i] - array[0][i]) < epsilon)) {
            sharedDimensionIndex = i;
            break;
        }
    }
    if (sharedDimensionIndex === undefined) {
        throw new Error('Cannot find a shared dimension index for polyline, probably oblique plane');
    }
    const points2D = [];
    const firstDim = (sharedDimensionIndex + 1) % 3;
    const secondDim = (sharedDimensionIndex + 2) % 3;
    for (let i = 0; i < polyline.length; i++) {
        points2D.push([polyline[i][firstDim], polyline[i][secondDim]]);
    }
    return {
        sharedDimensionIndex,
        projectedPolyline: points2D,
    };
}

const isPlaneIntersectingAABB = (origin, normal, minX, minY, minZ, maxX, maxY, maxZ) => {
    const vertices = [
        fromValues(minX, minY, minZ),
        fromValues(maxX, minY, minZ),
        fromValues(minX, maxY, minZ),
        fromValues(maxX, maxY, minZ),
        fromValues(minX, minY, maxZ),
        fromValues(maxX, minY, maxZ),
        fromValues(minX, maxY, maxZ),
        fromValues(maxX, maxY, maxZ),
    ];
    const normalVec = fromValues(normal[0], normal[1], normal[2]);
    const originVec = fromValues(origin[0], origin[1], origin[2]);
    const planeDistance = -dot(normalVec, originVec);
    let initialSign = null;
    for (const vertex of vertices) {
        const distance = dot(normalVec, vertex) + planeDistance;
        if (initialSign === null) {
            initialSign = Math.sign(distance);
        }
        else if (Math.sign(distance) !== initialSign) {
            return true;
        }
    }
    return false;
};

const polySegConverters = {
    polySeg: null,
    polySegInitializing: false,
    polySegInitializingPromise: null,
    async initializePolySeg(progressCallback) {
        if (this.polySegInitializing) {
            await this.polySegInitializingPromise;
            return;
        }
        if (this.polySeg?.instance) {
            return;
        }
        this.polySegInitializing = true;
        this.polySegInitializingPromise = new Promise((resolve) => {
            this.polySeg = new ICRPolySeg();
            this.polySeg
                .initialize({
                updateProgress: progressCallback,
            })
                .then(() => {
                this.polySegInitializing = false;
                resolve();
            });
        });
        await this.polySegInitializingPromise;
    },
    async convertContourToSurface(args, ...callbacks) {
        const { polylines, numPointsArray } = args;
        const [progressCallback] = callbacks;
        await this.initializePolySeg(progressCallback);
        const results = await this.polySeg.instance.convertContourRoiToSurface(polylines, numPointsArray);
        return results;
    },
    async convertLabelmapToSurface(args, ...callbacks) {
        const [progressCallback] = callbacks;
        await this.initializePolySeg(progressCallback);
        const results = this.polySeg.instance.convertLabelmapToSurface(args.scalarData, args.dimensions, args.spacing, args.direction, args.origin, [args.segmentIndex]);
        return results;
    },
    async convertContourToVolumeLabelmap(args, ...callbacks) {
        const [progressCallback] = callbacks;
        const polySeg = await new ICRPolySeg();
        await polySeg.initialize({
            updateProgress: progressCallback,
        });
        const { segmentIndices, scalarData, annotationUIDsInSegmentMap, dimensions, origin, direction, spacing, } = args;
        const segmentationVoxelManager = VoxelManager.createVolumeVoxelManager(dimensions, scalarData);
        const imageData = vtkImageData$1.newInstance();
        imageData.setDimensions(dimensions);
        imageData.setOrigin(origin);
        imageData.setDirection(direction);
        imageData.setSpacing(spacing);
        const scalarArray = vtkDataArray$1.newInstance({
            name: 'Pixels',
            numberOfComponents: 1,
            values: scalarData,
        });
        imageData.getPointData().setScalars(scalarArray);
        imageData.modified();
        for (const index of segmentIndices) {
            const annotations = annotationUIDsInSegmentMap.get(index);
            for (const annotation of annotations) {
                if (!annotation.polyline) {
                    continue;
                }
                const { polyline, holesPolyline } = annotation;
                const bounds = getBoundingBoxAroundShapeWorld(polyline);
                const [iMin, jMin, kMin] = transformWorldToIndex(imageData, [
                    bounds[0][0],
                    bounds[1][0],
                    bounds[2][0],
                ]);
                const [iMax, jMax, kMax] = transformWorldToIndex(imageData, [
                    bounds[0][1],
                    bounds[1][1],
                    bounds[2][1],
                ]);
                const { projectedPolyline, sharedDimensionIndex } = projectTo2D(polyline);
                const holes = holesPolyline?.map((hole) => {
                    const { projectedPolyline: projectedHole } = projectTo2D(hole);
                    return projectedHole;
                });
                const firstDim = (sharedDimensionIndex + 1) % 3;
                const secondDim = (sharedDimensionIndex + 2) % 3;
                pointInShapeCallback(imageData, (pointLPS) => {
                    const point2D = [pointLPS[firstDim], pointLPS[secondDim]];
                    const isInside = containsPoint(projectedPolyline, point2D, {
                        holes,
                    });
                    return isInside;
                }, ({ pointIJK }) => {
                    segmentationVoxelManager.setAtIJKPoint(pointIJK, index);
                }, [
                    [iMin, iMax],
                    [jMin, jMax],
                    [kMin, kMax],
                ]);
            }
        }
        return segmentationVoxelManager.scalarData;
    },
    async convertContourToStackLabelmap(args, ...callbacks) {
        const [progressCallback] = callbacks;
        const polySeg = await new ICRPolySeg();
        await polySeg.initialize({
            updateProgress: progressCallback,
        });
        const { segmentationsInfo, annotationUIDsInSegmentMap, segmentIndices } = args;
        const segmentationVoxelManagers = new Map();
        segmentationsInfo.forEach((segmentationInfo, referencedImageId) => {
            const { dimensions, scalarData, direction, spacing, origin } = segmentationInfo;
            const manager = VoxelManager.createVolumeVoxelManager(dimensions, scalarData);
            const imageData = vtkImageData$1.newInstance();
            imageData.setDimensions(dimensions);
            imageData.setOrigin(origin);
            imageData.setDirection(direction);
            imageData.setSpacing(spacing);
            const scalarArray = vtkDataArray$1.newInstance({
                name: 'Pixels',
                numberOfComponents: 1,
                values: scalarData,
            });
            imageData.getPointData().setScalars(scalarArray);
            imageData.modified();
            segmentationVoxelManagers.set(referencedImageId, { manager, imageData });
        });
        for (const index of segmentIndices) {
            const annotations = annotationUIDsInSegmentMap.get(index);
            for (const annotation of annotations) {
                if (!annotation.polyline) {
                    continue;
                }
                const { polyline, holesPolyline, referencedImageId } = annotation;
                const bounds = getBoundingBoxAroundShapeWorld(polyline);
                const { manager: segmentationVoxelManager, imageData } = segmentationVoxelManagers.get(referencedImageId);
                const [iMin, jMin, kMin] = transformWorldToIndex(imageData, [
                    bounds[0][0],
                    bounds[1][0],
                    bounds[2][0],
                ]);
                const [iMax, jMax, kMax] = transformWorldToIndex(imageData, [
                    bounds[0][1],
                    bounds[1][1],
                    bounds[2][1],
                ]);
                const { projectedPolyline, sharedDimensionIndex } = projectTo2D(polyline);
                const holes = holesPolyline?.map((hole) => {
                    const { projectedPolyline: projectedHole } = projectTo2D(hole);
                    return projectedHole;
                });
                const firstDim = (sharedDimensionIndex + 1) % 3;
                const secondDim = (sharedDimensionIndex + 2) % 3;
                pointInShapeCallback(imageData, (pointLPS) => {
                    const point2D = [pointLPS[firstDim], pointLPS[secondDim]];
                    const isInside = containsPoint(projectedPolyline, point2D, {
                        holes,
                    });
                    return isInside;
                }, ({ pointIJK }) => {
                    segmentationVoxelManager.setAtIJKPoint(pointIJK, index);
                }, [
                    [iMin, iMax],
                    [jMin, jMax],
                    [kMin, kMax],
                ]);
            }
        }
        segmentationsInfo.forEach((segmentationInfo, referencedImageId) => {
            const { manager: segmentationVoxelManager } = segmentationVoxelManagers.get(referencedImageId);
            segmentationInfo.scalarData = segmentationVoxelManager.scalarData;
        });
        return segmentationsInfo;
    },
    async convertSurfaceToVolumeLabelmap(args, ...callbacks) {
        const [progressCallback] = callbacks;
        await this.initializePolySeg(progressCallback);
        const results = this.polySeg.instance.convertSurfaceToLabelmap(args.points, args.polys, args.dimensions, args.spacing, args.direction, args.origin);
        return results;
    },
    async convertSurfacesToVolumeLabelmap(args, ...callbacks) {
        const [progressCallback] = callbacks;
        await this.initializePolySeg(progressCallback);
        const { segmentsInfo } = args;
        const promises = Array.from(segmentsInfo.keys()).map((segmentIndex) => {
            const { points, polys } = segmentsInfo.get(segmentIndex);
            const result = this.polySeg.instance.convertSurfaceToLabelmap(points, polys, args.dimensions, args.spacing, args.direction, args.origin);
            return {
                ...result,
                segmentIndex,
            };
        });
        const results = await Promise.all(promises);
        const targetImageData = vtkImageData$1.newInstance();
        targetImageData.setDimensions(args.dimensions);
        targetImageData.setOrigin(args.origin);
        targetImageData.setSpacing(args.spacing);
        targetImageData.setDirection(args.direction);
        const totalSize = args.dimensions[0] * args.dimensions[1] * args.dimensions[2];
        const scalarArray = vtkDataArray$1.newInstance({
            name: 'Pixels',
            numberOfComponents: 1,
            values: new Uint8Array(totalSize),
        });
        targetImageData.getPointData().setScalars(scalarArray);
        targetImageData.modified();
        const segmentationVoxelManager = VoxelManager.createVolumeVoxelManager(args.dimensions, targetImageData.getPointData().getScalars().getData());
        const outputVolumesInfo = results.map((result) => {
            const { data, dimensions, direction, origin, spacing } = result;
            const volume = vtkImageData$1.newInstance();
            volume.setDimensions(dimensions);
            volume.setOrigin(origin);
            volume.setSpacing(spacing);
            volume.setDirection(direction);
            const scalarArray = vtkDataArray$1.newInstance({
                name: 'Pixels',
                numberOfComponents: 1,
                values: data,
            });
            volume.getPointData().setScalars(scalarArray);
            volume.modified();
            const voxelManager = VoxelManager.createVolumeVoxelManager(dimensions, data);
            const extent = volume.getExtent();
            return {
                volume,
                voxelManager,
                extent,
                scalarData: data,
                segmentIndex: result.segmentIndex,
            };
        });
        pointInShapeCallback(targetImageData, () => true, ({ pointIJK, pointLPS }) => {
            try {
                for (const volumeInfo of outputVolumesInfo) {
                    const { volume, extent, voxelManager, segmentIndex } = volumeInfo;
                    const index = volume.worldToIndex(pointLPS);
                    if (index[0] < extent[0] ||
                        index[0] > extent[1] ||
                        index[1] < extent[2] ||
                        index[1] > extent[3] ||
                        index[2] < extent[4] ||
                        index[2] > extent[5]) {
                        continue;
                    }
                    const roundedIndex = index.map(Math.round);
                    const value = voxelManager.getAtIJK(...roundedIndex);
                    if (value > 0) {
                        segmentationVoxelManager.setAtIJKPoint(pointIJK, segmentIndex);
                        break;
                    }
                }
            }
            catch (error) {
            }
        });
        return segmentationVoxelManager.scalarData;
    },
    getSurfacesAABBs({ surfacesInfo }) {
        const aabbs = new Map();
        for (const { points, id } of surfacesInfo) {
            const aabb = getAABB(points, { numDimensions: 3 });
            aabbs.set(id, aabb);
        }
        return aabbs;
    },
    cutSurfacesIntoPlanes({ planesInfo, surfacesInfo, surfacesAABB = new Map() }, progressCallback, updateCacheCallback) {
        const numberOfPlanes = planesInfo.length;
        const cutter = vtkCutter$1.newInstance();
        const plane1 = vtkPlane$1.newInstance();
        cutter.setCutFunction(plane1);
        const surfacePolyData = vtkPolyData$1.newInstance();
        try {
            for (const [index$1, planeInfo] of planesInfo.entries()) {
                const { sliceIndex, planes } = planeInfo;
                const polyDataResults = new Map();
                for (const polyDataInfo of surfacesInfo) {
                    const { points, polys, id } = polyDataInfo;
                    const aabb3 = surfacesAABB.get(id) || getAABB(points, { numDimensions: 3 });
                    if (!surfacesAABB.has(id)) {
                        surfacesAABB.set(id, aabb3);
                    }
                    const { minX, minY, minZ, maxX, maxY, maxZ } = aabb3;
                    const { origin, normal } = planes[0];
                    if (!isPlaneIntersectingAABB(origin, normal, minX, minY, minZ, maxX, maxY, maxZ)) {
                        continue;
                    }
                    surfacePolyData.getPoints().setData(points, 3);
                    surfacePolyData.getPolys().setData(polys, 3);
                    surfacePolyData.modified();
                    cutter.setInputData(surfacePolyData);
                    plane1.setOrigin(origin);
                    plane1.setNormal(normal);
                    try {
                        cutter.update();
                    }
                    catch (e) {
                        console.warn('Error during clipping', e);
                        continue;
                    }
                    const polyData = cutter.getOutputData();
                    const cutterOutput = polyData;
                    cutterOutput.buildLinks();
                    const loopExtraction = index.newInstance();
                    loopExtraction.setInputData(cutterOutput);
                    const loopOutput = loopExtraction.getOutputData();
                    if (polyData) {
                        polyDataResults.set(id, {
                            points: loopOutput.getPoints().getData(),
                            lines: loopOutput.getLines().getData(),
                            numberOfCells: loopOutput.getLines().getNumberOfCells(),
                        });
                    }
                }
                progressCallback({ progress: (index$1 + 1) / numberOfPlanes });
                updateCacheCallback({ sliceIndex, polyDataResults });
            }
        }
        catch (e) {
            console.warn('Error during processing', e);
        }
        finally {
            surfacesInfo = null;
            plane1.delete();
        }
    },
};
expose(polySegConverters);
