// node_modules/@vue/shared/dist/shared.esm-bundler.js
// @__NO_SIDE_EFFECTS__
function e(e) {
	let t = /* @__PURE__ */ Object.create(null);
	for (let n of e.split(",")) t[n] = 1;
	return (e) => e in t;
}
var t = {}, n = [], r = () => {}, i = () => !1, a = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), o = (e) => e.startsWith("onUpdate:"), s = Object.assign, c = (e, t) => {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}, l = Object.prototype.hasOwnProperty, u = (e, t) => l.call(e, t), d = Array.isArray, f = (e) => x(e) === "[object Map]", p = (e) => x(e) === "[object Set]", m = (e) => x(e) === "[object Date]", h = (e) => typeof e == "function", g = (e) => typeof e == "string", _ = (e) => typeof e == "symbol", v = (e) => typeof e == "object" && !!e, y = (e) => (v(e) || h(e)) && h(e.then) && h(e.catch), b = Object.prototype.toString, x = (e) => b.call(e), S = (e) => x(e).slice(8, -1), C = (e) => x(e) === "[object Object]", w = (e) => g(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, T = /* @__PURE__ */ e(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), ee = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, te = /-\w/g, E = ee((e) => e.replace(te, (e) => e.slice(1).toUpperCase())), ne = /\B([A-Z])/g, D = ee((e) => e.replace(ne, "-$1").toLowerCase()), re = ee((e) => e.charAt(0).toUpperCase() + e.slice(1)), O = ee((e) => e ? `on${re(e)}` : ""), k = (e, t) => !Object.is(e, t), ie = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, ae = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, oe = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, se, ce = () => se ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function le(e) {
	if (d(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = g(r) ? pe(r) : le(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (g(e) || v(e)) return e;
}
var ue = /;(?![^(]*\))/g, de = /:([^]+)/, fe = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
function pe(e) {
	let t = {};
	return e.replace(fe, (e) => e.startsWith("/*") ? "" : e).split(ue).forEach((e) => {
		if (e) {
			let n = e.split(de);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function A(e) {
	let t = "";
	if (g(e)) t = e;
	else if (d(e)) for (let n = 0; n < e.length; n++) {
		let r = A(e[n]);
		r && (t += r + " ");
	}
	else if (v(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
var me = /* @__PURE__ */ e("itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,playsinline,readonly");
function he(e) {
	return !!e || e === "";
}
function ge(e, t, n) {
	if (e.length !== t.length) return !1;
	let r = !0;
	for (let i = 0; r && i < e.length; i++) r = be(e[i], t[i], n);
	return r;
}
function _e(e, t, n) {
	if (e.size !== t.size) return !1;
	let r = Array.from(t), i = new Uint8Array(r.length);
	for (let t of e) {
		let e = -1;
		for (let a = 0; a < r.length; a++) if (!i[a] && be(t, r[a], n)) {
			e = a;
			break;
		}
		if (e < 0) return !1;
		i[e] = 1;
	}
	return !0;
}
function ve(e, t, n) {
	let r = f(e), i = f(t);
	if (r || i || (r = p(e), i = p(t), r || i)) return r && i ? _e(e, t, n) : !1;
	if (Object.keys(e).length !== Object.keys(t).length) return !1;
	for (let r in e) {
		let i = e.hasOwnProperty(r), a = t.hasOwnProperty(r);
		if (i && !a || !i && a || !be(e[r], t[r], n)) return !1;
	}
	return String(e) === String(t);
}
function ye(e, t, n, r) {
	n ||= [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
	let [i, a] = n;
	if (i.has(e) || a.has(t)) return i.get(e) === t && a.get(t) === e;
	i.set(e, t), a.set(t, e);
	let o = r(e, t, n);
	return i.delete(e), a.delete(t), o;
}
function be(e, t, n) {
	if (e === t) return !0;
	let r = m(e), i = m(t);
	return r || i ? r && i ? e.getTime() === t.getTime() : !1 : (r = _(e), i = _(t), r || i ? e === t : (r = d(e), i = d(t), r || i ? r && i ? ye(e, t, n, ge) : !1 : (r = v(e), i = v(t), r || i ? !r || !i ? !1 : ye(e, t, n, ve) : String(e) === String(t))));
}
function xe(e, t) {
	return e.findIndex((e) => be(e, t));
}
var Se = (e) => !!(e && e.__v_isRef === !0), j = (e) => g(e) ? e : e == null ? "" : d(e) || v(e) && (e.toString === b || !h(e.toString)) ? Se(e) ? j(e.value) : JSON.stringify(e, Ce, 2) : String(e), Ce = (e, t) => Se(t) ? Ce(e, t.value) : f(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[we(t, r) + " =>"] = n, e), {}) } : p(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => we(e)) } : _(t) ? we(t) : v(t) && !d(t) && !C(t) ? String(t) : t, we = (e, t = "") => _(e) ? `Symbol(${e.description ?? t})` : e, M, Te = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && M && (M.active ? (this.parent = M, this.index = (M.scopes || (M.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
	}
	get active() {
		return this._active;
	}
	pause() {
		if (this._active) {
			this._isPaused = !0;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].pause();
			}
			for (e = 0, t = this.effects.length; e < t; e++) this.effects[e].pause();
		}
	}
	resume() {
		if (this._active && this._isPaused) {
			this._isPaused = !1;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].resume();
			}
			let n = this.effects.slice();
			for (e = 0, t = n.length; e < t; e++) n[e].resume();
		}
	}
	run(e) {
		if (this._active) {
			let t = M;
			try {
				return M = this, e();
			} finally {
				M = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = M, M = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (M === this) M = this.prevScope;
			else {
				let e = M;
				for (; e;) {
					if (e.prevScope === this) {
						e.prevScope = this.prevScope;
						break;
					}
					e = e.prevScope;
				}
			}
			this.prevScope = void 0;
		}
	}
	stop(e) {
		if (this._active) {
			this._active = !1;
			let t, n;
			for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].stop();
			for (this.effects.length = 0, t = 0, n = this.cleanups.length; t < n; t++) this.cleanups[t]();
			if (this.cleanups.length = 0, this.scopes) {
				let e = this.scopes.slice();
				for (t = 0, n = e.length; t < n; t++) e[t].stop(!0);
				this.scopes.length = 0;
			}
			if (!this.detached && this.parent && !e) {
				let e = this.parent.scopes.pop();
				e && e !== this && (this.parent.scopes[this.index] = e, e.index = this.index);
			}
			this.parent = void 0;
		}
	}
};
function Ee() {
	return M;
}
var N, De = /* @__PURE__ */ new WeakSet(), Oe = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, M && (M.active ? M.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, De.has(this) && (De.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Me(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, Ge(this), Fe(this);
		let e = N, t = Ve;
		N = this, Ve = !0;
		try {
			return this.fn();
		} finally {
			Ie(this), N = e, Ve = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) ze(e);
			this.deps = this.depsTail = void 0, Ge(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? De.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		Le(this) && this.run();
	}
	get dirty() {
		return Le(this);
	}
}, ke = 0, Ae, je;
function Me(e, t = !1) {
	e.flags |= 8, t ? (e.next = je, je = e) : (e.next = Ae, Ae = e);
}
function Ne() {
	ke++;
}
function Pe() {
	if (--ke > 0) return;
	if (je) {
		let e = je;
		for (je = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; Ae;) {
		let t = Ae;
		for (Ae = void 0; t;) {
			let n = t.next;
			if (t.next = void 0, t.flags &= -9, t.flags & 1) try {
				t.trigger();
			} catch (t) {
				e ||= t;
			}
			t = n;
		}
	}
	if (e) throw e;
}
function Fe(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Ie(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), ze(r), Be(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function Le(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (Re(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function Re(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ke) || (e.globalVersion = Ke, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Le(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = N, r = Ve;
	N = e, Ve = !0;
	try {
		Fe(e);
		let n = e.fn(e._value);
		(t.version === 0 || k(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		N = n, Ve = r, Ie(e), e.flags &= -3;
	}
}
function ze(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) ze(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function Be(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var Ve = !0, He = [];
function Ue() {
	He.push(Ve), Ve = !1;
}
function We() {
	let e = He.pop();
	Ve = e === void 0 || e;
}
function Ge(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = N;
		N = void 0;
		try {
			t();
		} finally {
			N = e;
		}
	}
}
var Ke = 0, qe = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, Je = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!N || !Ve || N === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== N) t = this.activeLink = new qe(N, this), N.deps ? (t.prevDep = N.depsTail, N.depsTail.nextDep = t, N.depsTail = t) : N.deps = N.depsTail = t, Ye(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = N.depsTail, t.nextDep = void 0, N.depsTail.nextDep = t, N.depsTail = t, N.deps === t && (N.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, Ke++, this.notify(e);
	}
	notify(e) {
		Ne();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			Pe();
		}
	}
};
function Ye(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Ye(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var Xe = /* @__PURE__ */ new WeakMap(), Ze = /* @__PURE__ */ Symbol(""), Qe = /* @__PURE__ */ Symbol(""), $e = /* @__PURE__ */ Symbol("");
function P(e, t, n) {
	if (Ve && N) {
		let t = Xe.get(e);
		t || Xe.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new Je()), r.map = t, r.key = n), r.track();
	}
}
function et(e, t, n, r, i, a) {
	let o = Xe.get(e);
	if (!o) {
		Ke++;
		return;
	}
	let s = (e) => {
		e && e.trigger();
	};
	if (Ne(), t === "clear") o.forEach(s);
	else {
		let i = d(e), a = i && w(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === $e || !_(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get($e)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(Ze)), f(e) && s(o.get(Qe)));
				break;
			case "delete":
				i || (s(o.get(Ze)), f(e) && s(o.get(Qe)));
				break;
			case "set": f(e) && s(o.get(Ze));
		}
	}
	Pe();
}
function tt(e) {
	let t = /* @__PURE__ */ F(e);
	return t === e || (P(t, "iterate", $e), /* @__PURE__ */ Vt(e)) ? t : /* @__PURE__ */ Bt(e) ? /* @__PURE__ */ zt(e) ? t.map((e) => Gt(Wt(e))) : t.map(Gt) : t.map(Wt);
}
function nt(e) {
	return P(e = /* @__PURE__ */ F(e), "iterate", $e), e;
}
function rt(e, t) {
	return /* @__PURE__ */ Bt(e) ? Gt(/* @__PURE__ */ zt(e) ? Wt(t) : t) : Wt(t);
}
var it = {
	__proto__: null,
	[Symbol.iterator]() {
		return at(this, Symbol.iterator, (e) => rt(this, e));
	},
	concat(...e) {
		return tt(this).concat(...e.map((e) => d(e) ? tt(e) : e));
	},
	entries() {
		return at(this, "entries", (e) => (e[1] = rt(this, e[1]), e));
	},
	every(e, t) {
		return ct(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return ct(this, "filter", e, t, (e) => e.map((e) => rt(this, e)), arguments);
	},
	find(e, t) {
		return ct(this, "find", e, t, (e) => rt(this, e), arguments);
	},
	findIndex(e, t) {
		return ct(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return ct(this, "findLast", e, t, (e) => rt(this, e), arguments);
	},
	findLastIndex(e, t) {
		return ct(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return ct(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return ut(this, "includes", e);
	},
	indexOf(...e) {
		return ut(this, "indexOf", e);
	},
	join(e) {
		return tt(this).join(e);
	},
	lastIndexOf(...e) {
		return ut(this, "lastIndexOf", e);
	},
	map(e, t) {
		return ct(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return dt(this, "pop");
	},
	push(...e) {
		return dt(this, "push", e);
	},
	reduce(e, ...t) {
		return lt(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return lt(this, "reduceRight", e, t);
	},
	shift() {
		return dt(this, "shift");
	},
	some(e, t) {
		return ct(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return dt(this, "splice", e);
	},
	toReversed() {
		return tt(this).toReversed();
	},
	toSorted(e) {
		return tt(this).toSorted(e);
	},
	toSpliced(...e) {
		return tt(this).toSpliced(...e);
	},
	unshift(...e) {
		return dt(this, "unshift", e);
	},
	values() {
		return at(this, "values", (e) => rt(this, e));
	}
};
function at(e, t, n) {
	let r = nt(e), i = r[t], a = i.call(r);
	if (r !== e && !/* @__PURE__ */ Vt(e)) {
		if (a[Symbol.toStringTag] === "Array Iterator") {
			let e = Object.create(Object.getPrototypeOf(a));
			return e.next = () => ot(a.next(), n), i !== st[t] && Object.defineProperties(e, {
				return: { get() {
					let e = a.return;
					return typeof e == "function" ? e.bind(a) : e;
				} },
				throw: { get() {
					let e = a.throw;
					return typeof e == "function" ? e.bind(a) : e;
				} }
			}), e;
		}
		a._next = a.next, a.next = () => ot(a._next(), n);
	}
	return a;
}
function ot(e, t) {
	return e.done || (e.value = t(e.value)), e;
}
var st = Array.prototype;
function ct(e, t, n, r, i, a) {
	let o = nt(e), s = o !== e && !/* @__PURE__ */ Vt(e), c = o[t];
	if (c !== st[t]) {
		let t = c.apply(e, a);
		return s ? Wt(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, rt(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function lt(e, t, n, r) {
	let i = nt(e), a = i !== e && !/* @__PURE__ */ Vt(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = rt(e, t)), n.call(this, t, rt(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? rt(e, c) : c;
}
function ut(e, t, n) {
	let r = /* @__PURE__ */ F(e);
	P(r, "iterate", $e);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Ht(n[0]) ? (n[0] = /* @__PURE__ */ F(n[0]), r[t](...n)) : i;
}
function dt(e, t, n = []) {
	Ue(), Ne();
	let r = (/* @__PURE__ */ F(e))[t].apply(e, n);
	return Pe(), We(), r;
}
var ft = /* @__PURE__ */ e("__proto__,__v_isRef,__isVue"), pt = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(_));
function mt(e) {
	_(e) || (e = String(e));
	let t = /* @__PURE__ */ F(this);
	return P(t, "has", e), t.hasOwnProperty(e);
}
var ht = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Nt : Mt : i ? jt : At).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = d(e);
		if (!r) {
			let e;
			if (a && (e = it[t])) return e;
			if (t === "hasOwnProperty") return mt;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ I(e) ? e : n);
		if ((_(t) ? pt.has(t) : ft(t)) || (r || P(e, "get", t), i)) return o;
		if (/* @__PURE__ */ I(o)) {
			let e = a && w(t) ? o : o.value;
			return r && v(e) ? /* @__PURE__ */ Lt(e) : e;
		}
		return v(o) ? r ? /* @__PURE__ */ Lt(o) : /* @__PURE__ */ Ft(o) : o;
	}
}, gt = class extends ht {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = d(e) && w(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ Bt(i);
			if (!/* @__PURE__ */ Vt(n) && !/* @__PURE__ */ Bt(n) && (i = /* @__PURE__ */ F(i), n = /* @__PURE__ */ F(n)), !a && /* @__PURE__ */ I(i) && !/* @__PURE__ */ I(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : u(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ I(e) ? e : r);
		return e === /* @__PURE__ */ F(r) && s && (o ? k(n, i) && et(e, "set", t, n, i) : et(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = u(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && et(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return _(t) && pt.has(t) || P(e, "has", t), n;
	}
	ownKeys(e) {
		return P(e, "iterate", d(e) ? "length" : Ze), Reflect.ownKeys(e);
	}
}, _t = class extends ht {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, vt = /* @__PURE__ */ new gt(), yt = /* @__PURE__ */ new _t(), bt = /* @__PURE__ */ new gt(!0), xt = (e) => e, St = (e) => Reflect.getPrototypeOf(e);
function Ct(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ F(i), o = f(a), c = e === "entries" || e === Symbol.iterator && o, l = e === "keys" && o, u = i[e](...r), d = n ? xt : t ? Gt : Wt;
		return !t && P(a, "iterate", l ? Qe : Ze), s(Object.create(u), { next() {
			let { value: e, done: t } = u.next();
			return t ? {
				value: e,
				done: t
			} : {
				value: c ? [d(e[0]), d(e[1])] : d(e),
				done: t
			};
		} });
	};
}
function wt(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function Tt(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ F(r), a = /* @__PURE__ */ F(n);
			e || (k(n, a) && P(i, "get", n), P(i, "get", a));
			let { has: o } = St(i), s = t ? xt : e ? Gt : Wt;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && P(/* @__PURE__ */ F(t), "iterate", Ze), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ F(n), i = /* @__PURE__ */ F(t);
			return e || (k(t, i) && P(r, "has", t), P(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ F(a), s = t ? xt : e ? Gt : Wt;
			return !e && P(o, "iterate", Ze), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return s(n, e ? {
		add: wt("add"),
		set: wt("set"),
		delete: wt("delete"),
		clear: wt("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ F(this), r = St(n), i = /* @__PURE__ */ F(e), a = !t && !/* @__PURE__ */ Vt(e) && !/* @__PURE__ */ Bt(e) ? i : e;
			return r.has.call(n, a) || k(e, a) && r.has.call(n, e) || k(i, a) && r.has.call(n, i) || (n.add(a), et(n, "add", a, a)), this;
		},
		set(e, n) {
			t || /* @__PURE__ */ Vt(n) || /* @__PURE__ */ Bt(n) || (n = /* @__PURE__ */ F(n));
			let r = /* @__PURE__ */ F(this), { has: i, get: a } = St(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ F(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? k(n, s) && et(r, "set", e, n, s) : et(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ F(this), { has: n, get: r } = St(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ F(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && et(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ F(this), t = e.size !== 0, n = e.clear();
			return t && et(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = Ct(r, e, t);
	}), n;
}
function Et(e, t) {
	let n = Tt(e, t);
	return (r, i, a) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_isShallow" ? t : i === "__v_raw" ? r : Reflect.get(u(n, i) && i in r ? n : r, i, a);
}
var Dt = { get: /* @__PURE__ */ Et(!1, !1) }, Ot = { get: /* @__PURE__ */ Et(!1, !0) }, kt = { get: /* @__PURE__ */ Et(!0, !1) }, At = /* @__PURE__ */ new WeakMap(), jt = /* @__PURE__ */ new WeakMap(), Mt = /* @__PURE__ */ new WeakMap(), Nt = /* @__PURE__ */ new WeakMap();
function Pt(e) {
	switch (e) {
		case "Object":
		case "Array": return 1;
		case "Map":
		case "Set":
		case "WeakMap":
		case "WeakSet": return 2;
		default: return 0;
	}
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
	return /* @__PURE__ */ Bt(e) ? e : Rt(e, !1, vt, Dt, At);
}
// @__NO_SIDE_EFFECTS__
function It(e) {
	return Rt(e, !1, bt, Ot, jt);
}
// @__NO_SIDE_EFFECTS__
function Lt(e) {
	return Rt(e, !0, yt, kt, Mt);
}
function Rt(e, t, n, r, i) {
	if (!v(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = Pt(S(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function zt(e) {
	return /* @__PURE__ */ Bt(e) ? /* @__PURE__ */ zt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Bt(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Vt(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Ht(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function F(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ F(t) : e;
}
function Ut(e) {
	return !u(e, "__v_skip") && Object.isExtensible(e) && ae(e, "__v_skip", !0), e;
}
var Wt = (e) => v(e) ? /* @__PURE__ */ Ft(e) : e, Gt = (e) => v(e) ? /* @__PURE__ */ Lt(e) : e;
// @__NO_SIDE_EFFECTS__
function I(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function L(e) {
	return qt(e, !1);
}
// @__NO_SIDE_EFFECTS__
function Kt(e) {
	return qt(e, !0);
}
function qt(e, t) {
	return /* @__PURE__ */ I(e) ? e : new Jt(e, t);
}
var Jt = class {
	constructor(e, t) {
		this.dep = new Je(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ F(e), this._value = t ? e : Wt(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ Vt(e) || /* @__PURE__ */ Bt(e);
		e = n ? e : /* @__PURE__ */ F(e), k(e, t) && (this._rawValue = e, this._value = n ? e : Wt(e), this.dep.trigger());
	}
};
function R(e) {
	return /* @__PURE__ */ I(e) ? e.value : e;
}
var Yt = {
	get: (e, t, n) => t === "__v_raw" ? e : R(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ I(i) && !/* @__PURE__ */ I(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Xt(e) {
	return /* @__PURE__ */ zt(e) ? e : new Proxy(e, Yt);
}
var Zt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new Je(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ke - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && N !== this) return Me(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return Re(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter && this.setter(e);
	}
};
// @__NO_SIDE_EFFECTS__
function Qt(e, t, n = !1) {
	let r, i;
	return h(e) ? r = e : (r = e.get, i = e.set), new Zt(r, i, n);
}
var $t = {}, en = /* @__PURE__ */ new WeakMap(), tn = void 0;
function nn(e, t = !1, n = tn) {
	if (n) {
		let t = en.get(n);
		t || en.set(n, t = []), t.push(e);
	}
}
function rn(e, n, i = t) {
	let { immediate: a, deep: o, once: s, scheduler: l, augmentJob: u, call: f } = i, p = (e) => o ? e : /* @__PURE__ */ Vt(e) || o === !1 || o === 0 ? an(e, 1) : an(e), m, g, _, v, y = !1, b = !1;
	if (/* @__PURE__ */ I(e) ? (g = () => e.value, y = /* @__PURE__ */ Vt(e)) : /* @__PURE__ */ zt(e) ? (g = () => p(e), y = !0) : d(e) ? (b = !0, y = e.some((e) => /* @__PURE__ */ zt(e) || /* @__PURE__ */ Vt(e)), g = () => e.map((e) => {
		if (/* @__PURE__ */ I(e)) return e.value;
		if (/* @__PURE__ */ zt(e)) return p(e);
		if (h(e)) return f ? f(e, 2) : e();
	})) : g = h(e) ? n ? f ? () => f(e, 2) : e : () => {
		if (_) {
			Ue();
			try {
				_();
			} finally {
				We();
			}
		}
		let t = tn;
		tn = m;
		try {
			return f ? f(e, 3, [v]) : e(v);
		} finally {
			tn = t;
		}
	} : r, n && o) {
		let e = g, t = o === !0 ? Infinity : o;
		g = () => an(e(), t);
	}
	let x = Ee(), S = () => {
		m.stop(), x && x.active && c(x.effects, m);
	};
	if (s && n) {
		let e = n;
		n = (...t) => {
			try {
				return e(...t);
			} finally {
				S();
			}
		};
	}
	let C = b ? Array(e.length).fill($t) : $t, w = (e) => {
		if (m.flags & 1 && (m.dirty || e)) {
			if (n) {
				let t = m.run();
				if (e || o || y || (b ? t.some((e, t) => k(e, C[t])) : k(t, C))) {
					let e = tn;
					Ue();
					try {
						_ && _(), tn = m;
						let e = [
							t,
							C === $t ? void 0 : b && C[0] === $t ? [] : C,
							v
						];
						C = t, f ? f(n, 3, e) : n(...e);
					} finally {
						tn = e, We();
					}
				}
			} else m.run();
		}
	};
	return u && u(w), m = new Oe(g), m.scheduler = l ? () => l(w, !1) : w, v = (e) => nn(e, !1, m), _ = m.onStop = () => {
		let e = en.get(m);
		if (e) {
			if (f) f(e, 4);
			else for (let t of e) t();
			en.delete(m);
		}
	}, n ? a ? w(!0) : C = m.run() : l ? l(w.bind(null, !0), !0) : m.run(), S.pause = m.pause.bind(m), S.resume = m.resume.bind(m), S.stop = S, S;
}
function an(e, t = Infinity, n) {
	if (t <= 0 || !v(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ I(e)) an(e.value, t, n);
	else if (d(e)) for (let r = 0; r < e.length; r++) an(e[r], t, n);
	else if (p(e) || f(e)) e.forEach((e) => {
		an(e, t, n);
	});
	else if (C(e)) {
		for (let r in e) an(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && an(e[r], t, n);
	}
	return e;
}
// node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
function on(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		cn(e, t, n);
	}
}
function sn(e, t, n, r) {
	if (h(e)) {
		let i = on(e, t, n, r);
		return i && y(i) && i.catch((e) => {
			cn(e, t, n);
		}), i;
	}
	if (d(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(sn(e[a], t, n, r));
		return i;
	}
}
function cn(e, n, r, i = !0) {
	let a = n ? n.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: s } = n && n.appContext.config || t;
	if (n) {
		let t = n.parent, i = n.proxy, a = `https://vuejs.org/error-reference/#runtime-${r}`;
		for (; t;) {
			let n = t.ec;
			if (n) {
				for (let t = 0; t < n.length; t++) if (n[t](e, i, a) === !1) return;
			}
			t = t.parent;
		}
		if (o) {
			Ue(), on(o, null, 10, [
				e,
				i,
				a
			]), We();
			return;
		}
	}
	ln(e, r, a, i, s);
}
function ln(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var z = [], un = -1, dn = [], fn = null, pn = 0, mn = /* @__PURE__ */ Promise.resolve(), hn = null;
function gn(e) {
	let t = hn || mn;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function _n(e) {
	let t = un + 1, n = z.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = z[r], a = Tn(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function vn(e) {
	if (!(e.flags & 1)) {
		let t = Tn(e), n = z[z.length - 1];
		!n || !(e.flags & 2) && t >= Tn(n) ? z.push(e) : z.splice(_n(t), 0, e), e.flags |= 1, yn();
	}
}
function yn() {
	hn ||= mn.then(En);
}
function bn(e) {
	if (!d(e)) fn && e.id === -1 ? fn.splice(pn + 1, 0, e) : e.flags & 1 || (dn.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) dn.push(e[t]);
	yn();
}
function xn(e, t, n, r = un + 1) {
	for (; r < z.length; r++) {
		let n = z[r];
		if (n && n.flags & 2) {
			if (e && n.id !== e.uid || t !== void 0 && !(n.id >= t)) continue;
			z.splice(r, 1), r = e ? r - 1 : un, n.flags & 4 && (n.flags &= -2), n(), n.flags & 4 || (n.flags &= -2);
		}
	}
}
function Sn(e, t, n = 0) {
	if (dn.length) {
		let e = dn, r = 0;
		if (t) {
			e = [];
			for (let i = 0; i < dn.length; i++) {
				let a = dn[i];
				(a.i === void 0 ? t.has(a) : !a.i || a.i.uid < n) ? dn[r++] = a : e.push(a);
			}
		}
		let i = [...new Set(e)].sort((e, t) => Tn(e) - Tn(t));
		if (dn.length = r, fn) {
			for (let e = 0; e < i.length; e++) fn.push(i[e]);
			return;
		}
		for (fn = i, pn = 0; pn < fn.length; pn++) {
			let e = fn[pn];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		fn = null, pn = 0;
	}
}
var Cn = !1;
function wn(e, t) {
	if (Cn) {
		e();
		return;
	}
	let n = t === void 0 ? void 0 : new Set(dn);
	e(), Cn = !0;
	try {
		xn(void 0, t), Sn(void 0, n, t);
	} finally {
		Cn = !1;
	}
}
var Tn = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function En(e) {
	try {
		for (un = 0; un < z.length; un++) {
			let e = z[un];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), on(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; un < z.length; un++) {
			let e = z[un];
			e && (e.flags &= -2);
		}
		un = -1, z.length = 0, Sn(e), hn = null, (z.length || dn.length) && En(e);
	}
}
var B = null, Dn = null;
function On(e) {
	let t = B;
	return B = e, Dn = e && e.type.__scopeId || null, t;
}
function V(e, t = B, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && di(-1);
		let i = On(t), a = si.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = si.length; e > a; e--) li();
			On(i), r._d && di(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function kn(e, n) {
	if (B === null) return e;
	let r = Ui(B), i = e.dirs ||= [];
	for (let e = 0; e < n.length; e++) {
		let [a, o, s, c = t] = n[e];
		a && (h(a) && (a = {
			mounted: a,
			updated: a
		}), a.deep && an(o), i.push({
			dir: a,
			instance: r,
			value: o,
			oldValue: void 0,
			arg: s,
			modifiers: c
		}));
	}
	return e;
}
function An(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (Ue(), sn(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), We());
	}
}
function jn(e, t) {
	if (ki) {
		let n = ki.provides, r = ki.parent && ki.parent.provides;
		r === n && (n = ki.provides = Object.create(r)), n[e] = t;
	}
}
function Mn(e, t, n = !1) {
	let r = Ai();
	if (r || hr) {
		let i = hr ? hr._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && h(t) ? t.call(r && r.proxy) : t;
	}
}
var Nn = /* @__PURE__ */ Symbol.for("v-scx"), Pn = () => Mn(Nn);
function Fn(e, t, n) {
	return In(e, t, n);
}
function In(e, n, i = t) {
	let { immediate: a, deep: o, flush: c, once: l } = i, u = s({}, i), d = n && a || !n && c !== "post", f;
	if (Ii) {
		if (c === "sync") {
			let e = Pn();
			f = e.__watcherHandles ||= [];
		} else if (!d) {
			let e = () => {};
			return e.stop = r, e.resume = r, e.pause = r, e;
		}
	}
	let p = ki;
	u.call = (e, t, n) => sn(e, p, t, n);
	let m = !1;
	c === "post" ? u.scheduler = (e) => {
		e.i = p, Gr(e, p && p.suspense);
	} : c !== "sync" && (m = !0, u.scheduler = (e, t) => {
		t ? e() : vn(e);
	}), u.augmentJob = (e) => {
		n && (e.flags |= 4), m && (e.flags |= 2, p && (e.id = p.uid, e.i = p));
	};
	let h = rn(e, n, u);
	return Ii && (f ? f.push(h) : d && h()), h;
}
var Ln = /* @__PURE__ */ Symbol("_vte"), Rn = (e) => e.__isTeleport, zn = /* @__PURE__ */ Symbol("_leaveCb");
function Bn(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== ai) {
			t = n;
			break;
		}
	}
	return t;
}
function Vn(e) {
	if (!Xn(e)) return Rn(e.type) && e.children ? Bn(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && h(n.default)) return n.default();
	}
}
function Hn(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Hn(Rn(n.type) && Vn(n) || n, t);
	} else if (e.shapeFlag & 128) e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback);
	else if (e.transition = t, e.type === U && d(e.children)) {
		let n = xr(e.children, !1);
		n && Hn(n, t);
	}
}
function Un(e) {
	if (e.component) return Un(e.component.subTree);
	if (e.type === U) {
		let t = d(e.children) && xr(e.children, !1);
		return t ? Un(t) : void 0;
	}
	if (e.type !== ai) return e;
}
function Wn(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Gn(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Kn = /* @__PURE__ */ new WeakMap();
function qn(e, n, r, a, o = !1) {
	if (d(e)) {
		e.forEach((e, t) => qn(e, n && (d(n) ? n[t] : n), r, a, o));
		return;
	}
	if (Yn(a) && !o) {
		a.shapeFlag & 512 && a.type.__asyncResolved && a.component.subTree.component && qn(e, n, r, a.component.subTree);
		return;
	}
	let s = a.shapeFlag & 4 ? Ui(a.component) : a.el, l = o ? null : s, { i: f, r: p } = e, m = n && n.r, _ = f.refs === t ? f.refs = {} : f.refs, v = f.setupState, y = /* @__PURE__ */ F(v), b = v === t ? i : (e) => !Gn(_, e) && u(y, e), x = (e, t) => !(t && Gn(_, t));
	if (m != null && m !== p) {
		if (Jn(n), g(m)) _[m] = null, b(m) && (v[m] = null);
		else if (/* @__PURE__ */ I(m)) {
			let e = n;
			x(m, e.k) && (m.value = null), e.k && (_[e.k] = null);
		}
	}
	if (h(p)) on(p, f, 12, [l, _]);
	else {
		let t = g(p), n = /* @__PURE__ */ I(p);
		if (t || n) {
			let i = () => {
				if (e.f) {
					let n = t ? b(p) ? v[p] : _[p] : x(p) || !e.k ? p.value : _[e.k];
					if (o) d(n) && c(n, s);
					else if (d(n)) n.includes(s) || n.push(s);
					else if (t) _[p] = [s], b(p) && (v[p] = _[p]);
					else {
						let t = [s];
						x(p, e.k) && (p.value = t), e.k && (_[e.k] = t);
					}
				} else t ? (_[p] = l, b(p) && (v[p] = l)) : n && (x(p, e.k) && (p.value = l), e.k && (_[e.k] = l));
			};
			if (l) {
				let t = () => {
					i(), Kn.delete(e);
				};
				t.id = -1, Kn.set(e, t), Gr(t, r);
			} else Jn(e), i();
		}
	}
}
function Jn(e) {
	let t = Kn.get(e);
	t && (t.flags |= 8, Kn.delete(e));
}
ce().requestIdleCallback, ce().cancelIdleCallback;
var Yn = (e) => !!e.type.__asyncLoader, Xn = (e) => e.type.__isKeepAlive;
function Zn(e, t, n = ki, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			Ue();
			let i = Ni(n), a = sn(t, n, e, r);
			return i(), We(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var Qn = (e) => (t, n = ki) => {
	Ii && e !== "sp" || Zn(e, (...e) => t(...e), n);
}, $n = Qn("m"), er = Qn("bum"), tr = "components", nr = /* @__PURE__ */ Symbol.for("v-ndc");
function rr(e) {
	return g(e) ? ir(tr, e, !1) || e : e || nr;
}
function ir(e, t, n = !0, r = !1) {
	let i = B || ki;
	if (i) {
		let n = i.type;
		if (e === tr) {
			let e = Wi(n, !1);
			if (e && (e === t || e === E(t) || e === re(E(t)))) return n;
		}
		let a = ar(i[e] || n[e], t) || ar(i.appContext[e], t);
		return !a && r ? n : a;
	}
}
function ar(e, t) {
	return e && (e[t] || e[E(t)] || e[re(E(t))]);
}
function H(e, t, n, r) {
	let i, a = n && n[r], o = d(e);
	if (o || g(e)) {
		let n = o && /* @__PURE__ */ zt(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ Vt(e), s = /* @__PURE__ */ Bt(e), e = nt(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Gt(Wt(e[n])) : Wt(e[n]) : e[n], n, void 0, a && a[n]);
	} else if (typeof e == "number") {
		if (!Number.isInteger(e) || e < 0) i = [];
		else {
			i = Array(e);
			for (let n = 0; n < e; n++) i[n] = t(n + 1, n, void 0, a && a[n]);
		}
	} else if (v(e)) {
		if (e[Symbol.iterator]) i = Array.from(e, (e, n) => t(e, n, void 0, a && a[n]));
		else {
			let n = Object.keys(e);
			i = Array(n.length);
			for (let r = 0, o = n.length; r < o; r++) {
				let o = n[r];
				i[r] = t(e[o], o, r, a && a[r]);
			}
		}
	} else i = [];
	return n && (n[r] = i), i;
}
function or(e, t, n, r, i, a) {
	if (n ??= {}, B.ce || B.parent && Yn(B.parent) && B.parent.ce) {
		let e = a != null && n.key == null ? s({}, n, { key: a }) : n, i = Object.keys(e).length > 0;
		return t !== "default" && (e.name = t), W(), K(U, null, [J("slot", e, r && r())], i ? -2 : 64);
	}
	let o = e[t];
	o && o._c && (o._d = !1);
	let c = si.length;
	W();
	let l;
	try {
		let i = o && sr(o(n)), s = n.key || a || i && i.key;
		l = K(U, { key: (s && !_(s) ? s : `_${t}`) + (!i && r ? "_fb" : "") }, i || (r ? r() : []), i && e._ === 1 ? 64 : -2);
	} catch (e) {
		for (let e = si.length; e > c; e--) li();
		throw e;
	} finally {
		o && o._c && (o._d = !0);
	}
	return !i && l.scopeId && (l.slotScopeIds = [l.scopeId + "-s"]), l;
}
function sr(e) {
	return e.some((e) => !pi(e) || !(e.type === ai || e.type === U && !sr(e.children))) ? e : null;
}
var cr = (e) => e ? Fi(e) ? Ui(e) : cr(e.parent) : null, lr = /* @__PURE__ */ s(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => cr(e.parent),
	$root: (e) => cr(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => e.type,
	$forceUpdate: (e) => e.f ||= () => {
		vn(e.update);
	},
	$nextTick: (e) => e.n ||= gn.bind(e.proxy),
	$watch: (e) => r
}), ur = (e, n) => e !== t && !e.__isScriptSetup && u(e, n), dr = {
	get({ _: e }, n) {
		if (n === "__v_skip") return !0;
		let { ctx: r, setupState: i, data: a, props: o, accessCache: s, type: c, appContext: l } = e;
		if (n[0] !== "$") {
			let e = s[n];
			if (e !== void 0) switch (e) {
				case 1: return i[n];
				case 2: return a[n];
				case 4: return r[n];
				case 3: return o[n];
			}
			else if (ur(i, n)) return s[n] = 1, i[n];
			else if (u(o, n)) return s[n] = 3, o[n];
			else if (r !== t && u(r, n)) return s[n] = 4, r[n];
			else s[n] = 0;
		}
		let d = lr[n], f, p;
		if (d) return n === "$attrs" && P(e.attrs, "get", ""), d(e);
		if ((f = c.__cssModules) && (f = f[n])) return f;
		if (r !== t && u(r, n)) return s[n] = 4, r[n];
		if (p = l.config.globalProperties, u(p, n)) return p[n];
	},
	set({ _: e }, t, n) {
		let { data: r, setupState: i, ctx: a } = e;
		return ur(i, t) ? (i[t] = n, !0) : u(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (a[t] = n, !0);
	},
	has({ _: { data: e, setupState: t, accessCache: n, ctx: r, appContext: i, props: a, type: o } }, s) {
		let c;
		return !!(n[s] || ur(t, s) || u(a, s) || u(r, s) || u(lr, s) || u(i.config.globalProperties, s) || (c = o.__cssModules) && c[s]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? u(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function fr() {
	return {
		app: null,
		config: {
			isNativeTag: i,
			performance: !1,
			globalProperties: {},
			optionMergeStrategies: {},
			errorHandler: void 0,
			warnHandler: void 0,
			compilerOptions: {}
		},
		mixins: [],
		components: {},
		directives: {},
		provides: /* @__PURE__ */ Object.create(null),
		optionsCache: /* @__PURE__ */ new WeakMap(),
		propsCache: /* @__PURE__ */ new WeakMap(),
		emitsCache: /* @__PURE__ */ new WeakMap()
	};
}
var pr = 0;
function mr(e, t) {
	return function(n, r = null) {
		h(n) || (n = s({}, n)), r != null && !v(r) && (r = null);
		let i = fr(), a = /* @__PURE__ */ new WeakSet(), o = [], c = !1, l = i.app = {
			_uid: pr++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: Ki,
			get config() {
				return i.config;
			},
			set config(e) {},
			use(e, ...t) {
				return a.has(e) || (e && h(e.install) ? (a.add(e), e.install(l, ...t)) : h(e) && (a.add(e), e(l, ...t))), l;
			},
			mixin(e) {
				return l;
			},
			component(e, t) {
				return t ? (i.components[e] = t, l) : i.components[e];
			},
			directive(e, t) {
				return t ? (i.directives[e] = t, l) : i.directives[e];
			},
			mount(a, o, s) {
				if (!c) {
					let u = l._ceVNode || J(n, r);
					return u.appContext = i, s === !0 ? s = "svg" : s === !1 && (s = void 0), o && t ? t(u, a) : e(u, a, s), c = !0, l._container = a, a.__vue_app__ = l, Ui(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				c && (sn(o, l._instance, 16), e(null, l._container), delete l._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, l;
			},
			runWithContext(e) {
				let t = hr;
				hr = l;
				try {
					return e();
				} finally {
					hr = t;
				}
			}
		};
		return l;
	};
}
var hr = null, gr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${E(t)}Modifiers`] || e[`${D(t)}Modifiers`];
function _r(e, n, ...r) {
	if (e.isUnmounted) return;
	let i = e.vnode.props || t, a = r, o = n.startsWith("update:"), s = o && gr(i, n.slice(7));
	s && (s.trim && (a = r.map((e) => g(e) ? e.trim() : e)), s.number && (a = a.map(oe)));
	let c, l = i[c = O(n)] || i[c = O(E(n))];
	!l && o && (l = i[c = O(D(n))]), l && sn(l, e, 6, a);
	let u = i[c + "Once"];
	if (u) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[c]) return;
		e.emitted[c] = !0, sn(u, e, 6, a);
	}
}
function vr(e, t, n = !1) {
	let r = t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {};
	return a ? (d(a) ? a.forEach((e) => o[e] = null) : s(o, a), v(e) && r.set(e, o), o) : (v(e) && r.set(e, null), null);
}
function yr(e, t) {
	return !e || !a(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), u(e, t[0].toLowerCase() + t.slice(1)) || u(e, D(t)) || u(e, t));
}
function br(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: s, attrs: c, emit: l, render: u, renderCache: d, props: f, data: p, setupState: m, ctx: h, inheritAttrs: g } = e, _ = On(e), v, y;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			v = bi(u.call(t, e, d, f, m, p, h)), y = c;
		} else {
			let e = t;
			v = bi(e.length > 1 ? e(f, {
				attrs: c,
				slots: s,
				emit: l
			}) : e(f, null)), y = t.props ? c : Sr(c);
		}
	} catch (t) {
		si.length = 0, cn(t, e, 1), v = J(ai);
	}
	let b = v;
	if (y && g !== !1) {
		let e = Object.keys(y), { shapeFlag: t } = b;
		e.length && t & 7 && (a && e.some(o) && (y = Cr(y, a)), b = yi(b, y, !1, !0));
	}
	return n.dirs && (b = yi(b, null, !1, !0), b.dirs = b.dirs ? b.dirs.concat(n.dirs) : n.dirs), n.transition && Hn(Rn(b.type) && Vn(b) || b, n.transition), v = b, On(_), v;
}
function xr(e, t = !0) {
	let n;
	for (let t = 0; t < e.length; t++) {
		let r = e[t];
		if (pi(r)) {
			if (r.type !== ai || r.children === "v-if") {
				if (n) return;
				n = r;
			}
		} else return;
	}
	return n;
}
var Sr = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || a(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Cr = (e, t) => {
	let n = {};
	for (let r in e) o(r) && r.slice(9) in t || (n[r] = e[r]);
	return n;
};
function wr(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Tr(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Er(o, r, n) && !yr(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Tr(r, o, l) : !!o;
	return !1;
}
function Tr(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (!u(e, a) || Er(t, e, a) && !yr(n, a)) return !0;
	}
	return !1;
}
function Er(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && v(r) && v(i) ? !be(r, i) : r !== i;
}
function Dr({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var Or = {}, kr = () => Object.create(Or), Ar = (e) => Object.getPrototypeOf(e) === Or;
function jr(e, t, n, r = !1) {
	let i = {}, a = kr();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), Nr(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ It(i) : e.type.props ? i : a, e.attrs = a;
}
function Mr(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ F(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (yr(e.emitsOptions, o)) continue;
				let d = t[o];
				if (c) {
					if (u(a, o)) d !== a[o] && (a[o] = d, l = !0);
					else {
						let t = E(o);
						i[t] = Pr(c, s, t, d, e, !1);
					}
				} else d !== a[o] && (a[o] = d, l = !0);
			}
		}
	} else {
		Nr(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) t && (u(t, a) || (r = D(a)) !== a && u(t, r)) || (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = Pr(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) t && u(t, e) || (delete a[e], l = !0);
	}
	l && et(e.attrs, "set", "");
}
function Nr(e, n, r, i) {
	let [a, o] = e.propsOptions, s = !1, c;
	if (n) for (let t in n) {
		if (T(t)) continue;
		let l = n[t], d;
		a && u(a, d = E(t)) ? !o || !o.includes(d) ? r[d] = l : (c ||= {})[d] = l : yr(e.emitsOptions, t) || t in i && l === i[t] || (i[t] = l, s = !0);
	}
	if (o) {
		let n = /* @__PURE__ */ F(r), i = c || t;
		for (let t = 0; t < o.length; t++) {
			let s = o[t];
			r[s] = Pr(a, n, s, i[s], e, !u(i, s));
		}
	}
	return s;
}
function Pr(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = u(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && h(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = Ni(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === D(n)) && (r = !0));
	}
	return r;
}
function Fr(e, r, i = !1) {
	let a = r.propsCache, o = a.get(e);
	if (o) return o;
	let c = e.props, l = {}, f = [];
	if (!c) return v(e) && a.set(e, n), n;
	if (d(c)) for (let e = 0; e < c.length; e++) {
		let n = E(c[e]);
		Ir(n) && (l[n] = t);
	}
	else if (c) for (let e in c) {
		let t = E(e);
		if (Ir(t)) {
			let n = c[e], r = l[t] = d(n) || h(n) ? { type: n } : s({}, n), i = r.type, a = !1, o = !0;
			if (d(i)) for (let e = 0; e < i.length; ++e) {
				let t = i[e], n = h(t) && t.name;
				if (n === "Boolean") {
					a = !0;
					break;
				}
				n === "String" && (o = !1);
			}
			else a = h(i) && i.name === "Boolean";
			r[0] = a, r[1] = o, (a || u(r, "default")) && f.push(t);
		}
	}
	let p = [l, f];
	return v(e) && a.set(e, p), p;
}
function Ir(e) {
	return e[0] !== "$" && !T(e);
}
var Lr = (e) => e === "_" || e === "_ctx" || e === "$stable", Rr = (e) => d(e) ? e.map(bi) : [bi(e)], zr = (e, t, n) => {
	if (t._n) return t;
	let r = V((...e) => Rr(t(...e)), n);
	return r._c = !1, r;
}, Br = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (Lr(n)) continue;
		let i = e[n];
		if (h(i)) t[n] = zr(n, i, r);
		else if (i != null) {
			let e = Rr(i);
			t[n] = () => e;
		}
	}
}, Vr = (e, t) => {
	let n = Rr(t);
	e.slots.default = () => n;
}, Hr = (e, t, n) => {
	for (let r in t) (n || !Lr(r)) && (e[r] = t[r]);
}, Ur = (e, t, n) => {
	let r = e.slots = kr();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (Hr(r, t, n), n && ae(r, "_", e, !0)) : Br(t, r);
	} else t && Vr(e, t);
}, Wr = (e, n, r) => {
	let { vnode: i, slots: a } = e, o = !0, s = t;
	if (i.shapeFlag & 32) {
		let e = n._;
		e ? r && e === 1 ? o = !1 : Hr(a, n, r) : (o = !n.$stable, Br(n, a)), s = n;
	} else n && (Vr(e, n), s = { default: 1 });
	if (o) for (let e in a) !Lr(e) && s[e] == null && delete a[e];
}, Gr = ri;
function Kr(e) {
	return qr(e);
}
function qr(e, i) {
	let a = ce();
	a.__VUE__ = !0;
	let { insert: o, remove: s, patchProp: c, createElement: l, createText: u, createComment: d, setText: f, setElementText: p, parentNode: m, nextSibling: h, setScopeId: g = r, insertStaticContent: _ } = e, v = (e, t, r, i = null, a = null, o = null, s = void 0, c = null, l = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !mi(e, t) && (i = ve(e), A(e, a, o, !0), e = null), t.patchFlag === -2 && (l = !1, t.dynamicChildren = null), t.dynamicChildren && e && e.dynamicChildren && e.dynamicChildren.hasOnce && (t.dynamicChildren === n && (t.dynamicChildren = []), t.dynamicChildren.hasOnce = !0);
		let { type: u, ref: d, shapeFlag: f } = t;
		switch (u) {
			case ii:
				y(e, t, r, i);
				break;
			case ai:
				b(e, t, r, i);
				break;
			case oi:
				e ?? x(t, r, i, s);
				break;
			case U:
				O(e, t, r, i, a, o, s, c, l);
				break;
			default: f & 1 ? w(e, t, r, i, a, o, s, c, l) : f & 6 ? k(e, t, r, i, a, o, s, c, l) : (f & 64 || f & 128) && u.process(e, t, r, i, a, o, s, c, l, be);
		}
		d != null && a ? qn(d, e && e.ref, o, t || e, !t) : d == null && e && e.ref != null && qn(e.ref, null, o, e, !0);
	}, y = (e, t, n, r) => {
		if (e == null) o(t.el = u(t.children), n, r);
		else {
			let n = t.el = e.el;
			t.children !== e.children && f(n, t.children);
		}
	}, b = (e, t, n, r) => {
		e == null ? o(t.el = d(t.children || ""), n, r) : t.el = e.el;
	}, x = (e, t, n, r) => {
		[e.el, e.anchor] = _(e.children, t, n, r, e.el, e.anchor);
	}, S = ({ el: e, anchor: t }, n, r) => {
		let i;
		for (; e && e !== t;) i = h(e), o(e, n, r), e = i;
		o(t, n, r);
	}, C = ({ el: e, anchor: t }) => {
		let n;
		for (; e && e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, w = (e, t, n, r, i, a, o, s, c) => {
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) ee(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), ne(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, ee = (e, t, n, r, i, a, s, u) => {
		let d, f, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (d = e.el = l(e.type, a, m && m.is, m), h & 8 ? p(d, e.children) : h & 16 && E(e.children, d, null, r, i, Jr(e, a), s, u), _ && An(e, null, r, "created"), te(d, e, e.scopeId, s, r), m) {
			for (let e in m) e !== "value" && !T(e) && c(d, e, null, m[e], a, r);
			"value" in m && c(d, "value", null, m.value, a), (f = m.onVnodeBeforeMount) && wi(f, r, e);
		}
		_ && An(e, null, r, "beforeMount");
		let v = Xr(i, g);
		v && g.beforeEnter(d), o(d, t, n), ((f = m && m.onVnodeMounted) || v || _) && Gr(() => {
			try {
				f && wi(f, r, e), v && g.enter(d), _ && An(e, null, r, "mounted");
			} finally {}
		}, i);
	}, te = (e, t, n, r, i) => {
		if (n && g(e, n), r) for (let t = 0; t < r.length; t++) g(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || ni(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				te(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, E = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? xi(e[l]) : bi(e[l]);
			v(null, c, t, n, r, i, a, o, s);
		}
	}, ne = (e, n, r, i, a, o, s) => {
		let l = n.el = e.el, { patchFlag: u, dynamicChildren: d, dirs: f } = n;
		u |= e.patchFlag & 16;
		let m = e.props || t, h = n.props || t, g;
		if (r && Yr(r, !1), (g = h.onVnodeBeforeUpdate) && wi(g, r, n, e), f && An(n, e, r, "beforeUpdate"), r && Yr(r, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (u = 0, s = !1, d = null), (m.innerHTML && h.innerHTML == null || m.textContent && h.textContent == null) && p(l, ""), d ? D(e.dynamicChildren, d, l, r, i, Jr(n, a), o) : s || ue(e, n, l, null, r, i, Jr(n, a), o, !1), u > 0) {
			if (u & 16) re(l, m, h, r, a);
			else if (u & 2 && m.class !== h.class && c(l, "class", null, h.class, a), u & 4 && c(l, "style", m.style, h.style, a), u & 8) {
				let e = n.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let n = e[t], i = m[n], o = h[n];
					(o !== i || n === "value") && c(l, n, i, o, a, r);
				}
			}
			u & 1 && e.children !== n.children && p(l, n.children);
		} else !s && d == null && re(l, m, h, r, a);
		((g = h.onVnodeUpdated) || f) && Gr(() => {
			g && wi(g, r, n, e), f && An(n, e, r, "updated");
		}, i);
	}, D = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el || ti(c), d = u && (c.type === U || !mi(c, l) || c.shapeFlag & 198) ? m(u) : n;
			v(c, l, d, null, r, i, a, o, !0);
		}
	}, re = (e, n, r, i, a) => {
		if (n !== r) {
			if (n !== t) for (let t in n) !T(t) && !(t in r) && c(e, t, n[t], null, a, i);
			for (let t in r) {
				if (T(t)) continue;
				let o = r[t], s = n[t];
				o !== s && t !== "value" && c(e, t, s, o, a, i);
			}
			"value" in r && c(e, "value", n.value, r.value, a);
		}
	}, O = (e, t, n, r, i, a, s, c, l) => {
		let d = t.el = e ? e.el : u(""), f = t.anchor = e ? e.anchor : u(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (c = c ? c.concat(h) : h), e == null ? (o(d, n, r), o(f, n, r), E(t.children || [], n, f, i, a, s, c, l)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (D(e.dynamicChildren, m, n, i, a, s, c), (t.key != null || i && t === i.subTree) && Zr(e, t, !0)) : ue(e, t, n, f, i, a, s, c, l);
	}, k = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : ae(t, n, r, i, a, o, c) : oe(e, t, c);
	}, ae = (e, t, n, r, i, a, o) => {
		let s = e.component = Oi(e, r, i);
		if (Xn(e) && (s.ctx.renderer = be), Li(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, se, o, a), !e.el) {
				let r = s.subTree = J(ai);
				b(null, r, t, n), e.placeholder = r.el;
			}
		} else se(s, e, t, n, i, a, o);
	}, oe = (e, t, n) => {
		let r = t.component = e.component;
		if (wr(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				t.el = e.el, t.placeholder = e.placeholder, le(r, t, n);
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, t.placeholder = e.placeholder, r.vnode = t;
	}, se = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = $r(e);
					if (n) {
						t && (t.el = c.el, le(e, t, o)), n.asyncDep.then(() => {
							Gr(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, d;
				Yr(e, !1), t ? (t.el = c.el, le(e, t, o)) : t = c, n && ie(n), (d = t.props && t.props.onVnodeBeforeUpdate) && wi(d, s, t, c), Yr(e, !0);
				let f = br(e), p = e.subTree;
				e.subTree = f, v(p, f, m(p.el), ve(p), e, i, a), t.el = f.el, u === null && Dr(e, f.el), r && Gr(r, i), (d = t.props && t.props.onVnodeUpdated) && Gr(() => wi(d, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Yn(t);
				if (Yr(e, !1), l && ie(l), !m && (o = c && c.onVnodeBeforeMount) && wi(o, d, t), Yr(e, !0), s && Se) {
					let t = () => {
						e.subTree = br(e), Se(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = br(e);
					v(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && Gr(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					Gr(() => wi(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Yn(d.vnode) && d.vnode.shapeFlag & 256) && e.a && Gr(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new Oe(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => vn(u), Yr(e, !0), l();
	}, le = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, Mr(e, t.props, r, n), Wr(e, t.children, n), Ue(), xn(e), We();
	}, ue = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, u = e ? e.shapeFlag : 0, d = t.children, { patchFlag: f, shapeFlag: m } = t;
		if (f > 0) {
			if (f & 128) {
				fe(l, d, n, r, i, a, o, s, c);
				return;
			}
			if (f & 256) {
				de(l, d, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (u & 16 && _e(l, i, a), d !== l && p(n, d)) : u & 16 ? m & 16 ? fe(l, d, n, r, i, a, o, s, c) : _e(l, i, a, !0) : (u & 8 && p(n, ""), m & 16 && E(d, n, r, i, a, o, s, c));
	}, de = (e, t, r, i, a, o, s, c, l) => {
		e ||= n, t ||= n;
		let u = e.length, d = t.length, f = Math.min(u, d), p = 0;
		for (; p < f; p++) {
			let n = t[p] = l ? xi(t[p]) : bi(t[p]);
			v(e[p], n, r, null, a, o, s, c, l);
		}
		u > d ? _e(e, a, o, !0, !1, f) : E(t, r, i, a, o, s, c, l, f);
	}, fe = (e, t, r, i, a, o, s, c, l) => {
		let u = 0, d = t.length, f = e.length - 1, p = d - 1;
		for (; u <= f && u <= p;) {
			let n = e[u], i = t[u] = l ? xi(t[u]) : bi(t[u]);
			if (mi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			u++;
		}
		for (; u <= f && u <= p;) {
			let n = e[f], i = t[p] = l ? xi(t[p]) : bi(t[p]);
			if (mi(n, i)) v(n, i, r, null, a, o, s, c, l);
			else break;
			f--, p--;
		}
		if (u > f) {
			if (u <= p) {
				let e = p + 1, n = e < d ? t[e].el : i;
				for (; u <= p;) v(null, t[u] = l ? xi(t[u]) : bi(t[u]), r, n, a, o, s, c, l), u++;
			}
		} else if (u > p) for (; u <= f;) A(e[u], a, o, !0), u++;
		else {
			let m = u, h = u, g = /* @__PURE__ */ new Map();
			for (u = h; u <= p; u++) {
				let e = t[u] = l ? xi(t[u]) : bi(t[u]);
				e.key != null && g.set(e.key, u);
			}
			let _, y = 0, b = p - h + 1, x = !1, S = 0, C = Array(b);
			for (u = 0; u < b; u++) C[u] = 0;
			for (u = m; u <= f; u++) {
				let n = e[u];
				if (y >= b) {
					A(n, a, o, !0);
					continue;
				}
				let i;
				if (n.key != null) i = g.get(n.key);
				else for (_ = h; _ <= p; _++) if (C[_ - h] === 0 && mi(n, t[_])) {
					i = _;
					break;
				}
				i === void 0 ? A(n, a, o, !0) : (C[i - h] = u + 1, i >= S ? S = i : x = !0, v(n, t[i], r, null, a, o, s, c, l), y++);
			}
			let w = x ? Qr(C) : n;
			for (_ = w.length - 1, u = b - 1; u >= 0; u--) {
				let e = h + u, n = t[e], f = t[e + 1], p = e + 1 < d ? f.el || ti(f) : i;
				C[u] === 0 ? v(null, n, r, p, a, o, s, c, l) : x && (_ < 0 || u !== w[_] ? pe(n, r, p, 2) : _--);
			}
		}
	}, pe = (e, t, n, r, i = null) => {
		let { el: a, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) pe(e.component.subTree, t, n, r);
		else if (d & 128) e.suspense.move(t, n, r);
		else if (d & 64) c.move(e, t, n, be);
		else if (c === U) {
			o(a, t, n);
			for (let e = 0; e < u.length; e++) pe(u[e], t, n, r);
			o(e.anchor, t, n);
		} else if (c === oi) S(e, t, n);
		else if (r !== 2 && d & 1 && l) {
			if (r === 0) l.persisted && !a[zn] ? o(a, t, n) : (l.beforeEnter(a), o(a, t, n), Gr(() => l.enter(a), i));
			else {
				let { leave: r, delayLeave: i, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? s(a) : o(a, t, n);
				}, d = () => {
					let e = a._isLeaving || !!a[zn];
					a._isLeaving && a[zn](!0), l.persisted && !e ? u() : r(a, () => {
						u(), c && c();
					});
				};
				i ? i(a, u, d) : d();
			}
		} else o(a, t, n);
	}, A = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if ((d === -2 || l && l.hasOnce) && (i = !1), s != null && (Ue(), qn(s, null, n, e, !0), We()), p == null || e.ctx && e.ctx !== t || (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Yn(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && wi(_, t, e), u & 6) ge(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && An(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, be, r) : l && !l.hasOnce && (a !== U || d > 0 && d & 64) ? _e(l, t, n, !1, !0) : (a === U && d & 384 || !i && u & 16) && _e(c, t, n), r && me(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && Gr(() => {
			_ && wi(_, t, e), h && An(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, me = (e) => {
		let { type: t, el: n, anchor: r, transition: i } = e, a = t === U;
		if (a && !i) {
			he(n, r);
			return;
		}
		if (t === oi) {
			C(e), i && !i.persisted && i.afterLeave && i.afterLeave();
			return;
		}
		let o = a ? Un(e) : e, c = () => {
			a ? m(n) && he(n, r) : s(n), i && !i.persisted && i.afterLeave && i.afterLeave();
		};
		if (o && o.shapeFlag & 1 && i && !i.persisted) {
			let { leave: e, delayLeave: t } = i, n = o.el, r = () => e(n, c);
			t ? t(n, c, r) : r();
		} else c();
	}, he = (e, t) => {
		let n;
		for (; e !== t;) n = h(e), s(e), e = n;
		s(t);
	}, ge = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		ei(c), ei(l), r && ie(r), i.stop(), a ? (a.flags |= 8, A(o, e, t, n)) : e.vnode.el && o && (o.transition = e.vnode.transition, A(o, e, t, n)), s && Gr(s, t), Gr(() => {
			e.isUnmounted = !0;
		}, t);
	}, _e = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) A(e[o], t, n, r, i);
	}, ve = (e) => {
		if (e.shapeFlag & 6) return ve(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = h(e.anchor || e.el), n = t && t[Ln];
		return n ? h(n) : t;
	}, ye = (e, t, n) => {
		wn(() => {
			e == null ? t._vnode && A(t._vnode, null, null, !0) : v(t._vnode || null, e, t, null, null, null, n), t._vnode = e;
		}, e && t._vnode ? void 0 : e && e.component ? e.component.uid : Di());
	}, be = {
		p: v,
		um: A,
		m: pe,
		r: me,
		mt: ae,
		mc: E,
		pc: ue,
		pbc: D,
		n: ve,
		o: e
	}, xe, Se;
	return i && ([xe, Se] = i(be)), {
		render: ye,
		hydrate: xe,
		createApp: mr(ye, xe)
	};
}
function Jr({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Yr({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Xr(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Zr(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (d(r) && d(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = xi(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && Zr(t, a)), a.type === ii && (a.patchFlag === -1 && (a = i[e] = xi(a)), a.el = t.el), a.type === ai && !a.el && (a.el = t.el);
	}
}
function Qr(e) {
	let t = e.slice(), n = [0], r, i, a, o, s, c = e.length;
	for (r = 0; r < c; r++) {
		let c = e[r];
		if (c !== 0) {
			if (i = n[n.length - 1], e[i] < c) {
				t[r] = i, n.push(r);
				continue;
			}
			for (a = 0, o = n.length - 1; a < o;) s = a + o >> 1, e[n[s]] < c ? a = s + 1 : o = s;
			c < e[n[a]] && (a > 0 && (t[r] = n[a - 1]), n[a] = r);
		}
	}
	for (a = n.length, o = n[a - 1]; a-- > 0;) n[a] = o, o = t[o];
	return n;
}
function $r(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : $r(t);
}
function ei(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function ti(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? ti(t.subTree) : null;
}
var ni = (e) => e.__isSuspense;
function ri(e, t) {
	t && t.pendingBranch ? d(e) ? t.effects.push(...e) : t.effects.push(e) : bn(e);
}
var U = /* @__PURE__ */ Symbol.for("v-fgt"), ii = /* @__PURE__ */ Symbol.for("v-txt"), ai = /* @__PURE__ */ Symbol.for("v-cmt"), oi = /* @__PURE__ */ Symbol.for("v-stc"), si = [], ci = null;
function W(e = !1) {
	si.push(ci = e ? null : []);
}
function li() {
	si.pop(), ci = si[si.length - 1] || null;
}
var ui = 1;
function di(e, t = !1) {
	ui += e, e < 0 && ci && t && (ci.hasOnce = !0);
}
function fi(e) {
	return e.dynamicChildren = ui > 0 ? ci || n : null, li(), ui > 0 && ci && ci.push(e), e;
}
function G(e, t, n, r, i, a) {
	return fi(q(e, t, n, r, i, a, !0));
}
function K(e, t, n, r, i) {
	return fi(J(e, t, n, r, i, !0));
}
function pi(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function mi(e, t) {
	return e.type === t.type && e.key === t.key;
}
var hi = ({ key: e }) => e ?? null, gi = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : g(e) || /* @__PURE__ */ I(e) || h(e) ? {
	i: B,
	r: e,
	k: t,
	f: !!n
} : e);
function q(e, t = null, n = null, r = 0, i = null, a = e === U ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && hi(t),
		ref: t && gi(t),
		scopeId: Dn,
		slotScopeIds: null,
		children: n,
		component: null,
		suspense: null,
		ssContent: null,
		ssFallback: null,
		dirs: null,
		transition: null,
		el: null,
		anchor: null,
		target: null,
		targetStart: null,
		targetAnchor: null,
		staticCount: 0,
		shapeFlag: a,
		patchFlag: r,
		dynamicProps: i,
		dynamicChildren: null,
		appContext: null,
		ctx: B
	};
	return s ? (Si(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= g(n) ? 8 : 16), ui > 0 && !o && ci && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && ci.push(c), c;
}
var J = _i;
function _i(e, t = null, n = null, r = 0, i = null, a = !1) {
	if (e && e !== nr || (e = ai), pi(e)) {
		let r = yi(e, t, !0);
		return n && Si(r, n), ui > 0 && !a && ci && (r.shapeFlag & 6 ? ci[ci.indexOf(e)] = r : ci.push(r)), r.patchFlag = -2, r;
	}
	if (Gi(e) && (e = e.__vccOpts), t) {
		t = vi(t);
		let { class: e, style: n } = t;
		e && !g(e) && (t.class = A(e)), v(n) && (/* @__PURE__ */ Ht(n) && !d(n) && (n = s({}, n)), t.style = le(n));
	}
	let o = g(e) ? 1 : ni(e) ? 128 : Rn(e) ? 64 : v(e) ? 4 : h(e) ? 2 : 0;
	return q(e, t, n, r, i, o, a, !0);
}
function vi(e) {
	return e ? /* @__PURE__ */ Ht(e) || Ar(e) ? s({}, e) : e : null;
}
function yi(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? Ci(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && hi(l),
		ref: t && t.ref ? n && a ? d(a) ? a.concat(gi(t)) : [a, gi(t)] : gi(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== U ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && yi(e.ssContent),
		ssFallback: e.ssFallback && yi(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce,
		cacheIndex: e.cacheIndex
	};
	return c && r && Hn(u, c.clone(u)), u;
}
function Y(e = " ", t = 0) {
	return J(ii, null, e, t);
}
function X(e = "", t = !1) {
	return t ? (W(), K(ai, null, e)) : J(ai, null, e);
}
function bi(e) {
	return e == null || typeof e == "boolean" ? J(ai) : d(e) ? J(U, null, e.slice()) : pi(e) ? xi(e) : J(ii, null, String(e));
}
function xi(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : yi(e);
}
function Si(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (d(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), Si(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !Ar(t) ? t._ctx = B : r === 3 && B && (B.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (h(t)) {
		if (r & 65) {
			Si(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: B
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [Y(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function Ci(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = A([t.class, r.class]));
		else if (e === "style") t.style = le([t.style, r.style]);
		else if (a(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(d(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !o(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function wi(e, t, n, r = null) {
	sn(e, t, 7, [n, r]);
}
var Ti = fr(), Ei = 0;
function Di() {
	return Ei;
}
function Oi(e, n, r) {
	let i = e.type, a = (n ? n.appContext : e.appContext) || Ti, o = {
		uid: Ei++,
		vnode: e,
		type: i,
		parent: n,
		appContext: a,
		root: null,
		next: null,
		subTree: null,
		effect: null,
		update: null,
		job: null,
		scope: new Te(!0),
		render: null,
		proxy: null,
		exposed: null,
		exposeProxy: null,
		withProxy: null,
		provides: n ? n.provides : Object.create(a.provides),
		ids: n ? n.ids : [
			"",
			0,
			0
		],
		accessCache: null,
		renderCache: [],
		components: null,
		directives: null,
		propsOptions: Fr(i, a),
		emitsOptions: vr(i, a),
		emit: null,
		emitted: null,
		propsDefaults: t,
		inheritAttrs: i.inheritAttrs,
		ctx: t,
		data: t,
		props: t,
		attrs: t,
		slots: t,
		refs: t,
		setupState: t,
		setupContext: null,
		suspense: r,
		suspenseId: r ? r.pendingId : 0,
		asyncDep: null,
		asyncResolved: !1,
		isMounted: !1,
		isUnmounted: !1,
		isDeactivated: !1,
		bc: null,
		c: null,
		bm: null,
		m: null,
		bu: null,
		u: null,
		um: null,
		bum: null,
		da: null,
		a: null,
		rtg: null,
		rtc: null,
		ec: null,
		sp: null
	};
	return o.ctx = { _: o }, o.root = n ? n.root : o, o.emit = _r.bind(null, o), e.ce && e.ce(o), o;
}
var ki = null, Ai = () => ki || B, ji, Mi;
{
	let e = ce(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	ji = t("__VUE_INSTANCE_SETTERS__", (e) => ki = e), Mi = t("__VUE_SSR_SETTERS__", (e) => Ii = e);
}
var Ni = (e) => {
	let t = ki;
	return ji(e), e.scope.on(), () => {
		e.scope.off(), ji(t);
	};
}, Pi = () => {
	ki && ki.scope.off(), ji(null);
};
function Fi(e) {
	return e.vnode.shapeFlag & 4;
}
var Ii = !1;
function Li(e, t = !1, n = !1) {
	t && Mi(t);
	let { props: r, children: i } = e.vnode, a = Fi(e);
	jr(e, r, a, t), Ur(e, i, n || t);
	let o = a ? Ri(e, t) : void 0;
	return t && Mi(!1), o;
}
function Ri(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, dr);
	let { setup: r } = n;
	if (r) {
		Ue();
		let n = e.setupContext = r.length > 1 ? Hi(e) : null, i = Ni(e), a = on(r, e, 0, [e.props, n]), o = y(a);
		if (We(), i(), (o || e.sp) && !Yn(e) && Wn(e), o) {
			if (a.then(Pi, Pi), t) return a.then((n) => {
				Mi(!0);
				try {
					zi(e, n, t);
				} finally {
					Mi(!1);
				}
			}).catch((t) => {
				cn(t, e, 0);
			});
			e.asyncDep = a;
		} else zi(e, a, t);
	} else Bi(e, t);
}
function zi(e, t, n) {
	h(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : v(t) && (e.setupState = Xt(t)), Bi(e, n);
}
function Bi(e, t, n) {
	let i = e.type;
	e.render ||= i.render || r;
}
var Vi = { get(e, t) {
	return P(e, "get", ""), e[t];
} };
function Hi(e) {
	return {
		attrs: new Proxy(e.attrs, Vi),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function Ui(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(Xt(Ut(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in lr) return lr[n](e);
		},
		has(e, t) {
			return t in e || t in lr;
		}
	}) : e.proxy;
}
function Wi(e, t = !0) {
	return h(e) ? e.displayName || e.name : e.name || t && e.__name;
}
function Gi(e) {
	return h(e) && "__vccOpts" in e;
}
var Z = (e, t) => /* @__PURE__ */ Qt(e, t, Ii), Ki = "3.5.44", qi = void 0, Ji = typeof window < "u" && window.trustedTypes;
if (Ji) try {
	qi = /* @__PURE__ */ Ji.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var Yi = qi ? (e) => qi.createHTML(e) : (e) => e, Xi = "http://www.w3.org/2000/svg", Zi = "http://www.w3.org/1998/Math/MathML", Qi = typeof document < "u" ? document : null, $i = Qi && /* @__PURE__ */ Qi.createElement("template"), ea = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? Qi.createElementNS(Xi, e) : t === "mathml" ? Qi.createElementNS(Zi, e) : n ? Qi.createElement(e, { is: n }) : Qi.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => Qi.createTextNode(e),
	createComment: (e) => Qi.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => Qi.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			$i.innerHTML = Yi(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = $i.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, ta = /* @__PURE__ */ Symbol("_vtc");
function na(e, t, n) {
	let r = e[ta];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var ra = /* @__PURE__ */ Symbol("_vod"), ia = /* @__PURE__ */ Symbol("_vsh"), aa = /* @__PURE__ */ Symbol(""), oa = /(?:^|;)\s*display\s*:/;
function sa(e, t, n) {
	let r = e.style, i = g(n), a = !1;
	if (n && !i) {
		if (t) {
			if (g(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? la(r, t, "");
			}
			else for (let e in t) n[e] ?? la(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? la(r, i, "") : pa(e, i, !g(t) && t ? t[i] : void 0, o) || la(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[aa];
			e && (n += ";" + e), r.cssText = n, a = oa.test(n);
		}
	} else t && e.removeAttribute("style");
	ra in e && (i && t === n || (e[ra] = a ? r.display : ""), e[ia] && (r.display = "none"));
}
var ca = /\s*!important$/;
function la(e, t, n) {
	if (d(n)) n.forEach((n) => la(e, t, n));
	else if (n ??= "", t.startsWith("--")) ca.test(n) ? e.setProperty(t, n.replace(ca, ""), "important") : e.setProperty(t, n);
	else {
		let r = fa(e, t);
		ca.test(n) ? e.setProperty(D(r), n.replace(ca, ""), "important") : e[r] = n;
	}
}
var ua = [
	"Webkit",
	"Moz",
	"ms"
], da = {};
function fa(e, t) {
	let n = da[t];
	if (n) return n;
	let r = E(t);
	if (r !== "filter" && r in e) return da[t] = r;
	r = re(r);
	for (let n = 0; n < ua.length; n++) {
		let i = ua[n] + r;
		if (i in e) return da[t] = i;
	}
	return t;
}
function pa(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && g(r) && n === r;
}
var ma = "http://www.w3.org/1999/xlink";
function ha(e, t, n, r, i, a = me(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(ma, t.slice(6, t.length)) : e.setAttributeNS(ma, t, n) : n == null || a && !he(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : _(n) ? String(n) : n);
}
function ga(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? Yi(n) : n);
		return;
	}
	let a = e.tagName;
	if (t === "value" && a !== "PROGRESS" && !a.includes("-")) {
		let r = a === "OPTION" ? e.getAttribute("value") || "" : e.value, i = n == null ? e.type === "checkbox" ? "on" : "" : String(n);
		r === i && "_value" in e || (e.value = i), n ?? e.removeAttribute(t), e._value = n;
		return;
	}
	let o = !1;
	if (n === "" || n == null) {
		let r = typeof e[t];
		r === "boolean" ? n = he(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch {}
	o && e.removeAttribute(i || t);
}
function _a(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function va(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var ya = /* @__PURE__ */ Symbol("_vei");
function ba(e, t, n, r, i = null) {
	let a = e[ya] || (e[ya] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = Ca(t);
		r ? _a(e, n, a[t] = Da(r, i), s) : o && (va(e, n, o, s), a[t] = void 0);
	}
}
var xa = /(Once|Passive|Capture)$/, Sa = /^on:?(?:Once|Passive|Capture)$/;
function Ca(e) {
	let t, n;
	for (; (n = e.match(xa)) && !Sa.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : D(e.slice(2)), t];
}
var wa = 0, Ta = /* @__PURE__ */ Promise.resolve(), Ea = () => wa ||= (Ta.then(() => wa = 0), Date.now());
function Da(e, t) {
	let n = (e) => {
		if (!e._vts) e._vts = Date.now();
		else if (e._vts <= n.attached) return;
		let r = n.value;
		if (d(r)) {
			let n = e.stopImmediatePropagation;
			e.stopImmediatePropagation = () => {
				n.call(e), e._stopped = !0;
			};
			let i = r.slice(), a = [e];
			for (let n = 0; n < i.length && !e._stopped; n++) {
				let e = i[n];
				e && sn(e, t, 5, a);
			}
		} else sn(r, t, 5, [e]);
	};
	return n.value = e, n.attached = Ea(), n;
}
var Oa = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, ka = (e, t, n, r, i, s) => {
	let c = i === "svg";
	t === "class" ? na(e, r, c) : t === "style" ? sa(e, n, r) : a(t) ? o(t) || ba(e, t, n, r, s) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : Aa(e, t, r, c)) ? (ga(e, t, r), e.tagName.includes("-") || t !== "value" && t !== "checked" && t !== "selected" || ha(e, t, r, c, s, t !== "value")) : e._isVueCE && (ja(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !g(r))) ? ga(e, E(t), r, s, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), ha(e, t, r, c));
};
function Aa(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Oa(t) && h(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Oa(t) && g(n) ? !1 : t in e;
}
function ja(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = E(t);
	return Array.isArray(n) ? n.some((e) => E(e) === r) : Object.keys(n).some((e) => E(e) === r);
}
var Ma = (e) => {
	let t = e.props["onUpdate:modelValue"] || !1;
	return d(t) ? (e) => ie(t, e) : t;
};
function Na(e) {
	e.target.composing = !0;
}
function Pa(e) {
	let t = e.target;
	t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
var Fa = /* @__PURE__ */ Symbol("_assign"), Ia = /* @__PURE__ */ Symbol("_initialValue");
function La(e, t, n) {
	return t && (e = e.trim()), n && (e = oe(e)), e;
}
var Ra = {
	created(e, { modifiers: { lazy: t, trim: n, number: r } }, i) {
		e.parentNode && (e.type === "text" ? e[Ia] = e.defaultValue.replace(/[\r\n]/g, "") : e.type === "textarea" && (e[Ia] = e.defaultValue.replace(/\r\n?/g, "\n"))), e[Fa] = Ma(i);
		let a = r || i.props && i.props.type === "number";
		_a(e, t ? "change" : "input", (t) => {
			t.target.composing || e[Fa](La(e.value, n, a));
		}), (n || a) && _a(e, "change", () => {
			e.value = La(e.value, n, a);
		}), t || (_a(e, "compositionstart", Na), _a(e, "compositionend", Pa), _a(e, "change", Pa));
	},
	mounted(e, { value: t, modifiers: { trim: n, number: r } }) {
		let i = t ?? "", a = e[Ia];
		delete e[Ia], a !== void 0 && (e.type === "text" || e.type === "textarea") && e.value !== a ? e[Fa](La(e.value, n, r)) : e.value = i;
	},
	beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: r, trim: i, number: a } }, o) {
		if (e[Fa] = Ma(o), e.composing) return;
		let s = (a || e.type === "number") && !/^0\d/.test(e.value) ? oe(e.value) : e.value, c = t ?? "";
		if (s === c) return;
		let l = e.getRootNode();
		(l instanceof Document || l instanceof ShadowRoot) && l.activeElement === e && e.type !== "range" && (r && t === n || i && e.value.trim() === c) || (e.value = c);
	}
}, za = {
	deep: !0,
	created(e, { value: t, modifiers: { number: n } }, r) {
		e._modelValue = t, _a(e, "change", () => {
			let t = Array.prototype.filter.call(e.options, (e) => e.selected).map((e) => n ? oe(Ha(e)) : Ha(e)), r = e.multiple, i = r ? p(e._modelValue) ? new Set(t) : t : t[0], a = e._pendingValue = [r, r ? d(i) ? t.slice() : t : i];
			try {
				e[Fa](i);
			} finally {
				gn(() => {
					e._pendingValue === a && (e._pendingValue = void 0);
				});
			}
		}), e[Fa] = Ma(r);
	},
	mounted(e, { value: t }) {
		Va(e, t);
	},
	beforeUpdate(e, { value: t }, n) {
		e._modelValue = t, e[Fa] = Ma(n);
	},
	updated(e, { value: t }) {
		let n = e._pendingValue;
		e._pendingValue = void 0, n && n[0] === e.multiple && Ba(t, n[1], n[0]) || Va(e, t);
	}
};
function Ba(e, t, n) {
	if (!n || d(e)) return be(e, t);
	if (p(e)) {
		if (e.size !== t.length) return !1;
		for (let n of t) if (!e.has(n)) return !1;
		return !0;
	}
	return !1;
}
function Va(e, t) {
	let n = e.multiple, r = d(t);
	if (!n || r || p(t)) {
		for (let i = 0, a = e.options.length; i < a; i++) {
			let a = e.options[i], o = Ha(a);
			if (n) {
				if (r) {
					let e = typeof o;
					a.selected = e === "string" || e === "number" ? t.some((e) => String(e) === String(o)) : xe(t, o) > -1;
				} else a.selected = t.has(o);
			} else if (be(Ha(a), t)) {
				e.selectedIndex !== i && (e.selectedIndex = i);
				return;
			}
		}
		!n && e.selectedIndex !== -1 && (e.selectedIndex = -1);
	}
}
function Ha(e) {
	return "_value" in e ? e._value : e.value;
}
var Ua = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], Wa = {
	stop: (e) => e.stopPropagation(),
	prevent: (e) => e.preventDefault(),
	self: (e) => e.target !== e.currentTarget,
	ctrl: (e) => !e.ctrlKey,
	shift: (e) => !e.shiftKey,
	alt: (e) => !e.altKey,
	meta: (e) => !e.metaKey,
	left: (e) => "button" in e && e.button !== 0,
	middle: (e) => "button" in e && e.button !== 1,
	right: (e) => "button" in e && e.button !== 2,
	exact: (e, t) => Ua.some((n) => e[`${n}Key`] && !t.includes(n))
}, Ga = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = Wa[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, Ka = /* @__PURE__ */ s({ patchProp: ka }, ea), qa;
function Ja() {
	return qa ||= Kr(Ka);
}
var Ya = ((...e) => {
	let t = Ja().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = Za(e);
		if (!r) return;
		let i = t._component;
		h(i) || i.render || i.template || (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, Xa(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function Xa(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function Za(e) {
	return g(e) ? document.querySelector(e) : e;
}
// src/admin-controller.js
function Qa(e = () => {}) {
	let t = [], n = (e, n, r) => {
		e.addEventListener(n, r), t.push(() => e.removeEventListener(n, r));
	}, r = (e, t = document) => t.querySelector(e), i = (e) => String(e ?? "").replace(/[&<>"']/g, (e) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[e]), a = r("meta[name=\"csrf-token\"]").content, o = {
		created: "已创建",
		downloading: "正在下载",
		downloaded: "下载完成",
		transferring: "正在传输",
		validating: "正在校验",
		installing: "正在安装",
		pending_boot: "等待启动确认",
		confirmed: "升级成功",
		failed: "升级失败",
		rolled_back: "已回滚"
	}, s = null, c = null, l = !1, u, d = !1, f = 0, p = [
		"release_management",
		"artifact_deletion",
		"metadata_management",
		"firmware_state"
	], m = "页面与运行中的后台版本不一致，请先重启 OTA 服务，再按 Ctrl+F5 刷新页面。";
	function h(e) {
		return e?.contract === 2 && Array.isArray(e.features) && p.every((t) => e.features?.includes(t));
	}
	function g() {
		return d ? !0 : (_(m, !0), !1);
	}
	function _(e, t = !1) {
		let n = r("#toast");
		n.textContent = e, n.className = "toast" + (t ? " error" : ""), n.hidden = !1, clearTimeout(u), u = setTimeout(() => n.hidden = !0, 6e3);
	}
	async function v(e, t = {}) {
		let n = (t.method || "GET").toUpperCase();
		if (e.startsWith("/api/admin/") && ![
			"GET",
			"HEAD",
			"OPTIONS"
		].includes(n) && e !== "/api/admin/logout" && !d) throw Error(m);
		let r = {
			"X-CSRF-Token": a,
			...t.headers
		};
		t.body && !(t.body instanceof FormData) && (r["Content-Type"] = "application/json");
		let i = n === "GET" && !t.signal ? new AbortController() : null, o = i ? setTimeout(() => i.abort(), 15e3) : null;
		try {
			let n = await fetch(e, {
				...t,
				headers: r,
				credentials: "same-origin",
				...i ? { signal: i.signal } : {}
			});
			if (n.status === 401) throw location.href = "/login", Error("请重新登录");
			let a;
			try {
				a = await n.json();
			} catch {
				throw Error("后台返回了无法识别的响应（HTTP " + n.status + "），请检查服务或代理配置。");
			}
			if (!n.ok) {
				let t = n.status === 404 && a.detail === "Not Found", r = Error(t ? m : typeof a.error == "string" ? a.error : typeof a.detail == "string" ? a.detail : "请求失败（HTTP " + n.status + "）");
				throw r.status = n.status, r.routeMissing = t, t && e !== "/api/admin/capabilities" && (d = !1, ee()), r;
			}
			return a;
		} catch (e) {
			throw i?.signal.aborted ? Error("读取后台数据超时，请检查网络后刷新页面。") : e;
		} finally {
			o && clearTimeout(o);
		}
	}
	let y = (e, t = {}) => v(e, {
		method: "POST",
		body: JSON.stringify(t)
	}), b = (e) => e ? (/* @__PURE__ */ new Date(e * 1e3)).toLocaleString("zh-CN", { hour12: !1 }) : "尚未联系", x = (e) => e >= 1048576 ? (e / 1048576).toFixed(2) + " MiB" : e >= 1024 ? Math.round(e / 1024) + " KiB" : e + " B", S = (e, t, n = "", r = "") => `<button data-action="${i(e)}" data-id="${i(n)}" class="${i(r)}">${i(t)}</button>`, C = (e, t, n = "") => `<div class="empty"><div class="empty-symbol">↥</div><h3>${i(e)}</h3><p>${i(t)}</p>${n}</div>`;
	async function w() {
		e({ syncing: !0 }), r("#sync-status").textContent = "正在同步";
		try {
			let e = v("/api/admin/capabilities").catch((e) => {
				if (e.routeMissing) return null;
				throw e;
			}), [t, n, i, a, o, c, l] = await Promise.all([
				v("/api/admin/overview"),
				v("/api/admin/catalog"),
				v("/api/admin/devices"),
				v("/api/admin/artifacts"),
				v("/api/admin/releases"),
				v("/api/admin/attempts"),
				e
			]);
			return s = {
				overview: t,
				...n,
				devices: i,
				artifacts: a,
				releases: o,
				attempts: c,
				capabilities: l
			}, d = h(l), ee(), r("#sync-status").textContent = d ? "已同步 " + (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour12: !1 }) : "后台待重启", !0;
		} catch (t) {
			return _(t.message, !0), r("#sync-status").textContent = "同步失败", s || e({ error: t.message }), !1;
		} finally {
			e({ syncing: !1 });
		}
	}
	function T(e = !0) {
		if (c) return e !== !1 && (l = !0), c;
		let t = (async () => {
			let e;
			do
				l = !1, e = await w();
			while (l);
			return e;
		})();
		return c = t, t.finally(() => {
			c === t && (c = null);
		}), t;
	}
	function ee() {
		e({
			snapshot: s,
			managementReady: d
		});
	}
	let te = (e, t = "name", n = !0) => e.map((e) => `<option value="${i(e.id)}">${i(e[t])}${n ? " · " + i(e.id.slice(0, 28)) : ""}</option>`).join(""), E = (e, t, n = "", r = "") => `<label>${i(e)}<input name="${i(t)}" ${n} value="${i(r)}"></label>`, ne = (e, t, n) => `<label>${i(e)}<select name="${i(t)}" ${t === "gateway_id" ? "" : "required"}>${n}</select></label>`;
	function D(e, t) {
		f++, r("#dialog-title").textContent = e, r("#dialog-body").innerHTML = t, r("#dialog").showModal();
	}
	function re() {
		f++, window.dispatchEvent(new Event("ota:dialog-close")), r("#dialog").close(), r("#dialog-body").replaceChildren();
	}
	function O(e, t, n, r = "保存") {
		D(t, `<form id="entry-form" data-kind="${e}">${n}<div class="form-error" role="alert" hidden></div><div class="form-actions"><button type="button" data-action="close">取消</button><button class="primary" type="submit">${r}</button></div></form>`);
	}
	function k(e) {
		D("保存设备凭据", `<div class="notice">以下密钥只显示这一次。关闭前请复制保存；忘记后可以轮换。</div><p class="muted">设备 / 代理标识</p><pre>${i(e.id)}</pre>${e.agent_id ? `<p class="muted">联网代理标识</p><pre>${i(e.agent_id)}</pre>` : ""}<p class="muted">访问密钥</p><div id="secret-token" class="secret-value">${i(e.token)}</div><div class="form-actions">${S("copy-token", "复制密钥", "", "primary")}${S("close", "我已保存")}</div>`);
	}
	function ie(e, t) {
		let n = URL.createObjectURL(new Blob([JSON.stringify(e, null, 2)], { type: "application/json" })), r = document.createElement("a");
		r.href = n, r.download = t, r.click(), setTimeout(() => URL.revokeObjectURL(n), 1e3);
	}
	let ae = {
		product: ["products", "产品"],
		target: ["targets", "硬件型号"],
		key: ["keys", "签名公钥"],
		device: ["devices", "设备"],
		gateway: ["gateways", "网关"]
	};
	async function oe(e, t = "", n = null) {
		if (!g()) return;
		let a = ++f;
		if (e === "republish") {
			let e = s.releases.find((e) => e.id === t);
			if (!e) {
				_("发布记录已变化，请刷新页面", !0);
				return;
			}
			return oe("publish", e.artifact_id, {
				channel: e.channel,
				notes: e.notes || ""
			});
		}
		if (e === "edit-release" || e === "delete-release") {
			let n = s.releases.find((e) => e.id === t);
			if (!n) {
				_("发布记录已变化，请刷新页面", !0);
				return;
			}
			let a = e === "delete-release", o = n.can_delete === !1 || !!n.active || n.attempt_count > 0, c = `<p><b>${i(n.version)}</b> · ${i(n.target_name)}</p><p class="muted">${i(n.channel)} 通道 · 发布 #${n.seq}</p><p class="mono artifact-delete-digest">SHA-256：${i(n.sha256)}</p>`, l = (n.delete_block_reasons || [...n.active ? ["当前为活动发布，请先撤回再删除。"] : [], ...n.attempt_count ? ["已有 " + n.attempt_count + " 条升级记录，需保留历史。"] : []]).map((e) => `<p class="notice error">${i(e)}</p>`).join(""), u = a ? c + l + "<div class=\"notice\">只移除此条发布，不删除固件库文件，不会让已安装设备回退。内部保留发布序号与审计信息，避免序号被重复使用。</div><p class=\"form-hint\">此操作不能在界面撤销；仍可从固件库新建发布。</p>" : c + `<label>发布说明<textarea name="notes" maxlength="2000">${i(n.notes || "")}</textarea></label><div class="notice">仅修改这一次发布的说明，不改固件库说明、版本号、签名、摘要或通道。</div>`;
			if (O(a ? "release-delete" : "release-edit", a ? "删除发布" : "编辑发布说明", u, a ? "确认删除发布" : "保存修改"), r("#entry-form").dataset.id = t, a) {
				let e = r("[type=submit]", r("#entry-form"));
				e.className = "danger", e.disabled = o, o && (e.textContent = "此发布受保护，不能删除");
			}
		} else {
			if (e.startsWith("edit-") || e.startsWith("delete-")) {
				let n = e.replace(/^(edit|delete)-/, ""), a = ae[n];
				if (a) {
					let [o, c] = a, l = s[o].find((e) => e.id === t);
					if (!l) {
						_("记录已变化，请刷新页面", !0);
						return;
					}
					let u = e.startsWith("delete-"), d = `<p class="muted">标识：<span class="mono artifact-delete-digest">${i(l.id)}</span></p>`, f = n === "device" ? "删除直连设备会同时移除其访问凭据；网关子设备不会删除网关凭据。" : n === "gateway" ? "删除网关会同时使其访问凭据失效。有授权子设备时不能删除。" : n === "key" ? "删除未引用公钥不会删除本机私钥。有硬件或固件引用时不能删除；在用公钥可使用“吊销”。" : "已有引用或历史记录时不能删除。不会级联删除其他数据。", p = u ? `<p>确认删除${i(c)}“${i(l.name)}”吗？</p>${d}<div class="notice error">${i(f)}没有回收站。</div>` : E(c + "名称", "name", `required maxlength="${n === "target" ? 100 : 80}"`, l.name) + (n === "product" ? `<label>产品说明<textarea name="description" maxlength="500">${i(l.description || "")}</textarea></label>` : "") + d + (n === "target" ? "<div class=\"notice\">仅修改显示名称，不改变芯片、布局、容量、签名公钥等兼容参数。兼容参数变化请新增硬件型号。</div>" : "");
					O(u ? "manage-delete" : "manage-edit", (u ? "删除" : "编辑") + c, p, u ? "确认删除" : "保存修改");
					let m = r("#entry-form");
					m.dataset.id = t, m.dataset.collection = o, u && (r("[type=submit]", m).className = "danger");
					return;
				}
			}
			if (e === "delete-artifact") {
				let { openArtifactDeletion: e } = await import("/static/retention-ui.mjs");
				if (a !== f) return;
				await e({
					id: t,
					api: v,
					post: y,
					esc: i,
					size: x,
					showDialog: D,
					onChanged: T,
					toast: _
				});
			} else if (e === "pack") {
				let { openPack: e } = await import("/static/pack-ui.mjs");
				if (a !== f) return;
				e({
					state: s,
					api: v,
					post: y,
					esc: i,
					size: x,
					showDialog: D,
					closeDialog: re,
					onUploaded: T,
					onAdvanced: () => oe("upload"),
					toast: _
				});
			} else if (["key", "target"].includes(e) && !s.products.length) _("请先创建产品", !0);
			else if ([
				"device",
				"upload",
				"publish"
			].includes(e) && !s.targets.length) _("请先添加签名公钥和硬件型号", !0);
			else {
				if (e === "product" && O(e, "新建产品", E("产品名称", "name", "required maxlength=\"80\" placeholder=\"例如：桌面伴侣\"") + E("产品标识", "id", "required pattern=\"[a-z0-9](?:[a-z0-9_]|-){1,63}\" placeholder=\"例如：desk-monitor\"") + "<label>产品说明<textarea name=\"description\" maxlength=\"500\"></textarea></label>"), e === "key" && O(e, "添加签名公钥", ne("所属产品", "product_id", te(s.products)) + E("公钥名称", "name", "required maxlength=\"80\"") + "<label>公钥 PEM<textarea name=\"pem\" class=\"mono\" required placeholder=\"-----BEGIN PUBLIC KEY-----\"></textarea></label><label>或选择 public.pem<input type=\"file\" id=\"pem-file\" accept=\".pem,.pub\"></label><p class=\"form-hint\">只上传 RSA-3072/4096 公钥。同一公钥归属一个产品，私钥留在本机。</p>"), e === "target") {
					if (!s.keys.some((e) => !e.revoked)) {
						_("请先添加签名公钥", !0);
						return;
					}
					O(e, "新增硬件型号", ne("所属产品", "product_id", te(s.products)) + ne("镜像格式 / 适配器", "adapter", Object.entries(s.adapters).map(([e, t]) => `<option value="${e}">${i(t)}</option>`).join("")) + "<div class=\"form-grid\">" + E("型号名称", "name", "required maxlength=\"100\"") + E("型号标识", "id", "required pattern=\"[a-z0-9](?:[a-z0-9_]|-){1,63}\"") + E("MCU 型号", "mcu", "required") + E("硬件修订", "hw_revision", "required", "1.0") + E("布局标识", "layout_id", "required pattern=\"[a-z0-9](?:[a-z0-9_]|-){1,63}\"") + E("最大镜像字节数", "max_size", "required type=\"number\" min=\"256\" max=\"134217728\"") + E("最低 Bootloader 版本", "min_bootloader", "required", "0.1.0") + "</div>" + ne("签名公钥", "key_id", "") + "<label>此硬件已实现的能力</label><div class=\"checkboxes\"><label><input type=\"checkbox\" checked disabled>完整固件暂存</label><label><input type=\"checkbox\" checked disabled>应用启动确认</label><label><input type=\"checkbox\" name=\"rollback\">自动回滚</label><label><input type=\"checkbox\" name=\"gateway_transport\">网关传输</label></div><label>适配器配置 JSON<textarea name=\"config\" class=\"mono\" required></textarea></label><p class=\"form-hint\">仅声明实机已实现的能力。配置不可变，布局/公钥变化时新增型号。JSON 地址使用十进制。</p>"), se(), ce();
				}
				if (e === "device" && O(e, "添加设备", E("设备名称", "name", "required maxlength=\"80\"") + ne("硬件型号", "target_id", te(s.targets)) + ne("更新通道", "channel", "<option value=\"stable\">stable · 稳定版</option><option value=\"beta\">beta · 测试版</option>") + ne("联网方式", "gateway_id", "<option value=\"\">直接联网 · 生成独立凭据</option>" + te(s.gateways.filter((e) => !e.revoked)))), e === "gateway" && O(e, "添加联网网关", E("网关名称", "name", "required maxlength=\"80\"") + "<p class=\"form-hint\">网关只能代理分配给它的子设备，目标 MCU 需实现匹配的 Bootloader 和传输协议。</p>"), e === "upload" && O(e, "上传签名固件", "<div class=\"notice\">导出硬件配置，在本机生成 manifest.json 和 signature.txt，再上传以下三个文件。</div><label>固件文件<input name=\"firmware\" type=\"file\" required accept=\".bin\"></label><label>manifest.json<input name=\"manifest\" type=\"file\" required accept=\".json\"></label><label>signature.txt<input name=\"signature\" type=\"file\" required accept=\".txt,.sig\"></label><label>更新说明<textarea name=\"notes\" maxlength=\"2000\"></textarea></label>", "上传并验证"), e === "publish") {
					let i = null;
					if (t) {
						if (i = await v("/api/admin/artifacts/" + encodeURIComponent(t)), a !== f) return;
						if (!i.can_publish) throw Error(i.publish_block_reasons?.join("；") || i.firmware_message || "此固件当前不可发布");
					}
					let o = s.artifacts.filter((e) => e.can_publish);
					if (i && !o.some((e) => e.id === i.id) && o.unshift(i), !o.length) {
						_("请先上传可用且已验证的固件", !0);
						return;
					}
					let c = o.map((e) => ({
						...e,
						label: `${e.version} · ${e.target_name} · SHA ${e.sha256.slice(0, 10)} · ${e.id.slice(0, 8)}`
					}));
					O(e, "发布固件", ne("固件版本 / 构建", "artifact_id", te(c, "label", !1)) + ne("发布通道", "channel", "<option value=\"stable\">stable · 稳定版</option><option value=\"beta\">beta · 测试版</option>") + "<label>发布说明<textarea name=\"notes\" maxlength=\"2000\"></textarea></label><div class=\"notice\">请核对固件摘要与通道。发布将替代此硬件型号、此通道的活动发布。</div>", "确认发布");
					let l = r("#entry-form");
					l.publishArtifacts = o, t && (r("[name=artifact_id]", l).value = t), n && (r("[name=channel]", l).value = n.channel), r("[name=notes]", l).value = n ? n.notes : (i || o[0]).notes || "";
				}
				e === "channel" && (O(e, "切换设备更新通道", ne("更新通道", "channel", "<option value=\"stable\">stable · 稳定版</option><option value=\"beta\">beta · 测试版</option>")), r("#entry-form").dataset.id = t, r("[name=channel]", r("#dialog")).value = s.devices.find((e) => e.id === t).channel);
			}
		}
	}
	function se() {
		let e = r("#entry-form");
		r("[name=key_id]", e).innerHTML = te(s.keys.filter((t) => t.product_id === r("[name=product_id]", e).value && !t.revoked));
	}
	function ce() {
		let e = r("#entry-form"), t = {
			"esp-idf-app": {
				name: "ESP32-S3 桌面伴侣",
				id: "desktop-s3-n8r8-st7735s-v1",
				mcu: "ESP32-S3",
				layout_id: "ota-3m-v1",
				max_size: 3145728,
				config: {
					chip_id: 9,
					project_name: "00_BASIC"
				}
			},
			"raw-cortexm": {
				name: "STM32 自定义应用",
				id: "stm32-custom-v1",
				mcu: "请填写精确型号",
				layout_id: "stm32-app-v1",
				max_size: 262144,
				config: {
					app_address: 134250496,
					ram_start: 536870912,
					ram_size: 65536
				}
			},
			"mcuboot-image": {
				name: "MCUboot 应用目标",
				id: "mcuboot-target-v1",
				mcu: "请填写精确型号",
				layout_id: "mcuboot-slot-v1",
				max_size: 262144,
				config: {
					header_size: 512,
					load_address: 0
				}
			}
		}[r("[name=adapter]", e).value];
		for (let [n, i] of Object.entries(t)) r(`[name="${n}"]`, e).value = n === "config" ? JSON.stringify(i, null, 2) : i;
	}
	n(document, "change", async (e) => {
		e.target.id === "pem-file" && e.target.files[0] && (r("[name=pem]", r("#dialog")).value = await e.target.files[0].text()), e.target.name === "product_id" && r("#entry-form")?.dataset.kind === "target" && se(), e.target.name === "adapter" && ce(), e.target.name === "artifact_id" && r("#entry-form")?.dataset.kind === "publish" && (r("[name=notes]", r("#dialog")).value = (r("#entry-form").publishArtifacts || s.artifacts).find((t) => t.id === e.target.value)?.notes || "");
	}), n(document, "submit", async (e) => {
		if (!e.target.matches("form#entry-form")) return;
		e.preventDefault();
		let t = e.target, n = t.dataset.kind, i = Object.fromEntries(new FormData(t)), a = r("[type=submit]", t), o = r(".form-error", t);
		if (g()) {
			a.disabled = !0, o.hidden = !0;
			try {
				let e;
				if (n === "release-edit") e = await v("/api/admin/releases/" + encodeURIComponent(t.dataset.id), {
					method: "PATCH",
					body: JSON.stringify(i)
				});
				else if (n === "release-delete") e = await y("/api/admin/releases/" + encodeURIComponent(t.dataset.id) + "/delete", {});
				else if (n === "manage-edit") e = await v("/api/admin/" + t.dataset.collection + "/" + encodeURIComponent(t.dataset.id), {
					method: "PATCH",
					body: JSON.stringify(i)
				});
				else if (n === "manage-delete") e = await y("/api/admin/" + t.dataset.collection + "/" + encodeURIComponent(t.dataset.id) + "/delete", {});
				else if (n === "target") {
					i.max_size = Number(i.max_size), i.config = JSON.parse(i.config), i.capabilities = ["staging", "app_confirm"];
					for (let e of ["rollback", "gateway_transport"]) i[e] && i.capabilities.push(e), delete i[e];
					e = await y("/api/admin/targets", i);
				} else n === "device" ? (i.gateway_id ||= null, e = await y("/api/admin/devices", i)) : e = n === "upload" ? await v("/api/admin/artifacts", {
					method: "POST",
					body: new FormData(t)
				}) : n === "channel" ? await y("/api/admin/devices/" + t.dataset.id + "/channel", i) : await y("/api/admin/" + {
					product: "products",
					key: "keys",
					gateway: "gateways",
					publish: "releases"
				}[n], i);
				t.isConnected && r("#entry-form") === t && re(), _(n === "upload" ? e.duplicate ? "固件已存在" : "固件验证通过，已存入固件库" : "操作成功"), await T(), e.token && k(e);
			} catch (e) {
				t.isConnected ? (o.textContent = e.message, o.hidden = !1) : _(e.message, !0);
			} finally {
				t.isConnected && (a.disabled = !d);
			}
		}
	});
	let le = async (e) => {
		let t = e.target.closest("[data-action]");
		if (!t) return;
		let { action: n, id: a } = t.dataset;
		if ([
			"product",
			"key",
			"target",
			"device",
			"gateway",
			"pack",
			"upload",
			"publish",
			"channel",
			"delete-artifact",
			"edit-release",
			"delete-release",
			"republish",
			...Object.keys(ae).flatMap((e) => ["edit-" + e, "delete-" + e])
		].includes(n)) try {
			await oe(n, a);
		} catch (e) {
			_(e.message, !0);
		}
		else try {
			if (n === "close") {
				re();
				return;
			}
			if (n === "copy-token") {
				await navigator.clipboard.writeText(r("#secret-token").textContent), _("密钥已复制");
				return;
			}
			if (n === "profile") {
				ie(await v("/api/admin/targets/" + a + "/profile"), a + ".profile.json"), _("型号配置已导出");
				return;
			}
			if (n === "events") {
				let e = ++f, t = await v("/api/admin/attempts/" + a + "/events");
				if (e !== f) return;
				D("升级事件", t.length ? t.map((e) => {
					let t = JSON.parse(e.payload);
					return `<div class="setup-step"><span class="step-num">${e.seq}</span><div class="step-text"><b>${i(o[t.state] || t.state)}</b><p>${i(b(e.created))} · ${t.progress}%</p>${t.error ? `<p>${i(t.error)}</p>` : ""}</div></div>`;
				}).join("") : C("暂无事件", "设备尚未上报安装进度。"));
				return;
			}
			if (!confirm({
				withdraw: "撤回后新的升级尝试不能选择它，已创建的下载仍绑定原文件。继续吗？",
				revoke: "停用此凭据？网关凭据停用会同时影响其子设备。",
				rotate: "旧密钥会立即失效，请准备更新设备或网关配置。继续吗？",
				"revoke-key": "吊销公钥将停止相关固件的检查和下载。继续吗？"
			}[n] || "确认操作？")) return;
			let e = n === "withdraw" ? "/api/admin/releases/" + a + "/withdraw" : n === "revoke-key" ? "/api/admin/keys/" + a + "/revoke" : "/api/admin/agents/" + a + "/" + (n === "rotate" ? "rotate" : "revoke"), t = await y(e);
			_("操作成功"), await T(), t.token && k(t);
		} catch (e) {
			_(e.message, !0);
		}
	};
	n(document, "click", le), n(r("#dialog-close"), "click", re), n(r("#dialog"), "cancel", re), n(r("#refresh"), "click", T), n(document, "visibilitychange", () => {
		document.hidden || T();
	}), n(r("#logout"), "click", async () => {
		try {
			await y("/api/admin/logout"), location.href = "/login";
		} catch (e) {
			_(e.message, !0);
		}
	}), n(r("#help"), "click", () => D("开始使用 OTA Station", "<p class=\"muted\">1. 创建产品，首次生成签名密钥，仅将公钥添加到后台。</p><p class=\"muted\">2. 创建精确硬件型号，添加设备并保存凭据。</p><p class=\"muted\">3. 首次打包时导入 private.pem，之后只需选择设备、应用 bin，写下更新说明；版本、摘要和清单自动读取或生成。</p><p class=\"muted\">4. 服务器复核通过后，点击“确认发布”。发布影响同型号、同通道的设备，不只限于所选设备。</p><p class=\"form-hint\">签名权限作为不可导出的 CryptoKey 保存在当前浏览器 IndexedDB；原 PEM 和解锁密码不保存、不发送服务器。加密私钥仅首次导入需原密码，后续无需输入。仅在可信个人电脑使用，清除网站数据或换浏览器后需重新导入；请离线备份原私钥。已有离线签名文件可使用高级三文件上传。ESP32、STM32 仍需匹配客户端与 Bootloader。详见 README。</p>"));
	let ue = null;
	return {
		handleClick: le,
		refresh: T,
		openForm: oe,
		closeDialog: re,
		request: v,
		start() {
			return ue = setInterval(() => {
				document.hidden || T(!1);
			}, 15e3), T();
		},
		dispose() {
			ue && clearInterval(ue), t.forEach((e) => e()), re();
		}
	};
}
// src/format.js
var $a = {
	overview: "总览",
	products: "产品与硬件",
	devices: "设备与网关",
	artifacts: "固件文件",
	releases: "版本发布",
	attempts: "升级记录"
}, eo = (e) => e ? (/* @__PURE__ */ new Date(e * 1e3)).toLocaleString("zh-CN", { hour12: !1 }) : "尚未联系", to = (e) => e >= 1048576 ? (e / 1048576).toFixed(2) + " MiB" : e >= 1024 ? Math.round(e / 1024) + " KiB" : e + " B", no = (e, t, n) => !t.trim() || n.some((n) => String(e[n] ?? "").toLowerCase().includes(t.trim().toLowerCase())), ro = {
	created: "已创建",
	downloading: "正在下载",
	downloaded: "下载完成",
	transferring: "传输中",
	validating: "校验中",
	installing: "安装中",
	pending_boot: "等待启动确认",
	confirmed: "升级成功",
	failed: "升级失败",
	rolled_back: "已回滚"
}, io = (e) => e === "confirmed" ? "green" : e === "failed" ? "red" : ["rolled_back", "pending_boot"].includes(e) ? "amber" : "blue", ao = {
	available: ["文件可用", "green"],
	deleted: ["固件已删除", "red"],
	missing: ["文件缺失", "amber"],
	corrupt: ["校验异常", "red"],
	storage_error: ["存储不可读", "red"],
	unknown: ["状态待确认", ""]
}, oo = {
	class: "ui-icon",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": "1.65",
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
	"aria-hidden": "true"
}, so = {
	key: 0,
	cx: "12",
	cy: "12",
	r: "9"
}, co = ["d"], lo = {
	__name: "Icon",
	props: { name: String },
	setup(e) {
		let t = e, n = {
			overview: [
				"M3.5 3.5h6v7h-6z",
				"M14.5 3.5h6v4h-6z",
				"M3.5 15.5h6v5h-6z",
				"M14.5 11.5h6v9h-6z"
			],
			products: [
				"m12 3 9 5-9 5-9-5 9-5Z",
				"m3 12 9 5 9-5",
				"m3 16 9 5 9-5"
			],
			devices: [
				"M7 3h10v18H7z",
				"M10 6h4",
				"M11 18h2",
				"M3 8v8",
				"M21 8v8"
			],
			artifacts: [
				"M7 3h7l4 4v14H6V3h1Z",
				"M14 3v5h4",
				"M9 12h6",
				"M9 16h4"
			],
			releases: [
				"M12 15V3",
				"m7 8 5-5 5 5",
				"M4 14v6h16v-6"
			],
			attempts: [
				"M4 6h2",
				"M10 6h10",
				"M4 12h2",
				"M10 12h10",
				"M4 18h2",
				"M10 18h10"
			],
			refresh: [
				"M20 11a8 8 0 0 0-14-5L3 9",
				"M3 3v6h6",
				"M4 13a8 8 0 0 0 14 5l3-3",
				"M15 15h6v6"
			],
			help: ["M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4", "M12 17h.01"],
			clock: ["M12 8v5l3 2"],
			logout: [
				"M9 4H4v16h5",
				"M10 12h10",
				"m16 8 4 4-4 4"
			],
			theme: ["M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"]
		}, r = Z(() => n[t.name] || n.products);
		return (t, n) => (W(), G("svg", oo, [e.name === "help" || e.name === "clock" ? (W(), G("circle", so)) : X("", !0), (W(!0), G(U, null, H(r.value, (e, t) => (W(), G("path", {
			key: t,
			d: e
		}, null, 8, co))), 128))]));
	}
}, uo = { class: "page-head" }, fo = { class: "head-buttons" }, po = {
	__name: "PageHeader",
	props: {
		title: String,
		description: String
	},
	setup(e) {
		return (t, n) => (W(), G("div", uo, [q("div", null, [q("h1", null, j(e.title), 1), q("p", null, j(e.description), 1)]), q("div", fo, [or(t.$slots, "default")])]));
	}
}, mo = { class: "section" }, ho = { class: "section-head" }, go = { class: "panel-extra" }, _o = {
	__name: "Panel",
	props: { title: String },
	setup(e) {
		return (t, n) => (W(), G("section", mo, [q("div", ho, [q("h2", null, j(e.title), 1), q("div", go, [or(t.$slots, "extra")])]), or(t.$slots, "default")]));
	}
}, vo = { class: "empty" }, yo = {
	__name: "Empty",
	props: {
		title: String,
		description: String
	},
	setup(e) {
		return (t, n) => (W(), G("div", vo, [
			n[0] ||= q("div", { class: "empty-symbol" }, "↥", -1),
			q("h3", null, j(e.title), 1),
			q("p", null, j(e.description), 1),
			or(t.$slots, "default")
		]));
	}
}, bo = [
	"data-action",
	"data-id",
	"disabled"
], Q = {
	__name: "Action",
	props: {
		kind: String,
		id: {
			type: String,
			default: ""
		},
		tone: {
			type: String,
			default: ""
		},
		disabled: Boolean,
		readonly: Boolean
	},
	setup(e) {
		let { ready: t } = Mn("admin");
		return (n, r) => (W(), G("button", {
			type: "button",
			"data-action": e.kind,
			"data-id": e.id,
			class: A(e.tone),
			disabled: e.disabled || !R(t) && !e.readonly
		}, [or(n.$slots, "default")], 10, bo));
	}
}, $ = {
	__name: "Badge",
	props: { tone: {
		type: String,
		default: ""
	} },
	setup(e) {
		return (t, n) => (W(), G("span", { class: A(["badge", e.tone]) }, [or(t.$slots, "default")], 2));
	}
}, xo = {
	__name: "Table",
	props: {
		columns: Array,
		kind: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		return (t, n) => (W(), G("div", { class: A(["table-wrap management-table", e.kind]) }, [q("table", null, [q("thead", null, [q("tr", null, [(W(!0), G(U, null, H(e.columns, (e) => (W(), G("th", { key: e }, j(e), 1))), 128))])]), q("tbody", null, [or(t.$slots, "default")])])], 2));
	}
}, So = {
	"wifi connection": "连接 Wi-Fi",
	"clock sync": "同步设备时间",
	"manifest request": "获取固件清单",
	"manifest verification": "验证固件清单",
	"partition selection": "选择备用分区",
	"save upgrade journal": "保存升级记录",
	"attempt request": "创建升级记录",
	"save download event": "保存下载进度",
	"firmware connection": "连接固件下载地址",
	"firmware length": "检查固件长度",
	"firmware header": "检查固件头",
	"prepare flash": "准备备用分区",
	"firmware download": "下载固件",
	"image verification": "校验固件",
	"select boot partition": "设置启动分区",
	"boot verification": "启动自检"
}, Co = /* @__PURE__ */ new Set([
	"manifest request",
	"attempt request",
	"firmware connection",
	"firmware download"
]);
function wo(e, t, n) {
	let r = t;
	return n === 401 ? r = "服务器拒绝了设备凭据，请核对设备标识和访问密钥" : n === 0 && Co.has(e) ? r = "未收到 HTTP 响应，请检查服务器地址和网络连接" : n >= 400 ? r = "服务器返回 HTTP " + n : e === "firmware download" && (r = "固件传输未完整结束"), (So[e] || e) + " · " + r + (r === t ? "" : "（" + t + "）");
}
function To(e) {
	let t = /^([a-z ]+) failed: ([\w:()-]+) \(HTTP (\d+)\)$/.exec(e || "");
	return t ? wo(t[1], t[2], Number(t[3])) : e;
}
// \0plugin-vue:export-helper
var Eo = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, Do = {
	key: 0,
	role: "status"
}, Oo = { key: 1 }, ko = { key: 0 }, Ao = { key: 1 }, jo = {
	key: 0,
	class: "command-error"
}, Mo = {
	key: 0,
	role: "status"
}, No = /*#__PURE__*/ Eo({
	__name: "UpgradeTimeline",
	props: {
		commandId: String,
		attemptId: String,
		modal: Boolean
	},
	emits: ["close"],
	setup(e, { emit: t }) {
		let n = e, r = t, { request: i } = Mn("admin"), a = /* @__PURE__ */ L(null), o = /* @__PURE__ */ L(null), s = /* @__PURE__ */ L(""), c = {
			...ro,
			queued: "已下发",
			claimed: "设备已领取",
			executing: "设备开始执行",
			created: "已创建升级记录",
			succeeded: "指令执行成功",
			expired: "等待领取或执行超时"
		}, l, u, d = !1;
		async function f() {
			if (d || u) return;
			u = new AbortController();
			let e = setTimeout(() => u?.abort(), 12e3);
			try {
				let e = n.commandId ? "commands/" + encodeURIComponent(n.commandId) : "attempts/" + encodeURIComponent(n.attemptId), t = await i("/api/admin/" + e + "/timeline", { signal: u.signal });
				d || (o.value = t, s.value = "");
			} catch (e) {
				d || (s.value = e.status === 404 ? "未找到时间线，请确认后台已更新。" : "暂时无法读取时间线，将自动重试。");
			} finally {
				clearTimeout(e), u = null, !d && !o.value?.terminal && (l = setTimeout(f, 5e3));
			}
		}
		return $n(() => {
			n.modal && a.value.showModal(), f();
		}), er(() => {
			d = !0, clearTimeout(l), u?.abort();
		}), (t, n) => (W(), K(rr(e.modal ? "dialog" : "section"), {
			ref_key: "box",
			ref: a,
			class: "upgrade-timeline",
			"aria-label": "升级时间线",
			onCancel: n[1] ||= Ga((e) => r("close"), ["prevent"])
		}, {
			default: V(() => [
				q("header", null, [n[2] ||= q("h3", null, "升级时间线", -1), e.modal ? (W(), G("button", {
					key: 0,
					type: "button",
					"aria-label": "关闭时间线",
					onClick: n[0] ||= (e) => r("close")
				}, "关闭")) : X("", !0)]),
				s.value ? (W(), G("p", Do, j(s.value), 1)) : o.value ? X("", !0) : (W(), G("p", Oo, "正在读取…")),
				o.value ? (W(), G(U, { key: 2 }, [
					q("ol", null, [(W(!0), G(U, null, H(o.value.steps, (e, t) => (W(), G("li", { key: t }, [
						q("div", null, [q("strong", null, j(c[e.stage] || e.stage), 1), e.stage === "downloading" ? (W(), G("b", ko, j(e.progress) + "%", 1)) : e.stage === "failed" && e.progress > 0 ? (W(), G("b", Ao, " · 失败时 " + j(e.progress) + "%", 1)) : X("", !0)]),
						q("small", null, j(R(eo)(e.received)) + " · +" + j(Math.max(0, Math.round(e.received - o.value.steps[0].received))) + " 秒", 1),
						e.error ? (W(), G("p", jo, j(R(To)(e.error)), 1)) : X("", !0)
					]))), 128))]),
					n[3] ||= q("small", null, "时间按后台接收记录计算，离线补报的多个步骤可能在同一秒出现。", -1),
					o.value.terminal ? X("", !0) : (W(), G("p", Mo, "等待设备更新，当前显示最后收到的记录。"))
				], 64)) : X("", !0)
			]),
			_: 1
		}, 544));
	}
}, [["__scopeId", "data-v-15c2e919"]]), Po = { class: "mono" }, Fo = ["value"], Io = ["title"], Lo = ["onClick"], Ro = {
	__name: "AttemptTable",
	props: { rows: Array },
	setup(e) {
		let t = /* @__PURE__ */ L("");
		return (n, r) => (W(), G(U, null, [J(xo, { columns: [
			"设备",
			"目标版本",
			"状态 / 进度",
			"更新时间",
			"操作"
		] }, {
			default: V(() => [(W(!0), G(U, null, H(e.rows, (e) => (W(), G("tr", { key: e.id }, [
				q("td", null, [q("strong", null, j(e.device_name), 1), q("small", null, j(e.target_name), 1)]),
				q("td", null, [q("strong", null, j(e.version), 1), q("small", Po, "#" + j(e.id.slice(0, 8)), 1)]),
				q("td", null, [J($, { tone: R(io)(e.state) }, {
					default: V(() => [Y(j(R(ro)[e.state] || e.state), 1)]),
					_: 2
				}, 1032, ["tone"]), q("progress", {
					max: "100",
					value: e.progress
				}, null, 8, Fo)]),
				q("td", null, [Y(j(R(eo)(e.updated)), 1), e.error ? (W(), G("small", {
					key: 0,
					title: e.error
				}, j(e.error), 9, Io)) : X("", !0)]),
				q("td", null, [q("button", {
					type: "button",
					"data-attempt-timeline": "",
					onClick: (n) => t.value = e.id
				}, "查看升级时间线", 8, Lo)])
			]))), 128))]),
			_: 1
		}), t.value ? (W(), K(No, {
			key: t.value,
			"attempt-id": t.value,
			modal: "",
			onClose: r[0] ||= (e) => t.value = ""
		}, null, 8, ["attempt-id"])) : X("", !0)], 64));
	}
}, zo = { class: "stats" }, Bo = { class: "stat-top" }, Vo = { class: "stat-icon" }, Ho = { class: "stat-foot" }, Uo = { class: "overview-grid" }, Wo = { class: "section-body" }, Go = ["href"], Ko = { class: "step-num" }, qo = { class: "step-text" }, Jo = { class: "section-body workspace-facts" }, Yo = { key: 0 }, Xo = {
	__name: "Overview",
	setup(e) {
		let { snapshot: t } = Mn("admin"), n = Z(() => {
			let e = t.value;
			return [
				[
					"在线设备",
					e.overview.online_devices,
					`已登记 ${e.overview.devices} 台设备`,
					"devices"
				],
				[
					"活动发布",
					e.overview.active_releases,
					"stable / beta 更新通道",
					"releases"
				],
				[
					"等待完成",
					e.overview.pending_attempts,
					"以应用启动确认为准",
					"clock"
				],
				[
					"硬件型号",
					e.overview.targets,
					`${e.overview.products} 个产品 · 独立校验规则`,
					"products"
				]
			];
		}), r = Z(() => t.value.releases.filter((e) => e.active)), i = Z(() => !t.value.targets.length || !t.value.devices.length), a = Z(() => [
			[
				"建立产品与硬件配置",
				"明确镜像格式、容量和签名公钥。",
				t.value.targets.length > 0,
				"products"
			],
			[
				"添加设备或联网网关",
				"设备使用独立凭据接入。",
				t.value.devices.length > 0,
				"devices"
			],
			[
				"打包并上传固件",
				"在本机检查、计算摘要并签名。",
				t.value.artifacts.length > 0,
				"artifacts"
			],
			[
				"确认发布到更新通道",
				"由你决定何时让设备发现更新。",
				t.value.releases.length > 0,
				"releases"
			]
		]);
		return (e, o) => (W(), G(U, null, [
			J(po, {
				title: "工作台总览",
				description: "设备状态、固件发布与升级进度，一处掌握。"
			}, {
				default: V(() => [J(Q, {
					kind: "pack",
					tone: "primary"
				}, {
					default: V(() => [...o[0] ||= [Y("＋ 打包并上传", -1)]]),
					_: 1
				})]),
				_: 1
			}),
			q("div", zo, [(W(!0), G(U, null, H(n.value, ([e, t, n, r]) => (W(), G("div", {
				key: e,
				class: "stat"
			}, [
				q("div", Bo, [Y(j(e), 1), q("span", Vo, [J(lo, { name: r }, null, 8, ["name"])])]),
				q("strong", null, j(t), 1),
				q("div", Ho, j(n), 1)
			]))), 128))]),
			q("div", Uo, [q("div", null, [J(_o, { title: "最近升级" }, {
				extra: V(() => [...o[1] ||= [q("a", {
					class: "section-link",
					href: "#attempts"
				}, "查看全部 →", -1)]]),
				default: V(() => [R(t).attempts.length ? (W(), K(Ro, {
					key: 0,
					rows: R(t).attempts.slice(0, 6)
				}, null, 8, ["rows"])) : (W(), K(yo, {
					key: 1,
					title: "还没有升级记录",
					description: "添加设备并发布固件后，每次下载与启动确认都会在这里留下记录。"
				}))]),
				_: 1
			}), J(_o, { title: "当前发布" }, {
				default: V(() => [r.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"硬件型号",
						"版本",
						"通道",
						"发布时间"
					]
				}, {
					default: V(() => [(W(!0), G(U, null, H(r.value.slice(0, 5), (e) => (W(), G("tr", { key: e.id }, [
						q("td", null, [q("strong", null, j(e.target_name), 1)]),
						q("td", null, j(e.version), 1),
						q("td", null, [J($, { tone: e.channel === "stable" ? "green" : "blue" }, {
							default: V(() => [Y(j(e.channel), 1)]),
							_: 2
						}, 1032, ["tone"])]),
						q("td", null, j(R(eo)(e.created)), 1)
					]))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: "准备你的第一个版本",
					description: "固件校验通过后保存，由你决定何时发布。"
				}, {
					default: V(() => [J(Q, {
						kind: "pack",
						tone: "secondary"
					}, {
						default: V(() => [...o[2] ||= [Y("打包并上传", -1)]]),
						_: 1
					})]),
					_: 1
				}))]),
				_: 1
			})]), q("div", null, [i.value ? (W(), K(_o, {
				key: 0,
				title: "从这里开始"
			}, {
				default: V(() => [q("div", Wo, [(W(!0), G(U, null, H(a.value, ([e, t, n, r], i) => (W(), G("a", {
					key: r,
					class: A(["setup-step", { done: n }]),
					href: "#" + r
				}, [q("span", Ko, j(n ? "✓" : i + 1), 1), q("div", qo, [q("b", null, j(e), 1), q("p", null, j(t), 1)])], 10, Go))), 128))])]),
				_: 1
			})) : X("", !0), J(_o, { title: "工作区状态" }, {
				default: V(() => [q("div", Jo, [
					q("p", null, [
						o[3] ||= Y("固件存储 ", -1),
						q("b", null, j(R(to)(R(t).overview.storage_bytes)), 1),
						R(t).overview.storage_warning ? (W(), G("small", Yo, "统计不完整，请检查存储权限")) : X("", !0)
					]),
					o[4] ||= q("p", null, [Y("镜像适配 "), q("b", null, "ESP-IDF / MCUboot / Cortex-M")], -1),
					o[5] ||= q("div", { class: "quiet-note" }, "文件传输完成不等于升级成功；成功状态来自设备新应用的启动确认。", -1)
				])]),
				_: 1
			})])])
		], 64));
	}
}, Zo = {
	__name: "ResourceActions",
	props: {
		kind: String,
		item: Object
	},
	setup(e) {
		return (t, n) => (W(), G(U, null, [J(Q, {
			kind: "edit-" + e.kind,
			id: e.item.id
		}, {
			default: V(() => [...n[0] ||= [Y("编辑", -1)]]),
			_: 1
		}, 8, ["kind", "id"]), J(Q, {
			kind: "delete-" + e.kind,
			id: e.item.id,
			tone: "danger"
		}, {
			default: V(() => [...n[1] ||= [Y("删除", -1)]]),
			_: 1
		}, 8, ["kind", "id"])], 64));
	}
}, Qo = { class: "resource-toolbar" }, $o = { class: "search-field" }, es = { class: "result-count" }, ts = {
	key: 0,
	class: "product-grid"
}, ns = { class: "product-mark" }, rs = { class: "mono muted" }, is = { class: "actions" }, as = { class: "actions" }, os = ["title"], ss = { class: "actions" }, cs = {
	__name: "Products",
	setup(e) {
		let { snapshot: t } = Mn("admin"), n = /* @__PURE__ */ L(""), r = Z(() => t.value.products.filter((e) => no(e, n.value, [
			"id",
			"name",
			"description"
		]))), i = Z(() => t.value.targets.filter((e) => no(e, n.value, [
			"id",
			"name",
			"product_id",
			"mcu",
			"adapter"
		]))), a = Z(() => t.value.keys.filter((e) => no(e, n.value, [
			"id",
			"name",
			"product_id"
		]))), o = (e) => t.value.products.find((t) => t.id === e)?.name || e;
		return (e, s) => (W(), G(U, null, [
			J(po, {
				title: "产品与硬件",
				description: "以产品组织设备，以精确板型校验每一份固件。"
			}, {
				default: V(() => [
					J(Q, {
						kind: "product",
						tone: "primary"
					}, {
						default: V(() => [...s[1] ||= [Y("＋ 新建产品", -1)]]),
						_: 1
					}),
					J(Q, { kind: "key" }, {
						default: V(() => [...s[2] ||= [Y("添加公钥", -1)]]),
						_: 1
					}),
					J(Q, { kind: "target" }, {
						default: V(() => [...s[3] ||= [Y("新增硬件型号", -1)]]),
						_: 1
					})
				]),
				_: 1
			}),
			q("div", Qo, [q("div", $o, [s[4] ||= q("span", null, "⌕", -1), kn(q("input", {
				"onUpdate:modelValue": s[0] ||= (e) => n.value = e,
				type: "search",
				placeholder: "搜索产品、型号、MCU 或标识",
				"aria-label": "搜索产品和硬件"
			}, null, 512), [[Ra, n.value]])]), q("span", es, j(R(t).products.length) + " 个产品 · " + j(R(t).targets.length) + " 个型号", 1)]),
			r.value.length ? (W(), G("div", ts, [(W(!0), G(U, null, H(r.value, (e) => (W(), G("div", {
				key: e.id,
				class: "product-card"
			}, [
				q("div", ns, [s[5] ||= q("span", null, "▧", -1), J($, null, {
					default: V(() => [Y(j(R(t).targets.filter((t) => t.product_id === e.id).length) + " 个型号", 1)]),
					_: 2
				}, 1024)]),
				q("h3", null, j(e.name), 1),
				q("small", rs, j(e.id), 1),
				q("p", null, j(e.description || "尚未填写产品说明"), 1),
				q("div", is, [J(Zo, {
					kind: "product",
					item: e
				}, null, 8, ["item"])])
			]))), 128))])) : R(t).products.length ? X("", !0) : (W(), K(_o, {
				key: 1,
				title: "产品"
			}, {
				default: V(() => [J(yo, {
					title: "先建立一个产品",
					description: "例如桌面伴侣或温湿度采集器，再添加公钥和硬件型号。"
				}, {
					default: V(() => [J(Q, {
						kind: "product",
						tone: "secondary"
					}, {
						default: V(() => [...s[6] ||= [Y("新建产品", -1)]]),
						_: 1
					})]),
					_: 1
				})]),
				_: 1
			})),
			J(_o, { title: "硬件型号" }, {
				default: V(() => [i.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"型号 / 标识",
						"产品 / MCU",
						"镜像格式",
						"最大镜像",
						"启动能力",
						"操作"
					]
				}, {
					default: V(() => [(W(!0), G(U, null, H(i.value, (e) => (W(), G("tr", { key: e.id }, [
						q("td", null, [q("strong", null, j(e.name), 1), q("small", null, j(e.id), 1)]),
						q("td", null, [Y(j(o(e.product_id)), 1), q("small", null, j(e.mcu) + " · " + j(e.hw_revision), 1)]),
						q("td", null, [q("code", null, j(e.adapter), 1)]),
						q("td", null, j(R(to)(e.max_size)), 1),
						q("td", null, [J($, { tone: e.capabilities.includes("rollback") ? "green" : "amber" }, {
							default: V(() => [Y(j(e.capabilities.includes("rollback") ? "可回滚" : "无自动回滚"), 1)]),
							_: 2
						}, 1032, ["tone"])]),
						q("td", null, [q("div", as, [J(Q, {
							kind: "profile",
							id: e.id,
							readonly: ""
						}, {
							default: V(() => [...s[7] ||= [Y("导出配置", -1)]]),
							_: 1
						}, 8, ["id"]), J(Zo, {
							kind: "target",
							item: e
						}, null, 8, ["item"])])])
					]))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: n.value ? "没有匹配的硬件型号" : "还没有硬件型号",
					description: "兼容参数保持不可变；芯片、布局或公钥变化时新增型号。"
				}, null, 8, ["title"]))]),
				_: 1
			}),
			J(_o, { title: "签名公钥" }, {
				default: V(() => [a.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"名称",
						"所属产品",
						"指纹",
						"状态",
						"操作"
					]
				}, {
					default: V(() => [(W(!0), G(U, null, H(a.value, (e) => (W(), G("tr", { key: e.id }, [
						q("td", null, [q("strong", null, j(e.name), 1)]),
						q("td", null, j(o(e.product_id)), 1),
						q("td", {
							class: "mono",
							title: e.id
						}, j(e.id.slice(0, 20)) + "…", 9, os),
						q("td", null, [J($, { tone: e.revoked ? "red" : "green" }, {
							default: V(() => [Y(j(e.revoked ? "已吊销" : "可用"), 1)]),
							_: 2
						}, 1032, ["tone"])]),
						q("td", null, [q("div", ss, [J(Zo, {
							kind: "key",
							item: e
						}, null, 8, ["item"]), e.revoked ? X("", !0) : (W(), K(Q, {
							key: 0,
							kind: "revoke-key",
							id: e.id,
							tone: "danger"
						}, {
							default: V(() => [...s[8] ||= [Y("吊销", -1)]]),
							_: 1
						}, 8, ["id"]))])])
					]))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: n.value ? "没有匹配的签名公钥" : "只需添加公钥",
					description: "签名在本机进行，私钥不会上传服务器。"
				}, null, 8, ["title"]))]),
				_: 1
			})
		], 64));
	}
}, ls = {
	queued: "等待设备接收",
	claimed: "设备已接收",
	executing: "正在执行",
	succeeded: "执行成功",
	failed: "执行失败",
	expired: "等待已过期"
}, us = {
	"ota.install": "固件升级",
	"device.restart": "设备重启"
}, ds = (e) => !!e && [
	"queued",
	"claimed",
	"executing"
].includes(e.status), fs = (e) => e?.status === "succeeded" ? "green" : e?.status === "failed" ? "red" : e?.status === "expired" ? "amber" : "blue", ps = (e) => e?.capabilities?.features?.includes("remote_commands") === !0, ms = (e, t) => !e.revoked && !!e.last_seen && t - e.last_seen < 180;
function hs(e, t) {
	return ps(t) ? e.revoked ? "设备凭据已停用" : e.agent_kind === "device" ? e.remote_commands_version === 1 ? ds(e.latest_command) ? "设备还有未结束的指令，请查看控制记录" : "" : "请先安装支持远程控制的设备固件" : "此网关尚未接入远程指令" : "请重启 OTA 后台并刷新页面，以启用远程控制";
}
// src/components/DeviceCommands.vue
var gs = { class: "dialog-heading" }, _s = { id: "device-control-title" }, vs = { class: "device-control-body" }, ys = { class: "command-device" }, bs = {
	key: 0,
	class: "command-version"
}, xs = {
	key: 1,
	class: "command-description"
}, Ss = {
	key: 2,
	class: "command-description"
}, Cs = { class: "notice command-queue-note" }, ws = { class: "command-expiry" }, Ts = ["disabled"], Es = {
	key: 3,
	class: "form-hint"
}, Ds = {
	key: 4,
	class: "form-hint"
}, Os = {
	key: 1,
	class: "command-receipt",
	role: "status",
	"aria-live": "polite"
}, ks = { key: 0 }, As = {
	key: 1,
	class: "command-error"
}, js = {
	key: 2,
	class: "form-error",
	role: "alert"
}, Ms = {
	key: 4,
	class: "command-receipt"
}, Ns = { class: "command-error" }, Ps = { class: "command-history" }, Fs = { class: "command-history-heading" }, Is = ["disabled"], Ls = {
	key: 0,
	class: "form-hint",
	role: "status"
}, Rs = {
	key: 1,
	class: "command-history-list"
}, zs = { class: "command-history-line" }, Bs = { key: 0 }, Vs = {
	key: 0,
	class: "command-error"
}, Hs = ["onClick"], Us = {
	key: 2,
	class: "form-hint"
}, Ws = { class: "form-actions" }, Gs = ["disabled"], Ks = {
	__name: "DeviceCommands",
	props: {
		deviceId: {
			type: String,
			required: !0
		},
		kind: {
			type: String,
			default: ""
		}
	},
	emits: ["close"],
	setup(e, { emit: t }) {
		let n = /* @__PURE__ */ L(""), r = /* @__PURE__ */ L(null), i = e, a = t, { snapshot: o, ready: s, request: c, refresh: l } = Mn("admin"), u = /* @__PURE__ */ L(null), d = /* @__PURE__ */ L([]), f = /* @__PURE__ */ L(null), p = /* @__PURE__ */ L(!1), m = /* @__PURE__ */ L(!1), h = /* @__PURE__ */ L(!1), g = /* @__PURE__ */ L(""), _ = /* @__PURE__ */ L(null), v = /* @__PURE__ */ L(900), y = /* @__PURE__ */ L(null), b = /* @__PURE__ */ L(!1), x = null, S = !1, C = null, w = /* @__PURE__ */ new Set(), T = Z(() => o.value.devices.find((e) => e.id === i.deviceId)), ee = Z(() => ms(T.value, o.value.overview.now)), te = Z(() => d.value.find(ds)), E = Z(() => i.kind === "ota.install"), ne = Z(() => i.kind ? E.value ? "升级设备固件" : "重启设备" : "设备控制记录"), D = Z(() => hs({
			...T.value,
			latest_command: p.value ? te.value : T.value.latest_command
		}, o.value)), re = Z(() => s.value && p.value && !g.value && !b.value && !h.value && !te.value && !D.value && (!E.value || !!f.value)), O = Z(() => _.value && d.value.find((e) => e.id === _.value.id) || _.value);
		async function k(e, t = {}) {
			let n = new AbortController();
			w.add(n);
			let r = setTimeout(() => n.abort(), 15e3);
			try {
				return await c(e, {
					...t,
					signal: n.signal
				});
			} catch (e) {
				throw e.name === "AbortError" ? Error("连接超时，暂时无法确认结果。你可以重试，重复提交不会重复执行同一条指令。") : e instanceof TypeError ? Error("网络连接中断，暂时无法确认结果。请重新读取状态或重试提交，同一条指令不会重复执行。") : e;
			} finally {
				clearTimeout(r), w.delete(n);
			}
		}
		async function ie(e = !1) {
			if (C) return C;
			e || (m.value = !0);
			let t = (async () => {
				try {
					let e = await k("/api/admin/devices/" + encodeURIComponent(i.deviceId) + "/commands");
					if (S) return;
					r.value = e.last_upgrade_failure, d.value = e.commands, f.value = e.available_release, p.value = !0, h.value || (g.value = "");
				} catch (e) {
					S || (g.value = e.message);
				} finally {
					S || (m.value = !1);
				}
			})();
			C = t, await t, C = null;
		}
		async function ae() {
			if (h.value || _.value || !p.value || te.value || D.value || b.value || !s.value) return;
			y.value ||= {
				kind: i.kind,
				ttl_seconds: Number(v.value),
				request_id: crypto.randomUUID().replaceAll("-", ""),
				...E.value ? {
					expected_release_id: f.value.id,
					expected_sha256: f.value.sha256
				} : {}
			}, h.value = !0, g.value = "";
			let e = !1;
			try {
				let t = await k("/api/admin/devices/" + encodeURIComponent(i.deviceId) + "/commands", {
					method: "POST",
					body: JSON.stringify(y.value)
				});
				if (S) return;
				_.value = t, e = !0;
			} catch (e) {
				S || (g.value = e.message, e.status === 409 && /发布.*变化/.test(e.message) && (b.value = !0));
			} finally {
				S || (h.value = !1);
			}
			e && !S && (ie(!0), l().catch(() => {}));
		}
		function oe() {
			y.value = null, b.value = !1, g.value = "", ie();
		}
		function se() {
			u.value?.close(), a("close");
		}
		function ce() {
			!document.hidden && !h.value && ie(!0);
		}
		return $n(async () => {
			await gn(), u.value.showModal(), ie(), document.addEventListener("visibilitychange", ce), x = setInterval(() => {
				!document.hidden && !h.value && ie(!0);
			}, 5e3);
		}), er(() => {
			S = !0, document.removeEventListener("visibilitychange", ce), x && clearInterval(x);
			for (let e of w) e.abort();
			u.value?.close();
		}), (t, i) => (W(), G("dialog", {
			ref_key: "dialog",
			ref: u,
			class: "device-control-dialog",
			"aria-labelledby": "device-control-title",
			onCancel: Ga(se, ["prevent"])
		}, [q("div", gs, [q("div", null, [i[4] ||= q("p", { class: "command-eyebrow" }, "远程设备控制", -1), q("h2", _s, j(ne.value), 1)]), q("button", {
			type: "button",
			class: "icon-button",
			"aria-label": "关闭设备控制",
			onClick: se
		}, "×")]), q("div", vs, [
			q("div", ys, [q("div", null, [q("strong", null, j(T.value.name), 1), q("p", null, j(T.value.target_name) + " · " + j(T.value.current_version || "等待版本上报"), 1)]), J($, { tone: ee.value ? "green" : "amber" }, {
				default: V(() => [Y(j(ee.value ? "最近在线" : "设备离线"), 1)]),
				_: 1
			}, 8, ["tone"])]),
			e.kind && !_.value ? (W(), G(U, { key: 0 }, [
				E.value ? (W(), G("div", bs, [
					q("div", null, [i[5] ||= q("span", null, "当前版本", -1), q("strong", null, j(T.value.current_version || "等待上报"), 1)]),
					i[7] ||= q("span", {
						class: "command-arrow",
						"aria-hidden": "true"
					}, "→", -1),
					q("div", null, [i[6] ||= q("span", null, "待升级版本", -1), q("strong", null, j(m.value ? "正在读取…" : f.value?.version || "暂无可用发布"), 1)])
				])) : X("", !0),
				E.value ? (W(), G("p", xs, "设备领取指令后，将下载已发布固件、验证文件并重启；新版本启动确认后才算升级成功。")) : (W(), G("p", Ss, "设备领取指令后会重启，期间屏幕和连接会短暂中断。恢复联网后才确认执行结果。")),
				q("div", Cs, [q("b", null, j(ee.value ? "设备联网后领取指令" : "设备当前离线，指令将排队等待"), 1), i[8] ||= q("p", null, "提交指令不代表设备已经执行；超过等待时间仍未领取将自动过期。设备正在升级时，请等待现有操作结束。", -1)]),
				q("label", ws, [i[10] ||= Y("等待设备的最长时间", -1), kn(q("select", {
					"onUpdate:modelValue": i[0] ||= (e) => v.value = e,
					disabled: h.value || !!y.value
				}, [...i[9] ||= [
					q("option", { value: 300 }, "5 分钟", -1),
					q("option", { value: 900 }, "15 分钟", -1),
					q("option", { value: 3600 }, "1 小时", -1)
				]], 8, Ts), [[za, v.value]])]),
				!m.value && D.value ? (W(), G("p", Es, j(D.value), 1)) : p.value && E.value && !f.value ? (W(), G("p", Ds, "请先为此设备的更新通道发布可用固件，再返回升级。")) : X("", !0)
			], 64)) : X("", !0),
			O.value ? (W(), G("div", Os, [
				J($, { tone: R(fs)(O.value) }, {
					default: V(() => [Y(j(R(ls)[O.value.status] || "状态待确认"), 1)]),
					_: 1
				}, 8, ["tone"]),
				q("h3", null, j(R(ds)(O.value) ? "指令已提交，正在等待设备完成" : "设备执行结果"), 1),
				q("p", null, j(R(us)[O.value.kind]) + " · 提交于 " + j(R(eo)(O.value.created_at)), 1),
				R(ds)(O.value) ? (W(), G("p", ks, "此页面会自动刷新结果，可以关闭后从“控制记录”继续查看。")) : X("", !0),
				O.value.error ? (W(), G("p", As, j(O.value.error), 1)) : X("", !0)
			])) : X("", !0),
			g.value || b.value ? (W(), G("div", js, [Y(j(b.value ? "发布版本已变化，请重新查看并确认升级目标。" : g.value), 1), b.value ? (W(), G("button", {
				key: 0,
				type: "button",
				class: "quiet",
				onClick: oe
			}, "重新确认版本")) : h.value ? X("", !0) : (W(), G("button", {
				key: 1,
				type: "button",
				class: "quiet",
				onClick: i[1] ||= (e) => ie()
			}, "重新读取状态"))])) : X("", !0),
			O.value?.kind === "ota.install" ? (W(), K(No, {
				key: O.value.id,
				"command-id": O.value.id
			}, null, 8, ["command-id"])) : X("", !0),
			r.value ? (W(), G("section", Ms, [
				i[11] ||= q("h3", null, "设备最近一次升级失败", -1),
				q("p", Ns, j(R(wo)(r.value.stage, r.value.error_code, r.value.http_status)), 1),
				q("small", null, "最后下载进度 " + j(r.value.progress) + "% · " + j(r.value.occurred ? "设备记录 " + R(eo)(r.value.occurred) : "记录时设备时钟未同步") + " · 后台收到 " + j(R(eo)(r.value.received)), 1)
			])) : X("", !0),
			q("section", Ps, [q("div", Fs, [i[12] ||= q("h3", null, "最近控制记录", -1), q("button", {
				type: "button",
				class: "quiet",
				disabled: m.value || h.value,
				onClick: i[2] ||= (e) => ie()
			}, j(m.value ? "正在刷新…" : "刷新记录"), 9, Is)]), !p.value && !g.value ? (W(), G("p", Ls, "正在读取设备控制状态…")) : d.value.length ? (W(), G("ol", Rs, [(W(!0), G(U, null, H(d.value.slice(0, 8), (e) => (W(), G("li", { key: e.id }, [
				q("div", zs, [q("strong", null, j(R(us)[e.kind] || "设备操作"), 1), J($, { tone: R(fs)(e) }, {
					default: V(() => [Y(j(R(ls)[e.status] || "状态待确认"), 1)]),
					_: 2
				}, 1032, ["tone"])]),
				q("p", null, [Y(j(R(eo)(e.created_at)), 1), e.status === "queued" ? (W(), G("span", Bs, " · 等待至 " + j(R(eo)(e.expires_at)), 1)) : X("", !0)]),
				e.error ? (W(), G("p", Vs, j(R(To)(e.error)), 1)) : X("", !0),
				e.kind === "ota.install" ? (W(), G("button", {
					key: 1,
					type: "button",
					class: "quiet",
					onClick: (t) => n.value = e.id
				}, "查看升级时间线", 8, Hs)) : X("", !0)
			]))), 128))])) : p.value ? (W(), G("p", Us, "还没有远程控制记录。升级与重启的执行结果会保存在这里。")) : X("", !0)]),
			n.value ? (W(), K(No, {
				key: n.value,
				"command-id": n.value,
				modal: "",
				onClose: i[3] ||= (e) => n.value = ""
			}, null, 8, ["command-id"])) : X("", !0),
			q("div", Ws, [q("button", {
				type: "button",
				onClick: se
			}, j(_.value || !e.kind ? "关闭" : "取消"), 1), e.kind && !_.value ? (W(), G("button", {
				key: 0,
				type: "button",
				class: "primary",
				disabled: h.value || b.value || !re.value && !y.value || !!te.value || !!D.value || !R(s),
				onClick: ae
			}, j(h.value ? "正在提交…" : y.value ? "重试提交" : E.value ? "确认升级" : "确认重启"), 9, Gs)) : X("", !0)])
		])], 544));
	}
}, qs = {
	key: 0,
	class: "notice command-backend-notice"
}, Js = { class: "resource-toolbar" }, Ys = { class: "search-field" }, Xs = { class: "result-count" }, Zs = ["data-device-id"], Qs = ["title"], $s = { key: 0 }, ec = { class: "status-stack" }, tc = ["title"], nc = { class: "device-actions" }, rc = { class: "actions device-control-actions" }, ic = [
	"disabled",
	"title",
	"onClick"
], ac = [
	"disabled",
	"title",
	"onClick"
], oc = ["disabled", "onClick"], sc = { class: "actions device-management-actions" }, cc = { class: "mono" }, lc = { class: "actions" }, uc = {
	__name: "Devices",
	setup(e) {
		let { snapshot: t, ready: n } = Mn("admin"), r = /* @__PURE__ */ L(""), i = /* @__PURE__ */ L(""), a = /* @__PURE__ */ L(null), o = (e) => ms(e, t.value.overview.now), s = (e) => hs(e, t.value), c = (e, t = "") => {
			a.value = {
				id: e.id,
				kind: t
			};
		}, l = Z(() => t.value.devices.filter((e) => no(e, r.value, [
			"id",
			"name",
			"target_name",
			"current_version"
		]) && (!i.value || (i.value === "online" ? o(e) : i.value === "revoked" ? e.revoked : !o(e))))), u = Z(() => t.value.gateways.filter((e) => no(e, r.value, ["id", "name"])));
		return (e, d) => (W(), G(U, null, [
			J(po, {
				title: "设备与网关",
				description: "查看设备连接状态，远程升级固件、重启设备并跟踪执行结果。"
			}, {
				default: V(() => [J(Q, {
					kind: "device",
					tone: "primary"
				}, {
					default: V(() => [...d[3] ||= [Y("＋ 添加设备", -1)]]),
					_: 1
				}), J(Q, { kind: "gateway" }, {
					default: V(() => [...d[4] ||= [Y("添加网关", -1)]]),
					_: 1
				})]),
				_: 1
			}),
			R(ps)(R(t)) ? X("", !0) : (W(), G("div", qs, "远程控制需要更新后的后台。请重启 OTA 服务并刷新此页；现有设备管理仍可使用。")),
			q("div", Js, [
				q("div", Ys, [d[5] ||= q("span", null, "⌕", -1), kn(q("input", {
					"onUpdate:modelValue": d[0] ||= (e) => r.value = e,
					type: "search",
					placeholder: "搜索设备、型号、版本或标识",
					"aria-label": "搜索设备"
				}, null, 512), [[Ra, r.value]])]),
				kn(q("select", {
					"onUpdate:modelValue": d[1] ||= (e) => i.value = e,
					class: "filter-select",
					"aria-label": "设备状态"
				}, [...d[6] ||= [
					q("option", { value: "" }, "全部状态", -1),
					q("option", { value: "online" }, "最近在线", -1),
					q("option", { value: "offline" }, "离线 / 未联系", -1),
					q("option", { value: "revoked" }, "凭据已停用", -1)
				]], 512), [[za, i.value]]),
				q("span", Xs, j(l.value.length) + " / " + j(R(t).devices.length) + " 台设备", 1)
			]),
			J(_o, { title: "设备列表" }, {
				default: V(() => [l.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"设备",
						"硬件型号",
						"当前版本",
						"通道",
						"连接与执行状态",
						"操作"
					],
					kind: "device-table"
				}, {
					default: V(() => [(W(!0), G(U, null, H(l.value, (e) => (W(), G("tr", {
						key: e.id,
						"data-device-id": e.id
					}, [
						q("td", null, [q("strong", null, j(e.name), 1), q("small", {
							class: "mono",
							title: e.id
						}, j(e.id.slice(0, 20)) + "…", 9, Qs)]),
						q("td", null, [Y(j(e.target_name), 1), q("small", null, j(e.agent_kind === "gateway" ? "通过网关" : "直接联网"), 1)]),
						q("td", null, [Y(j(e.current_version || "等待上报"), 1), e.agent_kind === "device" && e.remote_commands_version !== 1 ? (W(), G("small", $s, "需更新固件以启用远程控制")) : X("", !0)]),
						q("td", null, [J($, null, {
							default: V(() => [Y(j(e.channel), 1)]),
							_: 2
						}, 1024)]),
						q("td", null, [q("div", ec, [
							J($, { tone: e.revoked ? "red" : o(e) ? "green" : "" }, {
								default: V(() => [Y(j(e.revoked ? "凭据已停用" : o(e) ? "最近在线" : "尚未联系 / 离线"), 1)]),
								_: 2
							}, 1032, ["tone"]),
							q("small", null, j(R(eo)(e.last_seen)), 1),
							e.latest_command ? (W(), G(U, { key: 0 }, [J($, { tone: R(fs)(e.latest_command) }, {
								default: V(() => [Y(j(R(us)[e.latest_command.kind]) + " · " + j(R(ls)[e.latest_command.status] || "状态待确认"), 1)]),
								_: 2
							}, 1032, ["tone"]), e.latest_command.error ? (W(), G("small", {
								key: 0,
								class: "command-cell-error",
								title: e.latest_command.error
							}, j(e.latest_command.error), 9, tc)) : X("", !0)], 64)) : X("", !0)
						])]),
						q("td", null, [q("div", nc, [q("div", rc, [
							q("button", {
								type: "button",
								class: "primary",
								"data-control-kind": "ota.install",
								disabled: !R(n) || !!s(e),
								title: s(e) || "升级到此设备通道的当前发布版本",
								onClick: Ga((t) => c(e, "ota.install"), ["stop"])
							}, "立即升级", 8, ic),
							q("button", {
								type: "button",
								"data-control-kind": "device.restart",
								disabled: !R(n) || !!s(e),
								title: s(e) || "设备领取指令后重启",
								onClick: Ga((t) => c(e, "device.restart"), ["stop"])
							}, "重启设备", 8, ac),
							q("button", {
								type: "button",
								"data-control-kind": "history",
								disabled: !R(n) || !R(ps)(R(t)),
								onClick: Ga((t) => c(e), ["stop"])
							}, "控制记录", 8, oc)
						]), q("div", sc, [
							J(Zo, {
								kind: "device",
								item: e
							}, null, 8, ["item"]),
							J(Q, {
								kind: "channel",
								id: e.id
							}, {
								default: V(() => [...d[7] ||= [Y("切换通道", -1)]]),
								_: 1
							}, 8, ["id"]),
							e.agent_kind === "device" ? (W(), G(U, { key: 0 }, [J(Q, {
								kind: "rotate",
								id: e.agent_id
							}, {
								default: V(() => [...d[8] ||= [Y("轮换凭据", -1)]]),
								_: 1
							}, 8, ["id"]), e.revoked ? X("", !0) : (W(), K(Q, {
								key: 0,
								kind: "revoke",
								id: e.agent_id,
								tone: "danger"
							}, {
								default: V(() => [...d[9] ||= [Y("停用", -1)]]),
								_: 1
							}, 8, ["id"]))], 64)) : X("", !0)
						])])])
					], 8, Zs))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: r.value || i.value ? "没有匹配的设备" : "把第一台设备加入工作区",
					description: "设备凭据只在创建或轮换时显示一次，请妥善保存。"
				}, {
					default: V(() => [!r.value && !i.value ? (W(), K(Q, {
						key: 0,
						kind: "device",
						tone: "secondary"
					}, {
						default: V(() => [...d[10] ||= [Y("添加设备", -1)]]),
						_: 1
					})) : X("", !0)]),
					_: 1
				}, 8, ["title"]))]),
				_: 1
			}),
			d[13] ||= q("p", { class: "form-hint" }, "远程指令由设备联网后主动领取。离线设备可以排队等待，发布固件本身不会立即触发设备升级。", -1),
			J(_o, { title: "联网网关" }, {
				default: V(() => [u.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"网关",
						"标识",
						"授权子设备",
						"状态",
						"操作"
					]
				}, {
					default: V(() => [(W(!0), G(U, null, H(u.value, (e) => (W(), G("tr", { key: e.id }, [
						q("td", null, [q("strong", null, j(e.name), 1)]),
						q("td", cc, j(e.id.slice(0, 16)) + "…", 1),
						q("td", null, j(R(t).devices.filter((t) => t.agent_id === e.id).length) + " 台", 1),
						q("td", null, [J($, { tone: e.revoked ? "red" : "green" }, {
							default: V(() => [Y(j(e.revoked ? "已停用" : "可用"), 1)]),
							_: 2
						}, 1032, ["tone"])]),
						q("td", null, [q("div", lc, [
							J(Zo, {
								kind: "gateway",
								item: e
							}, null, 8, ["item"]),
							J(Q, {
								kind: "rotate",
								id: e.id
							}, {
								default: V(() => [...d[11] ||= [Y("轮换凭据", -1)]]),
								_: 1
							}, 8, ["id"]),
							e.revoked ? X("", !0) : (W(), K(Q, {
								key: 0,
								kind: "revoke",
								id: e.id,
								tone: "danger"
							}, {
								default: V(() => [...d[12] ||= [Y("停用", -1)]]),
								_: 1
							}, 8, ["id"]))
						])])
					]))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: "暂无匹配网关",
					description: "STM32 等设备可通过已适配的 ESP32 或电脑网关接入。"
				}))]),
				_: 1
			}),
			a.value ? (W(), K(Ks, {
				key: a.value.id + a.value.kind,
				"device-id": a.value.id,
				kind: a.value.kind,
				onClose: d[2] ||= (e) => a.value = null
			}, null, 8, ["device-id", "kind"])) : X("", !0)
		], 64));
	}
}, dc = ["title"], fc = ["title"], pc = {
	__name: "BuildIdentity",
	props: { item: Object },
	setup(e) {
		return (t, n) => (W(), G(U, null, [
			q("strong", null, j(e.item.version), 1),
			q("small", { title: e.item.notes }, j(e.item.notes || "无更新说明"), 9, dc),
			q("small", {
				class: "artifact-fingerprint",
				title: `SHA-256：${e.item.sha256}；制品：${e.item.artifact_id || e.item.id}`
			}, "SHA " + j(e.item.sha256.slice(0, 12)) + " · ID " + j((e.item.artifact_id || e.item.id).slice(0, 8)), 9, fc)
		], 64));
	}
}, mc = { class: "status-stack" }, hc = ["data-firmware-state", "title"], gc = { key: 1 }, _c = { key: 2 }, vc = { key: 3 }, yc = {
	__name: "FileStatus",
	props: {
		item: Object,
		release: Boolean
	},
	setup(e) {
		let t = e, n = Z(() => t.item.firmware_state || (t.item.pruned_at ? "deleted" : "unknown")), r = Z(() => ao[n.value] || ao.unknown);
		return (t, i) => (W(), G("div", mc, [
			e.release ? (W(), K($, {
				key: 0,
				tone: e.item.active ? "green" : ""
			}, {
				default: V(() => [Y(j(e.item.active ? "活动发布" : "已撤回 / 已替代"), 1)]),
				_: 1
			}, 8, ["tone"])) : X("", !0),
			q("span", {
				class: "firmware-status",
				"data-firmware-state": n.value,
				title: e.item.firmware_message
			}, [J($, { tone: r.value[1] }, {
				default: V(() => [Y(j(r.value[0]), 1)]),
				_: 1
			}, 8, ["tone"])], 8, hc),
			e.release ? (W(), G("small", gc, j(e.item.attempt_count ? `含 ${e.item.attempt_count} 条升级记录` : "暂无升级记录"), 1)) : X("", !0),
			e.item.deletion_pending ? (W(), G("small", _c, "文件待释放，可重试删除")) : X("", !0),
			e.item.key_revoked ? (W(), G("small", vc, "签名公钥已吊销")) : X("", !0)
		]));
	}
}, bc = { class: "management-summary" }, xc = { key: 0 }, Sc = { class: "resource-toolbar in-panel" }, Cc = { class: "search-field" }, wc = { class: "result-count" }, Tc = ["data-artifact-id"], Ec = { class: "release-identity" }, Dc = { class: "release-status" }, Oc = { class: "actions release-actions" }, kc = {
	__name: "Artifacts",
	setup(e) {
		let { snapshot: t } = Mn("admin"), n = /* @__PURE__ */ L(""), r = /* @__PURE__ */ L(""), i = Z(() => t.value.artifacts.filter((e) => no(e, n.value, [
			"id",
			"version",
			"notes",
			"sha256",
			"target_name"
		]) && (!r.value || e.firmware_state === r.value)));
		return (e, a) => (W(), G(U, null, [
			J(po, {
				title: "固件文件",
				description: "本机打包签名，以摘要区分每一份构建。"
			}, {
				default: V(() => [J(Q, {
					kind: "pack",
					tone: "primary"
				}, {
					default: V(() => [...a[3] ||= [Y("＋ 打包并上传", -1)]]),
					_: 1
				})]),
				_: 1
			}),
			q("div", bc, [q("span", null, [
				q("strong", null, j(R(t).artifacts.length), 1),
				Y(" 份固件 · " + j(R(t).overview.storage_warning ? "已知占用" : "当前占用") + " ", 1),
				q("strong", null, j(R(to)(R(t).overview.storage_bytes)), 1),
				R(t).overview.storage_warning ? (W(), G("span", xc, "（统计不完整，请检查存储权限）")) : X("", !0)
			]), a[4] ||= q("span", null, "手动管理 · 不自动清理", -1)]),
			J(_o, { title: "固件库" }, {
				extra: V(() => [...a[5] ||= [q("span", { class: "panel-note" }, "私钥留在本机，服务器独立复核", -1)]]),
				default: V(() => [q("div", Sc, [
					q("div", Cc, [a[6] ||= q("span", null, "⌕", -1), kn(q("input", {
						"onUpdate:modelValue": a[0] ||= (e) => n.value = e,
						type: "search",
						placeholder: "搜索版本、型号、SHA 或说明",
						"aria-label": "搜索固件"
					}, null, 512), [[Ra, n.value]])]),
					kn(q("select", {
						"onUpdate:modelValue": a[1] ||= (e) => r.value = e,
						class: "filter-select",
						"aria-label": "固件状态"
					}, [...a[7] ||= [
						q("option", { value: "" }, "全部状态", -1),
						q("option", { value: "available" }, "文件可用", -1),
						q("option", { value: "missing" }, "文件缺失", -1),
						q("option", { value: "corrupt" }, "校验异常", -1),
						q("option", { value: "storage_error" }, "存储不可读", -1)
					]], 512), [[za, r.value]]),
					q("span", wc, j(i.value.length) + " 项结果", 1)
				]), i.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"版本 / 构建",
						"硬件型号",
						"文件大小",
						"状态",
						"操作"
					],
					kind: "artifact-table"
				}, {
					default: V(() => [(W(!0), G(U, null, H(i.value, (e) => (W(), G("tr", {
						key: e.id,
						"data-artifact-id": e.id
					}, [
						q("td", Ec, [J(pc, { item: e }, null, 8, ["item"])]),
						q("td", null, j(e.target_name), 1),
						q("td", null, j(R(to)(e.size)), 1),
						q("td", Dc, [J(yc, { item: e }, null, 8, ["item"])]),
						q("td", null, [q("div", Oc, [e.can_publish ? (W(), K(Q, {
							key: 0,
							kind: "publish",
							id: e.id
						}, {
							default: V(() => [...a[8] ||= [Y("发布此固件", -1)]]),
							_: 1
						}, 8, ["id"])) : X("", !0), J(Q, {
							kind: "delete-artifact",
							id: e.id,
							tone: "danger"
						}, {
							default: V(() => [Y(j(e.deletion_pending ? "重试删除文件" : "删除此固件"), 1)]),
							_: 2
						}, 1032, ["id"])])])
					], 8, Tc))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: n.value || r.value ? "没有匹配的固件" : "固件库还是空的",
					description: "选择设备和应用 bin，写下更新说明即可打包。"
				}, {
					default: V(() => [n.value || r.value ? (W(), G("button", {
						key: 0,
						onClick: a[2] ||= (e) => {
							n.value = "", r.value = "";
						}
					}, "清空筛选")) : (W(), K(Q, {
						key: 1,
						kind: "pack",
						tone: "secondary"
					}, {
						default: V(() => [...a[9] ||= [Y("打包并上传", -1)]]),
						_: 1
					}))]),
					_: 1
				}, 8, ["title"]))]),
				_: 1
			})
		], 64));
	}
}, Ac = { class: "management-summary" }, jc = { class: "resource-toolbar in-panel" }, Mc = { class: "search-field" }, Nc = { class: "result-count" }, Pc = ["data-release-id", "data-artifact-id"], Fc = { class: "release-identity" }, Ic = { class: "mono" }, Lc = { class: "release-status" }, Rc = { class: "actions release-actions" }, zc = {
	__name: "Releases",
	setup(e) {
		let { snapshot: t } = Mn("admin"), n = /* @__PURE__ */ L(""), r = /* @__PURE__ */ L(""), i = /* @__PURE__ */ L(""), a = Z(() => t.value.releases.filter((e) => e.active).length), o = Z(() => t.value.releases.filter((e) => no(e, n.value, [
			"id",
			"artifact_id",
			"version",
			"notes",
			"sha256",
			"target_name"
		]) && (!r.value || e.channel === r.value) && (!i.value || (i.value === "active" ? e.active : !e.active))));
		return (e, s) => (W(), G(U, null, [
			J(po, {
				title: "版本发布",
				description: "每次发布独立管理，同版本的不同构建按 SHA 区分。"
			}, {
				default: V(() => [J(Q, {
					kind: "publish",
					tone: "primary"
				}, {
					default: V(() => [...s[4] ||= [Y("＋ 新建发布", -1)]]),
					_: 1
				})]),
				_: 1
			}),
			q("div", Ac, [q("span", null, [
				q("strong", null, j(R(t).releases.length), 1),
				s[5] ||= Y(" 条发布 · ", -1),
				q("strong", null, j(a.value), 1),
				s[6] ||= Y(" 条活动发布", -1)
			]), s[7] ||= q("span", null, "删除发布不删固件 · 状态按制品同步", -1)]),
			J(_o, { title: "发布历史" }, {
				extra: V(() => [...s[8] ||= [q("span", { class: "panel-note" }, "活动版本与历史记录分明", -1)]]),
				default: V(() => [q("div", jc, [
					q("div", Mc, [s[9] ||= q("span", null, "⌕", -1), kn(q("input", {
						"onUpdate:modelValue": s[0] ||= (e) => n.value = e,
						type: "search",
						placeholder: "搜索版本、型号、SHA 或发布说明",
						"aria-label": "搜索发布"
					}, null, 512), [[Ra, n.value]])]),
					kn(q("select", {
						"onUpdate:modelValue": s[1] ||= (e) => r.value = e,
						class: "filter-select",
						"aria-label": "发布通道"
					}, [...s[10] ||= [
						q("option", { value: "" }, "全部通道", -1),
						q("option", { value: "stable" }, "stable", -1),
						q("option", { value: "beta" }, "beta", -1)
					]], 512), [[za, r.value]]),
					kn(q("select", {
						"onUpdate:modelValue": s[2] ||= (e) => i.value = e,
						class: "filter-select",
						"aria-label": "发布状态"
					}, [...s[11] ||= [
						q("option", { value: "" }, "全部发布", -1),
						q("option", { value: "active" }, "活动发布", -1),
						q("option", { value: "inactive" }, "已撤回 / 已替代", -1)
					]], 512), [[za, i.value]]),
					q("span", Nc, j(o.value.length) + " 项结果", 1)
				]), o.value.length ? (W(), K(xo, {
					key: 0,
					columns: [
						"版本 / 构建",
						"硬件型号",
						"通道 / 序号",
						"发布时间",
						"状态",
						"操作"
					],
					kind: "release-table"
				}, {
					default: V(() => [(W(!0), G(U, null, H(o.value, (e) => (W(), G("tr", {
						key: e.id,
						"data-release-id": e.id,
						"data-artifact-id": e.artifact_id
					}, [
						q("td", Fc, [J(pc, { item: e }, null, 8, ["item"])]),
						q("td", null, j(e.target_name), 1),
						q("td", null, [J($, { tone: e.channel === "beta" ? "blue" : "" }, {
							default: V(() => [Y(j(e.channel), 1)]),
							_: 2
						}, 1032, ["tone"]), q("small", Ic, "发布 #" + j(e.seq), 1)]),
						q("td", null, j(R(eo)(e.created)), 1),
						q("td", Lc, [J(yc, {
							item: e,
							release: ""
						}, null, 8, ["item"])]),
						q("td", null, [q("div", Rc, [
							J(Q, {
								kind: "edit-release",
								id: e.id
							}, {
								default: V(() => [...s[12] ||= [Y("编辑说明", -1)]]),
								_: 1
							}, 8, ["id"]),
							e.active ? (W(), K(Q, {
								key: 0,
								kind: "withdraw",
								id: e.id,
								tone: "danger"
							}, {
								default: V(() => [...s[13] ||= [Y("撤回", -1)]]),
								_: 1
							}, 8, ["id"])) : e.can_publish ? (W(), K(Q, {
								key: 1,
								kind: "republish",
								id: e.id
							}, {
								default: V(() => [...s[14] ||= [Y("重新发布", -1)]]),
								_: 1
							}, 8, ["id"])) : X("", !0),
							J(Q, {
								kind: "delete-release",
								id: e.id,
								tone: "danger"
							}, {
								default: V(() => [...s[15] ||= [Y("删除发布", -1)]]),
								_: 1
							}, 8, ["id"])
						])])
					], 8, Pc))), 128))]),
					_: 1
				})) : (W(), K(yo, {
					key: 1,
					title: n.value || r.value || i.value ? "没有匹配的发布" : "还没有发布记录",
					description: "选择可用固件，发布到 stable 或 beta 通道。"
				}, {
					default: V(() => [n.value || r.value || i.value ? (W(), G("button", {
						key: 0,
						onClick: s[3] ||= (e) => {
							n.value = "", r.value = "", i.value = "";
						}
					}, "清空筛选")) : X("", !0)]),
					_: 1
				}, 8, ["title"]))]),
				_: 1
			}),
			s[16] ||= q("p", { class: "form-hint" }, "版本号相同不代表文件相同。活动发布请先撤回；已有升级记录的发布保留历史，不会级联删除。", -1)
		], 64));
	}
}, Bc = { class: "resource-toolbar in-panel" }, Vc = { class: "search-field" }, Hc = ["value"], Uc = { class: "result-count" }, Wc = {
	__name: "Attempts",
	setup(e) {
		let { snapshot: t } = Mn("admin"), n = /* @__PURE__ */ L(""), r = /* @__PURE__ */ L(""), i = Z(() => t.value.attempts.filter((e) => no(e, n.value, [
			"id",
			"device_name",
			"target_name",
			"version",
			"error"
		]) && (!r.value || e.state === r.value)));
		return (e, t) => (W(), G(U, null, [J(po, {
			title: "升级记录",
			description: "传输完成不代表新应用已经启动；每次更新都可追溯。"
		}), J(_o, { title: "最近 500 次升级" }, {
			default: V(() => [q("div", Bc, [
				q("div", Vc, [t[2] ||= q("span", null, "⌕", -1), kn(q("input", {
					"onUpdate:modelValue": t[0] ||= (e) => n.value = e,
					type: "search",
					placeholder: "搜索设备、版本、标识或错误",
					"aria-label": "搜索升级记录"
				}, null, 512), [[Ra, n.value]])]),
				kn(q("select", {
					"onUpdate:modelValue": t[1] ||= (e) => r.value = e,
					class: "filter-select",
					"aria-label": "升级状态"
				}, [t[3] ||= q("option", { value: "" }, "全部状态", -1), (W(!0), G(U, null, H(R(ro), (e, t) => (W(), G("option", {
					key: t,
					value: t
				}, j(e), 9, Hc))), 128))], 512), [[za, r.value]]),
				q("span", Uc, j(i.value.length) + " 项结果", 1)
			]), i.value.length ? (W(), K(Ro, {
				key: 0,
				rows: i.value
			}, null, 8, ["rows"])) : (W(), K(yo, {
				key: 1,
				title: n.value || r.value ? "没有匹配的升级记录" : "暂无升级尝试",
				description: "设备创建升级尝试后，记录会自动出现。"
			}, null, 8, ["title"]))]),
			_: 1
		})], 64));
	}
}, Gc = {
	class: "desktop-app",
	"data-visual-theme": "atelier"
}, Kc = { class: "sidebar" }, qc = {
	class: "brand",
	href: "#overview"
}, Jc = { class: "brand-symbol" }, Yc = { "aria-label": "主导航" }, Xc = ["href", "data-page"], Zc = { class: "nav-icon" }, Qc = { class: "sidebar-bottom" }, $c = {
	id: "logout",
	class: "quiet"
}, el = { class: "workspace" }, tl = { class: "topbar" }, nl = { class: "crumb" }, rl = { id: "crumb" }, il = { class: "top-actions" }, al = { class: "theme-control" }, ol = {
	id: "help",
	class: "avatar",
	"aria-label": "使用帮助"
}, sl = {
	key: 0,
	class: "empty"
}, cl = {
	key: 0,
	class: "notice error runtime-warning",
	role: "alert"
}, ll = {
	key: 2,
	class: "vue-loading",
	role: "status"
}, ul = { class: "skeleton-cards" };
// src/main.js
Ya({
	__name: "App",
	setup(e) {
		let t = /* @__PURE__ */ Kt(null), n = /* @__PURE__ */ L(!1), r = /* @__PURE__ */ L(!0), i = /* @__PURE__ */ L(""), a = () => Object.hasOwn($a, location.hash.slice(1)) ? location.hash.slice(1) : "overview", o = /* @__PURE__ */ L(a()), s = {
			overview: Xo,
			products: cs,
			devices: uc,
			artifacts: kc,
			releases: zc,
			attempts: Wc
		}, c = Z(() => s[o.value]), l;
		jn("admin", {
			snapshot: t,
			ready: n,
			request: (...e) => l.request(...e),
			refresh: () => l.refresh()
		}), Fn(o, (e) => {
			document.title = $a[e] + " · OTA Station";
		}, { immediate: !0 });
		let u = () => {
			o.value = a();
		}, d = (e) => l?.handleClick(e);
		return $n(() => {
			l = Qa((e) => {
				Object.hasOwn(e, "snapshot") && (t.value = e.snapshot, i.value = ""), Object.hasOwn(e, "managementReady") && (n.value = e.managementReady), Object.hasOwn(e, "syncing") && (r.value = e.syncing), e.error && (i.value = e.error);
			}), window.addEventListener("hashchange", u), l.start();
		}), er(() => {
			window.removeEventListener("hashchange", u), l?.dispose();
		}), (e, a) => (W(), G("div", Gc, [
			q("aside", Kc, [
				q("a", qc, [q("span", Jc, [J(lo, { name: "releases" })]), a[3] ||= q("span", null, [Y("OTA Station"), q("small", null, "个人固件工作台")], -1)]),
				a[7] ||= q("div", { class: "nav-caption" }, "工作区", -1),
				q("nav", Yc, [(W(!0), G(U, null, H(R($a), (e, t) => (W(), G("a", {
					key: t,
					href: "#" + t,
					"data-page": t,
					class: A({ active: o.value === t })
				}, [q("span", Zc, [J(lo, { name: t }, null, 8, ["name"])]), Y(j(e), 1)], 10, Xc))), 128))]),
				q("div", Qc, [
					a[5] ||= q("div", { class: "private-label" }, [q("span", { class: "dot" }), Y("个人工作区")], -1),
					a[6] ||= q("p", null, [
						Y("本机签名 · 独立凭据"),
						q("br"),
						Y("固件始终由你掌控")
					], -1),
					q("button", $c, [J(lo, { name: "logout" }), a[4] ||= Y("退出登录", -1)])
				])
			]),
			q("div", el, [
				q("header", tl, [q("div", nl, [
					a[8] ||= Y("控制台 ", -1),
					a[9] ||= q("span", null, "/", -1),
					q("b", rl, j(R($a)[o.value]), 1)
				]), q("div", il, [
					a[0] || (di(-1, !0), (a[0] = q("span", {
						id: "sync-status",
						class: "sync"
					}, [a[10] ||= Y("正在同步", -1)])).cacheIndex = 0, di(1), a[0]),
					q("div", al, [J(lo, { name: "theme" }), a[11] ||= q("select", {
						id: "theme-select",
						class: "theme-select",
						"data-theme-select": "",
						"aria-label": "外观主题"
					}, [
						q("option", { value: "system" }, "跟随系统"),
						q("option", { value: "light" }, "浅色模式"),
						q("option", { value: "dark" }, "暗色模式")
					], -1)]),
					q("button", {
						id: "refresh",
						class: A(["icon-button", { spinning: r.value }]),
						"aria-label": "刷新数据"
					}, [J(lo, { name: "refresh" })], 2),
					q("button", ol, [J(lo, { name: "help" })])
				])]),
				q("main", {
					id: "main",
					onClick: Ga(d, ["stop"])
				}, [i.value && !t.value ? (W(), G("div", sl, [a[12] ||= q("h3", null, "暂时无法载入工作台", -1), q("p", null, j(i.value), 1)])) : t.value ? (W(), G(U, { key: 1 }, [n.value ? X("", !0) : (W(), G("div", cl, [...a[13] ||= [
					q("b", null, "后台需要重启，暂为只读模式", -1),
					q("p", null, "页面与运行中的后台版本不一致，请先重启 OTA 服务，再按 Ctrl+F5 刷新页面。", -1),
					q("p", null, "仅刷新浏览器不能代替重启服务。", -1)
				]])), (W(), K(rr(c.value), { key: o.value }))], 64)) : (W(), G("div", ll, [
					a[14] ||= q("div", { class: "skeleton title" }, null, -1),
					q("div", ul, [(W(), G(U, null, H(4, (e) => q("div", {
						key: e,
						class: "skeleton"
					})), 64))]),
					a[15] ||= q("div", { class: "skeleton table" }, null, -1),
					a[16] ||= q("p", null, "正在连接工作台…", -1)
				]))]),
				a[17] ||= q("footer", { class: "footer" }, [q("span", null, "OTA Station"), q("span", null, "本地签名 · 手动发布")], -1)
			]),
			a[1] || (di(-1, !0), (a[1] = q("div", {
				id: "toast",
				class: "toast",
				role: "status",
				"aria-live": "polite",
				hidden: ""
			})).cacheIndex = 1, di(1), a[1]),
			a[2] || (di(-1, !0), (a[2] = q("dialog", { id: "dialog" }, [a[18] ||= q("div", { class: "dialog-heading" }, [q("h2", { id: "dialog-title" }), q("button", {
				id: "dialog-close",
				class: "icon-button",
				"aria-label": "关闭"
			}, "×")], -1), a[19] ||= q("div", { id: "dialog-body" }, null, -1)])).cacheIndex = 2, di(1), a[2])
		]));
	}
}).mount("#admin-app");
