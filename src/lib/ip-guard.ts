import { BlockList, isIP } from "node:net";

// Design Ref: §3.1 URL 안전 규칙 — 서버가 접속해도 되는 주소는 "인터넷에 공개된 일반 주소"뿐이다.
// Plan SC: 작업 12 (CHECK 2-7) — 내부·특수 주소 차단 목록. 이 목록에 들어 있거나 해석할 수 없으면 접속하지 않는다.

const blocked = new BlockList();

// IPv4: 자기 자신, 사설망, 링크로컬(클라우드 메타데이터 169.254.169.254 포함), 공유 주소(CGNAT), 문서용·시험용, 멀티캐스트, 예약
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
for (const [network, prefix] of BLOCKED_V4) blocked.addSubnet(network, prefix, "ipv4");

// IPv6: 자기 자신·미지정, NAT64(내부 IPv4로 이어질 수 있음), 폐기용, 시험용, 사설(ULA)·링크로컬·사이트로컬, 멀티캐스트, 6to4·Teredo
const BLOCKED_V6: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];
for (const [network, prefix] of BLOCKED_V6) blocked.addSubnet(network, prefix, "ipv6");

// `::ffff:127.0.0.1`처럼 IPv4를 IPv6 모양으로 쓴 주소는 안에 든 IPv4로 다시 검사한다.
function unwrapMappedV4(address: string): string | null {
  const match = /^(?:0{0,4}:){0,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address) ?? /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return match ? match[1] : null;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false; // IP 주소 모양이 아니면 허용하지 않는다.

  if (family === 6) {
    const mapped = unwrapMappedV4(address);
    if (mapped) return isPublicAddress(mapped);
    // 16진수로 쓴 매핑 주소(::ffff:7f00:1)도 막는다.
    if (/^(?:0{0,4}:){0,5}ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i.test(address)) return false;
    return !blocked.check(address, "ipv6");
  }

  return !blocked.check(address, "ipv4");
}
