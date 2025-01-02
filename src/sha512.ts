import { HashMD } from './_md.js';
import u64 from './_u64.js';
import { CHash, wrapConstructor } from './utils.js';

/**
 * SHA2-512 a.k.a. sha512 and sha384. It is slower than sha256 in js because u64 operations are slow.
 *
 * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
 * [the paper on truncated SHA512/256](https://eprint.iacr.org/2010/548.pdf).
 * @module
 */

// Round contants (first 32 bits of the fractional parts of the cube roots of the first 80 primes 2..409):
// prettier-ignore
const [SHA512_Kh, SHA512_Kl] = /* @__PURE__ */ (() => u64.split([
  '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
  '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
  '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
  '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
  '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
  '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
  '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
  '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
  '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
  '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
  '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
  '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
  '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
  '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
  '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
  '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
  '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
  '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
  '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
  '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
].map(n => BigInt(n))))();

// Temporary buffer, not used to store anything between runs
const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
export class SHA512 extends HashMD<SHA512> {
  // We cannot use array here since array allows indexing by variable which means optimizer/compiler cannot use registers.
  // Also looks cleaner and easier to verify with spec.
  // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
  // h -- high 32 bits, l -- low 32 bits
  protected Ah: number = 0x6a09e667 | 0;
  protected Al: number = 0xf3bcc908 | 0;
  protected Bh: number = 0xbb67ae85 | 0;
  protected Bl: number = 0x84caa73b | 0;
  protected Ch: number = 0x3c6ef372 | 0;
  protected Cl: number = 0xfe94f82b | 0;
  protected Dh: number = 0xa54ff53a | 0;
  protected Dl: number = 0x5f1d36f1 | 0;
  protected Eh: number = 0x510e527f | 0;
  protected El: number = 0xade682d1 | 0;
  protected Fh: number = 0x9b05688c | 0;
  protected Fl: number = 0x2b3e6c1f | 0;
  protected Gh: number = 0x1f83d9ab | 0;
  protected Gl: number = 0xfb41bd6b | 0;
  protected Hh: number = 0x5be0cd19 | 0;
  protected Hl: number = 0x137e2179 | 0;

