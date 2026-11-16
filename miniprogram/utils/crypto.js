// 本地「记住密码」的轻量混淆（XOR + base64 自实现）。
// 注意：这只是防止明文被随手翻到的混淆，不是真正的加密；
// 微信小程序沙箱内的 storage 本身有隔离，风险可接受。
const KEY = 'clothes-sort-mp';

function b64encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < str.length) {
    const c1 = str.charCodeAt(i++);
    const c2 = str.charCodeAt(i++);
    const c3 = str.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}

function b64decode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  str = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < str.length) {
    const e1 = chars.indexOf(str.charAt(i++));
    const e2 = chars.indexOf(str.charAt(i++));
    const e3 = chars.indexOf(str.charAt(i++));
    const e4 = chars.indexOf(str.charAt(i++));
    if (e1 < 0 || e2 < 0) break;
    const c1 = (e1 << 2) | (e2 >> 4);
    output += String.fromCharCode(c1);
    if (e3 !== 64 && e3 >= 0) {
      const c2 = ((e2 & 15) << 4) | (e3 >> 2);
      output += String.fromCharCode(c2);
      if (e4 !== 64 && e4 >= 0) {
        const c3 = ((e3 & 3) << 6) | e4;
        output += String.fromCharCode(c3);
      }
    }
  }
  return output;
}

// 先对字符串做 UTF-8 转字节（保证中文/特殊字符不丢失高字节），再 XOR
function strToUtf8Bytes(str) {
  const s = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
function utf8BytesToStr(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}

function xorBytes(bytes) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
  }
  return out;
}

function bytesToBinaryString(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
function binaryStringToBytes(s) {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function encode(plain) {
  try {
    return b64encode(bytesToBinaryString(xorBytes(strToUtf8Bytes(String(plain)))));
  } catch (e) {
    return '';
  }
}

function decode(cipher) {
  try {
    if (!cipher) return '';
    return utf8BytesToStr(xorBytes(binaryStringToBytes(b64decode(cipher))));
  } catch (e) {
    return '';
  }
}

module.exports = { encode, decode };