  constructor() {
    super(128, 64, 16, false);
  }
  // prettier-ignore
  protected get(): [
    number, number, number, number, number, number, number, number,
    number, number, number, number, number, number, number, number
  ] {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  protected set(
    Ah: number, Al: number, Bh: number, Bl: number, Ch: number, Cl: number, Dh: number, Dl: number,
    Eh: number, El: number, Fh: number, Fl: number, Gh: number, Gl: number, Hh: number, Hl: number
  ): void {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  protected process(view: DataView, offset: number): void {
    // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32((offset += 4));
    }
    for (let i = 16; i < 80; i++) {
      // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = u64.rotrSH(W15h, W15l, 1) ^ u64.rotrSH(W15h, W15l, 8) ^ u64.shrSH(W15h, W15l, 7);
      const s0l = u64.rotrSL(W15h, W15l, 1) ^ u64.rotrSL(W15h, W15l, 8) ^ u64.shrSL(W15h, W15l, 7);
      // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = u64.rotrSH(W2h, W2l, 19) ^ u64.rotrBH(W2h, W2l, 61) ^ u64.shrSH(W2h, W2l, 6);
      const s1l = u64.rotrSL(W2h, W2l, 19) ^ u64.rotrBL(W2h, W2l, 61) ^ u64.shrSL(W2h, W2l, 6);
      // SHA256_W[i] = s0 + s1 + SHA256_W[i - 7] + SHA256_W[i - 16];
      const SUMl = u64.add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = u64.add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    // Compression function main loop, 80 rounds
    for (let i = 0; i < 80; i++) {
      // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
      const sigma1h = u64.rotrSH(Eh, El, 14) ^ u64.rotrSH(Eh, El, 18) ^ u64.rotrBH(Eh, El, 41);
      const sigma1l = u64.rotrSL(Eh, El, 14) ^ u64.rotrSL(Eh, El, 18) ^ u64.rotrBL(Eh, El, 41);
      //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
      const CHIh = (Eh & Fh) ^ (~Eh & Gh);
      const CHIl = (El & Fl) ^ (~El & Gl);
      // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
      // prettier-ignore
      const T1ll = u64.add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = u64.add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
      const sigma0h = u64.rotrSH(Ah, Al, 28) ^ u64.rotrBH(Ah, Al, 34) ^ u64.rotrBH(Ah, Al, 39);
      const sigma0l = u64.rotrSL(Ah, Al, 28) ^ u64.rotrBL(Ah, Al, 34) ^ u64.rotrBL(Ah, Al, 39);
      const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
      const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = u64.add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = u64.add3L(T1l, sigma0l, MAJl);
      Ah = u64.add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    // Add the compressed chunk to the current hash value
    ({ h: Ah, l: Al } = u64.add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = u64.add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = u64.add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = u64.add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = u64.add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = u64.add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = u64.add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = u64.add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  protected roundClean(): void {
    SHA512_W_H.fill(0);
    SHA512_W_L.fill(0);
  }
  destroy(): void {
    this.buffer.fill(0);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}

export class SHA512_224 extends SHA512 {
  // h -- high 32 bits, l -- low 32 bits
  protected Ah: number = 0x8c3d37c8 | 0;
  protected Al: number = 0x19544da2 | 0;
  protected Bh: number = 0x73e19966 | 0;
  protected Bl: number = 0x89dcd4d6 | 0;
  protected Ch: number = 0x1dfab7ae | 0;
  protected Cl: number = 0x32ff9c82 | 0;
  protected Dh: number = 0x679dd514 | 0;
  protected Dl: number = 0x582f9fcf | 0;
  protected Eh: number = 0x0f6d2b69 | 0;
  protected El: number = 0x7bd44da8 | 0;
  protected Fh: number = 0x77e36f73 | 0;
  protected Fl: number = 0x04c48942 | 0;
  protected Gh: number = 0x3f9d85a8 | 0;
  protected Gl: number = 0x6a1d36c8 | 0;
  protected Hh: number = 0x1112e6ad | 0;
  protected Hl: number = 0x91d692a1 | 0;

  constructor() {
    super();
    this.outputLen = 28;
  }
}

export class SHA512_256 extends SHA512 {
  // h -- high 32 bits, l -- low 32 bits
  protected Ah: number = 0x22312194 | 0;
  protected Al: number = 0xfc2bf72c | 0;
  protected Bh: number = 0x9f555fa3 | 0;
  protected Bl: number = 0xc84c64c2 | 0;
  protected Ch: number = 0x2393b86b | 0;
  protected Cl: number = 0x6f53b151 | 0;
  protected Dh: number = 0x96387719 | 0;
  protected Dl: number = 0x5940eabd | 0;
  protected Eh: number = 0x96283ee2 | 0;
  protected El: number = 0xa88effe3 | 0;
  protected Fh: number = 0xbe5e1e25 | 0;
  protected Fl: number = 0x53863992 | 0;
  protected Gh: number = 0x2b0199fc | 0;
  protected Gl: number = 0x2c85b8aa | 0;
  protected Hh: number = 0x0eb72ddc | 0;
  protected Hl: number = 0x81c52ca2 | 0;

  constructor() {
    super();
    this.outputLen = 32;
  }
}

export class SHA384 extends SHA512 {
  // h -- high 32 bits, l -- low 32 bits
  protected Ah: number = 0xcbbb9d5d | 0;
  protected Al: number = 0xc1059ed8 | 0;
  protected Bh: number = 0x629a292a | 0;
  protected Bl: number = 0x367cd507 | 0;
  protected Ch: number = 0x9159015a | 0;
  protected Cl: number = 0x3070dd17 | 0;
  protected Dh: number = 0x152fecd8 | 0;
  protected Dl: number = 0xf70e5939 | 0;
  protected Eh: number = 0x67332667 | 0;
  protected El: number = 0xffc00b31 | 0;
  protected Fh: number = 0x8eb44a87 | 0;
  protected Fl: number = 0x68581511 | 0;
  protected Gh: number = 0xdb0c2e0d | 0;
  protected Gl: number = 0x64f98fa7 | 0;
  protected Hh: number = 0x47b5481d | 0;
  protected Hl: number = 0xbefa4fa4 | 0;

  constructor() {
    super();
    this.outputLen = 48;
  }
}

/** SHA2-512 hash function. */
export const sha512: CHash = /* @__PURE__ */ wrapConstructor(() => new SHA512());
/** SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks. */
export const sha512_224: CHash = /* @__PURE__ */ wrapConstructor(() => new SHA512_224());
/** SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks. */
export const sha512_256: CHash = /* @__PURE__ */ wrapConstructor(() => new SHA512_256());
/** SHA2-384 hash function. */
export const sha384: CHash = /* @__PURE__ */ wrapConstructor(() => new SHA384());
